// ============================================================
// Ledgerly - Reports Page
// Monthly, Yearly & All-Time Comprehensive Financial Reports
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  Heart,
  Landmark,
  Briefcase,
  Users,
  Clock,
  Sparkles,
  PieChart as PieIcon,
  Layers,
  ArrowDownLeft,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  businessLendingService,
  personalLendingService,
  expenseService,
  incomeService,
  transactionService,
} from '../services';
import { db } from '../db';
import type { MonthYear } from '../types';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  getCurrentMonth,
  getMonthName,
  getMonthYearLabel,
  MONTHS,
  cn,
} from '../utils';
import {
  Card,
  StatCard,
  Button,
  Tabs,
  Badge,
  LoadingSpinner,
  PageHeader,
} from '../components/ui';

const COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#ef4444', '#7c3aed',
];

export default function Reports() {
  const { bankAccounts } = useApp();

  const current = getCurrentMonth();
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'all_time'>('monthly');

  // Selectors
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);

  const [loading, setLoading] = useState(true);

  // Monthly Report Data
  const [monthlyData, setMonthlyData] = useState({
    interestCollected: 0,
    otherIncome: 0,
    totalIncome: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    sarayuSpending: 0,
    businessPrincipalLent: 0,
    businessPrincipalReturned: 0,
    personalLent: 0,
    personalReturned: 0,
    pendingInterest: 0,
    categoryBreakdown: [] as { category: string; total: number }[],
    spentForBreakdown: [] as { spentFor: string; total: number }[],
  });

  // Yearly Report Data
  const [yearlyData, setYearlyData] = useState({
    annualInterest: 0,
    annualOtherIncome: 0,
    annualTotalIncome: 0,
    annualExpenses: 0,
    annualNetCashFlow: 0,
    annualSarayuSpending: 0,
    outstandingPrincipal: 0,
    outstandingPersonal: 0,
    categoryBreakdown: [] as { category: string; total: number }[],
    monthlyComparison: [] as { month: string; income: number; expenses: number; net: number }[],
  });

  // All-Time Report Data
  const [allTimeData, setAllTimeData] = useState({
    lifetimeInterest: 0,
    lifetimeOtherIncome: 0,
    lifetimeIncome: 0,
    lifetimeExpenses: 0,
    lifetimeNetCashFlow: 0,
    totalPrincipalLent: 0,
    outstandingPrincipal: 0,
    totalPersonalLent: 0,
    outstandingPersonal: 0,
    totalBankBalance: 0,
    yearlyTrend: [] as { year: string; income: number; expenses: number; net: number }[],
  });

  // Load Monthly Data
  const loadMonthlyData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        interestCol,
        pendingInt,
        otherInc,
        totExp,
        catBreak,
        spentForBreak,
        sarayuSpend,
        txs,
      ] = await Promise.all([
        businessLendingService.getInterestCollectedForMonth(selectedMonth, selectedYear),
        businessLendingService.getInterestPendingForMonth(selectedMonth, selectedYear),
        incomeService.getNonInterestIncomeForMonth(selectedMonth, selectedYear),
        expenseService.getTotalForMonth(selectedMonth, selectedYear),
        expenseService.getByCategory(selectedMonth, selectedYear),
        expenseService.getBySpentFor(selectedMonth, selectedYear),
        expenseService.getSarayuSpending(selectedMonth, selectedYear),
        transactionService.getByMonth(selectedMonth, selectedYear),
      ]);

      const totInc = interestCol + otherInc;
      const net = totInc - totExp;

      let bLent = 0;
      let bReturned = 0;
      let pLent = 0;
      let pReturned = 0;

      for (const t of txs) {
        if (t.type === 'business_principal_lent') bLent += t.amount;
        if (t.type === 'business_principal_returned') bReturned += t.amount;
        if (t.type === 'personal_lent') pLent += t.amount;
        if (t.type === 'personal_repayment') pReturned += t.amount;
      }

      setMonthlyData({
        interestCollected: interestCol,
        otherIncome: otherInc,
        totalIncome: totInc,
        totalExpenses: totExp,
        netCashFlow: net,
        sarayuSpending: sarayuSpend,
        businessPrincipalLent: bLent,
        businessPrincipalReturned: bReturned,
        personalLent: pLent,
        personalReturned: pReturned,
        pendingInterest: pendingInt,
        categoryBreakdown: catBreak,
        spentForBreakdown: spentForBreak,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Load Yearly Data
  const loadYearlyData = useCallback(async () => {
    setLoading(true);
    try {
      let annInterest = 0;
      let annOther = 0;
      let annExp = 0;
      const monthlyComp: { month: string; income: number; expenses: number; net: number }[] = [];
      const catMap = new Map<string, number>();
      let annSarayu = 0;

      for (let m = 1; m <= 12; m++) {
        const [mInt, mOther, mExp, mCats, mSarayu] = await Promise.all([
          businessLendingService.getInterestCollectedForMonth(m, selectedYear),
          incomeService.getNonInterestIncomeForMonth(m, selectedYear),
          expenseService.getTotalForMonth(m, selectedYear),
          expenseService.getByCategory(m, selectedYear),
          expenseService.getSarayuSpending(m, selectedYear),
        ]);

        const mInc = mInt + mOther;
        annInterest += mInt;
        annOther += mOther;
        annExp += mExp;
        annSarayu += mSarayu;

        mCats.forEach((c) => {
          catMap.set(c.category, (catMap.get(c.category) || 0) + c.total);
        });

        monthlyComp.push({
          month: MONTHS[m - 1].slice(0, 3),
          income: mInc,
          expenses: mExp,
          net: mInc - mExp,
        });
      }

      const [outPrinc, outPers] = await Promise.all([
        businessLendingService.getOutstandingPrincipal(),
        personalLendingService.getTotalOutstanding(),
      ]);

      setYearlyData({
        annualInterest: annInterest,
        annualOtherIncome: annOther,
        annualTotalIncome: annInterest + annOther,
        annualExpenses: annExp,
        annualNetCashFlow: annInterest + annOther - annExp,
        annualSarayuSpending: annSarayu,
        outstandingPrincipal: outPrinc,
        outstandingPersonal: outPers,
        categoryBreakdown: Array.from(catMap.entries())
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total),
        monthlyComparison: monthlyComp,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  // Load All-Time Data
  const loadAllTimeData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        lifeInt,
        allIncomes,
        allExpenses,
        totPrincLent,
        outPrinc,
        totPersLent,
        outPers,
      ] = await Promise.all([
        businessLendingService.getTotalLifetimeInterestCollected(),
        incomeService.getAll(),
        expenseService.getAll(),
        businessLendingService.getTotalPrincipalLent(),
        businessLendingService.getOutstandingPrincipal(),
        personalLendingService.getTotalLent(),
        personalLendingService.getTotalOutstanding(),
      ]);

      const otherInc = allIncomes
        .filter((i) => i.source !== 'Business Interest')
        .reduce((sum, i) => sum + i.amount, 0);

      const totExp = allExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totInc = lifeInt + otherInc;
      const net = totInc - totExp;

      const totalBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

      // Build Yearly Trend from 2024 to 2026
      const years = [2024, 2025, 2026];
      const trend: { year: string; income: number; expenses: number; net: number }[] = [];

      for (const y of years) {
        let yInt = 0;
        let yOther = 0;
        let yExp = 0;
        for (let m = 1; m <= 12; m++) {
          const [mInt, mOther, mExp] = await Promise.all([
            businessLendingService.getInterestCollectedForMonth(m, y),
            incomeService.getNonInterestIncomeForMonth(m, y),
            expenseService.getTotalForMonth(m, y),
          ]);
          yInt += mInt;
          yOther += mOther;
          yExp += mExp;
        }
        const yInc = yInt + yOther;
        trend.push({
          year: String(y),
          income: yInc,
          expenses: yExp,
          net: yInc - yExp,
        });
      }

      setAllTimeData({
        lifetimeInterest: lifeInt,
        lifetimeOtherIncome: otherInc,
        lifetimeIncome: totInc,
        lifetimeExpenses: totExp,
        lifetimeNetCashFlow: net,
        totalPrincipalLent: totPrincLent,
        outstandingPrincipal: outPrinc,
        totalPersonalLent: totPersLent,
        outstandingPersonal: outPers,
        totalBankBalance: totalBalance,
        yearlyTrend: trend,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [bankAccounts]);

  // Trigger loading based on active report type
  useEffect(() => {
    if (reportType === 'monthly') loadMonthlyData();
    else if (reportType === 'yearly') loadYearlyData();
    else loadAllTimeData();

    const handleReset = () => {
      if (reportType === 'monthly') loadMonthlyData();
      else if (reportType === 'yearly') loadYearlyData();
      else loadAllTimeData();
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [reportType, loadMonthlyData, loadYearlyData, loadAllTimeData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Financial Reports"
      />

      {/* Report Type Selector Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-[var(--color-bg-card)] border-[var(--color-border)] shadow-sm">
        <Tabs
          tabs={[
            { key: 'monthly', label: 'Monthly Report' },
            { key: 'yearly', label: 'Yearly Report' },
            { key: 'all_time', label: 'All-Time Financial History' },
          ]}
          activeTab={reportType}
          onChange={(key) => setReportType(key as any)}
        />

        {/* Date Filter Controls based on type */}
        {reportType === 'monthly' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear((y) => y - 1);
                } else setSelectedMonth((m) => m - 1);
              }}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-base sm:text-xs font-semibold">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent outline-none cursor-pointer text-base sm:text-xs"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1} className="bg-[var(--color-bg-card)]">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent outline-none cursor-pointer text-base sm:text-xs"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y} className="bg-[var(--color-bg-card)]">
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear((y) => y + 1);
                } else setSelectedMonth((m) => m + 1);
              }}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {reportType === 'yearly' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">Select Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-base sm:text-xs font-semibold outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : reportType === 'monthly' ? (
        /* ============================================================
           MONTHLY REPORT VIEW
           ============================================================ */
        <div className="space-y-6">
          {/* Main Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Realized Income"
              value={formatCurrency(monthlyData.totalIncome)}
              subtitle="Lending interest + other"
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(monthlyData.totalExpenses)}
              subtitle="All categories"
            />
            <StatCard
              label="Net Cash Flow (Profit)"
              value={formatCurrency(monthlyData.netCashFlow)}
              subtitle="Income minus expenses"
            />
            <StatCard
              label="Spent on Sarayu"
              value={formatCurrency(monthlyData.sarayuSpending)}
              subtitle="Personal expenses"
            />
          </div>

          {/* Lending & Principal Flow Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                Lending & Capital Movement ({getMonthName(selectedMonth)})
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Interest Collected (Income):</span>
                  <span className="font-bold text-emerald-500">{formatCurrency(monthlyData.interestCollected)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Pending Unpaid Interest:</span>
                  <span className="font-bold text-amber-500">{formatCurrency(monthlyData.pendingInterest)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Business Amount Lent (Asset):</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {formatCurrency(monthlyData.businessPrincipalLent)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Amount Returned (Capital return):</span>
                  <span className="font-bold text-blue-500">
                    {formatCurrency(monthlyData.businessPrincipalReturned)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Personal Money Lent (Friends/Family):</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {formatCurrency(monthlyData.personalLent)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Personal Loans Repaid:</span>
                  <span className="font-bold text-emerald-500">
                    {formatCurrency(monthlyData.personalReturned)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Spending Breakdown by Recipient */}
            <Card className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-500" />
                Spending by Recipient ({getMonthName(selectedMonth)})
              </h4>
              <div className="space-y-3 text-xs">
                {monthlyData.spentForBreakdown.map((item) => {
                  const isSarayu = item.spentFor === 'Sarayu' || item.spentFor === 'Girlfriend';
                  const displayName = item.spentFor === 'Girlfriend' ? 'Sarayu' : item.spentFor;
                  return (
                    <div key={item.spentFor} className="flex justify-between p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                      <span className="font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
                        {isSarayu && <Heart className="w-3.5 h-3.5 text-pink-500" />}
                        {displayName}
                      </span>
                      <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(item.total)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Individual Bank Balances */}
              <h4 className="text-sm font-semibold pt-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-500" />
                Bank Balances
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {bankAccounts.map((a) => (
                  <div key={a.id} className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50">
                    <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{a.nickname}</p>
                    <p className="font-bold text-[var(--color-text-primary)] mt-0.5">{formatCurrency(a.currentBalance)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Expense Category Breakdown Chart */}
          {monthlyData.categoryBreakdown.length > 0 && (
            <Card className="p-5">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-[var(--color-accent)]" />
                Expense Category Distribution ({getMonthName(selectedMonth)})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={monthlyData.categoryBreakdown}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {monthlyData.categoryBreakdown.map((entry, index) => (
                          <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => formatCurrency(Number(val))}
                        contentStyle={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border)',
                          borderRadius: '8px',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {monthlyData.categoryBreakdown.map((item, idx) => (
                    <div key={item.category} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[var(--color-bg-hover)]">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="font-medium">{item.category}</span>
                      </div>
                      <span className="font-bold">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : reportType === 'yearly' ? (
        /* ============================================================
           YEARLY REPORT VIEW
           ============================================================ */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={`Annual Income (${selectedYear})`}
              value={formatCurrency(yearlyData.annualTotalIncome)}
              subtitle="Annual total realized"
            />
            <StatCard
              label={`Annual Expenses (${selectedYear})`}
              value={formatCurrency(yearlyData.annualExpenses)}
              subtitle="Annual spending"
            />
            <StatCard
              label="Annual Net Cash Flow"
              value={formatCurrency(yearlyData.annualNetCashFlow)}
              subtitle="Net profit for the year"
            />
            <StatCard
              label="Annual Sarayu Spending"
              value={formatCurrency(yearlyData.annualSarayuSpending)}
              subtitle="Yearly total"
            />
          </div>

          {/* Monthly Comparison Bar Chart */}
          <Card className="p-5">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
              Monthly Income vs Expenses ({selectedYear})
            </h4>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData.monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" stroke="var(--color-text-tertiary)" fontSize={12} />
                  <YAxis stroke="var(--color-text-tertiary)" fontSize={12} tickFormatter={(val) => formatCurrencyCompact(val)} />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Yearly Categories Breakdown */}
          <Card className="p-5">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[var(--color-accent)]" />
              Annual Spending by Category ({selectedYear})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              {yearlyData.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/50">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{cat.category}</p>
                  <p className="font-bold text-[var(--color-text-primary)] mt-1">{formatCurrency(cat.total)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* ============================================================
           ALL-TIME REPORT VIEW
           ============================================================ */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Lifetime Realized Interest"
              value={formatCurrency(allTimeData.lifetimeInterest)}
              subtitle="Total business interest collected"
            />
            <StatCard
              label="Lifetime Total Expenses"
              value={formatCurrency(allTimeData.lifetimeExpenses)}
              subtitle="All-time personal spending"
            />
            <StatCard
              label="Lifetime Net Cash Flow"
              value={formatCurrency(allTimeData.lifetimeNetCashFlow)}
              subtitle="Total realized profit"
            />
            <StatCard
              label="Total Bank Balances"
              value={formatCurrency(allTimeData.totalBankBalance)}
              subtitle="Current total liquid funds"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                Capital & Lending Portfolio Status
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Total Business Amount Lent (Lifetime):</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(allTimeData.totalPrincipalLent)}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Current Business Amount Outstanding:</span>
                  <span className="font-bold text-blue-500">{formatCurrency(allTimeData.outstandingPrincipal)}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Total Personal Loans Lent (Lifetime):</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(allTimeData.totalPersonalLent)}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <span className="text-[var(--color-text-secondary)]">Current Personal Loans Outstanding:</span>
                  <span className="font-bold text-amber-500">{formatCurrency(allTimeData.outstandingPersonal)}</span>
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
                Multi-Year Financial Trends
              </h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allTimeData.yearlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="year" stroke="var(--color-text-tertiary)" fontSize={12} />
                    <YAxis stroke="var(--color-text-tertiary)" fontSize={12} tickFormatter={(val) => formatCurrencyCompact(val)} />
                    <Tooltip
                      formatter={(val: any) => formatCurrency(Number(val))}
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border)',
                        borderRadius: '8px',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
