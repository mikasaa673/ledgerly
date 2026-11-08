// ============================================================
// Ledgerly - Full Screen Authentication Gate (Login & Register)
// Protects the financial application behind required login
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { updateSupabaseConfig, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Key,
  Moon,
  Sun,
  Briefcase,
} from 'lucide-react';
import { Button } from '../components/ui';

export default function LoginPage() {
  const { signIn, signUp, resetPassword, isConfigured } = useAuth();
  const { theme, toggleTheme } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'config'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
          setSuccessMsg('Signed in successfully! Loading your ledger...');
        } else {
          setErrorMsg(res.error || 'Failed to sign in. Check your email and password.');
        }
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          setErrorMsg('Please enter your name');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long');
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
          setSuccessMsg(res.message || 'Account created successfully! Loading your ledger...');
          if (res.message?.includes('check your email')) {
            setMode('signin');
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

  const handleSaveConfig = () => {
    updateSupabaseConfig(customUrl, customKey);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-150 p-4 sm:p-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full pt-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-dark.png"
            alt="Ledgerly"
            className="w-8 h-8 object-contain block dark:hidden"
          />
          <img
            src="/logo-light.png"
            alt="Ledgerly"
            className="w-8 h-8 object-contain hidden dark:block"
          />
          <span className="font-bold text-base tracking-tight text-zinc-950 dark:text-zinc-50">
            Ledgerly
          </span>
        </div>

        <button
          onClick={toggleTheme}
          type="button"
          className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer shadow-2xs transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-xs">
          {/* Brand & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 mb-3 border border-zinc-200/60 dark:border-zinc-700/60">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              {mode === 'signup'
                ? 'Create Your Account'
                : mode === 'forgot'
                ? 'Reset Password'
                : mode === 'config'
                ? 'Cloud Connection Config'
                : 'Sign In to Ledgerly'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {mode === 'signup'
                ? 'Set up your credentials to sync your ledger across devices'
                : mode === 'forgot'
                ? 'Enter your email to receive a password reset link'
                : mode === 'config'
                ? 'Configure Supabase URL & public anon key'
                : 'Your private financial notebook, safely protected with encryption'}
            </p>
          </div>

          {/* Mode Tabs */}
          {mode !== 'forgot' && mode !== 'config' && (
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-1 mb-5">
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
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================
              CONFIG TAB
              ============================================================ */}
          {mode === 'config' ? (
            <div className="space-y-4">
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
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveConfig}>
                  Save &amp; Reload
                </Button>
              </div>
            </div>
          ) : (
            /* ============================================================
                LOGIN / REGISTER FORM
                ============================================================ */
            <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    placeholder="you@example.com"
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

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Confirm Password
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

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full text-xs font-bold mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Verifying...'
                  : mode === 'signin'
                  ? 'Sign In to Ledger'
                  : mode === 'signup'
                  ? 'Create Free Account'
                  : 'Send Reset Link'}
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
            </form>
          )}

          {/* Security Guarantee */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Protected by Row-Level Security (RLS). Only your account can view your ledger.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-2 text-[11px] text-zinc-400 dark:text-zinc-600">
        Ledgerly Financial Management &bull; Private &amp; Cloud Synchronized
      </div>
    </div>
  );
}
