// ============================================================
// Ledgerly - Expense Service
// ============================================================

import { db } from '../db';
import type { Expense, Transaction } from '../types';
import { generateId, nowISO } from '../utils';
import { activityLogService } from './activityLogService';

export const expenseService = {
  async getAll(): Promise<Expense[]> {
    return db.expenses.toArray();
  },

  async getById(id: string): Promise<Expense | undefined> {
    return db.expenses.get(id);
  },

  async getByMonth(month: number, year: number): Promise<Expense[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return db.expenses
      .where('date')
      .between(startDate, endDate, true, false)
      .toArray();
  },

  async create(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.transaction('rw', [db.expenses, db.transactions], async () => {
      await db.expenses.put(expense);

      if (expense.bankAccountId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'expense',
          amount: expense.amount,
          date: expense.date,
          bankAccountId: expense.bankAccountId,
          description: expense.description || `${expense.category} expense`,
          category: expense.category,
          relatedEntityId: expense.id,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });

    await activityLogService.log({
      module: 'expense',
      actionType: 'expense_added',
      title: 'Expense Added',
      description: `${expense.category}: ${expense.description || 'Expense logged'} (Spent for: ${expense.spentFor})`,
      amount: expense.amount,
      flow: 'debit',
      bankAccountId: expense.bankAccountId,
      entityId: expense.id,
      category: expense.category,
      date: expense.date,
    });

    return expense;
  },

  async update(id: string, oldExpense: Expense, newData: Partial<Expense>): Promise<void> {
    await db.transaction('rw', [db.expenses, db.transactions], async () => {
      // Remove old transaction
      const oldTxs = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter(t => t.type === 'expense')
        .toArray();

      for (const oldTx of oldTxs) {
        await db.transactions.delete(oldTx.id);
      }

      const updatedExpense = { ...oldExpense, ...newData, updatedAt: nowISO() };
      await db.expenses.update(id, updatedExpense);

      // Create new transaction if bank account is linked
      if (updatedExpense.bankAccountId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'expense',
          amount: updatedExpense.amount,
          date: updatedExpense.date,
          bankAccountId: updatedExpense.bankAccountId,
          description: updatedExpense.description || `${updatedExpense.category} expense`,
          category: updatedExpense.category,
          relatedEntityId: id,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.expenses, db.transactions], async () => {
      await db.expenses.delete(id);
      const txs = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter(t => t.type === 'expense')
        .toArray();
      for (const tx of txs) {
        await db.transactions.delete(tx.id);
      }
    });
  },

  // Aggregations
  async getTotalForMonth(month: number, year: number): Promise<number> {
    const expenses = await this.getByMonth(month, year);
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  },

  async getByCategory(month: number, year: number): Promise<{ category: string; total: number }[]> {
    const expenses = await this.getByMonth(month, year);
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  },

  async getBySpentFor(month: number, year: number): Promise<{ spentFor: string; total: number }[]> {
    const expenses = await this.getByMonth(month, year);
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.spentFor, (map.get(e.spentFor) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([spentFor, total]) => ({ spentFor, total }))
      .sort((a, b) => b.total - a.total);
  },

  async getGirlfriendSpending(month?: number, year?: number): Promise<number> {
    let expenses: Expense[];
    if (month && year) {
      expenses = await this.getByMonth(month, year);
    } else {
      expenses = await this.getAll();
    }
    return expenses
      .filter(e => e.spentFor === 'Girlfriend')
      .reduce((sum, e) => sum + e.amount, 0);
  },

  async search(query: string): Promise<Expense[]> {
    const q = query.toLowerCase();
    const all = await this.getAll();
    return all.filter(e =>
      e.description?.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.spentFor.toLowerCase().includes(q) ||
      String(e.amount).includes(q)
    );
  },
};
