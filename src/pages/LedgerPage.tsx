// ============================================================
// Ledgerly - Master Ledger & Activity Audit Log Page
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Layers,
  ArrowLeftRight,
  TrendingUp,
  Receipt,
  Users,
  Briefcase,
  Landmark,
  FileSpreadsheet,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatCard,
  Button,
  Input,
  Select,
  Badge,
  EmptyState,
  LoadingSpinner,
  Tabs,
  Modal,
  ConfirmDialog,
} from '../components/ui';
import { useApp } from '../context/AppContext';
import { activityLogService } from '../services/activityLogService';
import type { ActivityLog, ActivityModule } from '../types';
import { formatCurrency, formatDate, todayISO, cn } from '../utils';
import { BankLogo } from '../utils/bankLogos';
import { subMonths, startOfYear, endOfMonth, parseISO, format } from 'date-fns';

type DateFilterType = 'all_time' | 'this_month' | 'previous_month' | 'this_year';
type ViewMode = 'table' | 'timeline';

export default function LedgerPage() {
  const { bankAccounts, theme } = useApp();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<ActivityModule | 'all'>('all');
  const [selectedFlow, setSelectedFlow] = useState<'all' | 'credit' | 'debit' | 'neutral'>('all');
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all_time');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<ActivityLog | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load and sync activities
  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      // First ensure historical transactions are backfilled into activity logs
      await activityLogService.syncFromExistingData();

      // Fetch all activity logs
      const all = await activityLogService.getAll();
      setLogs(all);
    } catch (err) {
      console.error('Failed to load ledger activities:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmDeleteLog = useCallback(async () => {
    const target = logToDelete;
    if (!target) return;
    const targetId = target.id;

    setIsDeleting(true);
    setLogToDelete(null);
    if (selectedLog?.id === targetId) {
      setSelectedLog(null);
    }
    // Optimistically remove from state immediately so UI updates instantly
    setLogs((prev) => prev.filter((l) => l.id !== targetId));

    try {
      await activityLogService.delete(targetId);
      const all = await activityLogService.getAll();
      setLogs(all);
    } catch (err) {
      console.error('Failed to delete log entry:', err);
      await loadActivities();
    } finally {
      setIsDeleting(false);
    }
  }, [logToDelete, selectedLog, loadActivities]);

  const handleConfirmClearAll = useCallback(async () => {
    setIsDeleting(true);
    setShowClearAllConfirm(false);
    setSelectedLog(null);
    setLogs([]);

    try {
      await activityLogService.clearAll();
      const all = await activityLogService.getAll();
      setLogs(all);
    } catch (err) {
      console.error('Failed to clear ledger:', err);
      await loadActivities();
    } finally {
      setIsDeleting(false);
    }
  }, [loadActivities]);

  useEffect(() => {
    loadActivities();

    const handleUpdate = () => {
      loadActivities();
    };

    const handleDeleted = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setLogs((prev) => prev.filter((l) => l.id !== deletedId));
      } else {
        activityLogService.getAll().then(setLogs);
      }
    };

    window.addEventListener('ledgerly-activity-recorded', handleUpdate);
    window.addEventListener('ledgerly-statement-reset', handleUpdate);
    window.addEventListener('ledgerly-data-reset', handleUpdate);
    window.addEventListener('ledgerly-income-updated', handleUpdate);
    window.addEventListener('ledgerly-activity-deleted', handleDeleted);

    return () => {
      window.removeEventListener('ledgerly-activity-recorded', handleUpdate);
      window.removeEventListener('ledgerly-statement-reset', handleUpdate);
      window.removeEventListener('ledgerly-data-reset', handleUpdate);
      window.removeEventListener('ledgerly-income-updated', handleUpdate);
      window.removeEventListener('ledgerly-activity-deleted', handleDeleted);
    };
  }, [loadActivities]);

  // Date range calculation
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case 'this_month': {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return { start: `${y}-${m}-01`, end: `${y}-${m}-31` };
      }
      case 'previous_month': {
        const prev = subMonths(now, 1);
        const y = prev.getFullYear();
        const m = String(prev.getMonth() + 1).padStart(2, '0');
        return { start: `${y}-${m}-01`, end: `${y}-${m}-31` };
      }
      case 'this_year': {
        const y = now.getFullYear();
        return { start: `${y}-01-01`, end: `${y}-12-31` };
      }
      case 'all_time':
      default:
        return null;
    }
  }, [dateFilter]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Module filter
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false;
      }

      // Flow filter
      if (selectedFlow !== 'all' && log.flow !== selectedFlow) {
        return false;
      }

      // Bank account filter
      if (selectedBankId !== 'all') {
        if (log.bankAccountId !== selectedBankId && log.secondaryBankAccountId !== selectedBankId) {
          return false;
        }
      }

      // Date range filter
      if (dateRange) {
        if (log.date < dateRange.start || log.date > dateRange.end) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchPerson = log.personName?.toLowerCase().includes(q);
        const matchBank = log.bankAccountName?.toLowerCase().includes(q);
        const matchCategory = log.category?.toLowerCase().includes(q);
        const matchAmount = log.amount !== undefined && String(log.amount).includes(q);
        if (!matchTitle && !matchDesc && !matchPerson && !matchBank && !matchCategory && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedModule, selectedFlow, selectedBankId, dateRange, searchQuery]);

  // Summary statistics for filtered records
  const stats = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;

    for (const log of filteredLogs) {
      if (log.flow === 'credit' && log.amount) {
        totalCredit += log.amount;
      } else if (log.flow === 'debit' && log.amount) {
        totalDebit += log.amount;
      }
    }

    return {
      totalCredit,
      totalDebit,
      netFlow: totalCredit - totalDebit,
      totalCount: filteredLogs.length,
    };
  }, [filteredLogs]);

  // Module Counts for tab badges
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: logs.length,
      business_lending: 0,
      personal_lending: 0,
      expense: 0,
      income: 0,
      bank_transfer: 0,
      bank_account: 0,
    };

    logs.forEach((l) => {
      if (counts[l.module] !== undefined) {
        counts[l.module]++;
      }
    });

    return counts;
  }, [logs]);

  // Account lookup for BankLogo
  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof bankAccounts)[0]>();
    bankAccounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [bankAccounts]);

  const handleExportCsv = () => {
    activityLogService.exportToCsv(filteredLogs);
  };

  const getModuleBadge = (mod: ActivityModule) => {
    switch (mod) {
      case 'business_lending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
            <Briefcase className="w-3 h-3" />
            Business
          </span>
        );
      case 'personal_lending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40">
            <Users className="w-3 h-3" />
            Personal
          </span>
        );
      case 'expense':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40">
            <Receipt className="w-3 h-3" />
            Expense
          </span>
        );
      case 'income':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
            <TrendingUp className="w-3 h-3" />
            Income
          </span>
        );
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
            <ArrowLeftRight className="w-3 h-3" />
            Transfer
          </span>
        );
      case 'bank_account':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-900/40">
            <Landmark className="w-3 h-3" />
            Banking
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            System
          </span>
        );
    }
  };

  const formatActivityTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = parseISO(isoString);
      return format(d, 'dd MMM yyyy, hh:mm a');
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Audit Ledger & Activity Log"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={loadActivities}
              title="Refresh Ledger"
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setShowClearAllConfirm(true)}
              disabled={logs.length === 0}
            >
              Clear Logs
            </Button>
          </div>
        }
      />

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Inflow (Credits)"
          value={formatCurrency(stats.totalCredit)}
          subtitle="Collections & income received"
          valueClassName="text-base sm:text-lg xl:text-xl text-emerald-600 dark:text-emerald-400"
          icon={<ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <StatCard
          label="Total Outflow (Debits)"
          value={formatCurrency(stats.totalDebit)}
          subtitle="Lending & expenses spent"
          valueClassName="text-base sm:text-lg xl:text-xl text-rose-600 dark:text-rose-400"
          icon={<ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
        />
        <StatCard
          label="Net Flow In Period"
          value={formatCurrency(stats.netFlow)}
          subtitle="Inflow minus Outflow"
          valueClassName={cn(
            'text-base sm:text-lg xl:text-xl',
            stats.netFlow >= 0 ? 'text-zinc-950 dark:text-zinc-50' : 'text-rose-600 dark:text-rose-400'
          )}
          icon={<FileSpreadsheet className="w-4 h-4 text-zinc-500" />}
        />
        <StatCard
          label="Activities Recorded"
          value={String(stats.totalCount)}
          subtitle={`${logs.length} lifetime audit entries`}
          valueClassName="text-base sm:text-lg xl:text-xl"
          icon={<BookOpen className="w-4 h-4 text-zinc-500" />}
        />
      </div>

      {/* Filter and View Controls Bar */}
      <Card className="p-4 space-y-4">
        {/* Module Selector Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <Tabs
            tabs={[
              { key: 'all', label: 'All Activities', count: moduleCounts.all },
              { key: 'business_lending', label: 'Business Lending', count: moduleCounts.business_lending },
              { key: 'personal_lending', label: 'Personal Lending', count: moduleCounts.personal_lending },
              { key: 'expense', label: 'Expenses', count: moduleCounts.expense },
              { key: 'income', label: 'Income', count: moduleCounts.income },
              { key: 'bank_transfer', label: 'Transfers', count: moduleCounts.bank_transfer },
            ]}
            activeTab={selectedModule}
            onChange={(key) => setSelectedModule(key as any)}
          />

          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                viewMode === 'table'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
              )}
            >
              Passbook Table
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
              )}
            >
              Timeline Feed
            </button>
          </div>
        </div>

        {/* Secondary Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Query */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by description, person, bank, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-base sm:text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Flow Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value as any)}
              className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all">All Cash Flows</option>
              <option value="credit">Money In (+ Credit)</option>
              <option value="debit">Money Out (- Debit)</option>
              <option value="neutral">Actions / Updates</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="lg:col-span-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all_time">All Time</option>
              <option value="this_month">This Month</option>
              <option value="previous_month">Previous Month</option>
              <option value="this_year">This Year</option>
            </select>
          </div>

          {/* Bank Account Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all">All Bank Accounts</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nickname} ({acc.bankName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Main Ledger Content */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No activity records found"
          description={
            searchQuery || selectedModule !== 'all' || selectedFlow !== 'all'
              ? 'Try adjusting your search query or filters to see more entries.'
              : 'Activities will automatically appear in this master ledger as you use Ledgerly.'
          }
          action={
            (searchQuery || selectedModule !== 'all' || selectedFlow !== 'all' || selectedBankId !== 'all') ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedModule('all');
                  setSelectedFlow('all');
                  setSelectedBankId('all');
                  setDateFilter('all_time');
                }}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'table' ? (
        /* ============================================================
           Passbook Table View
           ============================================================ */
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-zinc-50/50 dark:bg-zinc-800/40 border-b border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Transaction Passbook</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 sm:hidden">Swipe to see amounts &rarr;</span>
          </div>
          {/* Mobile Passbook Cards (md:hidden) */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredLogs.map((log) => {
              const account = log.bankAccountId ? accountMap.get(log.bankAccountId) : undefined;
              return (
                <div
                  key={`m-log-${log.id}`}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 space-y-2 bg-white dark:bg-zinc-900 cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-800/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 font-mono-num">
                          {formatDate(log.date)}
                        </span>
                        {log.timestamp && log.timestamp.includes('T') && (
                          <span className="text-[10px] text-zinc-400 font-mono-num">
                            {log.timestamp.split('T')[1].slice(0, 5)}
                          </span>
                        )}
                        {getModuleBadge(log.module)}
                      </div>
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-zinc-50 mt-1 leading-snug">
                        {log.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      {log.flow === 'credit' && log.amount !== undefined ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-num text-sm block">
                          +{formatCurrency(log.amount)}
                        </span>
                      ) : log.flow === 'debit' && log.amount !== undefined ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono-num text-sm block">
                          −{formatCurrency(log.amount)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 font-mono-num">—</span>
                      )}
                    </div>
                  </div>

                  {log.description && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {log.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                      {account ? `${account.nickname} (${account.bankName})` : 'Direct / Cash'}
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700"
                        title="View Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogToDelete(log)}
                        className="p-1 rounded text-rose-500 hover:text-rose-700"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Date &amp; Time</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Category</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Activity &amp; Description</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Bank Account</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right">Credit (+)</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right">Debit (−)</th>
                  <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                {filteredLogs.map((log) => {
                  const account = log.bankAccountId ? accountMap.get(log.bankAccountId) : undefined;
                  const secAccount = log.secondaryBankAccountId ? accountMap.get(log.secondaryBankAccountId) : undefined;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 whitespace-nowrap">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                          {formatDate(log.date)}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono-num">
                          {log.timestamp && log.timestamp.includes('T') ? log.timestamp.split('T')[1].slice(0, 5) : ''}
                        </span>
                      </td>

                      {/* Module Badge */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 whitespace-nowrap">
                        {getModuleBadge(log.module)}
                      </td>

                      {/* Activity & Description */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 min-w-[220px] sm:min-w-[260px] max-w-md">
                        <span className="font-bold text-zinc-950 dark:text-zinc-50 block leading-tight">
                          {log.title}
                        </span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                          {log.description}
                        </p>
                      </td>

                      {/* Bank Account with Bank Logo */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 whitespace-nowrap">
                        {account ? (
                          <div className="flex items-center gap-2">
                            <BankLogo
                              bankName={account.bankName}
                              logoKey={account.logo}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 block text-[11px] truncate max-w-[130px]">
                                {account.nickname}
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate block -mt-0.5 max-w-[130px]">
                                {account.bankName}
                              </span>
                            </div>
                          </div>
                        ) : secAccount ? (
                          <div className="flex items-center gap-2">
                            <BankLogo
                              bankName={secAccount.bankName}
                              logoKey={secAccount.logo}
                              size="sm"
                            />
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px] truncate max-w-[130px]">
                              {secAccount.nickname}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                            Direct / Cash
                          </span>
                        )}
                      </td>

                      {/* Credit (+) */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right whitespace-nowrap font-mono-num">
                        {log.flow === 'credit' && log.amount !== undefined ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(log.amount)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>

                      {/* Debit (−) */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right whitespace-nowrap font-mono-num">
                        {log.flow === 'debit' && log.amount !== undefined ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            −{formatCurrency(log.amount)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>

                      {/* Details & Delete Actions */}
                      <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="View full details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogToDelete(log);
                            }}
                            className="p-1.5 rounded-lg text-rose-500/80 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete entry from ledger log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ============================================================
           Chronological Timeline View
           ============================================================ */
        <div className="space-y-3">
          {filteredLogs.map((log, idx) => {
            const account = log.bankAccountId ? accountMap.get(log.bankAccountId) : undefined;
            const isCredit = log.flow === 'credit';
            const isDebit = log.flow === 'debit';

            return (
              <Card
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Visual Bank Logo / Action Icon */}
                    {account ? (
                      <BankLogo
                        bankName={account.bankName}
                        logoKey={account.logo}
                        size="md"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                        {isCredit ? (
                          <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : isDebit ? (
                          <ArrowUpRight className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getModuleBadge(log.module)}
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatActivityTime(log.timestamp)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                        {log.title}
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        {log.description}
                      </p>

                      {/* Context Tags */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                        {account && (
                          <span className="flex items-center gap-1 font-medium">
                            <Landmark className="w-3 h-3 text-zinc-400" />
                            {account.nickname}
                          </span>
                        )}
                        {log.personName && (
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="w-3 h-3 text-zinc-400" />
                            {log.personName}
                          </span>
                        )}
                        {log.category && (
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                            {log.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Flow Amount & Quick Delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    {log.amount !== undefined && (
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'text-base font-bold font-mono-num block',
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isDebit
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-900 dark:text-zinc-100'
                          )}
                        >
                          {isCredit ? '+' : isDebit ? '−' : ''}
                          {formatCurrency(log.amount)}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                          {log.flow}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogToDelete(log);
                      }}
                      className="p-1.5 sm:p-2 rounded-lg text-rose-500/80 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete entry from ledger log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Row Detail Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Activity Details"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                {selectedLog.bankAccountId && accountMap.get(selectedLog.bankAccountId) ? (
                  <BankLogo
                    bankName={accountMap.get(selectedLog.bankAccountId)?.bankName}
                    logoKey={accountMap.get(selectedLog.bankAccountId)?.logo}
                    size="lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-zinc-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                    {selectedLog.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getModuleBadge(selectedLog.module)}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(selectedLog.date)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedLog.amount !== undefined && (
                <div className="text-right">
                  <span
                    className={cn(
                      'text-xl font-extrabold font-mono-num block',
                      selectedLog.flow === 'credit'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedLog.flow === 'debit'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                    )}
                  >
                    {selectedLog.flow === 'credit' ? '+' : selectedLog.flow === 'debit' ? '−' : ''}
                    {formatCurrency(selectedLog.amount)}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">
                    {selectedLog.flow || 'neutral'}
                  </span>
                </div>
              )}
            </div>

            {/* Description Narrative */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                Description
              </p>
              <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                {selectedLog.description}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Timestamp
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  {formatActivityTime(selectedLog.timestamp)}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                  Action Type
                </span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                  {selectedLog.actionType}
                </span>
              </div>

              {selectedLog.bankAccountName && (
                <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                    Bank Account
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                    {selectedLog.bankAccountName}
                  </span>
                </div>
              )}

              {selectedLog.secondaryBankAccountName && (
                <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                    Secondary Account
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                    {selectedLog.secondaryBankAccountName}
                  </span>
                </div>
              )}

              {selectedLog.personName && (
                <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                    Person Involved
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                    {selectedLog.personName}
                  </span>
                </div>
              )}

              {selectedLog.category && (
                <div className="p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase tracking-wider">
                    Category
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                    {selectedLog.category}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  const toDelete = selectedLog;
                  setSelectedLog(null);
                  setLogToDelete(toDelete);
                }}
              >
                Delete Entry
              </Button>
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Single Entry Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(logToDelete)}
        onClose={() => setLogToDelete(null)}
        onConfirm={handleConfirmDeleteLog}
        title="Delete Ledger Log Entry"
        message={`Are you sure you want to remove "${logToDelete?.title}" from the audit ledger? This action cannot be undone.`}
        confirmLabel="Delete Entry"
        variant="danger"
      />

      {/* Clear All Logs Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={handleConfirmClearAll}
        title="Clear Entire Audit Ledger"
        message="Are you sure you want to clear all activity and ledger log entries? Your bank accounts, lending balances, and records will remain completely intact."
        confirmLabel="Clear All Logs"
        variant="danger"
      />
    </div>
  );
}
