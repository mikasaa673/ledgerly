// ============================================================
// Ledgerly - Supabase Authentication & Cloud Sync Modal
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateSupabaseConfig, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import {
  Modal,
  Button,
  Input,
  Card,
  Badge,
} from '../ui';
import {
  Cloud,
  CloudCheck,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Database,
  ArrowUpRight,
  Key,
  ShieldCheck,
  Smartphone,
  Laptop,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const {
    user,
    userName,
    loading,
    isConfigured,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isSyncing,
    lastSyncedAt,
    syncNow,
    hasLocalData,
    migrateLocalToCloud,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'config'>('signin');
  const [fullName, setFullName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  // Manual configuration fields
  const [customUrl, setCustomUrl] = useState(supabaseUrl);
  const [customKey, setCustomKey] = useState(supabaseAnonKey);

  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address');
      return;
    }

    if (mode !== 'forgot' && !password) {
      setErrorMsg('Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.success) {
          setSuccessMsg('Signed in successfully! Syncing your data...');
          setTimeout(() => {
            onClose();
            resetForm();
          }, 1200);
        } else {
          setErrorMsg(res.error || 'Failed to sign in');
        }
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          setErrorMsg('Please enter your name');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters');
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match. Please re-enter your password correctly.');
          setIsSubmitting(false);
          return;
        }
        const res = await signUp(email, password, fullName.trim());
        if (res.success) {
          setSuccessMsg(res.message || 'Account created successfully!');
          if (res.message?.includes('check your email')) {
            setMode('signin');
          } else {
            setTimeout(() => {
              onClose();
              resetForm();
            }, 1200);
          }
        } else {
          setErrorMsg(res.error || 'Failed to create account');
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (res.success) {
          setSuccessMsg(res.message || 'Password reset link sent to your email.');
          setMode('signin');
        } else {
          setErrorMsg(res.error || 'Failed to send reset link');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMigrate = async () => {
    setIsSubmitting(true);
    setMigrationStatus('Uploading local data to your cloud account...');
    try {
      const res = await migrateLocalToCloud();
      if (res.success) {
        setMigrationStatus(`Successfully uploaded ${res.count} records to your cloud account!`);
      } else {
        setErrorMsg(res.error || 'Failed to upload records');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Migration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveConfig = () => {
    updateSupabaseConfig(customUrl, customKey);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Cloud Sync & Account' : 'Sign In to Sync Across Devices'}
      size="md"
    >
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-icon-light.png"
              alt="Ledgerly"
              className="w-8 h-8 object-contain block dark:hidden"
            />
            <img
              src="/logo-icon-dark.png"
              alt="Ledgerly"
              className="w-8 h-8 object-contain hidden dark:block"
            />
            <div>
              <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 leading-tight">
                Ledgerly Cloud Sync
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Use Ledgerly across Phone &amp; Laptop seamlessly
              </p>
            </div>
          </div>

          {user && (
            <Badge variant="success" className="text-[10px]">
              Connected
            </Badge>
          )}
        </div>

        {/* ============================================================
            LOGGED IN VIEW
            ============================================================ */}
        {user ? (
          <div className="space-y-4">
            {/* Account Card */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Signed in as
                </span>
                <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50 truncate block mt-0.5">
                  {userName ? `${userName} (${user.email})` : user.email}
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    {lastSyncedAt
                      ? `Last synced: ${format(new Date(lastSyncedAt), 'dd MMM yyyy, HH:mm')}`
                      : 'Sync ready'}
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                onClick={syncNow}
                disabled={isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            {/* Sync Features Highlight */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Syncs with Phone</span>
              </div>
              <div className="p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Syncs with Laptop</span>
              </div>
            </div>

            {/* Local Data Upload Prompt */}
            {hasLocalData && (
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 space-y-2">
                <div className="flex items-start gap-2">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Existing Local Records Found
                    </h5>
                    <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 mt-0.5">
                      Upload your current bank accounts, loans, and passbook entries to your cloud account so they appear on your phone too.
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleMigrate}
                  disabled={isSubmitting}
                  className="w-full text-xs"
                >
                  {isSubmitting ? 'Uploading to Cloud...' : 'Upload Local Data to Cloud'}
                </Button>

                {migrationStatus && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 text-center">
                    {migrationStatus}
                  </p>
                )}
              </div>
            )}

            {/* Sign Out Button */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <Button
                variant="danger"
                size="sm"
                icon={<LogOut className="w-3.5 h-3.5" />}
                onClick={signOut}
              >
                Sign Out
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* ============================================================
             AUTH FORM (SIGN IN / SIGN UP)
             ============================================================ */
          <div className="space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-1">
              <button
                type="button"
                onClick={() => { setMode('signin'); resetForm(); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); resetForm(); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => { setMode('config'); resetForm(); }}
                className={`px-2 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  mode === 'config'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
                title="Supabase API Keys"
              >
                <Key className="w-3 h-3" />
                <span>Config</span>
              </button>
            </div>

            {/* Feedback Messages */}
            {errorMsg && (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* ============================================================
                CONFIG TAB (Paste Supabase Keys)
                ============================================================ */}
            {mode === 'config' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">
                    Connect to your Free Supabase Project
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    1. Create a free account at{' '}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-semibold"
                    >
                      supabase.com
                    </a>
                    .<br />
                    2. Go to <strong>Project Settings &rarr; API</strong>, and copy your Project URL &amp; anon key.<br />
                    3. Run the schema from <code>supabase/schema.sql</code> in the SQL editor.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode('signin')}>
                    Back
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveConfig}>
                    Save &amp; Connect
                  </Button>
                </div>
              </div>
            ) : (
              /* ============================================================
                  STANDARD LOGIN / REGISTER FORM
                  ============================================================ */
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Karthikeya"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="karthikeya@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); resetForm(); }}
                          className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirm Password (Sign Up only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Confirm Password (Re-enter Password)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full text-xs font-bold mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Processing...'
                    : mode === 'signin'
                    ? 'Sign In to Ledgerly'
                    : mode === 'signup'
                    ? 'Create Free Account'
                    : 'Send Password Reset Link'}
                </Button>

                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); resetForm(); }}
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer pt-1"
                  >
                    Back to Sign In
                  </button>
                )}

                {/* Device sync reminder */}
                <p className="text-[10px] text-center text-zinc-400 dark:text-zinc-500 pt-2">
                  <ShieldCheck className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-emerald-500" />
                  Your data is protected with Row-Level Security. Only you can access your ledger.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
