// ============================================================
// Ledgerly - Settings & Backups Page
// Configuration, Category Management, JSON & Excel Backup/Restore
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Database,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  FileJson,
  Sliders,
  RotateCcw,
  Cloud,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/auth/AuthModal';
import { backupService } from '../services/backupService';
import { db } from '../db';
import type { AppSettings, BackupData } from '../types';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Card,
  Button,
  Input,
  Select,
  ConfirmDialog,
  Modal,
  LoadingSpinner,
  PageHeader,
} from '../components/ui';
import { cn } from '../utils';
import { loadDemoData, removeDemoData, hasDemoData } from '../utils/demoData';

export default function SettingsPage() {
  const { settings, updateSettings, theme, toggleTheme, refreshBankAccounts, setShowResetConfirm } = useApp();
  const { user, userName, updateUserName, isConfigured, lastSyncedAt } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [profileName, setProfileName] = useState(userName || '');

  useEffect(() => {
    setProfileName(userName || '');
  }, [userName]);

  const handleSaveProfileName = async () => {
    await updateUserName(profileName);
    showFeedback('Your name updated successfully!');
  };

  // Local lists for edits
  const [expenseCats, setExpenseCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');

  const [incomeSrcs, setIncomeSrcs] = useState<string[]>([]);
  const [newSrc, setNewSrc] = useState('');

  const [spentFors, setSpentFors] = useState<string[]>([]);
  const [newSpentFor, setNewSpentFor] = useState('');

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportData, setPendingImportData] = useState<BackupData | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // Clear data confirm
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    hasDemoData().then(setDemoLoaded);
  }, []);

  const handleLoadDemo = async () => {
    try {
      await loadDemoData();
      setDemoLoaded(true);
      showFeedback('Sample/Demo data loaded successfully!');
      await refreshBankAccounts();
      await loadDbStats();
    } catch (err) {
      console.error(err);
      showFeedback('Failed to load demo data', true);
    }
  };

  const handleRemoveDemo = async () => {
    try {
      await removeDemoData();
      setDemoLoaded(false);
      showFeedback('All sample/demo data removed cleanly!');
      await refreshBankAccounts();
      await loadDbStats();
    } catch (err) {
      console.error(err);
      showFeedback('Failed to remove demo data', true);
    }
  };

  // DB Stats
  const [dbStats, setDbStats] = useState({
    accounts: 0,
    businessLoans: 0,
    personalLoans: 0,
    expenses: 0,
    incomes: 0,
    transfers: 0,
    transactions: 0,
  });

  const loadDbStats = async () => {
    try {
      const [acc, bl, pl, exp, inc, tr, tx] = await Promise.all([
        db.bankAccounts.count(),
        db.businessLoans.count(),
        db.personalLoans.count(),
        db.expenses.count(),
        db.incomes.count(),
        db.bankTransfers.count(),
        db.transactions.count(),
      ]);
      setDbStats({
        accounts: acc,
        businessLoans: bl,
        personalLoans: pl,
        expenses: exp,
        incomes: inc,
        transfers: tr,
        transactions: tx,
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (settings) {
      setExpenseCats(settings.expenseCategories || []);
      setIncomeSrcs(settings.incomeSources || []);
      setSpentFors(settings.spentForOptions || []);
    }
    loadDbStats();
    hasDemoData().then(setDemoLoaded);

    const handleReset = () => {
      loadDbStats();
      hasDemoData().then(setDemoLoaded);
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [settings]);

  // Show status feedback
  const showFeedback = (text: string, isError = false) => {
    setStatusMsg({ text, isError });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // ── Expense Categories ──
  const handleAddCategory = async () => {
    if (!newCat.trim()) return;
    if (expenseCats.includes(newCat.trim())) {
      showFeedback('Category already exists', true);
      return;
    }
    const updated = [...expenseCats, newCat.trim()];
    setExpenseCats(updated);
    setNewCat('');
    await updateSettings({ expenseCategories: updated });
    showFeedback('Category added successfully');
  };

  const handleDeleteCategory = async (cat: string) => {
    const updated = expenseCats.filter((c) => c !== cat);
    setExpenseCats(updated);
    await updateSettings({ expenseCategories: updated });
    showFeedback(`Category "${cat}" removed`);
  };

  const handleMoveCategory = async (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= expenseCats.length) return;
    const copy = [...expenseCats];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    setExpenseCats(copy);
    await updateSettings({ expenseCategories: copy });
  };

  // ── Income Sources ──
  const handleAddSource = async () => {
    if (!newSrc.trim()) return;
    if (incomeSrcs.includes(newSrc.trim())) {
      showFeedback('Income source already exists', true);
      return;
    }
    const updated = [...incomeSrcs, newSrc.trim()];
    setIncomeSrcs(updated);
    setNewSrc('');
    await updateSettings({ incomeSources: updated });
    showFeedback('Income source added');
  };

  const handleDeleteSource = async (src: string) => {
    const updated = incomeSrcs.filter((s) => s !== src);
    setIncomeSrcs(updated);
    await updateSettings({ incomeSources: updated });
    showFeedback(`Source "${src}" removed`);
  };

  // ── Spent For Options ──
  const handleAddSpentFor = async () => {
    if (!newSpentFor.trim()) return;
    if (spentFors.includes(newSpentFor.trim())) {
      showFeedback('Option already exists', true);
      return;
    }
    const updated = [...spentFors, newSpentFor.trim()];
    setSpentFors(updated);
    setNewSpentFor('');
    await updateSettings({ spentForOptions: updated });
    showFeedback('Recipient option added');
  };

  const handleDeleteSpentFor = async (opt: string) => {
    const updated = spentFors.filter((s) => s !== opt);
    setSpentFors(updated);
    await updateSettings({ spentForOptions: updated });
    showFeedback(`Recipient "${opt}" removed`);
  };

  // ── JSON Backup Export ──
  const handleExportJSON = async () => {
    try {
      const data = await backupService.exportAll();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const filename = `ledgerly-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      saveAs(blob, filename);
      showFeedback('JSON backup successfully exported');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to export JSON backup', true);
    }
  };

  // ── Excel Export (Multi-Sheet) ──
  const handleExportExcel = async () => {
    try {
      const [accounts, bLoans, pLoans, expenses, incomes, txs] = await Promise.all([
        db.bankAccounts.toArray(),
        db.businessLoans.toArray(),
        db.personalLoans.toArray(),
        db.expenses.toArray(),
        db.incomes.toArray(),
        db.transactions.toArray(),
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Transactions
      const wsTxs = XLSX.utils.json_to_sheet(txs);
      XLSX.utils.book_append_sheet(wb, wsTxs, 'Transactions');

      // Sheet 2: Expenses
      const wsExp = XLSX.utils.json_to_sheet(expenses);
      XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

      // Sheet 3: Incomes
      const wsInc = XLSX.utils.json_to_sheet(incomes);
      XLSX.utils.book_append_sheet(wb, wsInc, 'Income');

      // Sheet 4: Business Loans
      const wsBL = XLSX.utils.json_to_sheet(bLoans);
      XLSX.utils.book_append_sheet(wb, wsBL, 'Business Loans');

      // Sheet 5: Personal Loans
      const wsPL = XLSX.utils.json_to_sheet(pLoans);
      XLSX.utils.book_append_sheet(wb, wsPL, 'Personal Loans');

      // Sheet 6: Bank Accounts
      const wsAcc = XLSX.utils.json_to_sheet(accounts);
      XLSX.utils.book_append_sheet(wb, wsAcc, 'Bank Accounts');

      const filename = `ledgerly-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);
      showFeedback('Excel spreadsheet exported successfully');
    } catch (err) {
      console.error(err);
      showFeedback('Failed to export Excel file', true);
    }
  };

  // ── File Import Handler ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!backupService.validateBackup(parsed)) {
          showFeedback('Invalid backup file format', true);
          return;
        }
        setPendingImportData(parsed);
        setShowImportConfirm(true);
      } catch (err) {
        showFeedback('Could not parse JSON file', true);
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Confirm Import ──
  const handleConfirmImport = async () => {
    if (!pendingImportData) return;
    try {
      const res = await backupService.importAll(pendingImportData);
      if (res.success) {
        showFeedback(res.message);
        setShowImportConfirm(false);
        setPendingImportData(null);
        await refreshBankAccounts();
        await loadDbStats();
      } else {
        showFeedback(res.message, true);
      }
    } catch (err) {
      console.error(err);
      showFeedback('Failed to restore backup', true);
    }
  };

  // ── Clear All Data ──
  const handleClearAll = async () => {
    try {
      await backupService.clearAllData();
      setShowClearConfirm(false);
      showFeedback('All application data cleared');
      await refreshBankAccounts();
      await loadDbStats();
    } catch (err) {
      console.error(err);
      showFeedback('Failed to clear data', true);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <PageHeader
        title="Settings & Data Management"
        description="Preferences, category customization, complete JSON & Excel backups, and database utilities."
      />

      {/* Status banner */}
      {statusMsg && (
        <div
          className={cn(
            'p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in',
            statusMsg.isError
              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          )}
        >
          {statusMsg.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Section 1: Appearance & Preferences */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Moon className="w-4 h-4 text-[var(--color-accent)]" />
          Appearance & Dashboard Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Your Name / Display Greeting */}
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 space-y-2 sm:col-span-2">
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">Your Name (Display Greeting)</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                Sets the top greeting banner (e.g. "Hi {profileName || '...'}, welcome").
              </p>
            </div>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Karthikeya"
                className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <Button size="sm" variant="primary" onClick={handleSaveProfileName}>
                Save Name
              </Button>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">Interface Theme</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">Currently: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={toggleTheme} icon={theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>

          {/* Default Date Range */}
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 space-y-1.5">
            <label className="font-semibold text-[var(--color-text-primary)] block">Default Dashboard Date Range</label>
            <select
              value={settings?.defaultDateRange || 'this_month'}
              onChange={(e) => updateSettings({ defaultDateRange: e.target.value as any })}
              className="w-full px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none"
            >
              <option value="this_month">This Month</option>
              <option value="previous_month">Previous Month</option>
              <option value="this_year">This Year</option>
              <option value="previous_year">Previous Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Section 2: Cloud Sync & Multi-Device */}
      <Card className="space-y-4 border-blue-500/20 bg-blue-500/5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Cloud className="w-4 h-4" />
            Cloud Sync &amp; Multi-Device Access
          </h3>
          <Button
            variant="primary"
            size="sm"
            icon={<Cloud className="w-3.5 h-3.5" />}
            onClick={() => setShowAuthModal(true)}
          >
            {user ? 'Manage Cloud Sync' : 'Sign In to Sync'}
          </Button>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)]">
          Connect your Supabase cloud account to sync and protect your ledger records with Row-Level Security.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Cloud Sync Status</p>
              <p className="text-[10px] text-zinc-500">{user ? 'Active & Synchronized' : 'Not Signed In'}</p>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Account</p>
              <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">{user ? user.email : 'Not Signed In'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 3: Backup & Restore */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          Complete Backup & Restoration
        </h3>
        <p className="text-xs text-[var(--color-text-tertiary)] -mt-2">
          Ledgerly runs completely offline with persistent IndexedDB storage. Export regular backups to secure your data forever.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Export JSON */}
          <button
            onClick={handleExportJSON}
            className="p-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-left transition-colors flex flex-col justify-between cursor-pointer shadow-xs"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center mb-2">
                <FileJson className="w-4 h-4" />
              </div>
              <p className="font-semibold text-xs text-zinc-950">Download JSON Backup</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Complete database snapshot for full restore.</p>
            </div>
            <span className="text-[11px] font-semibold text-zinc-900 mt-3 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Export JSON
            </span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="p-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-left transition-colors flex flex-col justify-between cursor-pointer shadow-xs"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center mb-2">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <p className="font-semibold text-xs text-zinc-950">Export Excel Spreadsheet</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Formatted multi-sheet workbook for accounting.</p>
            </div>
            <span className="text-[11px] font-semibold text-zinc-900 mt-3 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Export .xlsx
            </span>
          </button>

          {/* Import JSON */}
          <label className="p-3.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-left transition-colors flex flex-col justify-between cursor-pointer shadow-xs">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center mb-2">
                <Upload className="w-4 h-4" />
              </div>
              <p className="font-semibold text-xs text-zinc-950">Restore from Backup</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Upload a previously exported JSON backup file.</p>
            </div>
            <span className="text-[11px] font-semibold text-zinc-900 mt-3 inline-flex items-center gap-1">
              <Upload className="w-3 h-3" /> Select File
            </span>
          </label>
        </div>
      </Card>

      {/* Section 3: Expense Category Management */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-500" />
          Expense Categories
        </h3>

        <div className="flex gap-2">
          <Input
            placeholder="Add new category..."
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            className="flex-1 !py-1.5"
          />
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddCategory}>
            Add
          </Button>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto border border-[var(--color-border)] rounded-lg p-2">
          {expenseCats.map((cat, idx) => (
            <div
              key={cat}
              className="flex items-center justify-between p-2 rounded-md bg-[var(--color-bg-tertiary)]/50 text-xs"
            >
              <span className="font-medium text-[var(--color-text-primary)]">{cat}</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={idx === 0}
                  onClick={() => handleMoveCategory(idx, 'up')}
                  className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  disabled={idx === expenseCats.length - 1}
                  onClick={() => handleMoveCategory(idx, 'down')}
                  className="p-1 rounded hover:bg-[var(--color-bg-hover)] disabled:opacity-30"
                  title="Move Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500 ml-1"
                  title="Delete Category"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Section 4: Income Sources & Recipient Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Income Sources */}
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold">Income Sources</h3>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Consulting"
              value={newSrc}
              onChange={(e) => setNewSrc(e.target.value)}
              className="flex-1 !py-1.5"
            />
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddSource}>
              Add
            </Button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-2">
            {incomeSrcs.map((src) => (
              <div
                key={src}
                className="flex items-center justify-between p-2 rounded-md bg-[var(--color-bg-tertiary)]/50 text-xs"
              >
                <span className="font-medium text-[var(--color-text-primary)]">{src}</span>
                <button
                  onClick={() => handleDeleteSource(src)}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Recipients (Spent For) */}
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold">"Spent For" Options</h3>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Pets"
              value={newSpentFor}
              onChange={(e) => setNewSpentFor(e.target.value)}
              className="flex-1 !py-1.5"
            />
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddSpentFor}>
              Add
            </Button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg p-2">
            {spentFors.map((opt) => (
              <div
                key={opt}
                className="flex items-center justify-between p-2 rounded-md bg-[var(--color-bg-tertiary)]/50 text-xs"
              >
                <span className="font-medium text-[var(--color-text-primary)]">{opt}</span>
                <button
                  onClick={() => handleDeleteSpentFor(opt)}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Section 5: Database Statistics & System Info */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Database Health & Statistics
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Bank Accounts</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.accounts}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Business Loans</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.businessLoans}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Personal Loans</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.personalLoans}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Expenses Logged</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.expenses}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Incomes Logged</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.incomes}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Bank Transfers</p>
            <p className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">{dbStats.transfers}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
            <p className="text-[10px] text-[var(--color-text-tertiary)]">Transactions Total</p>
            <p className="text-base font-bold text-indigo-500 mt-0.5">{dbStats.transactions}</p>
          </div>
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">Ledgerly Engine</p>
              <p className="text-xs font-bold text-[var(--color-text-primary)] mt-0.5">v1.0.0 (IndexedDB)</p>
            </div>
            <img src="/logo-icon-light.png" alt="Ledgerly" className="w-6 h-6 object-contain block dark:hidden opacity-80" />
            <img src="/logo-icon-dark.png" alt="Ledgerly" className="w-6 h-6 object-contain hidden dark:block opacity-80" />
          </div>
        </div>
      </Card>

      {/* Section 6: Sample / Demo Data */}
      <Card className="space-y-3 border-indigo-500/20 bg-indigo-500/5">
        <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Sample / Demo Data
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Quickly populate Ledgerly with sample bank accounts, lending notebooks (matching your notebook examples), personal loans, and categorized expenses to explore all dashboard charts and analytics. You can completely remove all sample data at any time without touching your real data.
        </p>
        <div className="flex gap-2 pt-1">
          {!demoLoaded ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleLoadDemo}
              icon={<Plus className="w-3.5 h-3.5 text-indigo-500" />}
            >
              Load Sample Data
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRemoveDemo}
              icon={<Trash2 className="w-3.5 h-3.5 text-amber-500" />}
            >
              Remove Sample Data
            </Button>
          )}
        </div>
      </Card>

      {/* Section 7: Reset All Values */}
      <Card className="border-red-200 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset Lending & Expense Records
          </h3>
          <span className="text-[11px] font-semibold text-zinc-500 font-mono">
            {dbStats.accounts} Accounts Preserved · {dbStats.businessLoans} Loans · {dbStats.expenses} Expenses
          </span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          This resets all active lending entries, monthly interest notebooks, personal loans, daily expenses, and transactions to zero. <strong>Your bank accounts and their current balances are safely preserved.</strong>
        </p>
        <div className="pt-1">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset Register Values
          </Button>
        </div>
      </Card>

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setPendingImportData(null);
        }}
        onConfirm={handleConfirmImport}
        title="Confirm Backup Restoration"
        message={`Are you sure you want to restore this backup? It was exported at ${
          pendingImportData?.exportedAt || 'unknown'
        }. This will REPLACE all current application data with the backup file contents.`}
        confirmLabel="Restore & Replace"
        variant="danger"
      />

      {/* Confirm Clear All Data Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
        title="Delete ALL Application Data"
        message="This is irreversible! All records, loans, notebook registers, expenses, and bank balances will be erased completely. Proceed?"
        confirmLabel="Erase Everything"
        variant="danger"
      />

      {/* Cloud Sync & Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
