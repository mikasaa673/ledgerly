// ============================================================
// Ledgerly - Transaction Service (Unified History)
// ============================================================

import { db } from '../db';
import type { Transaction } from '../types';

export const transactionService = {
  async getAll(): Promise<Transaction[]> {
    const txs = await db.transactions.toArray();
    return txs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    const txs = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
    return txs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  async getByMonth(month: number, year: number): Promise<Transaction[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const txs = await db.transactions
      .where('date')
      .between(startDate, endDate, true, false)
      .toArray();
    return txs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },

  async getByBankAccount(bankAccountId: string): Promise<Transaction[]> {
    const outgoing = await db.transactions.where('bankAccountId').equals(bankAccountId).toArray();
    const incoming = await db.transactions
      .filter(t => t.secondaryBankAccountId === bankAccountId)
      .toArray();
    const all = [...outgoing, ...incoming];
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async search(query: string): Promise<Transaction[]> {
    const q = query.toLowerCase();
    const all = await db.transactions.toArray();
    return all
      .filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
    const all = await this.getAll();
    return all.slice(0, limit);
  },

  // Monthly cash flow calculations
  async getMonthlyIncoming(month: number, year: number): Promise<number> {
    const txs = await this.getByMonth(month, year);
    return txs
      .filter(t => ['income', 'interest_collection', 'business_principal_returned', 'personal_repayment'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);
  },

  async getMonthlyOutgoing(month: number, year: number): Promise<number> {
    const txs = await this.getByMonth(month, year);
    return txs
      .filter(t => ['expense', 'business_principal_lent', 'personal_lent'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);
  },
};
