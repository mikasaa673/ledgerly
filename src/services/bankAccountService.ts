// ============================================================
// Ledgerly - Bank Account Service
// ============================================================

import { db } from '../db';
import type { BankAccount, Transaction } from '../types';
import { generateId, nowISO, todayISO } from '../utils';
import { activityLogService } from './activityLogService';
import { cloudSyncService } from './cloudSyncService';

export const bankAccountService = {
  async getAll(): Promise<BankAccount[]> {
    const all = await db.bankAccounts.toArray();
    return all.filter((a) => !a.isDeleted);
  },

  async getById(id: string): Promise<BankAccount | undefined> {
    const acc = await db.bankAccounts.get(id);
    return acc && !acc.isDeleted ? acc : undefined;
  },

  async create(data: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<BankAccount> {
    const account: BankAccount = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    await db.bankAccounts.put(account);

    await activityLogService.log({
      module: 'bank_account',
      actionType: 'account_created',
      title: 'Bank Account Added',
      description: `Added bank account: ${account.nickname} (${account.bankName}) with opening balance of ₹${account.openingBalance.toLocaleString('en-IN')}`,
      amount: account.openingBalance,
      flow: 'neutral',
      bankAccountId: account.id,
      bankAccountName: `${account.nickname} (${account.bankName})`,
    });

    return account;
  },

  async update(id: string, data: Partial<BankAccount>): Promise<void> {
    await db.bankAccounts.update(id, { ...data, updatedAt: nowISO() });

    await activityLogService.log({
      module: 'bank_account',
      actionType: 'account_updated',
      title: 'Bank Account Updated',
      description: `Updated account details: ${data.nickname || ''} ${data.bankName ? `(${data.bankName})` : ''}`,
      flow: 'neutral',
      bankAccountId: id,
    });
  },

  async softDelete(id: string): Promise<void> {
    const acc = await db.bankAccounts.get(id);
    const accName = acc ? `${acc.nickname} (${acc.bankName})` : id;

    // Check for transactions
    const txCount = await db.transactions.where('bankAccountId').equals(id).count();
    if (txCount > 0) {
      await db.bankAccounts.update(id, { isDeleted: true, updatedAt: nowISO() });
    } else {
      await db.bankAccounts.delete(id);
    }

    await activityLogService.log({
      module: 'bank_account',
      actionType: 'account_deleted',
      title: 'Bank Account Removed',
      description: `Removed bank account ${accName}`,
      flow: 'neutral',
      bankAccountId: id,
    });
  },

  async calculateBalance(id: string): Promise<number> {
    const account = await db.bankAccounts.get(id);
    if (!account) return 0;
    // Bank account balances are preserved as set by the user and not modified from anywhere for now
    return account.openingBalance;
  },

  /**
   * Adjust an account's balance by a positive or negative delta
   */
  async adjustBalance(id: string, delta: number): Promise<number | undefined> {
    const account = await db.bankAccounts.get(id);
    if (!account) return undefined;
    const newBalance = Math.round(((account.openingBalance || 0) + delta) * 100) / 100;
    await db.bankAccounts.update(id, { openingBalance: newBalance, updatedAt: nowISO() });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-bank-updated', { detail: { bankAccountId: id, newBalance } }));
    }

    cloudSyncService.scheduleAutoSync();
    return newBalance;
  },

  /**
   * Update bank account balance with full audit trail in Ledger Log and Transactions
   * Records where the money came from or went to.
   */
  async updateBalanceWithAudit(params: {
    accountId: string;
    newBalance: number;
    sourceOrReason: string;
    notes?: string;
    date?: string;
  }): Promise<{ oldBalance: number; newBalance: number; difference: number }> {
    const account = await db.bankAccounts.get(params.accountId);
    if (!account) throw new Error('Account not found');

    const oldBalance = account.openingBalance || 0;
    const newBalance = Math.round(params.newBalance * 100) / 100;
    const difference = Math.round((newBalance - oldBalance) * 100) / 100;
    const effectiveDate = params.date || todayISO();

    // 1. Update account balance
    await db.bankAccounts.update(params.accountId, {
      openingBalance: newBalance,
      updatedAt: nowISO(),
    });

    // 2. If there is a difference, record transaction and ledger log
    if (difference !== 0) {
      const isCredit = difference > 0;
      const absDiff = Math.abs(difference);

      const tx: Transaction = {
        id: generateId(),
        type: isCredit ? 'income' : 'expense',
        amount: absDiff,
        date: effectiveDate,
        bankAccountId: params.accountId,
        description: `Balance Update: ${params.sourceOrReason}${params.notes ? ` (${params.notes})` : ''}`,
        category: params.sourceOrReason,
        createdAt: nowISO(),
      };
      await db.transactions.put(tx);

      // 3. Record in Master Ledger / Activity Log
      await activityLogService.log({
        module: 'bank_account',
        actionType: 'account_updated',
        title: isCredit ? 'Bank Balance Added' : 'Bank Balance Deducted',
        description: `${account.nickname} (${account.bankName}): ${isCredit ? 'Added +' : 'Deducted −'}₹${absDiff.toLocaleString('en-IN')}. Source / Reason: ${params.sourceOrReason}${params.notes ? ` (${params.notes})` : ''}. Previous: ₹${oldBalance.toLocaleString('en-IN')} → New Balance: ₹${newBalance.toLocaleString('en-IN')}`,
        amount: absDiff,
        flow: isCredit ? 'credit' : 'debit',
        bankAccountId: account.id,
        bankAccountName: `${account.nickname} (${account.bankName})`,
        category: params.sourceOrReason,
        date: effectiveDate,
        metadata: {
          previousBalance: oldBalance,
          newBalance: newBalance,
          difference: difference,
          sourceOrReason: params.sourceOrReason,
          notes: params.notes,
        },
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-bank-updated', { detail: { bankAccountId: params.accountId, newBalance } }));
      window.dispatchEvent(new CustomEvent('ledgerly-activity-recorded'));
    }

    cloudSyncService.scheduleAutoSync();
    return { oldBalance, newBalance, difference };
  },

  async getAllWithBalances(): Promise<(BankAccount & { currentBalance: number })[]> {
    const accounts = await this.getAll();
    return Promise.all(
      accounts.map(async (acc) => ({
        ...acc,
        currentBalance: await this.calculateBalance(acc.id),
      }))
    );
  },

  async getTransactionHistory(id: string): Promise<Transaction[]> {
    const outgoing = await db.transactions.where('bankAccountId').equals(id).toArray();
    const incoming = await db.transactions.where('secondaryBankAccountId').equals(id).toArray();
    const all = [...outgoing, ...incoming];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Reset statement for a bank account:
   * Permanently clears all transactions for this account AND removes them from the Master Ledger log.
   */
  async resetStatement(id: string): Promise<{ deletedTransactions: number; deletedLogs: number }> {
    const outgoing = await db.transactions.where('bankAccountId').equals(id).toArray();
    const incoming = await db.transactions.where('secondaryBankAccountId').equals(id).toArray();
    const allTx = [...outgoing, ...incoming];
    const txIds = allTx.map((t) => t.id);

    if (txIds.length > 0) {
      await db.transactions.bulkDelete(txIds);
    }

    // Delete corresponding activity logs in the Master Ledger
    const deletedLogs = await activityLogService.deleteByBankAccountId(id);

    // Dispatch global events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-statement-reset', { detail: { bankAccountId: id } }));
      window.dispatchEvent(new CustomEvent('ledgerly-activity-recorded'));
    }

    return {
      deletedTransactions: txIds.length,
      deletedLogs,
    };
  },
};
