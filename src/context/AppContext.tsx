// ============================================================
// Ledgerly - App Context (Theme, Settings, Bank Accounts)
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppSettings, BankAccount } from '../types';
import { db, initializeSettings } from '../db';
import { bankAccountService } from '../services';
import { backupService, type ResetOptions } from '../services/backupService';
import { useLiveQuery } from 'dexie-react-hooks';

interface AppContextType {
  settings: AppSettings | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  bankAccounts: (BankAccount & { currentBalance: number })[];
  refreshBankAccounts: () => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  resetAllData: (keepBankAccounts?: boolean) => Promise<void>;
  resetSelectiveData: (options: ResetOptions) => Promise<void>;
  showResetConfirm: boolean;
  setShowResetConfirm: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ledgerly_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [bankAccounts, setBankAccounts] = useState<(BankAccount & { currentBalance: number })[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Initialize settings on mount
  useEffect(() => {
    initializeSettings().then((s) => {
      setSettings(s);
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('ledgerly_theme') : null;
      if (!local && s.theme) {
        const resolvedTheme = s.theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : s.theme;
        setThemeState(resolvedTheme);
      }
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ledgerly_theme', theme);
    }
  }, [theme]);

  // Load bank accounts
  const refreshBankAccounts = useCallback(async () => {
    const accounts = await bankAccountService.getAllWithBalances();
    setBankAccounts(accounts);
  }, []);

  useEffect(() => {
    refreshBankAccounts();
  }, [refreshBankAccounts]);

  useEffect(() => {
    const handleReset = async () => {
      await refreshBankAccounts();
      const freshSettings = await db.settings.get('app_settings');
      if (freshSettings) setSettings(freshSettings);
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [refreshBankAccounts]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      db.settings.update('app_settings', { theme: next, updatedAt: new Date().toISOString() });
      return next;
    });
  }, []);

  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    db.settings.update('app_settings', { theme: t, updatedAt: new Date().toISOString() });
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    await db.settings.update('app_settings', { ...updates, updatedAt: new Date().toISOString() });
    const updated = await db.settings.get('app_settings');
    if (updated) setSettings(updated);
  }, []);

  const resetSelectiveData = useCallback(async (options: ResetOptions) => {
    await backupService.resetSelective(options);
    await refreshBankAccounts();
    const freshSettings = await db.settings.get('app_settings');
    if (freshSettings) setSettings(freshSettings);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
      window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
    }
  }, [refreshBankAccounts]);

  const resetAllData = useCallback(async (keepBankAccounts = true) => {
    await backupService.resetFinancialValues(keepBankAccounts);
    await refreshBankAccounts();
    const freshSettings = await db.settings.get('app_settings');
    if (freshSettings) setSettings(freshSettings);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
      window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
    }
  }, [refreshBankAccounts]);

  return (
    <AppContext.Provider value={{
      settings,
      theme,
      toggleTheme,
      setTheme,
      updateSettings,
      bankAccounts,
      refreshBankAccounts,
      sidebarOpen,
      setSidebarOpen,
      resetAllData,
      resetSelectiveData,
      showResetConfirm,
      setShowResetConfirm,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
