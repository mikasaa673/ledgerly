// ============================================================
// Ledgerly - Supabase Authentication & Session Context
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cloudSyncService } from '../services/cloudSyncService';
import { backupService } from '../services/backupService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userName: string;
  updateUserName: (name: string) => Promise<void>;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
  hasLocalData: boolean;
  migrateLocalToCloud: () => Promise<{ success: boolean; count: number; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('ledgerly_user_name') : '') || '';
  });
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('ledgerly_cloud_synced_at') : null;
  });
  const [hasLocalData, setHasLocalData] = useState(false);

  // Sync userName with user metadata
  useEffect(() => {
    if (user) {
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
      if (metaName) {
        setUserName(metaName);
        localStorage.setItem('ledgerly_user_name', metaName);
      }
    }
  }, [user]);

  const updateUserName = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    setUserName(trimmed);
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('ledgerly_user_name', trimmed);
      } else {
        localStorage.removeItem('ledgerly_user_name');
      }
    }
    if (supabase && user) {
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: trimmed,
            name: trimmed,
          },
        });
      } catch (err) {
        console.error('Failed to update name in Supabase:', err);
      }
    }
  }, [user]);

  // Check if local data exists
  const checkLocalData = useCallback(async () => {
    const exists = await cloudSyncService.hasLocalData();
    setHasLocalData(exists);
  }, []);

  // Sync data from cloud (bidirectional: push local changes, then pull updates)
  const syncNow = useCallback(async () => {
    if (!supabase || !user) return;
    setIsSyncing(true);
    try {
      // 1. Push any local changes to cloud first
      await cloudSyncService.pushLocalToCloud(user.id);
      // 2. Pull latest data from cloud
      const res = await cloudSyncService.pullFromCloud(user.id);
      if (res.success) {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        localStorage.setItem('ledgerly_cloud_synced_at', now);
      }
    } catch (err) {
      console.error('Failed to sync with cloud:', err);
    } finally {
      setIsSyncing(false);
      checkLocalData();
    }
  }, [user, checkLocalData]);

  // Migrate local records to cloud
  const migrateLocalToCloud = useCallback(async () => {
    if (!supabase || !user) {
      return { success: false, count: 0, error: 'Not logged in' };
    }
    setIsSyncing(true);
    try {
      const res = await cloudSyncService.migrateLocalDataToCloud(user.id);
      if (res.success) {
        const now = new Date().toISOString();
        setLastSyncedAt(now);
        localStorage.setItem('ledgerly_cloud_synced_at', now);
      }
      return res;
    } finally {
      setIsSyncing(false);
      checkLocalData();
    }
  }, [user, checkLocalData]);

  useEffect(() => {
    checkLocalData();

    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        cloudSyncService.hasLocalData().then(async (hasData) => {
          if (hasData) {
            await cloudSyncService.pushLocalToCloud(session.user.id).catch(console.error);
          }
          await cloudSyncService.pullFromCloud(session.user.id).catch(console.error);
        });
      }
    }).catch((err) => {
      console.error('Failed to get Supabase session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user && _event !== 'TOKEN_REFRESHED') {
        const hasData = await cloudSyncService.hasLocalData();
        if (hasData) {
          await cloudSyncService.pushLocalToCloud(session.user.id).catch(console.error);
        }
        await cloudSyncService.pullFromCloud(session.user.id);
      } else if (_event === 'SIGNED_OUT') {
        // Completely wipe local database and credentials for security on sign out
        await backupService.clearAllData();
        setUserName('');
        setLastSyncedAt(null);
        setHasLocalData(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
          window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkLocalData]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { success: false, error: 'Supabase is not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await cloudSyncService.pullFromCloud(data.user.id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign in' };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!supabase) return { success: false, error: 'Supabase is not configured' };
    try {
      const trimmedName = fullName?.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: trimmedName
          ? {
              data: {
                full_name: trimmedName,
                name: trimmedName,
              },
            }
          : undefined,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (trimmedName) {
        setUserName(trimmedName);
        localStorage.setItem('ledgerly_user_name', trimmedName);
      }

      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Account created! Please check your email to confirm your account, then sign in.',
        };
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
      }

      return { success: true, message: 'Account created and signed in successfully!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sign up' };
    }
  };

  const signOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setSession(null);
      setUserName('');

      // Wipe all local database tables for privacy and security on sign out
      await backupService.clearAllData();

      setLastSyncedAt(null);
      setHasLocalData(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
        window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return { success: false, error: 'Supabase is not configured' };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Password reset link sent! Check your email inbox.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send reset link' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userName,
        updateUserName,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        isSyncing,
        lastSyncedAt,
        syncNow,
        hasLocalData,
        migrateLocalToCloud,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
