// ============================================================
// Ledgerly - Bank Transfer Service
// ============================================================

import { db } from '../db';
import type { BankTransfer, Transaction } from '../types';
import { generateId, nowISO } from '../utils';
import { activityLogService } from './activityLogService';

export const bankTransferService = {
  async getAll(): Promise<BankTransfer[]> {
    return db.bankTransfers.toArray();
  },

  async create(data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    notes?: string;
  }): Promise<BankTransfer> {
    const transfer: BankTransfer = {
      id: generateId(),
      ...data,
      createdAt: nowISO(),
    };

    await db.transaction('rw', [db.bankTransfers, db.transactions], async () => {
      await db.bankTransfers.put(transfer);

      // Single transaction record with both accounts
      const tx: Transaction = {
        id: generateId(),
        type: 'bank_transfer',
        amount: data.amount,
        date: data.date,
        bankAccountId: data.fromAccountId, // from
        secondaryBankAccountId: data.toAccountId, // to
        description: data.notes || `Bank transfer - ₹${data.amount.toLocaleString('en-IN')}`,
        relatedEntityId: transfer.id,
        createdAt: nowISO(),
      };
      await db.transactions.put(tx);
    });

    await activityLogService.log({
      module: 'bank_transfer',
      actionType: 'bank_transfer',
      title: 'Bank Transfer',
      description: `Transferred ₹${data.amount.toLocaleString('en-IN')}${data.notes ? ` (${data.notes})` : ''}`,
      amount: data.amount,
      flow: 'neutral',
      bankAccountId: data.fromAccountId,
      secondaryBankAccountId: data.toAccountId,
      entityId: transfer.id,
      date: data.date,
      category: 'Internal Transfer',
    });

    return transfer;
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.bankTransfers, db.transactions], async () => {
      await db.bankTransfers.delete(id);
      const txs = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter(t => t.type === 'bank_transfer')
        .toArray();
      for (const tx of txs) {
        await db.transactions.delete(tx.id);
      }
    });
  },
};
