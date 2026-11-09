// ============================================================
// Ledgerly - Bank Accounts Page
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  History,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  RotateCcw,
  Upload,
  AlertTriangle,
  IndianRupee,
} from 'lucide-react';
import {
  PageHeader,
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
} from '../components/ui';
import { useApp } from '../context/AppContext';
import { bankAccountService, bankTransferService } from '../services';
import type { BankAccount, Transaction } from '../types';
import { formatCurrency, formatDate, todayISO, isPositiveNumber, cn } from '../utils';
import { BankLogo, BANK_PRESETS, autoDetectBankLogo } from '../utils/bankLogos';

// --- Constants ---
const MAX_ACCOUNTS = 12;

// ============================================================
// Add/Edit Account Modal
// ============================================================
interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  account?: (BankAccount & { currentBalance: number }) | null;
}

function AccountFormModal({ isOpen, onClose, onSave, account }: AccountFormProps) {
  const [bankName, setBankName] = useState('');
  const [nickname, setNickname] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [selectedLogo, setSelectedLogo] = useState('sbi');
  const [customLogo, setCustomLogo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (account) {
        setBankName(account.bankName);
        setNickname(account.nickname);
        setOpeningBalance(String(account.openingBalance));
        setLastFourDigits(account.lastFourDigits || '');
        const isCustom = Boolean(account.logo && (account.logo.startsWith('http') || account.logo.startsWith('data:') || account.logo.includes('/')));
        if (isCustom) {
          setCustomLogo(account.logo || '');
          setSelectedLogo('sbi');
        } else {
          setSelectedLogo(account.logo || autoDetectBankLogo(account.bankName));
          setCustomLogo('');
        }
      } else {
        setBankName('');
        setNickname('');
        setOpeningBalance('0');
        setLastFourDigits('');
        setSelectedLogo('sbi');
        setCustomLogo('');
      }
      setErrors({});
      setFormError('');
    }
  }, [isOpen, account]);

  const handleBankNameChange = (val: string) => {
    setBankName(val);
    if (!customLogo) {
      const detected = autoDetectBankLogo(val);
      setSelectedLogo(detected);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!bankName.trim()) errs.bankName = 'Bank name is required (e.g. State Bank of India, Kotak)';
    if (!nickname.trim()) errs.nickname = 'Nickname is required (e.g. Main, Savings, Salary)';
    const rawBal = openingBalance.trim();
    const bal = rawBal === '' ? 0 : Number(rawBal);
    if (isNaN(bal) || bal < 0) errs.openingBalance = 'Enter a valid opening balance (0 or higher)';
    if (lastFourDigits.trim() && !/^\d{4}$/.test(lastFourDigits.trim())) {
      errs.lastFourDigits = 'Must be exactly 4 digits or left empty';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setFormError('');
    try {
      const rawBal = openingBalance.trim();
      const bal = rawBal === '' ? 0 : Number(rawBal);
      const finalLogo = customLogo.trim() || selectedLogo;

      if (account) {
        await bankAccountService.update(account.id, {
          bankName: bankName.trim(),
          nickname: nickname.trim(),
          openingBalance: bal,
          lastFourDigits: lastFourDigits.trim() || undefined,
          logo: finalLogo,
        });
      } else {
        await bankAccountService.create({
          bankName: bankName.trim(),
          nickname: nickname.trim(),
          openingBalance: bal,
          lastFourDigits: lastFourDigits.trim() || undefined,
          logo: finalLogo,
        });
      }
      await onSave();
      onClose();
    } catch (err: any) {
      console.error('Failed to save account:', err);
      setFormError(err?.message || 'Failed to save account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activeLogoKey = customLogo.trim() || selectedLogo;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={account ? 'Edit Bank Account' : 'Add Bank Account'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
            {formError}
          </div>
        )}

        {/* Bank Logo Live Preview & Preset Selector */}
        <div className="p-3.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BankLogo bankName={bankName} logoKey={activeLogoKey} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {bankName || 'Select bank below or add image'}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {customLogo ? 'Custom image uploaded' : 'Official bank logo'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all">
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{customLogo ? 'Change Image' : 'Add Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const res = ev.target?.result as string;
                        if (res) {
                          setCustomLogo(res);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>

              {customLogo && (
                <button
                  type="button"
                  onClick={() => setCustomLogo('')}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Quick Select Bank & Logo (Only user's actual banks) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
              Quick Select Bank &amp; Logo
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {BANK_PRESETS.map((preset) => {
                const isSelected = !customLogo && selectedLogo === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      setSelectedLogo(preset.key);
                      setCustomLogo('');
                      if (!bankName || bankName === 'State Bank of India' || preset.key !== 'cash') {
                        setBankName(preset.name);
                      }
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center gap-1.5 cursor-pointer',
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-600 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                    )}
                  >
                    <BankLogo logoKey={preset.key} size="sm" />
                    <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 truncate w-full">
                      {preset.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <Input
          label="Bank Name"
          placeholder="e.g. HDFC Bank, State Bank of India"
          value={bankName}
          onChange={(e) => handleBankNameChange(e.target.value)}
          error={errors.bankName}
          required
        />
        <Input
          label="Account Nickname"
          placeholder="e.g. Savings, Salary Account, Lending Reserve"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={errors.nickname}
          required
        />
        <Input
          label="Opening Balance (₹)"
          type="number"
          placeholder="0"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          error={errors.openingBalance}
          helpText="Enter the starting balance. Leave 0 if starting fresh."
        />
        <Input
          label="Last 4 Digits (Optional)"
          placeholder="1234"
          maxLength={4}
          value={lastFourDigits}
          onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
          error={errors.lastFourDigits}
          helpText="Optional 4 digits for easy identification"
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {account ? 'Save Changes' : 'Add Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Bank Transfer Modal
// ============================================================
interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  accounts: (BankAccount & { currentBalance: number })[];
}

function TransferModal({ isOpen, onClose, onComplete, accounts }: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFromAccountId(accounts[0]?.id || '');
      setToAccountId(accounts[1]?.id || '');
      setAmount('');
      setDate(todayISO());
      setNotes('');
      setErrors({});
    }
  }, [isOpen, accounts]);

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.nickname} (${a.bankName})`,
  }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fromAccountId) errs.fromAccountId = 'Select source account';
    if (!toAccountId) errs.toAccountId = 'Select destination account';
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) errs.toAccountId = 'Cannot transfer to the same account';
    const amt = Number(amount);
    if (!amount || isNaN(amt) || !isPositiveNumber(amt)) errs.amount = 'Enter a valid positive amount';
    if (!date) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await bankTransferService.create({
        fromAccountId,
        toAccountId,
        amount: Number(amount),
        date,
        notes: notes.trim() || undefined,
      });
      onComplete();
      onClose();
    } catch (err) {
      console.error('Transfer failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer Between Accounts">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="From Account"
          options={[{ value: '', label: 'Select account' }, ...accountOptions]}
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
          error={errors.fromAccountId}
        />
        <Select
          label="To Account"
          options={[{ value: '', label: 'Select account' }, ...accountOptions.filter((o) => o.value !== fromAccountId)]}
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
          error={errors.toAccountId}
        />

        {/* Visual From -> To Preview with Bank Logos */}
        {fromAccountId && toAccountId && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2 min-w-0">
              <BankLogo
                bankName={accounts.find((a) => a.id === fromAccountId)?.bankName}
                logoKey={accounts.find((a) => a.id === fromAccountId)?.logo}
                size="sm"
              />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[110px]">
                {accounts.find((a) => a.id === fromAccountId)?.nickname}
              </span>
            </div>
            <ArrowLeftRight className="w-4 h-4 text-zinc-400 shrink-0 mx-2" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[110px]">
                {accounts.find((a) => a.id === toAccountId)?.nickname}
              </span>
              <BankLogo
                bankName={accounts.find((a) => a.id === toAccountId)?.bankName}
                logoKey={accounts.find((a) => a.id === toAccountId)?.logo}
                size="sm"
              />
            </div>
          </div>
        )}
        <Input
          label="Amount (₹)"
          type="number"
          placeholder="0"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />
        <Textarea
          label="Notes (optional)"
          placeholder="e.g. Fund transfer for rent"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} icon={<ArrowLeftRight className="w-4 h-4" />}>
            Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Update Account Balance Modal (with Audit Trail)
// ============================================================
interface UpdateBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: (BankAccount & { currentBalance: number }) | null;
  onSuccess: () => Promise<void>;
}

function UpdateBalanceModal({ isOpen, onClose, account, onSuccess }: UpdateBalanceModalProps) {
  const [newBalance, setNewBalance] = useState('');
  const [sourceOrReason, setSourceOrReason] = useState('Cash Deposit');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && account) {
      setNewBalance(String(account.currentBalance));
      setSourceOrReason('Cash Deposit');
      setCustomReason('');
      setNotes('');
      setDate(todayISO());
      setErrors({});
    }
  }, [isOpen, account]);

  if (!account) return null;

  const currentBal = account.currentBalance;
  const parsedNewBal = parseFloat(newBalance);
  const isValidNum = !isNaN(parsedNewBal) && parsedNewBal >= 0;
  const difference = isValidNum ? Math.round((parsedNewBal - currentBal) * 100) / 100 : 0;
  const isCredit = difference > 0;
  const isDebit = difference < 0;

  const quickSources = isCredit
    ? ['Cash Deposit', 'Customer / Client Payment', 'Salary / Income', 'Family / Friend Transfer', 'Investment Return', 'Bank Interest', 'Other Source']
    : ['ATM / Cash Withdrawal', 'Personal Expense', 'Lending / Given Out', 'Bill / Rent Payment', 'Family / Friend Support', 'Bank Charges', 'Other Reason'];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (newBalance.trim() === '' || isNaN(parsedNewBal) || parsedNewBal < 0) {
      errs.newBalance = 'Enter a valid new balance (0 or higher)';
    }
    const finalReason = sourceOrReason.startsWith('Other')
      ? customReason.trim()
      : (sourceOrReason || customReason).trim();

    if (!finalReason) {
      errs.sourceOrReason = 'Please specify where the money came from or went';
    }
    if (!date) {
      errs.date = 'Date is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const finalReason = sourceOrReason.startsWith('Other')
        ? (customReason.trim() || 'Manual Balance Adjustment')
        : (sourceOrReason || customReason).trim();

      await bankAccountService.updateBalanceWithAudit({
        accountId: account.id,
        newBalance: parsedNewBal,
        sourceOrReason: finalReason,
        notes: notes.trim() || undefined,
        date,
      });

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update balance:', err);
      setErrors({ form: 'Failed to update balance' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update Balance — ${account.nickname}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium">
            {errors.form}
          </div>
        )}

        {/* Current vs New Balance Card */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Current Balance:</span>
            <span className="font-bold text-zinc-950 dark:text-zinc-50 font-mono-num text-sm">
              {formatCurrency(currentBal)}
            </span>
          </div>

          {isValidNum && difference !== 0 && (
            <div className={`flex items-center justify-between text-xs pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 font-medium ${
              isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              <span>{isCredit ? 'Money Added (Inflow):' : 'Money Deducted (Outflow):'}</span>
              <span className="font-bold font-mono-num text-sm">
                {isCredit ? '+' : '−'}{formatCurrency(Math.abs(difference))}
              </span>
            </div>
          )}
        </div>

        {/* New Balance Input */}
        <Input
          label="New Balance (₹)"
          type="number"
          step="any"
          min="0"
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          error={errors.newBalance}
          placeholder="e.g. 75000"
          helpText="Enter the actual current balance in this bank account."
          required
        />

        {/* Where the money came from or went */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {isCredit
              ? 'Where did the money come from? (Source)'
              : isDebit
              ? 'Where did the money go? (Purpose)'
              : 'Source / Reason'}
          </label>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickSources.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSourceOrReason(s)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                  sourceOrReason === s
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom Reason Input if Other selected */}
          {sourceOrReason.startsWith('Other') && (
            <Input
              label="Specify Source / Reason"
              placeholder="e.g., Sold old laptop, client cash advance..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              error={errors.sourceOrReason}
              required
            />
          )}
        </div>

        <Input
          label="Date of Balance Change"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
          required
        />

        <Textarea
          label="Additional Details / Notes (Recorded in Audit Ledger)"
          placeholder="e.g., Deposited by Suresh, ATM receipt #1234, client payment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300">
          This balance change and source details will be permanently recorded in your <strong>Master Ledger Log</strong> and account statement history.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save &amp; Update Ledger
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Account Statement View
// ============================================================
interface StatementViewProps {
  account: (BankAccount & { currentBalance: number }) | null;
  accounts: (BankAccount & { currentBalance: number })[];
  onBack: () => void;
  onResetStatement?: () => void;
  onUpdateBalance?: () => void;
}

function StatementView({ account, accounts, onBack, onResetStatement, onUpdateBalance }: StatementViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    bankAccountService.getTransactionHistory(account.id).then((txs) => {
      setTransactions(txs);
      setLoading(false);
    });
  }, [account]);

  if (!account) return null;

  const getAccountName = (id: string): string => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? acc.nickname : 'Unknown';
  };

  const getTxSign = (tx: Transaction): '+' | '-' | '' => {
    switch (tx.type) {
      case 'income':
      case 'interest_collection':
      case 'business_principal_returned':
      case 'personal_repayment':
        return '+';
      case 'expense':
      case 'business_principal_lent':
      case 'personal_lent':
        return '-';
      case 'bank_transfer':
        // Check if this account is the source or destination
        if (tx.bankAccountId === account.id) return '-';
        if (tx.secondaryBankAccountId === account.id) return '+';
        return '';
      default:
        return '';
    }
  };

  const getTxLabel = (tx: Transaction): string => {
    switch (tx.type) {
      case 'income': return 'Income';
      case 'expense': return 'Expense';
      case 'interest_collection': return 'Interest Collection';
      case 'business_principal_lent': return 'Principal Lent';
      case 'business_principal_returned': return 'Principal Returned';
      case 'personal_lent': return 'Personal Lent';
      case 'personal_repayment': return 'Personal Repayment';
      case 'bank_transfer':
        if (tx.bankAccountId === account.id) return `Transfer to ${getAccountName(tx.secondaryBankAccountId || '')}`;
        return `Transfer from ${getAccountName(tx.bankAccountId)}`;
      default: return tx.type;
    }
  };

  const getTxBadgeVariant = (sign: string): 'success' | 'danger' | 'default' => {
    if (sign === '+') return 'success';
    if (sign === '-') return 'danger';
    return 'default';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--color-accent)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </button>

        <div className="flex items-center gap-2">
          {onUpdateBalance && (
            <Button
              variant="secondary"
              size="sm"
              icon={<IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              onClick={onUpdateBalance}
            >
              Update Balance
            </Button>
          )}
          {onResetStatement && (
            <Button
              variant="danger"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={onResetStatement}
            >
              Reset Statement
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <BankLogo bankName={account.bankName} logoKey={account.logo} size="lg" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {account.nickname}
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {account.bankName}
              {account.lastFourDigits && ` •••• ${account.lastFourDigits}`}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {formatCurrency(account.currentBalance)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Current Balance</p>
          </div>
        </div>
      </Card>

      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
        Transaction History
      </h3>

      {loading ? (
        <LoadingSpinner />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<History className="w-5 h-5" />}
          title="No transactions yet"
          description="Transactions for this account will appear here."
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const sign = getTxSign(tx);
            const isCredit = sign === '+';
            return (
              <Card key={tx.id} className="!p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isCredit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: isCredit ? '#10b981' : '#ef4444',
                    }}
                  >
                    {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {getTxLabel(tx)}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {tx.description} • {formatDate(tx.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: isCredit ? '#10b981' : '#ef4444' }}
                    >
                      {sign}{formatCurrency(tx.amount)}
                    </p>
                    <Badge variant={getTxBadgeVariant(sign)} className="text-[10px]">
                      {tx.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Bank Accounts Page
// ============================================================
export default function BankAccounts() {
  const { bankAccounts, refreshBankAccounts } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<(BankAccount & { currentBalance: number }) | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<(BankAccount & { currentBalance: number }) | null>(null);
  const [updatingBalanceAccount, setUpdatingBalanceAccount] = useState<(BankAccount & { currentBalance: number }) | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [statementAccount, setStatementAccount] = useState<(BankAccount & { currentBalance: number }) | null>(null);
  const [resettingStatementAccount, setResettingStatementAccount] = useState<(BankAccount & { currentBalance: number }) | null>(null);
  const [isResettingStatement, setIsResettingStatement] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshBankAccounts().finally(() => setLoading(false));
    const handleReset = () => {
      setStatementAccount(null);
      setResettingStatementAccount(null);
      setUpdatingBalanceAccount(null);
    };
    window.addEventListener('ledgerly-data-reset', handleReset);
    return () => window.removeEventListener('ledgerly-data-reset', handleReset);
  }, [refreshBankAccounts]);

  const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const handleSave = useCallback(async () => {
    await refreshBankAccounts();
    // If viewing statement for updated account, keep it fresh
    if (statementAccount) {
      const updated = bankAccounts.find((a) => a.id === statementAccount.id);
      if (updated) setStatementAccount(updated);
    }
  }, [refreshBankAccounts, statementAccount, bankAccounts]);

  const handleDelete = useCallback(async () => {
    if (!deleteAccount) return;
    try {
      await bankAccountService.softDelete(deleteAccount.id);
      await refreshBankAccounts();
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setDeleteAccount(null);
  }, [deleteAccount, refreshBankAccounts]);

  const handleTransferComplete = useCallback(async () => {
    await refreshBankAccounts();
  }, [refreshBankAccounts]);

  const handleConfirmResetStatement = useCallback(async () => {
    if (!resettingStatementAccount) return;
    setIsResettingStatement(true);
    try {
      await bankAccountService.resetStatement(resettingStatementAccount.id);
      await refreshBankAccounts();
      if (statementAccount?.id === resettingStatementAccount.id) {
        setStatementAccount(null);
      }
      setResettingStatementAccount(null);
    } catch (err) {
      console.error('Failed to reset statement:', err);
    } finally {
      setIsResettingStatement(false);
    }
  }, [resettingStatementAccount, refreshBankAccounts, statementAccount]);

  // If viewing statement for an account
  if (statementAccount) {
    return (
      <>
        <StatementView
          account={statementAccount}
          accounts={bankAccounts}
          onBack={() => setStatementAccount(null)}
          onResetStatement={() => setResettingStatementAccount(statementAccount)}
          onUpdateBalance={() => setUpdatingBalanceAccount(statementAccount)}
        />

        {/* Update Balance Modal while in Statement View */}
        <UpdateBalanceModal
          isOpen={Boolean(updatingBalanceAccount)}
          onClose={() => setUpdatingBalanceAccount(null)}
          account={updatingBalanceAccount}
          onSuccess={handleSave}
        />

        {/* Reset Statement Modal while in Statement View */}
        <Modal
          isOpen={Boolean(resettingStatementAccount)}
          onClose={() => setResettingStatementAccount(null)}
          title="Reset Account Statement"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Reset statement for {resettingStatementAccount?.nickname}?
              </p>
              <p className="leading-relaxed">
                This will permanently delete all transaction history recorded for <strong>{resettingStatementAccount?.nickname} ({resettingStatementAccount?.bankName})</strong> and remove all corresponding records from the Master Ledger log.
              </p>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The account opening balance of <strong>{resettingStatementAccount ? formatCurrency(resettingStatementAccount.openingBalance) : '₹0'}</strong> will remain preserved.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button variant="ghost" onClick={() => setResettingStatementAccount(null)} disabled={isResettingStatement}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={handleConfirmResetStatement}
                loading={isResettingStatement}
              >
                Reset Statement &amp; Clear Logs
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        description="Manage your bank accounts and transfers"
        actions={
          <div className="flex gap-2">
            {bankAccounts.length >= 2 && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowLeftRight className="w-4 h-4" />}
                onClick={() => setShowTransferModal(true)}
              >
                Transfer
              </Button>
            )}
            {bankAccounts.length < MAX_ACCOUNTS && (
              <Button
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowAddModal(true)}
              >
                Add Account
              </Button>
            )}
          </div>
        }
      />

      {/* Total Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Balance Across Accounts"
          value={formatCurrency(totalBalance)}
          subtitle="Real-time calculated sum"
        />
        <StatCard
          label="Active Bank Accounts"
          value={String(bankAccounts.length)}
          subtitle="Up to 12 supported"
        />
      </div>

      {/* Account Cards */}
      {bankAccounts.length === 0 ? (
        <EmptyState
          icon={<Landmark className="w-5 h-5" />}
          title="No bank accounts"
          description="Add your first bank account to start tracking your finances."
          action={
            <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
              Add Account
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((account) => (
            <Card key={account.id} className="group relative">
              <div
                className="cursor-pointer"
                onClick={() => setStatementAccount(account)}
              >
                <div className="flex items-start gap-3">
                  <BankLogo bankName={account.bankName} logoKey={account.logo} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {account.nickname}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {account.bankName}
                      {account.lastFourDigits && ` •••• ${account.lastFourDigits}`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Current Balance</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: account.currentBalance >= 0 ? 'var(--color-text-primary)' : '#ef4444' }}
                  >
                    {formatCurrency(account.currentBalance)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<History className="w-3.5 h-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatementAccount(account);
                  }}
                >
                  Statement
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUpdatingBalanceAccount(account);
                  }}
                  className="text-xs font-semibold"
                  title="Update bank balance and record where money came from / went"
                >
                  Update Balance
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setResettingStatementAccount(account);
                  }}
                  className="hover:!text-amber-600 dark:hover:!text-amber-400 text-zinc-500"
                  title="Reset Statement & Clear Logs"
                >
                  Reset
                </Button>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditAccount(account);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteAccount(account);
                    }}
                    className="hover:!text-red-500"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AccountFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSave}
      />
      <AccountFormModal
        isOpen={!!editAccount}
        onClose={() => setEditAccount(null)}
        onSave={handleSave}
        account={editAccount}
      />

      {/* Reset Statement Modal */}
      <Modal
        isOpen={Boolean(resettingStatementAccount)}
        onClose={() => setResettingStatementAccount(null)}
        title="Reset Account Statement"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Reset statement for {resettingStatementAccount?.nickname}?
            </p>
            <p className="leading-relaxed">
              This will permanently delete all transaction history recorded for <strong>{resettingStatementAccount?.nickname} ({resettingStatementAccount?.bankName})</strong> and remove all corresponding records from the Master Ledger log.
            </p>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            The account opening balance of <strong>{resettingStatementAccount ? formatCurrency(resettingStatementAccount.openingBalance) : '₹0'}</strong> will remain preserved.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setResettingStatementAccount(null)} disabled={isResettingStatement}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleConfirmResetStatement}
              loading={isResettingStatement}
            >
              Reset Statement &amp; Clear Logs
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteAccount}
        onClose={() => setDeleteAccount(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteAccount?.nickname}"? This action cannot be undone. If there are existing transactions, the account will be archived instead.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Transfer Modal */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onComplete={handleTransferComplete}
        accounts={bankAccounts}
      />

      {/* Update Balance Modal */}
      <UpdateBalanceModal
        isOpen={Boolean(updatingBalanceAccount)}
        onClose={() => setUpdatingBalanceAccount(null)}
        account={updatingBalanceAccount}
        onSuccess={handleSave}
      />
    </div>
  );
}
