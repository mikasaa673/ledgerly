// ============================================================
// Ledgerly - Bank Account Service
// ============================================================

import { db } from '../db';
import type { BankAccount, Transaction } from '../types';
import { generateId, nowISO } from '../utils';
import { activityLogService } from './activityLogService';

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
