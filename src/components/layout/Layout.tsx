// ============================================================
// Ledgerly - Clean White & Dark Layout Component
// ============================================================

import React, { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../auth/AuthModal';
import {
  Menu,
  RotateCcw,
  Download,
  CheckCircle2,
  Moon,
  Sun,
  Briefcase,
  Users,
  Landmark,
  BookOpen,
  LayoutDashboard,
  Cloud,
} from 'lucide-react';
import { formatCurrency, cn } from '../../utils';
import { Modal, Button } from '../ui';
import { backupService } from '../../services/backupService';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: '' },
  '/ledger': { title: 'Master Ledger & Audit Log', subtitle: '' },
  '/personal-lending': { title: 'Personal', subtitle: '' },
  '/expenses': { title: 'Expenses', subtitle: '' },
  '/income': { title: 'Income', subtitle: '' },
  '/bank-accounts': { title: 'Bank Accounts', subtitle: '' },
  '/settings': { title: 'Settings', subtitle: '' },
};

export default function Layout() {
  const {
    sidebarOpen,
    setSidebarOpen,
    bankAccounts,
    showResetConfirm,
    setShowResetConfirm,
    resetAllData,
    resetSelectiveData,
    theme,
    toggleTheme,
  } = useApp();
  const { user, userName } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const location = useLocation();

  const welcomeGreeting = userName
    ? `Hi ${userName}, welcome`
    : user
    ? `Hi ${user.email?.split('@')[0] || 'there'}, welcome`
    : 'Welcome to Ledgerly';

  const pageInfo = (location.pathname === '/' || location.pathname === '/business-lending')
    ? { title: welcomeGreeting, subtitle: '' }
    : pageTitles[location.pathname] || { title: 'Ledgerly', subtitle: 'Financial Management' };

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const [resetting, setResetting] = useState(false);
  const [backupBeforeReset, setBackupBeforeReset] = useState(true);
  const [resetSuccessToast, setResetSuccessToast] = useState(false);

  // Granular Reset Selection Checkboxes
  const [resetCategories, setResetCategories] = useState({
    businessLending: true,
    personalLending: true,
    expenses: true,
    income: true,
    bankTransfers: true,
  });

  const selectedCount = Object.values(resetCategories).filter(Boolean).length;

  const toggleAllCategories = (select: boolean) => {
    setResetCategories({
      businessLending: select,
      personalLending: select,
      expenses: select,
      income: select,
      bankTransfers: select,
    });
  };

  const handleConfirmReset = async () => {
    if (selectedCount === 0) return;
    setResetting(true);
    try {
      if (backupBeforeReset) {
        const data = await backupService.exportAll();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        saveAs(blob, `ledgerly-pre-reset-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`);
      }
      await resetSelectiveData(resetCategories);
      setShowResetConfirm(false);
      setResetSuccessToast(true);
      setTimeout(() => setResetSuccessToast(false), 5000);
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-150">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50/50 dark:bg-zinc-950">
        {/* Sleek Top Navigation Bar */}
        <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 bg-white dark:bg-zinc-900/90 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0 transition-colors duration-150">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="Toggle Menu Options"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Mobile Brand Logo Icon */}
            <div className="lg:hidden shrink-0 flex items-center">
              <img
                src="/logo-icon-light.png"
                alt="Ledgerly"
                className="w-7 h-7 object-contain block dark:hidden"
              />
              <img
                src="/logo-icon-dark.png"
                alt="Ledgerly"
                className="w-7 h-7 object-contain hidden dark:block"
              />
            </div>
            <div className="min-w-0">
              <h2 className={cn(
                "tracking-tight text-zinc-950 dark:text-zinc-50 truncate",
                location.pathname === '/' || location.pathname === '/business-lending'
                  ? "text-base sm:text-xl md:text-2xl lg:text-[1.75rem] font-black"
                  : "text-sm sm:text-base md:text-lg font-bold"
              )}>
                {pageInfo.title}
              </h2>
              {pageInfo.subtitle ? (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block truncate">
                  {pageInfo.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Bank Balance Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium hidden md:inline">Total Balance:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num text-[11px] sm:text-xs">{formatCurrency(totalBankBalance)}</span>
            </div>

            {/* Cloud Sync Button */}
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title={user ? `Signed in as ${user.email} (Click to manage sync)` : 'Sign in to sync your ledger'}
            >
              <Cloud className={cn("w-3.5 h-3.5", user ? "text-emerald-500" : "text-blue-500")} />
              <span className="hidden sm:inline">{user ? 'Synced' : 'Cloud Sync'}</span>
            </button>

            {/* Quick Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Quick Reset Option Button */}
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-red-50 hover:border-red-200 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-red-950/40 dark:hover:border-red-900/60 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Reset all current values and start fresh"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset Values</span>
            </button>
          </div>
        </header>

        {/* Global Reset Success Toast */}
        {resetSuccessToast && (
          <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Selected register data has been reset. Your bank accounts and account balances remain 100% preserved.</span>
            </div>
            <button
              onClick={() => setResetSuccessToast(false)}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 font-bold ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          <div className="w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Visible only on mobile/tablet < lg) */}
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200/90 dark:border-zinc-800 px-1 py-1 flex items-center justify-around shadow-lg pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        >
          <NavLink
            to="/"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-[52px]",
              (isActive || location.pathname === '/business-lending')
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <Briefcase className="w-4 h-4 mb-0.5" />
            <span>Business</span>
          </NavLink>

          <NavLink
            to="/personal-lending"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-[52px]",
              isActive
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span>Personal</span>
          </NavLink>

          <NavLink
            to="/bank-accounts"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-[52px]",
              isActive
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <Landmark className="w-4 h-4 mb-0.5" />
            <span>Banks</span>
          </NavLink>

          <NavLink
            to="/ledger"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-[52px]",
              isActive
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span>Ledger</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-[52px]",
              isActive
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Dashboard</span>
          </NavLink>
        </nav>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Financial Data"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
              <p className="font-bold text-zinc-950 dark:text-zinc-50 text-sm">
                Select What to Reset
              </p>
              <p>
                Choose the individual sections you wish to reset. Unchecked categories will remain completely untouched.
              </p>
            </div>
          </div>

          {/* Explicit Assurance: Bank accounts & balance are preserved */}
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Bank accounts & balances will NEVER be removed or altered</span>
            </div>
            <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 pl-5">
              All {bankAccounts.length} active bank {bankAccounts.length === 1 ? 'account' : 'accounts'} and your current combined balance of <strong>{formatCurrency(totalBankBalance)}</strong> will remain 100% intact.
            </p>
          </div>

          {/* Quick Select / Deselect All */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Select sections ({selectedCount} of 5 selected):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllCategories(true)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold cursor-pointer underline"
              >
                Select All
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button
                type="button"
                onClick={() => toggleAllCategories(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 font-semibold cursor-pointer underline"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Category Checkboxes List */}
          <div className="space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50/60 dark:bg-zinc-900/60">
            {/* 1. Business Lending */}
            <label className="flex items-start gap-3 p-2 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetCategories.businessLending}
                onChange={(e) =>
                  setResetCategories((prev) => ({ ...prev, businessLending: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Business Lending
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  All business loans, monthly interest notebooks, interest collections, and principal repayment records.
                </span>
              </div>
            </label>

            {/* 2. Personal Lending */}
            <label className="flex items-start gap-3 p-2 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetCategories.personalLending}
                onChange={(e) =>
                  setResetCategories((prev) => ({ ...prev, personalLending: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Personal Lending
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  All interest-free personal loans to friends & family and repayment history.
                </span>
              </div>
            </label>

            {/* 3. Daily Expenses */}
            <label className="flex items-start gap-3 p-2 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetCategories.expenses}
                onChange={(e) =>
                  setResetCategories((prev) => ({ ...prev, expenses: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Daily Expenses
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  All logged expense items across personal, Sarayu, family & other categories.
                </span>
              </div>
            </label>

            {/* 4. Income */}
            <label className="flex items-start gap-3 p-2 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetCategories.income}
                onChange={(e) =>
                  setResetCategories((prev) => ({ ...prev, income: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Income Entries
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  All recorded salary logs, gifts, freelancing, and custom income entries.
                </span>
              </div>
            </label>

            {/* 5. Bank Transfers */}
            <label className="flex items-start gap-3 p-2 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetCategories.bankTransfers}
                onChange={(e) =>
                  setResetCategories((prev) => ({ ...prev, bankTransfers: e.target.checked }))
                }
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                  Bank Transfers
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Historical internal transfer logs between your bank accounts.
                </span>
              </div>
            </label>
          </div>

          {/* Automatic JSON Backup Checkbox */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 pr-2">
              <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
              <span className="text-zinc-700 dark:text-zinc-200 font-medium">Download JSON backup before resetting</span>
            </div>
            <input
              type="checkbox"
              checked={backupBeforeReset}
              onChange={(e) => setBackupBeforeReset(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600 text-zinc-950 focus:ring-zinc-950 cursor-pointer h-4 w-4"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="secondary"
              size="sm"
              disabled={resetting}
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={resetting || selectedCount === 0}
              onClick={handleConfirmReset}
            >
              {resetting
                ? 'Resetting...'
                : selectedCount === 0
                ? 'Select a Section'
                : `Reset Selected (${selectedCount})`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cloud Sync & Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
