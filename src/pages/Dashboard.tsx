// ============================================================
// Ledgerly - Minimalist Clean White Dashboard Overview
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  Landmark, Receipt, PieChart as PieChartIcon,
} from 'lucide-react';
import { Card, StatCard, LoadingSpinner, Tabs, Button } from '../components/ui';
import { useApp } from '../context/AppContext';
import {
  businessLendingService,
  personalLendingService,
  expenseService,
  incomeService,
  transactionService,
} from '../services';
import { db } from '../db';
import type { DashboardFilter, Transaction, LendingNotification, Expense, Income } from '../types';
import {
  formatCurrency, formatDate, getCurrentMonth,
  getMonthName, getMonthYearLabel, cn,
} from '../utils';
import { subMonths } from 'date-fns';
import { loadDemoData } from '../utils/demoData';

// ── Clean Sophisticated Pie & Chart Colors ──
const PIE_COLORS = [
  '#18181b', // Zinc 900
  '#2563eb', // Blue 600
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#8b5cf6', // Purple 500
  '#ec4899', // Pink 500
  '#06b6d4', // Cyan 500
  '#64748b', // Slate 500
];

const EARNED_PALETTE = ['#10b981', '#059669', '#14b8a6', '#0d9488', '#06b6d4', '#0284c7'];
const SPENT_PALETTE = ['#f43f5e', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#d97706', '#6366f1'];

// ── Minimalist Tooltip for Bar & Area Charts ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-md text-zinc-900 dark:text-zinc-100 z-50">
      <p className="font-semibold text-zinc-950 dark:text-zinc-50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono-num">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ── Sleek Minimalist Tooltip for Pie Charts ──
function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const itemType = p.payload?.type;
  const desc = p.payload?.desc;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-xs shadow-xl text-zinc-900 dark:text-zinc-100 z-50 pointer-events-none select-none min-w-[150px]">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
          style={{ backgroundColor: p.payload?.fill || p.payload?.color || p.color }}
        />
        <span className="font-bold text-zinc-950 dark:text-zinc-50">{p.payload?.category || p.name}</span>
        {itemType && (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
            itemType === 'earned'
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
          )}>
            {itemType}
          </span>
        )}
      </div>
      {desc && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5">{desc}</p>
      )}
      <div className="text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
        <span className="text-[11px]">Amount:</span>
        <span className="font-bold text-zinc-950 dark:text-zinc-50 font-mono-num">{formatCurrency(p.value)}</span>
      </div>
    </div>
  );
}

interface DashboardData {
  filterLabel: string;
  totalPrincipalLent: number;
  outstandingPrincipal: number;
  yourBusinessAmount: number;
  othersBusinessAmount: number;
  emiBusinessAmount: number;
  interestCollectedMonth: number;
  interestExpectedMonth: number;
  interestPendingMonth: number;
  totalLifetimeInterest: number;
  activeLoansCount: number;

  totalLent: number;
  totalReturned: number;
  outstandingPersonal: number;

  totalBalance: number;
  monthlyIncoming: number;
  monthlyOutgoing: number;

  totalIncomeMonth: number;
  totalExpensesMonth: number;
  netCashFlow: number;
  interestIncomeMonth: number;
  otherIncomeMonth: number;
  spentOnMe: number;
  spentOnGirlfriend: number;
  spentOnFamily: number;

  incomeVsExpensesData: { month: string; income: number; expenses: number }[];
  monthlyInterestData: { month: string; collected: number }[];
  expenseCategoryData: { name: string; value: number }[];
  incomeCategoryData: { name: string; value: number }[];
  spentForData: { name: string; value: number }[];
  bankBalanceData: { name: string; value: number }[];

  notifications: LendingNotification[];
  recentTransactions: Transaction[];
}

type FilterType = DashboardFilter['type'];

export default function Dashboard() {
  const { bankAccounts, refreshBankAccounts, theme } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('this_month');
  const [spentEarnedPieView, setSpentEarnedPieView] = useState<'all' | 'spent' | 'earned'>('all');
  const [expensePieView, setExpensePieView] = useState<'category' | 'recipient'>('category');
  const [hoveredNetWorthIndex, setHoveredNetWorthIndex] = useState<number>(-1);

  const chartGridStroke = theme === 'dark' ? '#27272a' : '#f4f4f5';
  const chartAxisStroke = theme === 'dark' ? '#71717a' : '#a1a1aa';
  const chartBarPrimary = theme === 'dark' ? '#f4f4f5' : '#18181b';
  const chartBarSecondary = theme === 'dark' ? '#52525b' : '#a1a1aa';
  const pieStrokeColor = theme === 'dark' ? '#18181b' : '#ffffff';

  const getFilterRange = useCallback(() => {
    const now = new Date();
    switch (filterType) {
      case 'this_month': {
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        return { mode: 'month' as const, month: m, year: y, label: getMonthYearLabel(m, y) };
      }
      case 'previous_month': {
        const prev = subMonths(now, 1);
        const m = prev.getMonth() + 1;
        const y = prev.getFullYear();
        return { mode: 'month' as const, month: m, year: y, label: getMonthYearLabel(m, y) };
      }
      case 'this_year': {
        const y = now.getFullYear();
        return { mode: 'year' as const, month: 0, year: y, label: `Year ${y}` };
      }
      case 'previous_year': {
        const y = now.getFullYear() - 1;
        return { mode: 'year' as const, month: 0, year: y, label: `Year ${y}` };
      }
      case 'all_time':
      default:
        return { mode: 'all' as const, month: -1, year: 0, label: 'All-Time Overview' };
    }
  }, [filterType]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getFilterRange();
      const current = getCurrentMonth();

      // Ensure active business loans are carried forward & statuses refreshed
      await businessLendingService.carryForwardLoans(current.month, current.year);
      await businessLendingService.refreshStatuses();

      // Business Lending Portfolio totals
      const [
        totalPrincipalLent,
        outstandingPrincipal,
        totalLifetimeInterest,
        activeLoans,
        businessBreakdown,
      ] = await Promise.all([
        businessLendingService.getTotalPrincipalLent(),
        businessLendingService.getOutstandingPrincipal(),
        businessLendingService.getTotalLifetimeInterestCollected(),
        businessLendingService.getActiveLoans(),
        businessLendingService.getYourBusinessAmount(),
      ]);

      // Filtered Collections & Incomes
      let interestCollectedMonth = 0;
      let interestExpectedMonth = 0;
      let interestPendingMonth = 0;

      if (range.mode === 'month') {
        [interestCollectedMonth, interestExpectedMonth, interestPendingMonth] = await Promise.all([
          businessLendingService.getInterestCollectedForMonth(range.month, range.year),
          businessLendingService.getInterestExpectedForMonth(range.month, range.year),
          businessLendingService.getInterestPendingForMonth(range.month, range.year),
        ]);
      } else if (range.mode === 'year') {
        interestExpectedMonth = await businessLendingService.getInterestExpectedForMonth(current.month, current.year);
        interestPendingMonth = await businessLendingService.getInterestPendingForMonth(current.month, current.year);
        for (let m = 1; m <= 12; m++) {
          interestCollectedMonth += await businessLendingService.getInterestCollectedForMonth(m, range.year);
        }
      } else {
        interestCollectedMonth = totalLifetimeInterest;
        interestExpectedMonth = await businessLendingService.getInterestExpectedForMonth(current.month, current.year);
        interestPendingMonth = await businessLendingService.getInterestPendingForMonth(current.month, current.year);
      }

      // Personal Lending
      const [totalLent, totalReturned, outstandingPersonal] = await Promise.all([
        personalLendingService.getTotalLent(),
        personalLendingService.getTotalReturned(),
        personalLendingService.getTotalOutstanding(),
      ]);

      // Banking total
      const totalBalance = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

      // Incoming / Outgoing
      let monthlyIncoming = 0;
      let monthlyOutgoing = 0;
      if (range.mode === 'month') {
        [monthlyIncoming, monthlyOutgoing] = await Promise.all([
          transactionService.getMonthlyIncoming(range.month, range.year),
          transactionService.getMonthlyOutgoing(range.month, range.year),
        ]);
      }

      // Filtered Expenses & Incomes
      let expenses: Expense[] = [];
      let incomes: Income[] = [];

      if (range.mode === 'month') {
        expenses = await expenseService.getByMonth(range.month, range.year);
        incomes = await incomeService.getByMonth(range.month, range.year);
      } else if (range.mode === 'year') {
        const startDate = `${range.year}-01-01`;
        const endDate = `${range.year + 1}-01-01`;
        expenses = await db.expenses.where('date').between(startDate, endDate, true, false).toArray();
        incomes = await db.incomes.where('date').between(startDate, endDate, true, false).toArray();
      } else {
        expenses = await expenseService.getAll();
        incomes = await incomeService.getAll();
      }

      const totalExpensesMonth = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalIncomeMonth = incomes.reduce((sum, i) => sum + i.amount, 0);
      const interestIncomeMonth = incomes
        .filter((i) => i.source === 'Business Interest')
        .reduce((sum, i) => sum + i.amount, 0);
      const otherIncomeMonth = totalIncomeMonth - interestIncomeMonth;

      // Spent By Category breakdown
      const catMap = new Map<string, number>();
      for (const e of expenses) {
        catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
      }
      const expenseCategoryData = Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Earned By Source breakdown
      const incMap = new Map<string, number>();
      for (const inc of incomes) {
        incMap.set(inc.source, (incMap.get(inc.source) || 0) + inc.amount);
      }
      const incomeCategoryData = Array.from(incMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // Spent For breakdown (Me, Girlfriend, Family, Other)
      const spentMap = new Map<string, number>();
      for (const e of expenses) {
        spentMap.set(e.spentFor, (spentMap.get(e.spentFor) || 0) + e.amount);
      }
      const spentForData = Array.from(spentMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const spentOnMe = spentMap.get('Me') || 0;
      const spentOnGirlfriend = spentMap.get('Girlfriend') || 0;
      const spentOnFamily = spentMap.get('Family') || 0;

      // Bank balance distribution (only accounts with positive balance)
      const bankBalanceData = bankAccounts
        .filter((a) => (a.currentBalance || 0) > 0)
        .map((a) => ({
          name: a.nickname,
          value: a.currentBalance || 0,
        }))
        .sort((a, b) => b.value - a.value);

      // Charts (Last 6 Months History)
      const now = new Date();
      const incomeVsExpensesData: { month: string; income: number; expenses: number }[] = [];
      const monthlyInterestData: { month: string; collected: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const mName = getMonthName(m).slice(0, 3);

        const [mInc, mExp, mInt] = await Promise.all([
          incomeService.getTotalForMonth(m, y),
          expenseService.getTotalForMonth(m, y),
          businessLendingService.getInterestCollectedForMonth(m, y),
        ]);

        incomeVsExpensesData.push({ month: mName, income: mInc, expenses: mExp });
        monthlyInterestData.push({ month: mName, collected: mInt });
      }

      // Notifications (Upcoming / Pending Interest)
      const activeRecords = await businessLendingService.getMonthlyRecords(current.month, current.year);
      const notifications: LendingNotification[] = [];
      for (const rec of activeRecords) {
        const pendingVal = rec.pendingAmount || rec.expectedInterest || 0;
        if (rec.status === 'due_today') {
          notifications.push({
            id: rec.id,
            type: 'due_today',
            loanId: rec.loanId,
            recordId: rec.id,
            amount: pendingVal,
            dueDate: rec.dueDate,
            message: `${formatCurrency(pendingVal)} interest due today`,
          });
        } else if (rec.status === 'pending') {
          notifications.push({
            id: rec.id,
            type: 'pending',
            loanId: rec.loanId,
            recordId: rec.id,
            amount: pendingVal,
            dueDate: rec.dueDate,
            message: `${formatCurrency(pendingVal)} interest pending`,
          });
        }
      }

      // Recent Transactions
      const recentTransactions = await transactionService.getRecentTransactions(8);

      setData({
        filterLabel: range.label,
        totalPrincipalLent,
        outstandingPrincipal,
        yourBusinessAmount: businessBreakdown.yourAmount,
        othersBusinessAmount: businessBreakdown.othersMoney,
        emiBusinessAmount: businessBreakdown.totalEmiAmount,
        interestCollectedMonth,
        interestExpectedMonth,
        interestPendingMonth,
        totalLifetimeInterest,
        activeLoansCount: activeLoans.length,
        totalLent,
        totalReturned,
        outstandingPersonal,
        totalBalance,
        monthlyIncoming,
        monthlyOutgoing,
        totalIncomeMonth,
        totalExpensesMonth,
        netCashFlow: totalIncomeMonth - totalExpensesMonth,
        interestIncomeMonth,
        otherIncomeMonth,
        spentOnMe,
        spentOnGirlfriend,
        spentOnFamily,
        incomeVsExpensesData,
        monthlyInterestData,
        expenseCategoryData,
        incomeCategoryData,
        spentForData,
        bankBalanceData,
        notifications,
        recentTransactions,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [getFilterRange, bankAccounts]);

  useEffect(() => {
    loadData();
    const handleReset = () => {
      loadData();
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [loadData]);

  // Datasets for Spent vs Earned Pie Chart indicating categories
  const earnedSlices = useMemo(() => {
    if (!data?.incomeCategoryData) return [];
    return data.incomeCategoryData.map((item, idx) => ({
      name: `${item.name} (Earned)`,
      category: item.name,
      type: 'earned' as const,
      value: item.value,
      color: EARNED_PALETTE[idx % EARNED_PALETTE.length],
    }));
  }, [data?.incomeCategoryData]);

  const spentSlices = useMemo(() => {
    if (!data?.expenseCategoryData) return [];
    return data.expenseCategoryData.map((item, idx) => ({
      name: `${item.name} (Spent)`,
      category: item.name,
      type: 'spent' as const,
      value: item.value,
      color: SPENT_PALETTE[idx % SPENT_PALETTE.length],
    }));
  }, [data?.expenseCategoryData]);

  const activeSpentEarnedData = useMemo(() => {
    if (spentEarnedPieView === 'spent') return spentSlices;
    if (spentEarnedPieView === 'earned') return earnedSlices;
    return [...earnedSlices, ...spentSlices];
  }, [spentEarnedPieView, earnedSlices, spentSlices]);

  const hasSpentEarnedData = activeSpentEarnedData.length > 0 && activeSpentEarnedData.some((d) => d.value > 0);

  // Net Worth Breakdown Data
  // STRICT USER REQUIREMENT:
  // ONLY ADD "YOUR AMOUNT" from the business page (Total Business Amount - EMI Money - Others Money).
  // NEVER add the entire circulating amount (outstandingPrincipal).
  const netWorthBusiness = data?.yourBusinessAmount || 0;
  const netWorthPersonal = data?.outstandingPersonal || 0;
  const netWorthBank = data?.totalBalance || 0;
  const totalNetWorth = netWorthBusiness + netWorthPersonal + netWorthBank;

  const netWorthChartData = useMemo(() => {
    return [
      {
        name: 'Your Amount (Business)',
        category: 'Your Amount (Business)',
        value: netWorthBusiness,
        color: '#2563eb', // Blue 600
        desc: 'Total Business - EMI - Others',
      },
      {
        name: 'Personal Loans Money',
        category: 'Personal Loans Money',
        value: netWorthPersonal,
        color: '#8b5cf6', // Purple 500
        desc: 'Friends & family receivable',
      },
      {
        name: 'Money in Bank Accounts',
        category: 'Money in Bank Accounts',
        value: netWorthBank,
        color: '#10b981', // Emerald 500
        desc: 'Liquid balances in bank accounts',
      },
    ].filter((d) => d.value > 0);
  }, [netWorthBusiness, netWorthPersonal, netWorthBank]);

  // Active dataset for Expense Donut (fallback / secondary)
  const activeExpensePieData = data ? (expensePieView === 'category' ? data.expenseCategoryData : data.spentForData) : [];
  const hasExpenseData = activeExpensePieData.length > 0 && activeExpensePieData.some((d) => d.value > 0);
  const hasBankData = Boolean(data && data.bankBalanceData.length > 0 && data.bankBalanceData.some((d) => d.value > 0));

  if (loading && !data) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-zinc-500">Failed to load dashboard data.</p>
        <Button onClick={loadData}>Retry</Button>
      </div>
    );
  }

  const filterTabs = [
    { key: 'this_month', label: 'This Month' },
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'this_year', label: 'This Year' },
    { key: 'all_time', label: 'All Time' },
  ];

  return (
    <div className="space-y-8">
      {/* Top Welcome / Sample Data Banner (Only if empty database) */}
      {data.totalBalance === 0 && data.totalPrincipalLent === 0 && data.recentTransactions.length === 0 && (
        <Card className="p-6 border-zinc-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Welcome to Ledgerly</h3>
            <p className="text-xs text-zinc-600 mt-0.5">
              Load sample notebook records (₹15k, ₹20k, ₹5k, ₹10k) and accounts to preview all charts and calculations.
            </p>
          </div>
          <Button
            size="sm"
            onClick={async () => {
              await loadDemoData();
              await refreshBankAccounts();
              await loadData();
            }}
          >
            Load Sample Data
          </Button>
        </Card>
      )}

      {/* Date Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800">
        <Tabs
          tabs={filterTabs}
          activeTab={filterType}
          onChange={(key) => setFilterType(key as FilterType)}
        />
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Period: <span className="text-zinc-950 dark:text-zinc-50 font-bold">{data.filterLabel}</span>
        </div>
      </div>

      {/* ── Net Worth Section ── */}
      <section className="space-y-3">
        <Card className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Net Worth KPI (4 cols) */}
            <div className="lg:col-span-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total Net Worth
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-zinc-50 font-mono-num tracking-tight">
                {formatCurrency(totalNetWorth)}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Calculated strictly from <strong>Your Amount</strong> in business lending + personal loans receivable + bank balances.
              </p>
              <div className="pt-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono-num">
                (Borrowed funds &amp; EMI money excluded from business total)
              </div>
            </div>

            {/* Center: Donut / Pie Chart (3 cols) */}
            <div className="lg:col-span-3 flex justify-center items-center">
              <div className="w-48 h-48 sm:w-52 sm:h-52 relative flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={netWorthChartData.length > 0 ? netWorthChartData : [{ name: 'Empty', category: 'None', value: 1, color: '#e4e4e7' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={netWorthChartData.length > 1 ? 3 : 0}
                      dataKey="value"
                      nameKey="name"
                      onMouseEnter={(_, index) => setHoveredNetWorthIndex(index)}
                      onMouseLeave={() => setHoveredNetWorthIndex(-1)}
                    >
                      {(netWorthChartData.length > 0 ? netWorthChartData : [{ name: 'Empty', category: 'None', value: 1, color: '#e4e4e7' }]).map((entry, index) => (
                        <Cell
                          key={`nw-cell-${entry.name}-${index}`}
                          fill={entry.color}
                          stroke={hoveredNetWorthIndex === index ? entry.color : pieStrokeColor}
                          strokeWidth={hoveredNetWorthIndex === index ? 3 : 2}
                          className="cursor-pointer transition-all duration-150"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Clean Center Display - Dynamically shows active slice on hover or Total Net Worth without collision */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2 select-none">
                  {hoveredNetWorthIndex >= 0 && netWorthChartData[hoveredNetWorthIndex] ? (
                    <div className="animate-fade-in flex flex-col items-center">
                      <span
                        className="text-[10px] uppercase font-bold tracking-wider truncate max-w-[110px]"
                        style={{ color: netWorthChartData[hoveredNetWorthIndex].color }}
                      >
                        {netWorthChartData[hoveredNetWorthIndex].category}
                      </span>
                      <span className="text-sm font-extrabold text-zinc-950 dark:text-zinc-50 font-mono-num tracking-tight mt-0.5">
                        {formatCurrency(netWorthChartData[hoveredNetWorthIndex].value)}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 font-mono-num">
                        {totalNetWorth > 0 ? `${Math.round((netWorthChartData[hoveredNetWorthIndex].value / totalNetWorth) * 100)}%` : '0%'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">
                        Net Worth
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-zinc-950 dark:text-zinc-50 font-mono-num tracking-tight mt-0.5">
                        {formatCurrency(totalNetWorth)}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-medium tracking-tight">
                        Combined Total
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Three Category Breakdown Cards / Clear Legend (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-2.5">
              {/* 1. Your Amount (Business) */}
              <div
                onMouseEnter={() => setHoveredNetWorthIndex(0)}
                onMouseLeave={() => setHoveredNetWorthIndex(-1)}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  hoveredNetWorthIndex === 0
                    ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                    : "border-blue-200/70 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-600/20" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block truncate">
                        Your Amount (Business)
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                        Total ({formatCurrency(data.outstandingPrincipal)}) − EMI ({formatCurrency(data.emiBusinessAmount)}) − Others ({formatCurrency(data.othersBusinessAmount)})
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 font-mono-num block">
                      {formatCurrency(netWorthBusiness)}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 font-mono-num">
                      {totalNetWorth > 0 ? `${Math.round((netWorthBusiness / totalNetWorth) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Personal Loans Money */}
              <div
                onMouseEnter={() => setHoveredNetWorthIndex(1)}
                onMouseLeave={() => setHoveredNetWorthIndex(-1)}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  hoveredNetWorthIndex === 1
                    ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 ring-2 ring-purple-500/20"
                    : "border-purple-200/70 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shrink-0 ring-2 ring-purple-500/20" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block truncate">
                        Personal Loans Money
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                        Friends &amp; family receivable
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 font-mono-num block">
                      {formatCurrency(netWorthPersonal)}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 font-mono-num">
                      {totalNetWorth > 0 ? `${Math.round((netWorthPersonal / totalNetWorth) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Money in Bank Accounts */}
              <div
                onMouseEnter={() => setHoveredNetWorthIndex(2)}
                onMouseLeave={() => setHoveredNetWorthIndex(-1)}
                className={cn(
                  "p-3.5 rounded-xl border transition-all cursor-pointer",
                  hoveredNetWorthIndex === 2
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20"
                    : "border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-500/20" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 block truncate">
                        Money in Bank Accounts
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block -mt-0.5">
                        Liquid savings &amp; current balances
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-bold text-zinc-950 dark:text-zinc-50 font-mono-num block">
                      {formatCurrency(netWorthBank)}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono-num">
                      {totalNetWorth > 0 ? `${Math.round((netWorthBank / totalNetWorth) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* 1. Cash Flow Highlights */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Cash Flow & Profit
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Net: <strong className={data.netCashFlow >= 0 ? 'text-zinc-950 dark:text-zinc-50' : 'text-red-600 dark:text-red-400'}>{formatCurrency(data.netCashFlow)}</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Realized Income"
            value={formatCurrency(data.totalIncomeMonth)}
            subtitle="Includes collected interest"
          />
          <StatCard
            label="Total Expenses"
            value={formatCurrency(data.totalExpensesMonth)}
            subtitle="Categorized spending"
          />
          <StatCard
            label="Net Profit / Cash Flow"
            value={formatCurrency(data.netCashFlow)}
            subtitle="Income minus expenses"
          />
          <StatCard
            label="Total Bank Balances"
            value={formatCurrency(data.totalBalance)}
            subtitle="Across all active accounts"
          />
        </div>
      </section>

      {/* 2. Business Lending Portfolio */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Business Lending Portfolio
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Your Amount"
            value={formatCurrency(data.yourBusinessAmount)}
            subtitle="Total − EMI − Others"
            className="px-2.5 py-3 xl:px-3 xl:py-3.5"
            valueClassName="text-sm sm:text-base lg:text-[1.05rem] xl:text-[1.1rem] 2xl:text-xl font-bold tracking-tight"
          />
          <StatCard
            label="Total in Circulation"
            value={formatCurrency(data.outstandingPrincipal)}
            subtitle={`${data.activeLoansCount} active loans`}
            className="px-2.5 py-3 xl:px-3 xl:py-3.5"
            valueClassName="text-sm sm:text-base lg:text-[1.05rem] xl:text-[1.1rem] 2xl:text-xl font-bold tracking-tight"
          />
          <StatCard
            label="Interest Collected"
            value={formatCurrency(data.interestCollectedMonth)}
            subtitle="Earned this period"
            className="px-2.5 py-3 xl:px-3 xl:py-3.5"
            valueClassName="text-sm sm:text-base lg:text-[1.05rem] xl:text-[1.1rem] 2xl:text-xl font-bold tracking-tight"
          />
          <StatCard
            label="Interest Pending"
            value={formatCurrency(data.interestPendingMonth)}
            subtitle="Due for collection"
            className="px-2.5 py-3 xl:px-3 xl:py-3.5"
            valueClassName="text-sm sm:text-base lg:text-[1.05rem] xl:text-[1.1rem] 2xl:text-xl font-bold tracking-tight"
          />
          <StatCard
            label="Lifetime Interest"
            value={formatCurrency(data.totalLifetimeInterest)}
            subtitle="Cumulative profit"
            className="px-2.5 py-3 xl:px-3 xl:py-3.5"
            valueClassName="text-sm sm:text-base lg:text-[1.05rem] xl:text-[1.1rem] 2xl:text-xl font-bold tracking-tight"
          />
        </div>
      </section>

      {/* 3. Personal Lending & Spending */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Personal Lending & Family Spending
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Friends & Family Loans"
            value={formatCurrency(data.outstandingPersonal)}
            subtitle="Interest-free receivable"
          />
          <StatCard
            label="Spent on Girlfriend"
            value={formatCurrency(data.spentOnGirlfriend)}
            subtitle="Gifts, dining & personal"
          />
          <StatCard
            label="Spent on Myself"
            value={formatCurrency(data.spentOnMe)}
            subtitle="Self expenses & fitness"
          />
          <StatCard
            label="Spent on Family"
            value={formatCurrency(data.spentOnFamily)}
            subtitle="Household & support"
          />
        </div>
      </section>

      {/* 4. PIE CHARTS SECTION - Expense Breakdown & Bank Allocation */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PieChartIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Portfolio & Expense Allocation
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: Spent vs Earned Breakdown (Donut / Pie Chart indicating categories) */}
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Spent vs Earned Breakdown
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {spentEarnedPieView === 'all'
                      ? 'Categorized spending vs earned income sources'
                      : spentEarnedPieView === 'spent'
                      ? 'Categorized expenditures'
                      : 'Earned income sources'}
                  </p>
                </div>
                {/* View Filter Toggles */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSpentEarnedPieView('all')}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                      spentEarnedPieView === 'all'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpentEarnedPieView('spent')}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                      spentEarnedPieView === 'spent'
                        ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    )}
                  >
                    Spent ({formatCurrency(data.totalExpensesMonth)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpentEarnedPieView('earned')}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                      spentEarnedPieView === 'earned'
                        ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    )}
                  >
                    Earned ({formatCurrency(data.totalIncomeMonth)})
                  </button>
                </div>
              </div>

              {hasSpentEarnedData ? (
                <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                  {/* Pie / Donut Canvas */}
                  <div className="w-48 h-48 sm:w-52 sm:h-52 relative flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomPieTooltip />} />
                        <Pie
                          data={activeSpentEarnedData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {activeSpentEarnedData.map((entry, index) => (
                            <Cell
                              key={`cell-${entry.name}-${index}`}
                              fill={entry.color}
                              stroke={pieStrokeColor}
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                      {spentEarnedPieView === 'all' ? (
                        <>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">
                            {data.netCashFlow >= 0 ? 'Net Profit' : 'Net Deficit'}
                          </span>
                          <span className={cn(
                            "text-xs sm:text-sm font-bold font-mono-num",
                            data.netCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {data.netCashFlow >= 0 ? `+${formatCurrency(data.netCashFlow)}` : formatCurrency(data.netCashFlow)}
                          </span>
                        </>
                      ) : spentEarnedPieView === 'spent' ? (
                        <>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">
                            Total Spent
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 font-mono-num">
                            {formatCurrency(data.totalExpensesMonth)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">
                            Total Earned
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono-num">
                            {formatCurrency(data.totalIncomeMonth)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Legend List Grouped by Earned & Spent Categories */}
                  <div className="w-full space-y-3 max-h-56 overflow-y-auto pr-1">
                    {spentEarnedPieView !== 'spent' && earnedSlices.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider pb-1 border-b border-emerald-100 dark:border-emerald-900/40">
                          <span>Earned Income</span>
                          <span className="font-mono-num">{formatCurrency(data.totalIncomeMonth)}</span>
                        </div>
                        {earnedSlices.map((item) => {
                          const pct = data.totalIncomeMonth > 0 ? Math.round((item.value / data.totalIncomeMonth) * 100) : 0;
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{item.category}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono-num">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(item.value)}</span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-8 text-right">({pct}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {spentEarnedPieView !== 'earned' && spentSlices.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider pb-1 border-b border-rose-100 dark:border-rose-900/40">
                          <span>Spent Expenses</span>
                          <span className="font-mono-num">{formatCurrency(data.totalExpensesMonth)}</span>
                        </div>
                        {spentSlices.map((item) => {
                          const pct = data.totalExpensesMonth > 0 ? Math.round((item.value / data.totalExpensesMonth) * 100) : 0;
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{item.category}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono-num">
                                <span className="font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(item.value)}</span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-8 text-right">({pct}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-52 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-xs">
                  <Receipt className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                  <span>No spent or earned entries for this period</span>
                </div>
              )}
            </div>
          </Card>

          {/* Card B: Bank Balance Allocation (Donut / Pie Chart) */}
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Bank Balance Allocation
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Liquid wealth distribution across accounts</p>
                </div>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full">
                  {bankAccounts.length} {bankAccounts.length === 1 ? 'Account' : 'Accounts'}
                </span>
              </div>

              {hasBankData ? (
                <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                  {/* Pie / Donut Canvas */}
                  <div className="w-48 h-48 sm:w-52 sm:h-52 relative flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomPieTooltip />} />
                        <Pie
                          data={data.bankBalanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >
                          {data.bankBalanceData.map((entry, index) => (
                            <Cell
                              key={`bank-cell-${entry.name}-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                              stroke={pieStrokeColor}
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-medium tracking-wider">Total</span>
                      <span className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-zinc-50 font-mono-num">
                        {formatCurrency(data.totalBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Legend List */}
                  <div className="w-full space-y-2 max-h-52 overflow-y-auto pr-1">
                    {data.bankBalanceData.map((item, index) => {
                      const pct = data.totalBalance > 0 ? Math.round((item.value / data.totalBalance) * 100) : 0;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                            />
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono-num">
                            <span className="font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(item.value)}</span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-8 text-right">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-52 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-xs">
                  <Landmark className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                  <span>No active bank balances</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* 5. Minimalist Historical Trends */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card className="p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
            Income vs Expenses (Last 6 Months)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.incomeVsExpensesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="month" stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income" name="Income" fill={chartBarPrimary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={chartBarSecondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Interest Collections Area Chart */}
        <Card className="p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
            Lending Interest Yields (Last 6 Months)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyInterestData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="month" stroke={chartAxisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={chartAxisStroke} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Interest Collected"
                  stroke={chartBarPrimary}
                  fill={chartBarPrimary}
                  fillOpacity={theme === 'dark' ? 0.15 : 0.05}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* 6. Bank Accounts & Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Balances */}
        <Card className="p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Bank Account Balances
          </h4>
          <div className="space-y-2.5">
            {bankAccounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60"
              >
                <div>
                  <p className="text-xs font-bold text-zinc-950 dark:text-zinc-100">{acc.nickname}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{acc.bankName} {acc.lastFourDigits ? `(•• ${acc.lastFourDigits})` : ''}</p>
                </div>
                <span className="text-sm font-bold font-mono-num text-zinc-950 dark:text-zinc-50">
                  {formatCurrency(acc.currentBalance)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recent Activity
          </h4>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentTransactions.map((tx) => {
              const isIncome = ['income', 'interest_collection', 'business_principal_returned', 'personal_repayment'].includes(tx.type);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{tx.description}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatDate(tx.date)}</p>
                  </div>
                  <span className={cn('text-xs font-bold font-mono-num whitespace-nowrap', isIncome ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400')}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
