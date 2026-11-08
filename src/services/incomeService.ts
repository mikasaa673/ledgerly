// ============================================================
// Ledgerly - Income Service
// ============================================================

import { db } from '../db';
import type { Income, Transaction } from '../types';
import { generateId, nowISO } from '../utils';
import { activityLogService } from './activityLogService';

export const incomeService = {
  async getAll(): Promise<Income[]> {
    return db.incomes.toArray();
  },

  async getById(id: string): Promise<Income | undefined> {
    return db.incomes.get(id);
  },

  async getByMonth(month: number, year: number): Promise<Income[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    return db.incomes
      .where('date')
      .between(startDate, endDate, true, false)
      .toArray();
  },

  async create(data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<Income> {
    const income: Income = {
      ...data,
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.transaction('rw', [db.incomes, db.transactions], async () => {
      await db.incomes.put(income);

      // Only create transaction if not already linked (e.g., interest collections create their own)
      if (!income.relatedTransactionId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'income',
          amount: income.amount,
          date: income.date,
          bankAccountId: income.bankAccountId,
          description: income.description || `${income.source} income`,
          relatedEntityId: income.id,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });

    if (!income.relatedTransactionId) {
      await activityLogService.log({
        module: 'income',
        actionType: 'income_added',
        title: 'Income Received',
        description: `${income.source}: ${income.description || 'Income logged'}`,
        amount: income.amount,
        flow: 'credit',
        bankAccountId: income.bankAccountId,
        entityId: income.id,
        category: income.source,
        date: income.date,
      });
    }

    return income;
  },

  async update(id: string, oldIncome: Income, newData: Partial<Income>): Promise<void> {
    // Don't allow editing auto-generated interest income
    if (oldIncome.relatedTransactionId) {
      throw new Error('Cannot edit auto-generated interest income');
    }

    await db.transaction('rw', [db.incomes, db.transactions], async () => {
      const oldTxs = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter(t => t.type === 'income')
        .toArray();

      for (const oldTx of oldTxs) {
        await db.transactions.delete(oldTx.id);
      }

      const updatedIncome = { ...oldIncome, ...newData, updatedAt: nowISO() };
      await db.incomes.update(id, updatedIncome);

      const tx: Transaction = {
        id: generateId(),
        type: 'income',
        amount: updatedIncome.amount,
        date: updatedIncome.date,
        bankAccountId: updatedIncome.bankAccountId,
        description: updatedIncome.description || `${updatedIncome.source} income`,
        relatedEntityId: id,
        createdAt: nowISO(),
      };
      await db.transactions.put(tx);
    });
  },

  async delete(id: string): Promise<void> {
    const income = await db.incomes.get(id);
    if (income?.relatedTransactionId) {
      throw new Error('Cannot delete auto-generated interest income');
    }

    await db.transaction('rw', [db.incomes, db.transactions], async () => {
      await db.incomes.delete(id);
      const txs = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter(t => t.type === 'income')
        .toArray();
      for (const tx of txs) {
        await db.transactions.delete(tx.id);
      }
    });
  },

  // Aggregations
  async getTotalForMonth(month: number, year: number): Promise<number> {
    const incomes = await this.getByMonth(month, year);
    return incomes.reduce((sum, i) => sum + i.amount, 0);
  },

  async getNonInterestIncomeForMonth(month: number, year: number): Promise<number> {
    const incomes = await this.getByMonth(month, year);
    return incomes
      .filter(i => i.source !== 'Business Interest')
      .reduce((sum, i) => sum + i.amount, 0);
  },

  async getInterestIncomeForMonth(month: number, year: number): Promise<number> {
    const incomes = await this.getByMonth(month, year);
    return incomes
      .filter(i => i.source === 'Business Interest')
      .reduce((sum, i) => sum + i.amount, 0);
  },

  async getBySource(month: number, year: number): Promise<{ source: string; total: number }[]> {
    const incomes = await this.getByMonth(month, year);
    const map = new Map<string, number>();
    for (const i of incomes) {
      map.set(i.source, (map.get(i.source) || 0) + i.amount);
    }
    return Array.from(map.entries())
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total);
  },
};
