// ============================================================
// Ledgerly - Expenses Page
// Dedicated Expense Tracker with Sarayu & Family breakdown
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  User,
  Users,
  Wallet,
  PieChart as PieIcon,
  Tag,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { expenseService } from '../services/expenseService';
import type { Expense } from '../types';
import {
  formatCurrency,
  formatDate,
  todayISO,
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
  Input,
  Select,
  Textarea,
  Modal,
  ConfirmDialog,
  Badge,
  EmptyState,
  LoadingSpinner,
  PageHeader,
} from '../components/ui';

export default function Expenses() {
  const { bankAccounts, refreshBankAccounts, settings, resetSelectiveData } = useApp();

  // Current Month/Year filter
  const current = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [spentForFilter, setSpentForFilter] = useState('ALL');
  const [bankAccountFilter, setBankAccountFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteExpenseItem, setDeleteExpenseItem] = useState<Expense | null>(null);

  // Reset expenses state
  const [showResetExpensesConfirm, setShowResetExpensesConfirm] = useState(false);
  const [resettingExpenses, setResettingExpenses] = useState(false);

  // Month summary stats
  const [stats, setStats] = useState({
    total: 0,
    spentOnMe: 0,
    spentOnSarayu: 0,
    spentOnFamily: 0,
    spentOnOther: 0,
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total: number }[]>([]);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, catList, spentForList, totalMonth] = await Promise.all([
        expenseService.getByMonth(selectedMonth, selectedYear),
        expenseService.getByCategory(selectedMonth, selectedYear),
        expenseService.getBySpentFor(selectedMonth, selectedYear),
        expenseService.getTotalForMonth(selectedMonth, selectedYear),
      ]);

      setExpenses(list);
      setCategoryBreakdown(catList);

      let onMe = 0;
      let onSarayu = 0;
      let onFam = 0;
      let onOth = 0;

      for (const item of spentForList) {
        if (item.spentFor === 'Me') onMe = item.total;
        else if (item.spentFor === 'Sarayu' || item.spentFor === 'Girlfriend') onSarayu += item.total;
        else if (item.spentFor === 'Family') onFam = item.total;
        else onOth += item.total;
      }

      setStats({
        total: totalMonth,
        spentOnMe: onMe,
        spentOnSarayu: onSarayu,
        spentOnFamily: onFam,
        spentOnOther: onOth,
      });
    } catch (err) {
      console.error('Error loading expenses:', err);
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

  // Month Navigation
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

  // Bank name lookup
  const getBankName = (id?: string) => {
    if (!id) return 'None (Cash)';
    const acc = bankAccounts.find((a) => a.id === id);
    return acc ? acc.nickname || acc.bankName : 'None (Cash)';
  };

  // Filtered & Sorted Expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
        if (spentForFilter !== 'ALL' && e.spentFor !== spentForFilter) return false;
        if (bankAccountFilter === 'CASH') {
          if (e.bankAccountId) return false;
        } else if (bankAccountFilter !== 'ALL' && e.bankAccountId !== bankAccountFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = e.description?.toLowerCase().includes(q);
          const matchCat = e.category.toLowerCase().includes(q);
          const matchPerson = e.spentFor.toLowerCase().includes(q);
          const matchAmt = String(e.amount).includes(q);
          if (!matchDesc && !matchCat && !matchPerson && !matchAmt) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        if (sortBy === 'amount_asc') return a.amount - b.amount;
        return 0;
      });
  }, [expenses, categoryFilter, spentForFilter, bankAccountFilter, searchQuery, sortBy]);

  // Delete Expense Handler
  const handleDelete = async () => {
    if (!deleteExpenseItem) return;
    try {
      await expenseService.delete(deleteExpenseItem.id);
      setDeleteExpenseItem(null);
      await loadData();
      await refreshBankAccounts();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Expense Management"
        description="Track daily expenses, categorize costs, and monitor spending for yourself, Sarayu, and family."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5 text-zinc-500" />}
              onClick={() => setShowResetExpensesConfirm(true)}
              title="Reset Expenses"
            >
              Reset Expenses
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Add Expense
            </Button>
          </div>
        }
      />

      {/* Month Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-[var(--color-bg-card)] border-[var(--color-border)] shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-semibold outline-none cursor-pointer text-[var(--color-text-primary)]"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1} className="bg-[var(--color-bg-card)] text-[var(--color-text-primary)]">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-semibold outline-none cursor-pointer text-[var(--color-text-primary)]"
            >
              {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                <option key={y} value={y} className="bg-[var(--color-bg-card)] text-[var(--color-text-primary)]">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const cur = getCurrentMonth();
              setSelectedMonth(cur.month);
              setSelectedYear(cur.year);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            This Month
          </button>
        </div>

        <div className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Total Spent: <span className="text-red-500 font-bold text-base">{formatCurrency(stats.total)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Total Expenses (${getMonthName(selectedMonth).slice(0, 3)})`}
          value={formatCurrency(stats.total)}
          subtitle="Monthly total"
        />
        <StatCard
          label="Spent on Sarayu"
          value={formatCurrency(stats.spentOnSarayu)}
          subtitle="Gifts, dining & personal"
        />
        <StatCard
          label="Spent on Me"
          value={formatCurrency(stats.spentOnMe)}
          subtitle="Self expenses"
        />
        <StatCard
          label="Spent on Family"
          value={formatCurrency(stats.spentOnFamily)}
          subtitle="Household & bills"
        />
      </div>

      {/* Category Breakdown Pill Row */}
      {categoryBreakdown.length > 0 && (
        <Card className="p-4 border-[var(--color-border)]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-[var(--color-accent)]" />
            Top Categories in {getMonthName(selectedMonth)}
          </h4>
          <div className="flex flex-wrap gap-2">
            {categoryBreakdown.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setCategoryFilter(categoryFilter === cat.category ? 'ALL' : cat.category)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2',
                  categoryFilter === cat.category
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                )}
              >
                <span>{cat.category}</span>
                <span className="font-bold">{formatCurrency(cat.total)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Filters & Search Toolbar */}
      <Card className="p-4 border-[var(--color-border)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--color-border)] text-base sm:text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-base sm:text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {settings?.expenseCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Spent For Filter */}
          <select
            value={spentForFilter}
            onChange={(e) => setSpentForFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-base sm:text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none cursor-pointer"
          >
            <option value="ALL">All Recipients (Spent For)</option>
            {settings?.spentForOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Bank Account Filter */}
          <select
            value={bankAccountFilter}
            onChange={(e) => setBankAccountFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-base sm:text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none cursor-pointer"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="CASH">None / Cash</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} ({a.nickname})
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-base sm:text-xs bg-[var(--color-bg-input)] text-[var(--color-text-primary)] outline-none cursor-pointer"
          >
            <option value="date_desc">Latest Date First</option>
            <option value="date_asc">Oldest Date First</option>
            <option value="amount_desc">Highest Amount First</option>
            <option value="amount_asc">Lowest Amount First</option>
          </select>
        </div>
      </Card>

      {/* Expenses Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card className="p-0 overflow-hidden border-[var(--color-border)]">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-tertiary)]/50">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-500" />
                Expenses for {getMonthYearLabel(selectedMonth, selectedYear)}
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Showing {filteredExpenses.length} of {expenses.length} records
              </p>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No expenses found"
              description={
                searchQuery || categoryFilter !== 'ALL' || spentForFilter !== 'ALL'
                  ? 'Try adjusting your filters or search terms.'
                  : `No expenses recorded for ${getMonthYearLabel(selectedMonth, selectedYear)}.`
              }
              action={
                <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
                  Add Expense
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile Cards View (md:hidden) */}
              <div className="md:hidden divide-y divide-[var(--color-border)]">
                {filteredExpenses.map((exp) => (
                  <div key={`m-exp-${exp.id}`} className="p-3.5 space-y-2 bg-[var(--color-bg-primary)]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-base font-bold text-red-500 font-mono-num block">
                          {formatCurrency(exp.amount)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                            {exp.category}
                          </span>
                          {(() => {
                            const isSarayu = exp.spentFor === 'Sarayu' || exp.spentFor === 'Girlfriend';
                            const displaySpent = exp.spentFor === 'Girlfriend' ? 'Sarayu' : exp.spentFor;
                            return (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold',
                                  isSarayu && 'bg-pink-500/10 text-pink-500 border border-pink-500/20',
                                  exp.spentFor === 'Me' && 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                                  exp.spentFor === 'Family' && 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                                  !isSarayu &&
                                    exp.spentFor !== 'Me' &&
                                    exp.spentFor !== 'Family' &&
                                    'bg-slate-500/10 text-slate-400'
                                )}
                              >
                                {isSarayu && <Heart className="w-3 h-3" />}
                                {displaySpent}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!p-1.5 text-[var(--color-text-tertiary)]"
                          onClick={() => setEditingExpense(exp)}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!p-1.5 text-red-500"
                          onClick={() => setDeleteExpenseItem(exp)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] pt-1">
                      <span className="inline-flex items-center gap-1 font-mono-num">
                        <Calendar className="w-3 h-3" />
                        {formatDate(exp.date)}
                      </span>
                      <span>{getBankName(exp.bankAccountId)}</span>
                    </div>

                    {exp.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] italic">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/80 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Spent For</th>
                    <th className="py-3 px-4">Bank Account</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-sm">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono-num font-medium text-xs text-zinc-900 dark:text-zinc-100 shadow-2xs">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                          <span>{formatDate(exp.date)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-red-500 whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const isSarayu = exp.spentFor === 'Sarayu' || exp.spentFor === 'Girlfriend';
                          const displaySpent = exp.spentFor === 'Girlfriend' ? 'Sarayu' : exp.spentFor;
                          return (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold',
                                isSarayu && 'bg-pink-500/10 text-pink-500 border border-pink-500/20',
                                exp.spentFor === 'Me' && 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                                exp.spentFor === 'Family' && 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                                !isSarayu &&
                                  exp.spentFor !== 'Me' &&
                                  exp.spentFor !== 'Family' &&
                                  'bg-slate-500/10 text-slate-400'
                              )}
                            >
                              {isSarayu && <Heart className="w-3 h-3" />}
                              {displaySpent}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                        {getBankName(exp.bankAccountId)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--color-text-tertiary)] max-w-xs truncate">
                        {exp.description || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                            onClick={() => setEditingExpense(exp)}
                            title="Edit Expense"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!p-1.5 text-[var(--color-text-tertiary)] hover:text-red-500"
                            onClick={() => setDeleteExpenseItem(exp)}
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </Card>
      )}

      {/* Add / Edit Expense Modal */}
      <ExpenseFormModal
        isOpen={showAddModal || !!editingExpense}
        onClose={() => {
          setShowAddModal(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
        bankAccounts={bankAccounts}
        categories={settings?.expenseCategories || []}
        spentForOptions={settings?.spentForOptions || []}
        onSuccess={() => {
          setShowAddModal(false);
          setEditingExpense(null);
          loadData();
          refreshBankAccounts();
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteExpenseItem}
        onClose={() => setDeleteExpenseItem(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Are you sure you want to delete this expense of ${formatCurrency(
          deleteExpenseItem?.amount || 0
        )}?`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Reset Expenses Confirmation */}
      <ConfirmDialog
        isOpen={showResetExpensesConfirm}
        onClose={() => setShowResetExpensesConfirm(false)}
        onConfirm={async () => {
          setResettingExpenses(true);
          try {
            await resetSelectiveData({ expenses: true });
            setShowResetExpensesConfirm(false);
            await loadData();
            await refreshBankAccounts();
          } catch (err) {
            console.error('Failed to reset expenses:', err);
          } finally {
            setResettingExpenses(false);
          }
        }}
        title="Reset All Expenses"
        message="Are you sure you want to reset all daily expense records? All other sections and your bank accounts & balances will remain 100% intact."
        confirmLabel="Reset Expenses"
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// Subcomponent: Add / Edit Expense Modal
// ============================================================
interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: Expense | null;
  bankAccounts: any[];
  categories: string[];
  spentForOptions: string[];
  onSuccess: () => void;
}

function ExpenseFormModal({
  isOpen,
  onClose,
  expense,
  bankAccounts,
  categories,
  spentForOptions,
  onSuccess,
}: ExpenseFormModalProps) {
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [spentFor, setSpentFor] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setAmount(String(expense.amount));
        setBankAccountId(expense.bankAccountId || '');
        setCategory(expense.category);
        setSpentFor(expense.spentFor);
        setDate(expense.date);
        setDescription(expense.description || '');
      } else {
        setAmount('');
        setBankAccountId('');
        setCategory(categories[0] || 'Food');
        setSpentFor(spentForOptions[0] || 'Me');
        setDate(todayISO());
        setDescription('');
      }
      setErrors({});
    }
  }, [isOpen, expense, bankAccounts, categories, spentForOptions]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const val = Number(amount);
    if (!amount || isNaN(val) || val <= 0) errs.amount = 'Enter a valid amount';
    if (!category) errs.category = 'Select category';
    if (!spentFor) errs.spentFor = 'Select who it was for';
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (expense) {
        await expenseService.update(expense.id, expense, {
          amount: Number(amount),
          bankAccountId: bankAccountId || undefined,
          category,
          spentFor,
          date,
          description: description.trim() || undefined,
        });
      } else {
        await expenseService.create({
          amount: Number(amount),
          bankAccountId: bankAccountId || undefined,
          category,
          spentFor,
          date,
          description: description.trim() || undefined,
        });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Failed to save expense' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={expense ? 'Edit Expense' : 'Add New Expense'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium">
            {errors.form}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 1500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            required
          />

          <Input
            label="Transaction Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            error={errors.category}
            options={categories.map((c) => ({ value: c, label: c }))}
            required
          />

          <Select
            label="Who Was It For?"
            value={spentFor}
            onChange={(e) => setSpentFor(e.target.value)}
            error={errors.spentFor}
            options={spentForOptions.map((opt) => ({ value: opt, label: opt }))}
            required
          />
        </div>

        <Select
          label="Bank Account Used (optional)"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          options={[
            { value: '', label: 'None / Cash (No bank account)' },
            ...bankAccounts.map((a) => ({
              value: a.id,
              label: `${a.bankName} - ${a.nickname}`,
            })),
          ]}
        />

        <Textarea
          label="Description / Notes (Optional)"
          placeholder="e.g. Dinner at restaurant, Zomato order..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {expense ? 'Update Expense' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
