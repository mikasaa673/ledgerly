// ============================================================
// Ledgerly - Personal Lending Page
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HandCoins, Plus, Pencil, ArrowDownLeft, Eye, Trash2, Users, User,
  ChevronDown, ChevronUp, Calendar, Banknote, StickyNote, RotateCcw,
} from 'lucide-react';
import { parseISO, format, addDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { personalLendingService } from '../services/personalLendingService';
import { bankAccountService } from '../services/bankAccountService';
import type { PersonalLoan, PersonalRepayment } from '../types';
import { formatCurrency, formatDate, todayISO, getDaysSince, computeNextMonthDate } from '../utils';
import {
  Card, StatCard, Button, Input, Select, Textarea, Modal,
  ConfirmDialog, Badge, EmptyState, LoadingSpinner, PageHeader,
} from '../components/ui';

// ---- Types ----
interface PersonSummary {
  personName: string;
  totalLent: number;
  totalReturned: number;
  outstanding: number;
  lifetimeLent?: number;
}

// ============================================================
// Main Page Component
// ============================================================
export default function PersonalLending() {
  const { bankAccounts, refreshBankAccounts, resetSelectiveData } = useApp();

  const [loans, setLoans] = useState<PersonalLoan[]>([]);
  const [personSummaries, setPersonSummaries] = useState<PersonSummary[]>([]);
  const [totalLent, setTotalLent] = useState(0);
  const [totalReturned, setTotalReturned] = useState(0);
  const [lifetimeLent, setLifetimeLent] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showEditLoan, setShowEditLoan] = useState(false);
  const [editingLoan, setEditingLoan] = useState<PersonalLoan | null>(null);
  const [showRepayment, setShowRepayment] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<PersonalLoan | null>(null);

  // Reset page state
  const [showResetPersonalConfirm, setShowResetPersonalConfirm] = useState(false);
  const [resettingPersonal, setResettingPersonal] = useState(false);

  // Person summary expand/collapse
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allLoans, summaries, activeLent, returned, lifetime] = await Promise.all([
        personalLendingService.getAll(),
        personalLendingService.getPersonSummary(),
        personalLendingService.getTotalLent(),
        personalLendingService.getTotalReturned(),
        personalLendingService.getLifetimeLent(),
      ]);
      const validLoans = (allLoans || []).filter((l) => l && l.status !== 'archived');
      validLoans.sort((a, b) => (b.dateLent || b.createdAt || '').localeCompare(a.dateLent || a.createdAt || ''));
      setLoans(validLoans);
      setPersonSummaries(summaries || []);
      setTotalLent(activeLent || 0);
      setTotalReturned(returned || 0);
      setLifetimeLent(lifetime || 0);
    } catch (err) {
      console.error('Failed to load personal lending data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleReset = () => {
      loadData();
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [loadData]);

  const handleAfterAction = async () => {
    await Promise.all([loadData(), refreshBankAccounts()]);
  };

  const getBankName = (id?: string) => {
    if (!id) return 'None (Cash)';
    const acc = bankAccounts.find(a => a.id === id);
    return acc ? acc.nickname || acc.bankName : 'None (Cash)';
  };

  // ---- Handlers ----
  const handleEditClick = (loan: PersonalLoan) => {
    setEditingLoan(loan);
    setShowEditLoan(true);
  };

  const handleRecordRepayment = (loan: PersonalLoan) => {
    setSelectedLoan(loan);
    setShowRepayment(true);
  };

  const handleViewDetail = (loan: PersonalLoan) => {
    setSelectedLoan(loan);
    setShowDetail(true);
  };

  const handleDeleteClick = (loan: PersonalLoan) => {
    setSelectedLoan(loan);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLoan) return;
    try {
      await personalLendingService.deleteLoan(selectedLoan.id);
      await handleAfterAction();
    } catch (err) {
      console.error('Failed to delete loan:', err);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Personal"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5 text-zinc-500" />}
              onClick={() => setShowResetPersonalConfirm(true)}
              title="Reset Personal"
            >
              Reset Personal
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddLoan(true)}>
              Add Loan
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Money Lent"
          value={formatCurrency(totalLent)}
          subtitle={totalReturned > 0 ? `${formatCurrency(lifetimeLent)} original (${formatCurrency(totalReturned)} returned)` : 'Current active lent out'}
        />
        <StatCard
          label="Total Returned"
          value={formatCurrency(totalReturned)}
          subtitle="Repaid by friends/family"
        />
        <StatCard
          label="Lifetime Lent"
          value={formatCurrency(lifetimeLent)}
          subtitle="Total historical capital lent"
        />
      </div>

      {/* Person Summaries */}
      {personSummaries.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-zinc-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Balances by Person</h2>
          </div>
          <div className="space-y-2">
            {personSummaries.map((ps) => (
              <div key={ps.personName} className="rounded-lg border border-zinc-200/80 bg-zinc-50/50">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-100/60 transition-colors rounded-lg cursor-pointer"
                  onClick={() => setExpandedPerson(expandedPerson === ps.personName ? null : ps.personName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-800">
                      {ps.personName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">{ps.personName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 font-medium">Currently Lent</p>
                      <p className="text-sm font-bold font-mono-num text-zinc-950">
                        {formatCurrency(ps.outstanding)}
                      </p>
                    </div>
                    {expandedPerson === ps.personName ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </button>
                {expandedPerson === ps.personName && (
                  <div className="px-4 pb-3 grid grid-cols-3 gap-3 border-t border-zinc-200/60 bg-white">
                    <div className="pt-3">
                      <p className="text-[10px] text-zinc-500 font-medium">Currently Lent</p>
                      <p className="text-sm font-bold font-mono-num text-zinc-900">{formatCurrency(ps.outstanding)}</p>
                    </div>
                    <div className="pt-3">
                      <p className="text-[10px] text-zinc-500 font-medium">Total Returned</p>
                      <p className="text-sm font-bold font-mono-num text-zinc-900">{formatCurrency(ps.totalReturned)}</p>
                    </div>
                    <div className="pt-3">
                      <p className="text-[10px] text-zinc-500 font-medium">Original Lent</p>
                      <p className="text-sm font-bold font-mono-num text-zinc-950">{formatCurrency(ps.lifetimeLent || ps.totalLent)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Loans List */}
      {loans.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="w-6 h-6" />}
          title="No personal loans yet"
          description="Start tracking personal loans you've given to friends and family."
          action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddLoan(true)}>Add First Loan</Button>}
        />
      ) : (
        <Card>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>All Loans</h2>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {['Person', 'Amount Lent', 'Given Date / Days', 'Returned', 'Outstanding', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => (
                  <tr key={loan.id} className="border-b hover:bg-[var(--color-bg-hover)] transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-3 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{loan.personName}</td>
                    <td className="py-3 px-3" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(loan.amountLent)}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {loan.dateLent ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs font-mono-num">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                          <span>{formatDate(loan.dateLent)}</span>
                          {(() => {
                            const days = getDaysSince(loan.dateLent);
                            if (days === null) return null;
                            if (days === 0) return <span className="ml-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">(Today)</span>;
                            return (
                              <span className="ml-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                ({days} {days === 1 ? 'day' : 'days'})
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">Not specified</span>
                      )}
                    </td>
                    <td className="py-3 px-3" style={{ color: '#10b981' }}>{formatCurrency(loan.amountReturned)}</td>
                    <td className="py-3 px-3 font-medium" style={{ color: loan.outstandingBalance > 0 ? '#f59e0b' : '#10b981' }}>
                      {formatCurrency(loan.outstandingBalance)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={loan.status === 'active' ? 'warning' : 'success'}>
                        {loan.status === 'active' ? 'Active' : 'Closed'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        {loan.status === 'active' && (
                          <Button variant="ghost" size="sm" icon={<ArrowDownLeft className="w-3.5 h-3.5" />} onClick={() => handleRecordRepayment(loan)} title="Collect Repayment" />
                        )}
                        <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditClick(loan)} title="Edit Loan" />
                        <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => handleViewDetail(loan)} title="View Details" />
                        <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} onClick={() => handleDeleteClick(loan)} title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {loans.map(loan => (
              <div key={loan.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                      {loan.personName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{loan.personName}</span>
                  </div>
                  <Badge variant={loan.status === 'active' ? 'warning' : 'success'}>
                    {loan.status === 'active' ? 'Active' : 'Closed'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p style={{ color: 'var(--color-text-tertiary)' }}>Lent</p>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(loan.amountLent)}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-text-tertiary)' }}>Returned</p>
                    <p className="font-semibold" style={{ color: '#10b981' }}>{formatCurrency(loan.amountReturned)}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-text-tertiary)' }}>Outstanding</p>
                    <p className="font-semibold" style={{ color: loan.outstandingBalance > 0 ? '#f59e0b' : '#10b981' }}>{formatCurrency(loan.outstandingBalance)}</p>
                  </div>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  {loan.dateLent ? (
                    <>
                      Lent on {formatDate(loan.dateLent)}{' '}
                      {(() => {
                        const days = getDaysSince(loan.dateLent);
                        if (days === null) return null;
                        if (days === 0) return <span className="font-semibold text-emerald-600 dark:text-emerald-400">(Today)</span>;
                        return <span className="font-semibold text-blue-600 dark:text-blue-400">({days} {days === 1 ? 'day' : 'days'} ago)</span>;
                      })()}
                    </>
                  ) : (
                    <span>Given date: Not specified</span>
                  )}
                </p>
                <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                  {loan.status === 'active' && (
                    <Button variant="secondary" size="sm" icon={<ArrowDownLeft className="w-3.5 h-3.5" />} onClick={() => handleRecordRepayment(loan)}>Collect</Button>
                  )}
                  <Button variant="ghost" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditClick(loan)}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => handleViewDetail(loan)}>Details</Button>
                  <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} onClick={() => handleDeleteClick(loan)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modals */}
      <AddLoanModal
        isOpen={showAddLoan}
        onClose={() => setShowAddLoan(false)}
        bankAccounts={bankAccounts}
        onSuccess={handleAfterAction}
      />

      {editingLoan && (
        <EditPersonalLoanModal
          isOpen={showEditLoan}
          onClose={() => { setShowEditLoan(false); setEditingLoan(null); }}
          loan={editingLoan}
          bankAccounts={bankAccounts}
          onSuccess={handleAfterAction}
        />
      )}

      {selectedLoan && (
        <>
          <RecordRepaymentModal
            isOpen={showRepayment}
            onClose={() => { setShowRepayment(false); setSelectedLoan(null); }}
            loan={selectedLoan}
            bankAccounts={bankAccounts}
            onSuccess={handleAfterAction}
          />
          <LoanDetailModal
            isOpen={showDetail}
            onClose={() => { setShowDetail(false); setSelectedLoan(null); }}
            loan={selectedLoan}
            getBankName={getBankName}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setSelectedLoan(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Loan"
        message={`Are you sure you want to delete this loan to ${selectedLoan?.personName}? This action will archive the loan.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showResetPersonalConfirm}
        onClose={() => setShowResetPersonalConfirm(false)}
        onConfirm={async () => {
          setResettingPersonal(true);
          try {
            await resetSelectiveData({ personalLending: true });
            setShowResetPersonalConfirm(false);
            await handleAfterAction();
          } catch (err) {
            console.error('Failed to reset personal lending:', err);
          } finally {
            setResettingPersonal(false);
          }
        }}
        title="Reset Personal Lending"
        message="Are you sure you want to reset all personal loans and repayment records? All other sections and your bank accounts & balances will remain 100% intact."
        confirmLabel="Reset Personal Lending"
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// Add Loan Modal
// ============================================================
function AddLoanModal({
  isOpen, onClose, bankAccounts, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: any[];
  onSuccess: () => Promise<void>;
}) {
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [dateLent, setDateLent] = useState(todayISO());
  const [expectedRepaymentDate, setExpectedRepaymentDate] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const resetForm = () => {
    setPersonName('');
    setAmount('');
    setDateLent(todayISO());
    setExpectedRepaymentDate('');
    setBankAccountId('');
    setUpdateBankBalance(true);
    setNotes('');
    setErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!personName.trim()) errs.personName = 'Person name is required';
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      await personalLendingService.create({
        personName: personName.trim(),
        amountLent: amt,
        dateLent: dateLent || undefined,
        expectedRepaymentDate: expectedRepaymentDate || undefined,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim() || undefined,
      });

      // If user opted to update bank balance, deduct from the selected bank account
      if (updateBankBalance && bankAccountId && amt > 0) {
        await bankAccountService.adjustBalance(bankAccountId, -amt);
      }

      await onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create loan:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Add Personal Loan">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Person's Name" value={personName} onChange={e => setPersonName(e.target.value)} error={errors.personName} placeholder="e.g., Rahul" required />
        <Input label="Amount (₹)" type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} error={errors.amount} placeholder="₹ Amount" required />
        <Input label="Given Date (optional)" type="date" value={dateLent} onChange={e => setDateLent(e.target.value)} />
        <div className="space-y-1.5">
          <Input label="Expected Repayment Date (optional)" type="date" value={expectedRepaymentDate} onChange={e => setExpectedRepaymentDate(e.target.value)} />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-zinc-500 font-medium">Quick Tenure:</span>
            {[3, 5, 7, 10, 15, 20].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  const base = dateLent || todayISO();
                  try {
                    setExpectedRepaymentDate(format(addDays(parseISO(base), days), 'yyyy-MM-dd'));
                  } catch {}
                }}
                className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
              >
                +{days} Days
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const base = dateLent || todayISO();
                setExpectedRepaymentDate(computeNextMonthDate(base));
              }}
              className="px-2 py-0.5 text-[11px] font-semibold rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              +1 Month
            </button>
          </div>
        </div>
        <Select
          label="Bank Account (optional)"
          value={bankAccountId}
          onChange={e => setBankAccountId(e.target.value)}
          options={[
            { value: '', label: 'None / Cash (No bank account)' },
            ...bankAccounts.map(a => ({
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
                    ? `Will deduct −${formatCurrency(parseFloat(amount) || 0)} from ${selectedAccount.nickname || selectedAccount.bankName} (New balance: ${formatCurrency((selectedAccount.currentBalance ?? selectedAccount.openingBalance ?? 0) - (parseFloat(amount) || 0))})`
                    : 'Bank balance will remain untouched'}
                </span>
              </div>
            </label>
          </div>
        )}

        <Textarea label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
          <Button type="submit" loading={saving}>Add Loan</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Edit Personal Loan Modal
// ============================================================
function EditPersonalLoanModal({
  isOpen,
  onClose,
  loan,
  bankAccounts,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: PersonalLoan;
  bankAccounts: { id: string; bankName: string; nickname: string }[];
  onSuccess: () => Promise<void>;
}) {
  const [personName, setPersonName] = useState(loan.personName);
  const [amount, setAmount] = useState(String(loan.amountLent));
  const [dateLent, setDateLent] = useState(loan.dateLent || '');
  const [expectedRepaymentDate, setExpectedRepaymentDate] = useState(loan.expectedRepaymentDate || '');
  const [bankAccountId, setBankAccountId] = useState(loan.bankAccountId || '');
  const [notes, setNotes] = useState(loan.notes || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setPersonName(loan.personName);
      setAmount(String(loan.amountLent));
      setDateLent(loan.dateLent || '');
      setExpectedRepaymentDate(loan.expectedRepaymentDate || '');
      setBankAccountId(loan.bankAccountId || '');
      setNotes(loan.notes || '');
      setErrors({});
    }
  }, [isOpen, loan]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!personName.trim()) errs.personName = 'Person name is required';
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await personalLendingService.update(loan.id, {
        personName: personName.trim(),
        amountLent: parseFloat(amount),
        dateLent: dateLent || undefined,
        expectedRepaymentDate: expectedRepaymentDate || undefined,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim() || undefined,
      });
      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update personal loan:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Personal Loan">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Person's Name"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          error={errors.personName}
          placeholder="e.g., Rahul"
          required
        />
        <Input
          label="Amount (₹)"
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="₹ Amount"
          required
        />
        <Input
          label="Given Date (optional)"
          type="date"
          value={dateLent}
          onChange={(e) => setDateLent(e.target.value)}
        />
        <Input
          label="Expected Repayment Date (optional)"
          type="date"
          value={expectedRepaymentDate}
          onChange={(e) => setExpectedRepaymentDate(e.target.value)}
        />
        <Select
          label="Bank Account (optional)"
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          options={[
            { value: '', label: 'None / Cash (No bank account)' },
            ...bankAccounts.map((a) => ({ value: a.id, label: a.nickname || a.bankName })),
          ]}
        />
        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes..."
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Record Repayment Modal
// ============================================================
function RecordRepaymentModal({
  isOpen, onClose, loan, bankAccounts, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: PersonalLoan;
  bankAccounts: any[];
  onSuccess: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [updateBankBalance, setUpdateBankBalance] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const resetForm = () => {
    setAmount('');
    setBankAccountId('');
    setUpdateBankBalance(true);
    setDate(todayISO());
    setNotes('');
    setErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
    else if (amt > loan.outstandingBalance) errs.amount = `Cannot exceed outstanding balance (${formatCurrency(loan.outstandingBalance)})`;
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      await personalLendingService.recordRepayment({
        personalLoanId: loan.id,
        amount: amt,
        bankAccountId: bankAccountId || undefined,
        date,
        notes: notes.trim() || undefined,
      });

      // If user opted to update bank balance, credit the receiving bank account
      if (updateBankBalance && bankAccountId && amt > 0) {
        await bankAccountService.adjustBalance(bankAccountId, amt);
      }

      await onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to record repayment:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title={`Collect Repayment — ${loan.personName}`}>
      <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p style={{ color: 'var(--color-text-tertiary)' }}>Amount Lent</p>
            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(loan.amountLent)}</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-text-tertiary)' }}>Outstanding</p>
            <p className="font-semibold" style={{ color: '#f59e0b' }}>{formatCurrency(loan.outstandingBalance)}</p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Collection Amount (₹)" type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} error={errors.amount} placeholder="₹ Amount" />
        <Select
          label="Receiving Bank Account (optional)"
          value={bankAccountId}
          onChange={e => setBankAccountId(e.target.value)}
          options={[
            { value: '', label: 'None / Cash (No bank account)' },
            ...bankAccounts.map(a => ({
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
                    ? `Will credit +${formatCurrency(parseFloat(amount) || 0)} into ${selectedAccount.nickname || selectedAccount.bankName} (New balance: ${formatCurrency((selectedAccount.currentBalance ?? selectedAccount.openingBalance ?? 0) + (parseFloat(amount) || 0))})`
                    : 'Bank balance will remain untouched'}
                </span>
              </div>
            </label>
          </div>
        )}

        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} error={errors.date} />
        <Textarea label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
          <Button type="submit" loading={saving}>Record Repayment</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Loan Detail Modal
// ============================================================
function LoanDetailModal({
  isOpen, onClose, loan, getBankName,
}: {
  isOpen: boolean;
  onClose: () => void;
  loan: PersonalLoan;
  getBankName: (id: string) => string;
}) {
  const [repayments, setRepayments] = useState<PersonalRepayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && loan) {
      setLoading(true);
      personalLendingService.getRepayments(loan.id).then(r => {
        setRepayments((r || []).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')));
        setLoading(false);
      });
    }
  }, [isOpen, loan]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Loan Details — ${loan.personName}`} size="lg">
      <div className="space-y-5">
        {/* Loan Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <DetailItem label="Person" value={loan.personName} />
          <DetailItem label="Amount Lent" value={formatCurrency(loan.amountLent)} />
          <DetailItem
            label="Given Date"
            value={
              loan.dateLent
                ? `${formatDate(loan.dateLent)}${(() => {
                    const days = getDaysSince(loan.dateLent);
                    if (days === null) return '';
                    if (days === 0) return ' (Today)';
                    return ` (${days} ${days === 1 ? 'day' : 'days'} ago)`;
                  })()}`
                : 'Not specified'
            }
          />
          <DetailItem label="Amount Returned" value={formatCurrency(loan.amountReturned)} valueColor="#10b981" />
          <DetailItem label="Outstanding" value={formatCurrency(loan.outstandingBalance)} valueColor={loan.outstandingBalance > 0 ? '#f59e0b' : '#10b981'} />
          <DetailItem label="Status" value={loan.status === 'active' ? 'Active' : 'Closed'} />
          {loan.expectedRepaymentDate && <DetailItem label="Expected Repayment" value={formatDate(loan.expectedRepaymentDate)} />}
          <DetailItem label="Bank Account" value={getBankName(loan.bankAccountId)} />
        </div>
        {loan.notes && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Notes</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{loan.notes}</p>
          </div>
        )}

        {/* Repayment History */}
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Repayment History</h3>
          {loading ? (
            <LoadingSpinner />
          ) : repayments.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>No repayments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {repayments.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <ArrowDownLeft className="w-4 h-4" style={{ color: '#10b981' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#10b981' }}>{formatCurrency(r.amount)}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(r.date)} · {getBankName(r.bankAccountId)}</p>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-xs max-w-[150px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{r.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Detail Item ----
function DetailItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: valueColor || 'var(--color-text-primary)' }}>{value}</p>
    </div>
  );
}
