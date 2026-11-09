// ============================================================
// Ledgerly - Business Lending Page
// Clean Minimalist White Digital Lending Notebook
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Pencil,
  Check,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  Sliders,
  FileSpreadsheet,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseISO, format, addDays } from 'date-fns';
import { businessLendingService } from '../services/businessLendingService';
import { bankAccountService } from '../services/bankAccountService';
import { cloudSyncService } from '../services/cloudSyncService';
import { db } from '../db';
import type { BusinessLoan, MonthlyInterestRecord, PrincipalRepayment, CustomColumn } from '../types';
import {
  formatCurrency,
  formatDate,
  formatDueDate,
  formatDateShort,
  todayISO,
  computeNextMonthDate,
  getCurrentMonth,
  getMonthName,
  getMonthYearLabel,
  MONTHS,
  cn,
  generateId,
  getCollectionStatus,
} from '../utils';
import {
  Card,
  StatCard,
  Button,
  Input,
  Select,
  Textarea,
  CalendarPicker,
  Modal,
  ConfirmDialog,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  Tabs,
} from '../components/ui';

export default function BusinessLending() {
  const { bankAccounts, refreshBankAccounts, settings, updateSettings, resetSelectiveData } = useApp();

  // Month navigation
  const current = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);

  // View Mode
  const [activeTab, setActiveTab] = useState<'notebook' | 'all_loans'>('notebook');

  // Data states
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MonthlyInterestRecord[]>([]);
  const [allLoans, setAllLoans] = useState<BusinessLoan[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, Record<string, string>>>({});

  // Modals
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MonthlyInterestRecord | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoan, setDetailLoan] = useState<BusinessLoan | null>(null);

  const [showPrincipalModal, setShowPrincipalModal] = useState(false);
  const [principalLoan, setPrincipalLoan] = useState<BusinessLoan | null>(null);
  const [principalRecord, setPrincipalRecord] = useState<MonthlyInterestRecord | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<BusinessLoan | null>(null);

  const [showResetRegisterConfirm, setShowResetRegisterConfirm] = useState(false);
  const [resettingRegister, setResettingRegister] = useState(false);

  // Hide Zero Stat Tiles Option
  const [hideZeroTiles, setHideZeroTiles] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ledgerly_hide_zero_tiles') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHideZeroTiles = () => {
    setHideZeroTiles((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ledgerly_hide_zero_tiles', String(next));
      } catch {}
      return next;
    });
  };

  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');

  // Edit Loan & Record Modal State
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<{ loan: BusinessLoan; record?: MonthlyInterestRecord } | null>(null);

  const openEditLoan = (loan: BusinessLoan, record?: MonthlyInterestRecord) => {
    setLoanToEdit({ loan, record });
    setShowEditLoanModal(true);
  };

  // Table columns from settings or defaults, with dateLent completely removed
  const tableColumns = useMemo(() => {
    const raw = settings?.lendingTableColumns?.slice().sort((a, b) => a.order - b.order) || [];
    return raw.filter((c) => c.key !== 'dateLent');
  }, [settings?.lendingTableColumns]);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Auto carry forward loans for the selected month & heal corrupted records
      await businessLendingService.carryForwardLoans(selectedMonth, selectedYear);
      await businessLendingService.refreshStatuses();

      // 2. Fetch monthly records and loans
      const [monthlyRecs, loans, allCustoms] = await Promise.all([
        businessLendingService.getMonthlyRecords(selectedMonth, selectedYear),
        businessLendingService.getAllLoans(),
        db.customColumnValues.toArray(),
      ]);

      setRecords(monthlyRecs);
      setAllLoans(loans);

      // Custom values map
      const customMap: Record<string, Record<string, string>> = {};
      for (const cv of allCustoms) {
        if (!customMap[cv.loanId]) customMap[cv.loanId] = {};
        customMap[cv.loanId][cv.columnId] = cv.value;
      }
      setCustomValues(customMap);
    } catch (err) {
      console.error('Error loading business lending data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
    const handleReset = () => {
      loadData();
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [loadData]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const cur = getCurrentMonth();
    setSelectedMonth(cur.month);
    setSelectedYear(cur.year);
  };

  // Lookup map for loans
  const loanMap = useMemo(() => {
    const map = new Map<string, BusinessLoan>();
    allLoans.forEach((l) => map.set(l.id, l));
    return map;
  }, [allLoans]);

  // Filter out records for deleted or archived loans and sort automatically by dates (earliest due first)
  const displayRecords = useMemo(() => {
    const list = records.filter((rec) => {
      const loan = loanMap.get(rec.loanId);
      if (!loan) return false;
      if (loan.status === 'archived') return false;
      return true;
    });

    return list.sort((a, b) => {
      // Primary sort: due date ascending (e.g. 06-11, 07-11, 11-11...)
      const dateA = a.dueDate || '';
      const dateB = b.dueDate || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // Secondary sort: date lent ascending
      const loanA = loanMap.get(a.loanId);
      const loanB = loanMap.get(b.loanId);
      const lentA = loanA?.dateLent || '';
      const lentB = loanB?.dateLent || '';
      if (lentA !== lentB) return lentA.localeCompare(lentB);

      return b.principal - a.principal;
    });
  }, [records, loanMap]);

  // Dynamic stats calculated directly from displayRecords (the actual rows in the table!)
  const stats = useMemo(() => {
    let expInt = 0;
    let colInt = 0;
    let penInt = 0;
    let colEmi = 0;
    let emiColCount = 0;

    for (const rec of displayRecords) {
      const loan = loanMap.get(rec.loanId);
      const isEmi = Boolean(rec.expectedInterest === 0 || (loan && loan.monthlyInterest === 0));
      const due = rec.dueDate ? parseISO(rec.dueDate) : null;
      // If the due date is in a future month (e.g. December when viewing November),
      // it CANNOT be added to this month's total interest or pending interest!
      const isDueFutureMonth = due
        ? due.getFullYear() > selectedYear || (due.getFullYear() === selectedYear && (due.getMonth() + 1) > selectedMonth)
        : false;

      if (isEmi) {
        // 0% EMI: Collections are principal / EMI recovery, NOT monthly interest!
        if (rec.collectedAmount > 0) {
          colEmi += rec.collectedAmount;
          emiColCount += 1;
        }
      } else {
        // Interest-based loan: update expected, collected, and pending interest
        const effectiveExpected = isDueFutureMonth ? 0 : rec.expectedInterest;
        const effectivePending = isDueFutureMonth ? 0 : rec.pendingAmount;

        expInt += effectiveExpected;
        colInt += rec.collectedAmount;
        penInt += effectivePending;
      }
    }

    const activeL = allLoans.filter((l) => l.status === 'active');
    const totalAmount = activeL.reduce((sum, l) => sum + l.principalRemaining, 0);
    const totalEmiAmount = activeL.filter((l) => l.monthlyInterest === 0).reduce((sum, l) => sum + l.principalRemaining, 0);
    const emiCount = activeL.filter((l) => l.monthlyInterest === 0).length;
    const othersMoney = activeL.filter((l) => l.isOthersMoney).reduce((sum, l) => sum + l.principalRemaining, 0);
    const othersCount = activeL.filter((l) => l.isOthersMoney).length;
    const yourAmount = Math.max(0, totalAmount - totalEmiAmount - othersMoney);

    return {
      expectedInterest: expInt,
      collectedInterest: colInt,
      pendingInterest: penInt,
      collectedEmi: colEmi,
      emiColCount,
      activeCount: activeL.length,
      totalAmount,
      outstandingPrincipal: totalAmount,
      yourAmount,
      othersMoney,
      othersCount,
      totalEmiAmount,
      emiCount,
    };
  }, [displayRecords, allLoans, selectedMonth, selectedYear, loanMap]);

  // Stat tiles with zero hide support
  const allStatTiles = useMemo(() => {
    const tiles = [
      {
        id: 'expectedInterest',
        label: 'Expected Interest',
        value: formatCurrency(stats.expectedInterest),
        subtitle: `For ${getMonthName(selectedMonth).slice(0, 3)}`,
        numValue: stats.expectedInterest,
        isZero: (stats.expectedInterest || 0) === 0,
      },
      {
        id: 'collectedInterest',
        label: 'Collected This Month',
        value: formatCurrency(stats.collectedInterest),
        subtitle: stats.pendingInterest > 0 ? `${formatCurrency(stats.pendingInterest)} pending` : 'Interest collected',
        numValue: stats.collectedInterest,
        isZero: (stats.collectedInterest || 0) === 0,
      },
      {
        id: 'pendingInterest',
        label: 'Pending Interest',
        value: formatCurrency(stats.pendingInterest),
        subtitle: stats.pendingInterest > 0 ? 'Due for collection' : 'Zero pending',
        numValue: stats.pendingInterest,
        isZero: (stats.pendingInterest || 0) === 0,
      },
      {
        id: 'totalAmount',
        label: 'Total Amount',
        value: formatCurrency(stats.totalAmount),
        subtitle: `${stats.activeCount} active loans`,
        numValue: stats.totalAmount,
        isZero: (stats.totalAmount || 0) === 0,
      },
      {
        id: 'yourAmount',
        label: 'Your Amount',
        value: formatCurrency(stats.yourAmount),
        subtitle: 'Total − EMI − Others',
        numValue: stats.yourAmount,
        isZero: (stats.yourAmount || 0) === 0,
      },
      {
        id: 'othersMoney',
        label: 'Others Money',
        value: formatCurrency(stats.othersMoney),
        subtitle: `${stats.othersCount} loan(s) from others`,
        numValue: stats.othersMoney,
        isZero: (stats.othersMoney || 0) === 0,
      },
    ];

    if (stats.totalEmiAmount > 0 || !hideZeroTiles) {
      tiles.push({
        id: 'totalEmiAmount',
        label: '0% EMI Amount',
        value: formatCurrency(stats.totalEmiAmount),
        subtitle: `${stats.emiCount} active EMI loan(s)`,
        numValue: stats.totalEmiAmount,
        isZero: (stats.totalEmiAmount || 0) === 0,
      });
    }

    if (stats.collectedEmi > 0 || !hideZeroTiles) {
      tiles.push({
        id: 'collectedEmi',
        label: 'EMI Collected',
        value: formatCurrency(stats.collectedEmi),
        subtitle: stats.collectedEmi > 0 ? `${stats.emiColCount} EMI(s) collected` : `For ${getMonthName(selectedMonth).slice(0, 3)}`,
        numValue: stats.collectedEmi,
        isZero: (stats.collectedEmi || 0) === 0,
      });
    }

    return tiles;
  }, [stats, selectedMonth, hideZeroTiles]);

  const visibleStatTiles = useMemo(() => {
    if (!hideZeroTiles) return allStatTiles;
    return allStatTiles.filter((t) => !t.isZero);
  }, [allStatTiles, hideZeroTiles]);

  const gridColsClass = useMemo(() => {
    const count = visibleStatTiles.length;
    switch (count) {
      case 8: return 'grid-cols-2 sm:grid-cols-4 md:grid-cols-4 2xl:grid-cols-8';
      case 7: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-7';
      case 6: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 2xl:grid-cols-6';
      case 5: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';
      case 4: return 'grid-cols-2 sm:grid-cols-4';
      case 3: return 'grid-cols-1 sm:grid-cols-3';
      case 2: return 'grid-cols-2';
      default: return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
  }, [visibleStatTiles.length]);

  const handleDeleteColumnDirect = async (columnId: string) => {
    const col = tableColumns.find((c) => c.id === columnId);
    if (!col || col.isProtected) return;
    const updated = tableColumns.filter((c) => c.id !== columnId);
    await updateSettings({ lendingTableColumns: updated });
  };

  const getBankName = (id: string) => {
    const b = bankAccounts.find((a) => a.id === id);
    return b ? `${b.bankName} (${b.nickname})` : 'Unknown Account';
  };

  const openCollect = (record: MonthlyInterestRecord) => {
    setSelectedRecord(record);
    setShowCollectModal(true);
  };

  const openDetail = (loanId: string) => {
    const loan = loanMap.get(loanId);
    if (loan) {
      setDetailLoan(loan);
      setShowDetailModal(true);
    }
  };

  const openPrincipalRepayment = (loan: BusinessLoan, record?: MonthlyInterestRecord) => {
    setPrincipalLoan(loan);
    setPrincipalRecord(record || null);
    setShowPrincipalModal(true);
  };

  const handleCustomValueChange = async (loanId: string, columnId: string, value: string) => {
    const existing = await db.customColumnValues.where({ loanId, columnId }).first();
    if (existing) {
      await db.customColumnValues.update(existing.id, { value });
    } else {
      await db.customColumnValues.put({
        id: generateId(),
        loanId,
        columnId,
        value,
      });
    }
    setCustomValues((prev) => ({
      ...prev,
      [loanId]: {
        ...(prev[loanId] || {}),
        [columnId]: value,
      },
    }));
    cloudSyncService.scheduleAutoSync();
  };

  // Status Indicator (Live Evaluated against current date)
  const renderStatus = (record: MonthlyInterestRecord) => {
    const loan = loanMap.get(record.loanId);
    const isEmi = Boolean(loan && loan.monthlyInterest === 0);
    const isFullyRepaid = isEmi && !!loan && loan.principalRemaining <= 0;
    const due = record.dueDate ? parseISO(record.dueDate) : null;
    const isDueFutureMonth = due
      ? due.getFullYear() > selectedYear || (due.getFullYear() === selectedYear && (due.getMonth() + 1) > selectedMonth)
      : false;

    const currentStatus = isDueFutureMonth && record.collectedAmount === 0
      ? 'coming_soon'
      : getCollectionStatus(record.dueDate, record.collectedAmount, record.expectedInterest, isFullyRepaid);

    switch (currentStatus) {
      case 'collected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
            <Check className="w-4 h-4 stroke-[2.5]" />
            Collected
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
            <Clock className="w-4 h-4" />
            Partial ({formatCurrency(record.collectedAmount)})
          </span>
        );
      case 'due_today':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/50">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            Due Today
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/60 dark:border-red-800">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'coming_soon':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700">
            <Clock className="w-4 h-4" />
            Coming Soon
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80">
        {/* Month Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 sm:p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
            >
              {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 sm:p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleCurrentMonth}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
          >
            Today
          </button>

          {/* Hide Zero Tiles Toggle */}
          <button
            type="button"
            onClick={toggleHideZeroTiles}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-xs",
              hideZeroTiles
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
            title={hideZeroTiles ? "Hiding tiles with zero value. Click to show all." : "Click to hide tiles with zero value."}
          >
            {hideZeroTiles ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hideZeroTiles ? "Zero Tiles Hidden" : "Hide 0 Tiles"}</span>
          </button>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <Tabs
            tabs={[
              { key: 'notebook', label: getMonthName(selectedMonth) },
              { key: 'all_loans', label: 'All Active Loans', count: stats.activeCount },
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as any)}
          />

          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5 text-zinc-500" />}
            onClick={() => setShowResetRegisterConfirm(true)}
            title="Reset Business Lending Register"
          >
            <span className="hidden sm:inline">Reset Register</span>
            <span className="sm:hidden">Reset</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddLoan(true)}
          >
            <span className="hidden sm:inline">Add Loan Entry</span>
            <span className="sm:hidden">Add Loan</span>
          </Button>
        </div>
      </div>

      {/* Clean Minimal Stat Cards (with Hide Zero Tiles support) */}
      {visibleStatTiles.length > 0 ? (
        <div className={cn("grid gap-2 sm:gap-2.5 xl:gap-2 2xl:gap-3", gridColsClass)}>
          {visibleStatTiles.map((tile) => (
            <StatCard
              key={tile.id}
              label={tile.label}
              value={tile.value}
              subtitle={tile.subtitle}
              className="p-3 sm:p-3.5 2xl:p-4"
              valueClassName={cn(
                "font-bold tracking-tight font-mono-num whitespace-nowrap",
                visibleStatTiles.length >= 6
                  ? "text-sm sm:text-base lg:text-[1.05rem] 2xl:text-lg"
                  : "text-base sm:text-lg lg:text-xl 2xl:text-2xl"
              )}
            />
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-500">
          <span>All stat cards currently have zero value and are hidden.</span>
          <button
            type="button"
            onClick={toggleHideZeroTiles}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Show All Cards
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner />
      ) : activeTab === 'notebook' ? (
        /* ============================================================
           Digital Notebook Table (Matches Handwritten Register Format)
           ============================================================ */
        <div className="bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden">
          {/* Table Header Strip */}
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <span>{getMonthYearLabel(selectedMonth, selectedYear)}</span>
                <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500 sm:hidden ml-1">(Swipe &rarr;)</span>
              </h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile View Toggle */}
              <div className="flex md:hidden rounded-lg bg-zinc-200/70 dark:bg-zinc-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setMobileViewMode('cards')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer",
                    mobileViewMode === 'cards'
                      ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewMode('table')}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer",
                    mobileViewMode === 'table'
                      ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  Table
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={<Sliders className="w-3.5 h-3.5" />}
                onClick={() => setShowColumnConfig(true)}
              >
                Columns
              </Button>
            </div>
          </div>

          {displayRecords.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-8 h-8" />}
              title={`No entries for ${getMonthYearLabel(selectedMonth, selectedYear)}`}
              description="Click 'Add Loan Entry' above to add your first lending entry."
              action={
                <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddLoan(true)}>
                  Add Loan Entry
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile Cards View (md:hidden) */}
              <div className={cn("divide-y divide-zinc-100 dark:divide-zinc-800", mobileViewMode === 'cards' ? "block md:hidden" : "hidden")}>
                {displayRecords.map((rec) => {
                  const loan = loanMap.get(rec.loanId);
                  const isEmi = Boolean(loan && loan.monthlyInterest === 0);
                  const due = rec.dueDate ? parseISO(rec.dueDate) : null;
                  const isDueFutureMonth = due
                    ? due.getFullYear() > selectedYear || (due.getFullYear() === selectedYear && (due.getMonth() + 1) > selectedMonth)
                    : false;
                  const isFullyRepaid = isEmi && !!loan && loan.principalRemaining <= 0;
                  const effStatus = isDueFutureMonth && rec.collectedAmount === 0
                    ? 'coming_soon'
                    : getCollectionStatus(rec.dueDate, rec.collectedAmount, rec.expectedInterest, isFullyRepaid);

                  return (
                    <div key={`m-card-${rec.id}`} className="p-3.5 space-y-2.5 bg-white dark:bg-zinc-900">
                      {/* Top Header: Amount & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-zinc-950 dark:text-zinc-50 font-mono-num">
                              {formatCurrency(loan ? loan.principal : rec.principal)}
                            </span>
                            {loan?.isOthersMoney && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                title={`Money borrowed from ${loan.othersName || 'Others'}`}
                              >
                                Others: {loan.othersName || 'Others'}
                              </span>
                            )}
                          </div>
                          {loan && loan.principalRemaining < loan.principal && (
                            <span className="text-[11px] text-zinc-500 font-mono-num block mt-0.5">
                              Remaining: {formatCurrency(loan.principalRemaining)}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">
                          {renderStatus(rec)}
                        </div>
                      </div>

                      {/* 2x2 Key Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block tracking-wider">
                            Monthly Interest
                          </span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num text-xs mt-0.5 block">
                            {isEmi ? '0% EMI' : formatCurrency(rec.expectedInterest || loan?.monthlyInterest || 0)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block tracking-wider">
                            Due Date
                          </span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono-num text-xs mt-0.5 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                            {formatDueDate(rec.dueDate)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block tracking-wider">
                            Bank Account
                          </span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate block mt-0.5">
                            {getBankName(rec.collectionBankAccountId || loan?.bankAccountId)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block tracking-wider">
                            Collection Date
                          </span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 block mt-0.5">
                            {rec.collectionDate ? formatDate(rec.collectionDate) : '—'}
                          </span>
                        </div>
                      </div>

                      {loan?.notes && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic px-0.5 line-clamp-2">
                          Note: {loan.notes}
                        </p>
                      )}

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1">
                          {loan && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!py-1 !px-2 text-xs text-zinc-600 dark:text-zinc-400"
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => openEditLoan(loan, rec)}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!py-1 !px-2 text-xs text-zinc-600 dark:text-zinc-400"
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => openDetail(rec.loanId)}
                          >
                            Details
                          </Button>
                        </div>

                        <div>
                          {isEmi ? (
                            effStatus === 'collected' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="!py-1 !px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                                onClick={() => loan && openPrincipalRepayment(loan, rec)}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Collected
                              </Button>
                            ) : isDueFutureMonth ? (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Due {due ? formatDueDate(rec.dueDate) : 'Next Month'}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant={effStatus === 'pending' ? 'danger' : 'primary'}
                                className="!py-1 !px-3 text-xs font-bold"
                                icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                                onClick={() => loan && openPrincipalRepayment(loan, rec)}
                              >
                                Collect EMI
                              </Button>
                            )
                          ) : isDueFutureMonth ? (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              Due {due ? formatDueDate(rec.dueDate) : 'Next Month'}
                            </span>
                          ) : effStatus !== 'collected' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              className="!py-1 !px-3.5 text-xs font-bold hover:!bg-emerald-600"
                              icon={<Check className="w-3.5 h-3.5" />}
                              onClick={() => openCollect(rec)}
                            >
                              Collect
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="!py-1 !px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                              onClick={() => openCollect(rec)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full Desktop / Mobile Scrollable Table View */}
              <div className={cn("overflow-x-auto", mobileViewMode === 'cards' ? "hidden md:block" : "block")}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50 dark:bg-zinc-800/60 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {tableColumns
                      .filter((c) => c.isVisible)
                      .map((col) => (
                        <th key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 whitespace-nowrap">
                          <span>{col.key === 'principal' ? 'Amount' : col.name}</span>
                        </th>
                      ))}
                    <th className="py-3 sm:py-4 px-3 sm:px-6 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                  {displayRecords.map((rec) => {
                    const loan = loanMap.get(rec.loanId);
                    const isEmi = Boolean(loan && loan.monthlyInterest === 0);
                    const due = rec.dueDate ? parseISO(rec.dueDate) : null;
                    const isDueFutureMonth = due
                      ? due.getFullYear() > selectedYear || (due.getFullYear() === selectedYear && (due.getMonth() + 1) > selectedMonth)
                      : false;
                    const isFullyRepaid = isEmi && !!loan && loan.principalRemaining <= 0;
                    const effStatus = isDueFutureMonth && rec.collectedAmount === 0
                      ? 'coming_soon'
                      : getCollectionStatus(rec.dueDate, rec.collectedAmount, rec.expectedInterest, isFullyRepaid);
                    return (
                      <tr
                        key={rec.id}
                        onDoubleClick={() => loan && openEditLoan(loan, rec)}
                        className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors"
                        title="Double-click to edit entry"
                      >
                        {tableColumns
                          .filter((c) => c.isVisible)
                          .map((col) => {
                            if (col.key === 'principal') {
                              return (
                                <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 font-bold text-zinc-950 dark:text-zinc-50 font-mono-num text-sm sm:text-base whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span>{formatCurrency(loan ? loan.principal : rec.principal)}</span>
                                    {loan?.isOthersMoney && (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                        title={`Money borrowed from ${loan.othersName || 'Others'}`}
                                      >
                                        Others: {loan.othersName || 'Others'}
                                      </span>
                                    )}
                                  </div>
                                  {loan && loan.principalRemaining < loan.principal && (
                                    <span className="block text-xs font-normal text-zinc-500">
                                      Bal: {formatCurrency(loan.principalRemaining)}
                                    </span>
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'monthlyInterest') {
                              return (
                                <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 font-bold text-zinc-950 dark:text-zinc-50 font-mono-num text-sm sm:text-base whitespace-nowrap">
                                  {isEmi ? (
                                    <div>
                                      <span>₹0</span>
                                      <span className="block text-xs font-semibold text-blue-600 dark:text-blue-400">0% EMI</span>
                                    </div>
                                  ) : isDueFutureMonth ? (
                                    <div>
                                      <span className="text-zinc-900 dark:text-zinc-100">
                                        {formatCurrency(rec.expectedInterest || loan?.monthlyInterest || 0)}
                                      </span>
                                      <span className="block text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        Due in {due ? format(due, 'MMM') : 'Dec'}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      {formatCurrency(rec.expectedInterest)}
                                      {rec.collectedAmount > 0 && rec.collectedAmount !== rec.expectedInterest && (
                                        <span className="block text-xs text-zinc-500 font-normal">
                                          Paid: {formatCurrency(rec.collectedAmount)}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                              );
                            }

                            if (col.key === 'dueDate') {
                              return (
                                <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 whitespace-nowrap">
                                  <div
                                    title={formatDate(rec.dueDate)}
                                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold font-mono-num border bg-zinc-100 text-zinc-800 border-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-200 dark:border-zinc-700 shadow-2xs"
                                  >
                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                                    <span>{formatDueDate(rec.dueDate)}</span>
                                  </div>
                                </td>
                              );
                            }

                            if (col.key === 'status') {
                              return (
                                <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 whitespace-nowrap">
                                  {renderStatus(rec)}
                                </td>
                              );
                            }

                            if (col.key === 'notes') {
                              return (
                                <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xs sm:max-w-sm truncate">
                                  {loan?.notes || '—'}
                                </td>
                              );
                            }

                            // Custom column
                            const val = customValues[rec.loanId]?.[col.id] || '';
                            return (
                              <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200">
                                <input
                                  type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                  value={val}
                                  onChange={(e) => handleCustomValueChange(rec.loanId, col.id, e.target.value)}
                                  placeholder="—"
                                  className="w-28 sm:w-32 px-2 py-1 bg-transparent border border-transparent hover:border-zinc-300 focus:border-zinc-950 rounded outline-none text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
                                />
                              </td>
                            );
                          })}

                        {/* Row Actions */}
                        <td className="py-3 sm:py-4 px-3 sm:px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {isEmi ? (
                              effStatus === 'collected' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="!py-1.5 !px-3.5 !text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                                  onClick={() => loan && openPrincipalRepayment(loan, rec)}
                                  title="EMI Collected. Click to view or adjust collection."
                                >
                                  <Check className="w-4 h-4 mr-1 inline" /> Collected
                                </Button>
                              ) : isDueFutureMonth ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg border border-blue-200/60 dark:border-blue-800">
                                  Due {due ? formatDueDate(rec.dueDate) : 'Next Month'}
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={effStatus === 'pending' ? 'danger' : 'primary'}
                                  className="!py-1.5 !px-3.5 !text-xs font-bold"
                                  icon={<ArrowDownLeft className="w-4 h-4" />}
                                  onClick={() => loan && openPrincipalRepayment(loan, rec)}
                                  title="Record EMI Collection"
                                >
                                  Collect EMI
                                </Button>
                              )
                            ) : isDueFutureMonth ? (
                              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg border border-blue-200/60 dark:border-blue-800">
                                Due {due ? formatDueDate(rec.dueDate) : 'Next Month'}
                              </span>
                            ) : effStatus !== 'collected' ? (
                              <Button
                                size="sm"
                                variant="primary"
                                className="!py-1.5 !px-4 !text-xs font-bold transition-all hover:!bg-emerald-600 hover:!border-emerald-600 hover:!text-white dark:hover:!bg-emerald-600 dark:hover:!border-emerald-600"
                                icon={<Check className="w-4 h-4" />}
                                onClick={() => openCollect(rec)}
                              >
                                Collect
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="!py-1.5 !px-3.5 !text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                                onClick={() => openCollect(rec)}
                                title="Interest collected. Click to adjust collected payment."
                              >
                                <Check className="w-4 h-4 mr-1 inline" /> Paid
                              </Button>
                            )}

                            {loan && (
                              <button
                                type="button"
                                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                onClick={() => openEditLoan(loan, rec)}
                                title="Edit Loan Entry (Principal, Interest, Date, Notes)"
                              >
                                <Pencil className="w-4.5 h-4.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              onClick={() => openDetail(rec.loanId)}
                              title="View Loan Details & History"
                            >
                              <Eye className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 font-bold text-sm">
                  <tr>
                    {tableColumns
                      .filter((c) => c.isVisible)
                      .map((col, idx) => {
                        if (col.key === 'principal') {
                          const totalP = displayRecords.reduce((sum, r) => sum + r.principal, 0);
                          return (
                            <td key={col.id} className="py-4.5 px-6 font-mono-num text-base sm:text-lg text-zinc-950 dark:text-zinc-50 font-bold whitespace-nowrap">
                              <span className="text-xs uppercase tracking-wider block text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">Total Amount</span>
                              {formatCurrency(totalP)}
                            </td>
                          );
                        }
                        if (col.key === 'monthlyInterest') {
                          const totalI = displayRecords.reduce((sum, r) => {
                            const due = r.dueDate ? parseISO(r.dueDate) : null;
                            const isDueFutureMonth = due
                              ? due.getFullYear() > selectedYear || (due.getFullYear() === selectedYear && (due.getMonth() + 1) > selectedMonth)
                              : false;
                            return sum + (isDueFutureMonth ? 0 : r.expectedInterest);
                          }, 0);
                          return (
                            <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 font-mono-num text-sm sm:text-base text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">
                              <span className="text-[10px] sm:text-xs uppercase tracking-wider block text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">Total Interest</span>
                              {formatCurrency(totalI)}
                            </td>
                          );
                        }
                        if (idx === 0) {
                          return (
                            <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6 text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-xs sm:text-sm font-bold whitespace-nowrap">
                              Total ({displayRecords.length} Entries)
                            </td>
                          );
                        }
                        return <td key={col.id} className="py-3 sm:py-4 px-3 sm:px-6"></td>;
                      })}
                    <td className="py-3 sm:py-4 px-3 sm:px-6"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
        </div>
      ) : (
        /* ============================================================
           All Loans Master List
           ============================================================ */
        <div className="bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden">
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-zinc-600" />
              <span>All Business Loans Overview</span>
              <span className="text-[10px] font-normal text-zinc-400 sm:hidden ml-1">(Swipe &rarr;)</span>
            </h3>
            <p className="text-xs text-zinc-600 mt-0.5">
              Summary of all loans, remaining capital, and settlement status.
            </p>
          </div>

          {/* Mobile Cards for All Loans */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {allLoans
              .slice()
              .sort((a, b) => (b.firstDueDate || '').localeCompare(a.firstDueDate || ''))
              .map((loan) => (
                <div key={`m-all-${loan.id}`} className="p-3.5 space-y-2.5 bg-white dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-zinc-950 dark:text-zinc-50 font-mono-num">
                          {formatCurrency(loan.principal)}
                        </span>
                        {loan.isOthersMoney && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Others: {loan.othersName || 'Others'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono-num block mt-0.5">
                        Remaining: {formatCurrency(loan.principalRemaining)}
                      </span>
                    </div>

                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold",
                      loan.status === 'active'
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      {loan.status === 'active' ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Monthly Interest
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num text-xs mt-0.5 block">
                        {formatCurrency(loan.monthlyInterest)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Due Date
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono-num text-xs mt-0.5 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400 shrink-0" />
                        {formatDueDate(loan.firstDueDate)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                        Bank Account
                      </span>
                      <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate block mt-0.5">
                        {getBankName(loan.bankAccountId)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="!py-1 !px-2 text-xs text-zinc-600 dark:text-zinc-400"
                        icon={<Pencil className="w-3.5 h-3.5" />}
                        onClick={() => openEditLoan(loan)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="!py-1 !px-2 text-xs text-zinc-600 dark:text-zinc-400"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => openDetail(loan.id)}
                      >
                        Details
                      </Button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 cursor-pointer"
                        onClick={() => {
                          setLoanToDelete(loan);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {loan.status === 'active' && loan.principalRemaining > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!py-1 !px-3 text-xs font-semibold"
                        icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                        onClick={() => openPrincipalRepayment(loan)}
                      >
                        Return Principal
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50 dark:bg-zinc-800/60 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Original Amount</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Remaining Amount</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Monthly Interest</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Due Date</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Bank Account</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6">Status</th>
                  <th className="py-3 sm:py-4 px-3 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {allLoans
                  .slice()
                  .sort((a, b) => (b.firstDueDate || '').localeCompare(a.firstDueDate || ''))
                  .map((loan) => (
                  <tr key={loan.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 font-bold text-zinc-950 dark:text-zinc-50 font-mono-num text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{formatCurrency(loan.principal)}</span>
                        {loan.isOthersMoney && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            title={`Money borrowed from ${loan.othersName || 'Others'}`}
                          >
                            Others: {loan.othersName || 'Others'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 font-bold font-mono-num text-sm sm:text-base whitespace-nowrap">
                      <span className={loan.principalRemaining > 0 ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-500'}>
                        {formatCurrency(loan.principalRemaining)}
                      </span>
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 font-bold text-zinc-950 dark:text-zinc-50 font-mono-num text-sm sm:text-base whitespace-nowrap">
                      {formatCurrency(loan.monthlyInterest)}
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 whitespace-nowrap">
                      <div
                        title={formatDate(loan.firstDueDate)}
                        className="inline-flex items-center gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-blue-50/80 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-xs sm:text-sm font-bold shadow-2xs font-mono-num"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{formatDueDate(loan.firstDueDate)}</span>
                      </div>
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {getBankName(loan.bankAccountId)}
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 whitespace-nowrap">
                      {loan.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="py-3 sm:py-4.5 px-3 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {loan.status === 'active' && loan.principalRemaining > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!py-1.5 !px-3 !text-xs font-semibold"
                            icon={<ArrowDownLeft className="w-4 h-4" />}
                            onClick={() => openPrincipalRepayment(loan)}
                          >
                            Return Principal
                          </Button>
                        )}
                        <button
                          type="button"
                          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          onClick={() => openEditLoan(loan)}
                          title="Edit Loan Entry"
                        >
                          <Pencil className="w-4.5 h-4.5" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          onClick={() => openDetail(loan.id)}
                          title="View Details"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setLoanToDelete(loan);
                            setShowDeleteConfirm(true);
                          }}
                          title="Delete Loan"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          Modals
          ============================================================ */}

      {/* 1. Add Loan Modal */}
      <AddLoanModal
        isOpen={showAddLoan}
        onClose={() => setShowAddLoan(false)}
        bankAccounts={bankAccounts}
        onSuccess={() => {
          setShowAddLoan(false);
          loadData();
          refreshBankAccounts();
        }}
      />

      {/* 2. Collect Interest Modal */}
      {selectedRecord && (
        <CollectInterestModal
          isOpen={showCollectModal}
          onClose={() => {
            setShowCollectModal(false);
            setSelectedRecord(null);
          }}
          record={selectedRecord}
          loan={loanMap.get(selectedRecord.loanId)}
          bankAccounts={bankAccounts}
          onSuccess={() => {
            setShowCollectModal(false);
            setSelectedRecord(null);
            loadData();
            refreshBankAccounts();
          }}
        />
      )}

      {/* 3. Loan Detail Modal */}
      {detailLoan && (
        <LoanDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setDetailLoan(null);
          }}
          loan={detailLoan}
          bankAccounts={bankAccounts}
          onEdit={(l) => {
            setShowDetailModal(false);
            setDetailLoan(null);
            openEditLoan(l);
          }}
          onRepaymentSuccess={() => {
            loadData();
            refreshBankAccounts();
          }}
        />
      )}

      {/* 4. Return Principal / EMI Repayment Modal */}
      {principalLoan && (
        <PrincipalRepaymentModal
          isOpen={showPrincipalModal}
          onClose={() => {
            setShowPrincipalModal(false);
            setPrincipalLoan(null);
            setPrincipalRecord(null);
          }}
          loan={principalLoan}
          record={principalRecord}
          bankAccounts={bankAccounts}
          onSuccess={() => {
            setShowPrincipalModal(false);
            setPrincipalLoan(null);
            setPrincipalRecord(null);
            loadData();
            refreshBankAccounts();
          }}
        />
      )}

      {/* 5. Edit Loan / Record Modal */}
      {loanToEdit && (
        <EditLoanModal
          isOpen={showEditLoanModal}
          onClose={() => {
            setShowEditLoanModal(false);
            setLoanToEdit(null);
          }}
          loan={loanToEdit.loan}
          record={loanToEdit.record}
          onDelete={() => {
            const loanObj = loanToEdit.loan;
            setShowEditLoanModal(false);
            setLoanToEdit(null);
            setLoanToDelete(loanObj);
            setShowDeleteConfirm(true);
          }}
          onSuccess={() => {
            setShowEditLoanModal(false);
            setLoanToEdit(null);
            loadData();
            refreshBankAccounts();
          }}
        />
      )}

      {/* 5. Column Customizer Modal */}
      <ColumnConfigModal
        isOpen={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        columns={tableColumns}
        onSave={async (newCols) => {
          await updateSettings({ lendingTableColumns: newCols });
          setShowColumnConfig(false);
        }}
      />

      {/* 6. Confirm Delete/Archive Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setLoanToDelete(null);
        }}
        onConfirm={async () => {
          if (loanToDelete) {
            await businessLendingService.deleteLoan(loanToDelete.id);
            setShowDeleteConfirm(false);
            setLoanToDelete(null);
            await loadData();
            refreshBankAccounts();
          }
        }}
        title="Delete Lending Entry"
        message={`Are you sure you want to delete this lending entry (₹${loanToDelete?.principal.toLocaleString('en-IN')}) from the register? It will be removed from this month and will not carry forward into future months.`}
        confirmLabel="Delete Entry"
        variant="danger"
      />

      {/* 7. Confirm Reset Business Register Dialog */}
      <ConfirmDialog
        isOpen={showResetRegisterConfirm}
        onClose={() => setShowResetRegisterConfirm(false)}
        onConfirm={async () => {
          setResettingRegister(true);
          try {
            await resetSelectiveData({ businessLending: true });
            setShowResetRegisterConfirm(false);
            await loadData();
            await refreshBankAccounts();
          } catch (err) {
            console.error('Failed to reset business lending:', err);
          } finally {
            setResettingRegister(false);
          }
        }}
        title="Reset Business Lending Register"
        message="Are you sure you want to reset all business loans, monthly interest notebooks, and repayment records? All other sections (personal loans, expenses, income) and your bank accounts & balances will remain 100% intact."
        confirmLabel="Reset Register"
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// Subcomponent: Add Loan Modal
// ============================================================
function AddLoanModal({
  isOpen,
  onClose,
  bankAccounts,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts?: any[];
  onSuccess: () => void;
}) {
  const [principal, setPrincipal] = useState('');
  const [monthlyInterest, setMonthlyInterest] = useState('');
  const [isZeroInterest, setIsZeroInterest] = useState(false);
  const [isOthersMoney, setIsOthersMoney] = useState(false);
  const [othersName, setOthersName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [tenureType, setTenureType] = useState<'month' | 'days'>('month');
  const [tenureDays, setTenureDays] = useState<number | string>(7);
  const [dateLent, setDateLent] = useState(todayISO());
  const [firstDueDate, setFirstDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAccount = useMemo(
    () => (bankAccounts || []).find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  useEffect(() => {
    if (isOpen) {
      setPrincipal('');
      const today = todayISO();
      setDateLent(today);
      setTenureType('month');
      setTenureDays(7);
      setFirstDueDate(computeNextMonthDate(today));
      setMonthlyInterest('');
      setIsZeroInterest(false);
      setIsOthersMoney(false);
      setOthersName('');
      setBankAccountId('');
      setUpdateBankBalance(true);
      setNotes('');
      setErrors({});
    }
  }, [isOpen]);

  const handleDateLentChange = (newDateLent: string) => {
    setDateLent(newDateLent);
    if (tenureType === 'month') {
      setFirstDueDate(computeNextMonthDate(newDateLent));
    } else {
      const days = Number(tenureDays) || 7;
      try {
        const next = addDays(parseISO(newDateLent), days);
        setFirstDueDate(format(next, 'yyyy-MM-dd'));
      } catch {
        setFirstDueDate(newDateLent);
      }
    }
  };

  const handleSelectTenureType = (type: 'month' | 'days') => {
    setTenureType(type);
    const baseDate = dateLent || todayISO();
    if (type === 'month') {
      setFirstDueDate(computeNextMonthDate(baseDate));
    } else {
      const days = Number(tenureDays) || 7;
      try {
        const next = addDays(parseISO(baseDate), days);
        setFirstDueDate(format(next, 'yyyy-MM-dd'));
      } catch {
        setFirstDueDate(baseDate);
      }
    }
  };

  const handleSelectDays = (days: number) => {
    setTenureType('days');
    setTenureDays(days);
    const baseDate = dateLent || todayISO();
    try {
      const next = addDays(parseISO(baseDate), days);
      setFirstDueDate(format(next, 'yyyy-MM-dd'));
    } catch {
      setFirstDueDate(baseDate);
    }
  };

  const handleCustomDaysChange = (val: string) => {
    setTenureDays(val);
    const days = parseInt(val, 10);
    if (!isNaN(days) && days > 0) {
      const baseDate = dateLent || todayISO();
      try {
        const next = addDays(parseISO(baseDate), days);
        setFirstDueDate(format(next, 'yyyy-MM-dd'));
      } catch {}
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    const p = Number(principal);
    if (!principal || isNaN(p) || p <= 0) errs.principal = 'Enter valid amount';
    const mi = Number(monthlyInterest);
    if (!isZeroInterest && (monthlyInterest === '' || isNaN(mi) || mi < 0)) {
      errs.monthlyInterest = 'Enter interest (or select 0% EMI)';
    }
    if (!firstDueDate) errs.firstDueDate = 'Due date is required';
    if (isOthersMoney && !othersName.trim()) {
      errs.othersName = "Enter the person's name who provided this money";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const p = Number(principal);
      const interestVal = isZeroInterest ? 0 : Number(monthlyInterest);
      const effectiveDateLent = dateLent || todayISO();
      await businessLendingService.createLoan({
        principal: p,
        dateLent: effectiveDateLent,
        monthlyInterest: interestVal,
        firstDueDate,
        bankAccountId: bankAccountId || undefined,
        isOthersMoney,
        othersName: isOthersMoney ? othersName.trim() : undefined,
        notes: notes.trim() || (tenureType === 'days' ? `Lent for ${tenureDays} days` : undefined),
      });

      // If user opted to update bank balance, deduct from the selected bank account
      if (updateBankBalance && bankAccountId && p > 0) {
        await bankAccountService.adjustBalance(bankAccountId, -p);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Failed to create loan entry' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Lending Entry" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 -mt-1">
          Record amount, duration (month or few days), and interest directly into your register.
        </p>

        {errors.form && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {errors.form}
          </div>
        )}

        {/* Tenure / Duration Selector: 1 Month vs A Few Days */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              Lending Tenure / Duration
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-zinc-200/70 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => handleSelectTenureType('month')}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                  tenureType === 'month'
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                )}
              >
                1 Month
              </button>
              <button
                type="button"
                onClick={() => handleSelectTenureType('days')}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                  tenureType === 'days'
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                )}
              >
                A Few Days
              </button>
            </div>
          </div>

          {tenureType === 'days' ? (
            <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                Select duration or type custom number of days:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[3, 5, 7, 10, 15, 20, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleSelectDays(d)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                      Number(tenureDays) === d
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    )}
                  >
                    {d} Days
                  </button>
                ))}
                <div className="inline-flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Custom"
                    value={tenureDays}
                    onChange={(e) => handleCustomDaysChange(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-xs text-zinc-500">days</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Standard 1 month lending cycle. Due on {formatDueDate(firstDueDate)}.
            </p>
          )}
        </div>

        {/* Given Date & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Lending Date"
            type="date"
            value={dateLent}
            onChange={(e) => handleDateLentChange(e.target.value)}
            required
          />

          <Input
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 15000"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            error={errors.principal}
            required
          />
        </div>

        {/* Interest & 0% EMI */}
        <div>
          <Input
            label={
              isZeroInterest
                ? 'Interest (₹)'
                : tenureType === 'days'
                ? `Interest for ${tenureDays} Days (₹)`
                : 'Monthly Interest (₹)'
            }
            type="number"
            placeholder={isZeroInterest ? '0' : 'e.g. 1500'}
            value={isZeroInterest ? '0' : monthlyInterest}
            onChange={(e) => {
              setMonthlyInterest(e.target.value);
              if (Number(e.target.value) === 0 && e.target.value !== '') {
                setIsZeroInterest(true);
              }
            }}
            disabled={isZeroInterest}
            error={errors.monthlyInterest}
            helpText={
              isZeroInterest
                ? '0% interest EMI'
                : tenureType === 'days'
                ? `Total interest charged for ${tenureDays} days`
                : 'Manual monthly interest (no % calculation)'
            }
            required
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isZeroInterest}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsZeroInterest(checked);
                if (checked) {
                  setMonthlyInterest('0');
                } else {
                  setMonthlyInterest('');
                }
              }}
              className="w-4 h-4 rounded text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 cursor-pointer"
            />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              0% Interest / No Interest (EMI Amount)
            </span>
          </label>
        </div>

        {/* Bank Account Selection (Optional) */}
        <div className="space-y-2">
          <Select
            label="Lent From Bank Account (Optional)"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            options={[
              { value: '', label: 'None / Cash (No bank account)' },
              ...(bankAccounts || []).map((a) => ({
                value: a.id,
                label: `${a.nickname || a.bankName} (Bal: ${formatCurrency(a.currentBalance ?? a.openingBalance ?? 0)})`,
              })),
            ]}
          />

          {/* Ask to update bank balance */}
          {selectedAccount && (
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={updateBankBalance}
                  onChange={(e) => setUpdateBankBalance(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Update bank balance?
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                    {updateBankBalance
                      ? `Will deduct −${formatCurrency(Number(principal) || 0)} from ${selectedAccount.nickname || selectedAccount.bankName} (New balance: ${formatCurrency((selectedAccount.currentBalance ?? selectedAccount.openingBalance ?? 0) - (Number(principal) || 0))})`
                      : 'Bank balance will remain untouched'}
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Others Money Option */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isOthersMoney}
              onChange={(e) => {
                setIsOthersMoney(e.target.checked);
                if (!e.target.checked) setOthersName('');
              }}
              className="w-4 h-4 rounded text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Others Money
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                Borrowed from someone else to lend out for interest
              </span>
            </div>
          </label>

          {isOthersMoney && (
            <Input
              label="Whose Money is this? (Person Name)"
              placeholder="e.g. Ramesh, Suresh, Uncle"
              value={othersName}
              onChange={(e) => setOthersName(e.target.value)}
              error={errors.othersName}
              helpText="This person's name will be displayed next to the amount"
              required={isOthersMoney}
            />
          )}
        </div>

        <CalendarPicker
          label={`Due Date (${tenureType === 'days' ? `${tenureDays} Days` : '1 Month'})`}
          value={firstDueDate}
          onChange={(val) => setFirstDueDate(val)}
          error={errors.firstDueDate}
          helpText="Click any date on the calendar to fine-tune due date"
        />

        <Textarea
          label="Optional Notes / Remarks"
          placeholder="Any custom remarks..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Subcomponent: Edit Loan / Record Modal
// ============================================================
function EditLoanModal({
  isOpen,
  onClose,
  loan,
  record,
  onDelete,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: BusinessLoan;
  record?: MonthlyInterestRecord;
  onDelete: () => void;
  onSuccess: () => void;
}) {
  const [principal, setPrincipal] = useState(String(loan.principal));
  const initialInterest = record ? record.expectedInterest : loan.monthlyInterest;
  const [monthlyInterest, setMonthlyInterest] = useState(String(initialInterest));
  const [isZeroInterest, setIsZeroInterest] = useState(initialInterest === 0);
  const [isOthersMoney, setIsOthersMoney] = useState(Boolean(loan.isOthersMoney));
  const [othersName, setOthersName] = useState(loan.othersName || '');
  const [dueDate, setDueDate] = useState(record?.dueDate || loan.firstDueDate || todayISO());
  const [notes, setNotes] = useState(loan.notes || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setPrincipal(String(loan.principal));
      const curInt = record ? record.expectedInterest : loan.monthlyInterest;
      setMonthlyInterest(String(curInt));
      setIsZeroInterest(curInt === 0);
      setIsOthersMoney(Boolean(loan.isOthersMoney));
      setOthersName(loan.othersName || '');
      setDueDate(record?.dueDate || loan.firstDueDate || todayISO());
      setNotes(loan.notes || '');
      setErrors({});
    }
  }, [isOpen, loan, record]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const p = Number(principal);
    if (!principal || isNaN(p) || p <= 0) errs.principal = 'Enter valid amount';
    const mi = Number(monthlyInterest);
    if (!isZeroInterest && (monthlyInterest === '' || isNaN(mi) || mi < 0)) {
      errs.monthlyInterest = 'Enter manual monthly interest (or check 0% EMI)';
    }
    if (!dueDate) errs.dueDate = 'Due date is required';
    if (isOthersMoney && !othersName.trim()) {
      errs.othersName = "Enter the person's name who provided this money";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const interestVal = isZeroInterest ? 0 : Number(monthlyInterest);
      await businessLendingService.updateLoanAndRecord(loan.id, record?.id, {
        principal: Number(principal),
        monthlyInterest: interestVal,
        dueDate,
        isOthersMoney,
        othersName: isOthersMoney ? othersName.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Failed to update loan entry' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Lending Entry" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 -mt-1">
          Modify amount, monthly interest, due date, or remarks for this notebook entry.
        </p>

        {errors.form && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 15000"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            error={errors.principal}
            required
          />

          <div>
            <Input
              label="Monthly Interest (₹)"
              type="number"
              placeholder={isZeroInterest ? '0' : 'e.g. 1500'}
              value={isZeroInterest ? '0' : monthlyInterest}
              onChange={(e) => {
                setMonthlyInterest(e.target.value);
                if (Number(e.target.value) === 0 && e.target.value !== '') {
                  setIsZeroInterest(true);
                }
              }}
              disabled={isZeroInterest}
              error={errors.monthlyInterest}
              helpText={isZeroInterest ? '0% interest EMI' : 'Manual interest amount'}
              required
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isZeroInterest}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsZeroInterest(checked);
                  if (checked) {
                    setMonthlyInterest('0');
                  } else {
                    setMonthlyInterest('');
                  }
                }}
                className="w-4 h-4 rounded text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 cursor-pointer"
              />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                0% Interest / No Interest (EMI Amount)
              </span>
            </label>
          </div>
        </div>

        {/* Others Money Option */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isOthersMoney}
              onChange={(e) => {
                setIsOthersMoney(e.target.checked);
                if (!e.target.checked) setOthersName('');
              }}
              className="w-4 h-4 rounded text-zinc-950 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Others Money
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                Borrowed from someone else to lend out for interest
              </span>
            </div>
          </label>

          {isOthersMoney && (
            <Input
              label="Whose Money is this? (Person Name)"
              placeholder="e.g. Ramesh, Suresh, Uncle"
              value={othersName}
              onChange={(e) => setOthersName(e.target.value)}
              error={errors.othersName}
              helpText="This person's name will be displayed next to the amount"
              required={isOthersMoney}
            />
          )}
        </div>

        <CalendarPicker
          label="Due Date"
          value={dueDate}
          onChange={(val) => setDueDate(val)}
          error={errors.dueDate}
          helpText="Click any date on the calendar to select"
        />

        <Textarea
          label="Optional Notes / Remarks"
          placeholder="Any custom remarks..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={onDelete}
          >
            Delete Entry
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Subcomponent: Collect Interest Modal
// ============================================================
function CollectInterestModal({
  isOpen,
  onClose,
  record,
  loan,
  bankAccounts,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  record: MonthlyInterestRecord;
  loan?: BusinessLoan;
  bankAccounts: any[];
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(record.pendingAmount || record.expectedInterest));
  const [bankAccountId, setBankAccountId] = useState(record.collectionBankAccountId || bankAccounts[0]?.id || '');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [collectionDate, setCollectionDate] = useState(record.collectionDate || todayISO());

  // Principal return state
  const remainingPrincipal = loan?.principalRemaining || 0;
  const [isReturningPrincipal, setIsReturningPrincipal] = useState(false);
  const [principalAmount, setPrincipalAmount] = useState(String(remainingPrincipal));
  const [clearLoanPermanently, setClearLoanPermanently] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const interestVal = Number(amount) || 0;
  const principalVal = isReturningPrincipal ? (Number(principalAmount) || 0) : 0;
  const totalAmountReceived = interestVal + principalVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!amount || isNaN(val) || val <= 0) {
      setError('Enter valid interest collection amount');
      return;
    }
    if (!bankAccountId) {
      setError('Select bank account');
      return;
    }

    const pVal = isReturningPrincipal ? Number(principalAmount) : 0;
    if (isReturningPrincipal) {
      if (isNaN(pVal) || pVal <= 0) {
        setError('Enter valid principal return amount');
        return;
      }
      if (pVal > remainingPrincipal) {
        setError(`Principal returned cannot exceed remaining balance (${formatCurrency(remainingPrincipal)})`);
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Record interest collection
      await businessLendingService.collectInterest(record.id, {
        amount: val,
        bankAccountId,
        collectionDate,
      });

      // 2. If principal returned as well, record principal repayment
      if (isReturningPrincipal && loan && pVal > 0) {
        await businessLendingService.recordPrincipalRepayment({
          loanId: loan.id,
          amount: pVal,
          bankAccountId,
          date: collectionDate,
          notes: (clearLoanPermanently || pVal >= remainingPrincipal)
            ? 'Full principal settlement (Loan cleared permanently)'
            : 'Principal repayment received with monthly interest',
        });
      }

      // 3. If user opted to update bank balance, credit total money received
      if (updateBankBalance && bankAccountId && totalAmountReceived > 0) {
        await bankAccountService.adjustBalance(bankAccountId, totalAmountReceived);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to record collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Interest Collection" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">Expected Interest:</span>
            <span className="font-bold text-zinc-950 dark:text-zinc-50 font-mono-num">{formatCurrency(record.expectedInterest)}</span>
          </div>
          {record.collectedAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Already Collected:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono-num">{formatCurrency(record.collectedAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200/60 dark:border-zinc-800 pt-1.5">
            <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Remaining Pending:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num">{formatCurrency(record.pendingAmount)}</span>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

        <Input
          label="Interest Amount Received (₹)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helpText="Defaults to pending interest. Partial collection keeps the rest as pending."
          required
        />

        {/* Option to also collect Principal and permanently clear the loan */}
        {loan && remainingPrincipal > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReturningPrincipal}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsReturningPrincipal(checked);
                  if (checked) {
                    setPrincipalAmount(String(remainingPrincipal));
                    setClearLoanPermanently(true);
                  }
                }}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  Principal is also being returned?
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                  Borrower is returning principal as well (clear loan permanently)
                </span>
              </div>
            </label>

            {isReturningPrincipal && (
              <div className="space-y-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Outstanding Principal:</span>
                  <span className="font-bold font-mono-num text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(remainingPrincipal)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Input
                    label="Principal Returned (₹)"
                    type="number"
                    max={remainingPrincipal}
                    value={principalAmount}
                    onChange={(e) => {
                      setPrincipalAmount(e.target.value);
                      const p = Number(e.target.value);
                      if (p >= remainingPrincipal) {
                        setClearLoanPermanently(true);
                      } else {
                        setClearLoanPermanently(false);
                      }
                    }}
                    helpText={
                      clearLoanPermanently
                        ? "Full principal settlement — loan will be closed and permanently cleared"
                        : `Partial return — remaining balance will be ${formatCurrency(Math.max(0, remainingPrincipal - (Number(principalAmount) || 0)))}`
                    }
                    required
                  />

                  <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={clearLoanPermanently}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setClearLoanPermanently(checked);
                        if (checked) {
                          setPrincipalAmount(String(remainingPrincipal));
                        }
                      }}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Clear loan permanently ({formatCurrency(remainingPrincipal)} full return)
                    </span>
                  </label>
                </div>

                {/* Combined Total Received Breakdown */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Interest Collected:</span>
                    <span className="font-mono-num font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(interestVal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Principal Returned:</span>
                    <span className="font-mono-num font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(principalVal)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800 font-bold text-zinc-950 dark:text-zinc-50">
                    <span>Total Money Received:</span>
                    <span className="font-mono-num text-emerald-700 dark:text-emerald-400 text-sm font-extrabold">{formatCurrency(totalAmountReceived)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Select
          label="Received Into Bank Account"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          options={bankAccounts.map((a) => ({
            value: a.id,
            label: `${a.bankName} - ${a.nickname} (Bal: ${formatCurrency(a.currentBalance)})`,
          }))}
          required
        />

        {/* Ask to update bank balance */}
        {selectedAccount && (
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateBankBalance}
                onChange={(e) => setUpdateBankBalance(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  Update bank balance?
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                  {updateBankBalance
                    ? `Will credit +${formatCurrency(totalAmountReceived)} into ${selectedAccount.nickname || selectedAccount.bankName} (New balance: ${formatCurrency((selectedAccount.currentBalance ?? selectedAccount.openingBalance ?? 0) + totalAmountReceived)})`
                    : 'Bank balance will remain untouched'}
                </span>
              </div>
            </label>
          </div>
        )}

        <Input
          label="Collection Date"
          type="date"
          value={collectionDate}
          onChange={(e) => setCollectionDate(e.target.value)}
          required
        />

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {record.collectedAmount > 0 ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={saving}
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this collection and reset the interest back to pending? Any recorded interest income will be removed.')) {
                  setSaving(true);
                  try {
                    await businessLendingService.uncollectInterest(record.id);
                    onSuccess();
                  } catch (err) {
                    console.error(err);
                    setError('Failed to delete collection');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              title="Delete this collection record and reset status to pending"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Delete Collection
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Confirm Collection
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Subcomponent: Principal Repayment Modal
// ============================================================
function PrincipalRepaymentModal({
  isOpen,
  onClose,
  loan,
  record,
  bankAccounts,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: BusinessLoan;
  record?: MonthlyInterestRecord | null;
  bankAccounts: any[];
  onSuccess: () => void;
}) {
  const isEmi = loan.monthlyInterest === 0;
  const defaultAmount = isEmi && record && record.principal > 0
    ? String(record.principal)
    : String(loan.principalRemaining);
  const [amount, setAmount] = useState(defaultAmount);
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [date, setDate] = useState(record?.dueDate || todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!amount || isNaN(val) || val <= 0) {
      setError('Enter valid amount');
      return;
    }
    if (val > loan.principalRemaining) {
      setError(`Cannot return more than remaining amount (${formatCurrency(loan.principalRemaining)})`);
      return;
    }

    setSaving(true);
    try {
      await businessLendingService.recordPrincipalRepayment({
        loanId: loan.id,
        recordId: record?.id,
        amount: val,
        bankAccountId,
        date,
        notes: notes.trim() || undefined,
      });

      // If user opted to update bank balance, credit the receiving bank account
      if (updateBankBalance && bankAccountId && val > 0) {
        await bankAccountService.adjustBalance(bankAccountId, val);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Failed to record collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEmi ? "Record EMI Collection" : "Collect Principal"} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Original Amount:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num">{formatCurrency(loan.principal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Remaining Balance:</span>
            <span className="font-bold text-zinc-950 dark:text-zinc-100 font-mono-num">{formatCurrency(loan.principalRemaining)}</span>
          </div>
          {record && record.collectedAmount > 0 && (
            <div className="flex justify-between border-t border-zinc-200/60 dark:border-zinc-800 pt-1">
              <span className="text-zinc-600 dark:text-zinc-400">Collected This Month:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono-num">{formatCurrency(record.collectedAmount)}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
          {isEmi
            ? "Collect EMI installment from borrower into your bank account."
            : "Principal collection from borrower. Capital returned, not profit."}
        </p>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

        <Input
          label={isEmi ? "EMI Collection Amount (₹)" : "Collection Amount (₹)"}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <Select
          label="Bank Account Receiving Money"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          options={bankAccounts.map((a) => ({
            value: a.id,
            label: `${a.bankName} - ${a.nickname} (Bal: ${formatCurrency(a.currentBalance)})`,
          }))}
          required
        />

        {selectedAccount && (
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={updateBankBalance}
                onChange={(e) => setUpdateBankBalance(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  Update bank balance?
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                  {updateBankBalance
                    ? `Will credit +${formatCurrency(Number(amount) || 0)} into ${selectedAccount.nickname || selectedAccount.bankName} (New balance: ${formatCurrency((selectedAccount.currentBalance ?? selectedAccount.openingBalance ?? 0) + (Number(amount) || 0))})`
                    : 'Bank balance will remain untouched'}
                </span>
              </div>
            </label>
          </div>
        )}

        <Input
          label="Date Collected"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <Input
          label="Notes (Optional)"
          placeholder="e.g. EMI installment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {record && record.collectedAmount > 0 ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={saving}
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this collection and reset status back to pending?')) {
                  setSaving(true);
                  try {
                    await businessLendingService.uncollectEmi(record.id);
                    onSuccess();
                  } catch (err) {
                    console.error(err);
                    setError('Failed to reset collection');
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              title="Delete collection and reset status to pending"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Delete Collection
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Confirm Collection
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Subcomponent: Loan Detail Modal
// ============================================================
function LoanDetailModal({
  isOpen,
  onClose,
  loan,
  bankAccounts,
  onEdit,
  onRepaymentSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: BusinessLoan;
  bankAccounts: any[];
  onEdit?: (loan: BusinessLoan) => void;
  onRepaymentSuccess: () => void;
}) {
  const [history, setHistory] = useState<MonthlyInterestRecord[]>([]);
  const [repayments, setRepayments] = useState<PrincipalRepayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        businessLendingService.getRecordsForLoan(loan.id),
        businessLendingService.getPrincipalRepayments(loan.id),
      ]).then(([recs, repays]) => {
        setHistory(recs.sort((a, b) => b.year - a.year || b.month - a.month));
        setRepayments((repays || []).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')));
        setLoading(false);
      });
    }
  }, [isOpen, loan.id]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Loan Details & History" size="lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Loan Breakdown & Record Summary</span>
          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              className="!py-1 !px-2.5 !text-xs"
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => onEdit(loan)}
            >
              Edit Loan Details
            </Button>
          )}
        </div>

        {loan.isOthersMoney && (
          <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider block">
                Money Source: Others Money
              </span>
              <span className="text-xs text-purple-800 dark:text-purple-400">
                Borrowed from: <strong className="font-semibold">{loan.othersName || 'Others'}</strong>
              </span>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-mono-num">
              {formatCurrency(loan.principalRemaining)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Original Amount</p>
            <p className="text-sm font-bold text-zinc-950 font-mono-num mt-0.5">{formatCurrency(loan.principal)}</p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Remaining Amount</p>
            <p className="text-sm font-bold text-zinc-950 font-mono-num mt-0.5">{formatCurrency(loan.principalRemaining)}</p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Monthly Interest</p>
            <p className="text-sm font-bold text-zinc-950 font-mono-num mt-0.5">{formatCurrency(loan.monthlyInterest)}</p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <p className="text-[10px] text-zinc-600 uppercase font-semibold">Date Lent</p>
            <p className="text-sm font-bold text-zinc-950 mt-0.5">{formatDate(loan.dateLent)}</p>
          </div>
        </div>

        {/* Principal / EMI Collections */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
            {loan.monthlyInterest === 0 ? `EMI Collections (${repayments.length})` : `Principal Collections (${repayments.length})`}
          </h4>
          {repayments.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 py-1">No collections recorded yet.</p>
          ) : (
            <div className="border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 font-semibold text-zinc-700">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {repayments.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3">{formatDate(r.date)}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-950 font-mono-num">{formatCurrency(r.amount)}</td>
                      <td className="py-2.5 px-3 text-zinc-600">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Interest History */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-2">
            Monthly Interest History ({history.length} Months)
          </h4>
          {loading ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <p className="text-xs text-zinc-600 py-1">No records found.</p>
          ) : (
            <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 font-semibold text-zinc-700 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Expected</th>
                    <th className="py-2.5 px-3">Collected</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 px-3 font-medium">{getMonthYearLabel(h.month, h.year)}</td>
                      <td className="py-2 px-3 font-mono-num">{formatCurrency(h.expectedInterest)}</td>
                      <td className="py-2 px-3 font-bold font-mono-num text-zinc-950">
                        {h.collectedAmount > 0 ? formatCurrency(h.collectedAmount) : '—'}
                      </td>
                      <td className="py-2 px-3 capitalize">{h.status.replace('_', ' ')}</td>
                      <td className="py-2 px-3 text-zinc-600">{h.collectionDate ? formatDate(h.collectionDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-100">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Subcomponent: Column Customizer Modal
// ============================================================
function ColumnConfigModal({
  isOpen,
  onClose,
  columns,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  columns: CustomColumn[];
  onSave: (cols: CustomColumn[]) => Promise<void>;
}) {
  const [cols, setCols] = useState<CustomColumn[]>([]);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date'>('text');

  useEffect(() => {
    if (isOpen) {
      setCols([...columns]);
      setNewColName('');
    }
  }, [isOpen, columns]);

  const toggleVisibility = (id: string) => {
    setCols((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          if (c.isProtected) return c;
          return { ...c, isVisible: !c.isVisible };
        }
        return c;
      })
    );
  };

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const newCol: CustomColumn = {
      id: `col_custom_${Date.now()}`,
      name: newColName.trim(),
      key: `custom_${Date.now()}`,
      type: newColType,
      isVisible: true,
      isProtected: false,
      order: cols.length,
    };
    setCols([...cols, newCol]);
    setNewColName('');
  };

  const handleDeleteColumn = (id: string) => {
    setCols((prev) => prev.filter((c) => c.id !== id || c.isProtected));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;
    const copy = [...cols];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    copy.forEach((c, i) => (c.order = i));
    setCols(copy);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Table Columns" size="md">
      <div className="space-y-4">
        <p className="text-xs text-zinc-600">
          Toggle or add columns for your monthly register. Essential financial fields remain locked.
        </p>

        <div className="space-y-2 border border-zinc-200 rounded-lg p-2 max-h-60 overflow-y-auto">
          {cols.map((col, idx) => (
            <div
              key={col.id}
              className="flex items-center justify-between p-2 rounded-md bg-zinc-50 border border-zinc-200/60 text-xs"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={col.isVisible}
                  disabled={col.isProtected}
                  onChange={() => toggleVisibility(col.id)}
                  className="rounded text-zinc-950 cursor-pointer"
                />
                <span className={cn('font-medium', col.isProtected ? 'text-zinc-950' : 'text-zinc-700')}>
                  {col.name} {col.isProtected && <span className="text-[10px] text-zinc-500 font-normal">(Required)</span>}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, 'up')}
                  className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === cols.length - 1}
                  onClick={() => handleMove(idx, 'down')}
                  className="p-1 rounded hover:bg-zinc-200 disabled:opacity-30"
                >
                  ↓
                </button>
                {!col.isProtected && (
                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(col.id)}
                    className="p-1 rounded text-red-600 hover:bg-red-50 ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Column */}
        <div className="p-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-2">
          <p className="text-xs font-semibold text-zinc-800">Add Custom Column</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Remarks"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white text-zinc-900 outline-none"
            />
            <select
              value={newColType}
              onChange={(e) => setNewColType(e.target.value as any)}
              className="px-2 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white text-zinc-900 outline-none"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <Button size="sm" type="button" onClick={handleAddColumn}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(cols)}>
            Save Columns
          </Button>
        </div>
      </div>
    </Modal>
  );
}
