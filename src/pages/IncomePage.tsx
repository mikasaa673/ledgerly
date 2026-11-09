// ============================================================
// Ledgerly - Income Page
// Income Tracker with Auto-Integrated Lending Interest
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Receipt,
  Briefcase,
  Wallet,
  PieChart as PieIcon,
  Lock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { incomeService } from '../services/incomeService';
import { businessLendingService } from '../services/businessLendingService';
import { bankAccountService } from '../services/bankAccountService';
import type { Income } from '../types';
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

export default function IncomePage() {
  const { bankAccounts, refreshBankAccounts, settings, resetSelectiveData } = useApp();

  // Current Month / Year
  const current = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(current.month);
  const [selectedYear, setSelectedYear] = useState(current.year);

  // Data
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  // Summary stats
  const [totalIncome, setTotalIncome] = useState(0);
  const [interestIncome, setInterestIncome] = useState(0);
  const [awaitingInterest, setAwaitingInterest] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ source: string; total: number }[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [deleteIncomeItem, setDeleteIncomeItem] = useState<Income | null>(null);

  // Reset state
  const [showResetIncomeConfirm, setShowResetIncomeConfirm] = useState(false);
  const [resettingIncome, setResettingIncome] = useState(false);
  const [resetSuccessToast, setResetSuccessToast] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, total, interest, other, sources, pendingLending] = await Promise.all([
        incomeService.getByMonth(selectedMonth, selectedYear),
        incomeService.getTotalForMonth(selectedMonth, selectedYear),
        incomeService.getInterestIncomeForMonth(selectedMonth, selectedYear),
        incomeService.getNonInterestIncomeForMonth(selectedMonth, selectedYear),
        incomeService.getBySource(selectedMonth, selectedYear),
        businessLendingService.getInterestPendingForMonth(selectedMonth, selectedYear),
      ]);

      setIncomes(list.sort((a, b) => b.date.localeCompare(a.date)));
      setTotalIncome(total);
      setInterestIncome(interest);
      setOtherIncome(other);
      setAwaitingInterest(pendingLending);
      setSourceBreakdown(sources);
    } catch (err) {
      console.error('Error loading incomes:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('ledgerly-data-reset', handleUpdate);
    window.addEventListener('ledgerly-income-updated', handleUpdate);
    return () => {
      window.removeEventListener('ledgerly-data-reset', handleUpdate);
      window.removeEventListener('ledgerly-income-updated', handleUpdate);
    };
  }, [loadData]);

  // Month navigation
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

  // Lookup bank name
  const getBankName = (id: string) => {
    const acc = bankAccounts.find((a) => a.id === id);
    return acc ? acc.nickname : 'Unknown';
  };

  // Delete Income Handler
  const handleDelete = async () => {
    if (!deleteIncomeItem) return;
    try {
      await incomeService.delete(deleteIncomeItem.id);
      setDeleteIncomeItem(null);
      await loadData();
      await refreshBankAccounts();
    } catch (err) {
      console.error('Failed to delete income:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Income Management"
        description=""
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5 text-zinc-500" />}
              onClick={() => setShowResetIncomeConfirm(true)}
              title="Reset Income"
            >
              Reset Income
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Add Income
            </Button>
          </div>
        }
      />

      {/* Reset Income Success Toast */}
      {resetSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>All income entries have been reset to zero. Bank accounts and balances remain safely preserved.</span>
          </div>
          <button
            onClick={() => setResetSuccessToast(false)}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

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
          Total Income: <span className="text-emerald-500 font-bold text-base">{formatCurrency(totalIncome)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Total Realized Income (${getMonthName(selectedMonth).slice(0, 3)})`}
          value={formatCurrency(totalIncome)}
          subtitle="Collected interest + other sources"
        />
        <StatCard
          label="Lending Interest Yield"
          value={formatCurrency(interestIncome)}
          subtitle="Collected into bank account"
        />
        <StatCard
          label="Awaiting Collection"
          value={formatCurrency(awaitingInterest)}
          subtitle="Click 'Collect' in Lending to realize"
        />
        <StatCard
          label="Secondary Income"
          value={formatCurrency(otherIncome)}
          subtitle="Salary, freelancing, gifts"
        />
      </div>

      {/* Sources Breakdown Row */}
      {sourceBreakdown.length > 0 && (
        <Card className="p-4 border-[var(--color-border)]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-[var(--color-accent)]" />
            Income Sources in {getMonthName(selectedMonth)}
          </h4>
          <div className="flex flex-wrap gap-2">
            {sourceBreakdown.map((s) => (
              <div
                key={s.source}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-[var(--color-bg-tertiary)] border-[var(--color-border)] flex items-center gap-2"
              >
                <span>{s.source}</span>
                <span className="font-bold text-emerald-500">{formatCurrency(s.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Income List Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card className="p-0 overflow-hidden border-[var(--color-border)]">
          <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-tertiary)]/50">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Income Entries for {getMonthYearLabel(selectedMonth, selectedYear)}</span>
                <span className="text-[10px] font-normal text-zinc-400 sm:hidden ml-1">(Swipe &rarr;)</span>
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                Realized income from business lending collections and custom income sources.
              </p>
            </div>
          </div>

          {incomes.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="w-8 h-8" />}
              title="No income entries found"
              description={`No income recorded for ${getMonthYearLabel(selectedMonth, selectedYear)}.`}
              action={
                <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
                  Add Income
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile Cards View (md:hidden) */}
              <div className="md:hidden divide-y divide-[var(--color-border)]">
                {incomes.map((inc) => {
                  const isAuto = !!inc.relatedTransactionId;
                  return (
                    <div key={`m-inc-${inc.id}`} className="p-3.5 space-y-2 bg-[var(--color-bg-primary)]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-base font-bold text-emerald-500 font-mono-num block">
                            +{formatCurrency(inc.amount)}
                          </span>
                          <span className="font-semibold text-xs text-[var(--color-text-primary)] block mt-0.5">
                            {inc.source}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isAuto ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <Sparkles className="w-3 h-3" /> Auto
                            </span>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!p-1.5 text-[var(--color-text-tertiary)]"
                                onClick={() => setEditingIncome(inc)}
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!p-1.5 text-red-500"
                                onClick={() => setDeleteIncomeItem(inc)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] pt-1">
                        <span className="inline-flex items-center gap-1 font-mono-num">
                          <Calendar className="w-3 h-3" />
                          {formatDate(inc.date)}
                        </span>
                        <span>{getBankName(inc.bankAccountId)}</span>
                      </div>

                      {inc.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] italic">
                          {inc.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/80 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Date</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Amount</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Source</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Bank Account</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Description</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4">Type</th>
                    <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-sm">
                  {incomes.map((inc) => {
                    const isAuto = !!inc.relatedTransactionId;
                    return (
                      <tr key={inc.id} className="hover:bg-[var(--color-bg-hover)] transition-colors">
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono-num font-medium text-xs text-zinc-900 dark:text-zinc-100 shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                            <span>{formatDate(inc.date)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 font-bold text-emerald-500 whitespace-nowrap">
                          {formatCurrency(inc.amount)}
                        </td>
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                          {inc.source}
                        </td>
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                          {getBankName(inc.bankAccountId)}
                        </td>
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 text-xs text-[var(--color-text-tertiary)] max-w-xs truncate">
                          {inc.description || '—'}
                        </td>
                        <td className="py-2.5 sm:py-3.5 px-2.5 sm:px-4 whitespace-nowrap">
                          {isAuto ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <Sparkles className="w-3 h-3" />
                              Auto (Lending)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 text-slate-400">
                              Manual
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isAuto ? (
                            <span
                              className="text-xs text-[var(--color-text-tertiary)] flex items-center justify-end gap-1"
                              title="Managed via Business Lending"
                            >
                              <Lock className="w-3 h-3" /> Protected
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                                onClick={() => setEditingIncome(inc)}
                                title="Edit Income"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!p-1.5 text-[var(--color-text-tertiary)] hover:text-red-500"
                                onClick={() => setDeleteIncomeItem(inc)}
                                title="Delete Income"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        </Card>
      )}

      {/* Add / Edit Income Modal */}
      <IncomeFormModal
        isOpen={showAddModal || !!editingIncome}
        onClose={() => {
          setShowAddModal(false);
          setEditingIncome(null);
        }}
        income={editingIncome}
        bankAccounts={bankAccounts}
        sources={settings?.incomeSources || []}
        onSuccess={() => {
          setShowAddModal(false);
          setEditingIncome(null);
          loadData();
          refreshBankAccounts();
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteIncomeItem}
        onClose={() => setDeleteIncomeItem(null)}
        onConfirm={handleDelete}
        title="Delete Income Entry"
        message={`Are you sure you want to delete this income entry of ${formatCurrency(
          deleteIncomeItem?.amount || 0
        )}? The bank balance of ${getBankName(deleteIncomeItem?.bankAccountId || '')} will be reduced.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Reset Income Confirmation */}
      <ConfirmDialog
        isOpen={showResetIncomeConfirm}
        onClose={() => setShowResetIncomeConfirm(false)}
        onConfirm={async () => {
          setResettingIncome(true);
          try {
            await resetSelectiveData({ income: true });
            setShowResetIncomeConfirm(false);
            setResetSuccessToast(true);
            setTimeout(() => setResetSuccessToast(false), 4000);
            await loadData();
            await refreshBankAccounts();
          } catch (err) {
            console.error('Failed to reset income:', err);
          } finally {
            setResettingIncome(false);
          }
        }}
        title="Reset Income Entries"
        message="Are you sure you want to reset all income entries? All recorded salaries, gifts, freelancing, and lending interest collections will be reset to zero. Your bank accounts & balances will remain 100% intact."
        confirmLabel="Reset Income"
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// Subcomponent: Add / Edit Income Modal
// ============================================================
interface IncomeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  income?: Income | null;
  bankAccounts: any[];
  sources: string[];
  onSuccess: () => void;
}

function IncomeFormModal({
  isOpen,
  onClose,
  income,
  bankAccounts,
  sources,
  onSuccess,
}: IncomeFormModalProps) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (income) {
        setAmount(String(income.amount));
        setSource(income.source);
        setBankAccountId(income.bankAccountId);
        setDate(income.date);
        setDescription(income.description || '');
        setUpdateBankBalance(false);
      } else {
        setAmount('');
        setSource(sources[0] || 'Salary');
        setBankAccountId(bankAccounts[0]?.id || '');
        setDate(todayISO());
        setDescription('');
        setUpdateBankBalance(true);
      }
      setErrors({});
    }
  }, [isOpen, income, bankAccounts, sources]);

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    const val = Number(amount);
    if (!amount || isNaN(val) || val <= 0) errs.amount = 'Enter a valid amount';
    if (!source) errs.source = 'Select income source';
    if (!bankAccountId) errs.bankAccountId = 'Select bank account';
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (income) {
        await incomeService.update(income.id, income, {
          amount: Number(amount),
          source,
          bankAccountId,
          date,
          description: description.trim() || undefined,
        });
      } else {
        await incomeService.create({
          amount: Number(amount),
          source,
          bankAccountId,
          date,
          description: description.trim() || undefined,
        });

        // If user opted to update bank balance, credit the selected bank account
        if (updateBankBalance && bankAccountId && Number(amount) > 0) {
          await bankAccountService.adjustBalance(bankAccountId, Number(amount));
        }
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrors({ form: 'Failed to save income' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={income ? 'Edit Income' : 'Add New Income'} size="md">
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
            placeholder="e.g. 50000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.amount}
            required
          />

          <Input
            label="Date Received"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Income Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            error={errors.source}
            options={sources.map((s) => ({ value: s, label: s }))}
            required
          />

          <Select
            label="Bank Account Received Into"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            error={errors.bankAccountId}
            options={bankAccounts.map((a) => ({
              value: a.id,
              label: `${a.bankName} - ${a.nickname} (Bal: ${formatCurrency(a.currentBalance)})`,
            }))}
            required
          />
        </div>

        {/* Ask to update bank balance */}
        {!income && selectedAccount && (
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

        <Textarea
          label="Description / Notes (Optional)"
          placeholder="e.g. November monthly stipend, freelance web project..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {income ? 'Update Income' : 'Save Income'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
