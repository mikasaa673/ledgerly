// ============================================================
// Ledgerly - Personal Lending Service
// ============================================================

import { db } from '../db';
import type { PersonalLoan, PersonalRepayment, Transaction } from '../types';
import { generateId, nowISO } from '../utils';
import { activityLogService, recordDeletedActivityId } from './activityLogService';
import { cloudSyncService } from './cloudSyncService';

export const personalLendingService = {
  async getAll(): Promise<PersonalLoan[]> {
    return db.personalLoans.toArray();
  },

  async getActive(): Promise<PersonalLoan[]> {
    return db.personalLoans.where('status').equals('active').toArray();
  },

  async getById(id: string): Promise<PersonalLoan | undefined> {
    return db.personalLoans.get(id);
  },

  async create(data: {
    personName: string;
    amountLent: number;
    dateLent?: string;
    expectedRepaymentDate?: string;
    bankAccountId?: string;
    notes?: string;
  }): Promise<PersonalLoan> {
    const loan: PersonalLoan = {
      id: generateId(),
      personName: data.personName,
      amountLent: data.amountLent,
      dateLent: data.dateLent || '',
      expectedRepaymentDate: data.expectedRepaymentDate,
      bankAccountId: data.bankAccountId || '',
      notes: data.notes,
      amountReturned: 0,
      outstandingBalance: data.amountLent,
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.transaction('rw', [db.personalLoans, db.transactions], async () => {
      await db.personalLoans.put(loan);

      // Record transaction only if a bank account was selected
      if (data.bankAccountId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'personal_lent',
          amount: data.amountLent,
          date: data.dateLent || nowISO().slice(0, 10),
          bankAccountId: data.bankAccountId,
          description: `Lent to ${data.personName} - ₹${data.amountLent.toLocaleString('en-IN')}`,
          relatedEntityId: loan.id,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });

    await activityLogService.log({
      module: 'personal_lending',
      actionType: 'personal_lent',
      title: 'Personal Loan Lent',
      description: `Lent ₹${data.amountLent.toLocaleString('en-IN')} to ${data.personName}`,
      amount: data.amountLent,
      flow: 'debit',
      bankAccountId: data.bankAccountId,
      entityId: loan.id,
      personName: data.personName,
      date: data.dateLent || nowISO().slice(0, 10),
      category: 'Personal Lending',
    });

    return loan;
  },

  async update(id: string, data: Partial<PersonalLoan>): Promise<void> {
    const loan = await db.personalLoans.get(id);
    if (!loan) throw new Error('Personal loan not found');

    await db.transaction('rw', [db.personalLoans, db.transactions], async () => {
      let outstanding = loan.outstandingBalance;
      if (data.amountLent !== undefined) {
        outstanding = Math.max(0, data.amountLent - loan.amountReturned);
      }

      await db.personalLoans.update(id, {
        ...data,
        outstandingBalance: outstanding,
        status: outstanding <= 0 ? 'closed' : 'active',
        updatedAt: nowISO(),
      });

      // Update linked transaction if needed
      const tx = await db.transactions
        .where('relatedEntityId')
        .equals(id)
        .filter((t) => t.type === 'personal_lent')
        .first();

      if (tx) {
        const newPerson = data.personName || loan.personName;
        const newAmount = data.amountLent ?? tx.amount;
        await db.transactions.update(tx.id, {
          amount: newAmount,
          date: data.dateLent || tx.date,
          bankAccountId: data.bankAccountId || tx.bankAccountId,
          description: `Lent to ${newPerson} - ₹${newAmount.toLocaleString('en-IN')}`,
        });
      }
    });
  },

  async recordRepayment(data: {
    personalLoanId: string;
    amount: number;
    bankAccountId?: string;
    date: string;
    notes?: string;
  }): Promise<void> {
    const loan = await db.personalLoans.get(data.personalLoanId);
    if (!loan) throw new Error('Loan not found');

    const newReturned = loan.amountReturned + data.amount;
    const newOutstanding = loan.amountLent - newReturned;

    await db.transaction('rw', [db.personalLoans, db.personalRepayments, db.transactions], async () => {
      const repayment: PersonalRepayment = {
        id: generateId(),
        personalLoanId: data.personalLoanId,
        amount: data.amount,
        bankAccountId: data.bankAccountId || '',
        date: data.date,
        notes: data.notes,
        createdAt: nowISO(),
      };
      await db.personalRepayments.put(repayment);

      await db.personalLoans.update(data.personalLoanId, {
        amountReturned: newReturned,
        outstandingBalance: Math.max(0, newOutstanding),
        status: newOutstanding <= 0 ? 'closed' : 'active',
        updatedAt: nowISO(),
      });

      if (data.bankAccountId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'personal_repayment',
          amount: data.amount,
          date: data.date,
          bankAccountId: data.bankAccountId,
          description: `Repayment from ${loan.personName} - ₹${data.amount.toLocaleString('en-IN')}`,
          relatedEntityId: data.personalLoanId,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });

    await activityLogService.log({
      module: 'personal_lending',
      actionType: 'personal_repayment',
      title: 'Personal Repayment Received',
      description: `Received ₹${data.amount.toLocaleString('en-IN')} repayment from ${loan.personName}`,
      amount: data.amount,
      flow: 'credit',
      bankAccountId: data.bankAccountId,
      entityId: data.personalLoanId,
      personName: loan.personName,
      date: data.date,
      category: 'Personal Repayment',
    });
  },

  async getRepayments(loanId: string): Promise<PersonalRepayment[]> {
    return db.personalRepayments.where('personalLoanId').equals(loanId).toArray();
  },

  async deleteLoan(id: string): Promise<void> {
    const loan = await db.personalLoans.get(id);
    await db.transaction(
      'rw',
      [db.personalLoans, db.personalRepayments, db.transactions, db.activityLogs],
      async () => {
        // 1. Delete personal loan
        await db.personalLoans.delete(id);

        // 2. Delete repayments
        await db.personalRepayments.where('personalLoanId').equals(id).delete();

        // 3. Delete transactions
        const txs = await db.transactions
          .where('relatedEntityId')
          .equals(id)
          .filter((t) => t.type === 'personal_lent' || t.type === 'personal_repayment')
          .toArray();
        for (const tx of txs) {
          recordDeletedActivityId(`log_legacy_${tx.id}`);
          await db.transactions.delete(tx.id);
          await cloudSyncService.deleteRecord('transactions', tx.id);
        }

        // 4. Delete activity logs
        const logs = await db.activityLogs.where('entityId').equals(id).toArray();
        for (const l of logs) {
          recordDeletedActivityId(l.id);
          await db.activityLogs.delete(l.id);
          await cloudSyncService.deleteRecord('activity_logs', l.id);
        }
        if (loan?.personName) {
          const nameLogs = await db.activityLogs
            .filter((l) => l.personName === loan.personName || l.description?.includes(loan.personName))
            .toArray();
          for (const l of nameLogs) {
            recordDeletedActivityId(l.id);
            await db.activityLogs.delete(l.id);
            await cloudSyncService.deleteRecord('activity_logs', l.id);
          }
        }
      }
    );

    // Clean up from Supabase cloud
    await cloudSyncService.deleteRecord('personal_loans', id);
    await cloudSyncService.deleteRecordsByField('personal_repayments', 'personal_loan_id', id);
    await cloudSyncService.deleteRecordsByField('transactions', 'related_entity_id', id);
    await cloudSyncService.deleteRecordsByField('activity_logs', 'entity_id', id);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
      window.dispatchEvent(new CustomEvent('ledgerly-activity-deleted'));
    }

    cloudSyncService.scheduleAutoSync();
  },

  // Aggregations
  async getTotalLent(): Promise<number> {
    const loans = await db.personalLoans.toArray();
    return loans.filter(l => l.status !== 'archived').reduce((sum, l) => sum + l.amountLent, 0);
  },

  async getTotalReturned(): Promise<number> {
    const loans = await db.personalLoans.toArray();
    return loans.filter(l => l.status !== 'archived').reduce((sum, l) => sum + l.amountReturned, 0);
  },

  async getTotalOutstanding(): Promise<number> {
    const loans = await this.getActive();
    return loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  },

  async getPersonSummary(): Promise<{ personName: string; totalLent: number; totalReturned: number; outstanding: number }[]> {
    const loans = await db.personalLoans.filter(l => l.status !== 'archived').toArray();
    const summary = new Map<string, { totalLent: number; totalReturned: number }>();

    for (const loan of loans) {
      const existing = summary.get(loan.personName) || { totalLent: 0, totalReturned: 0 };
      existing.totalLent += loan.amountLent;
      existing.totalReturned += loan.amountReturned;
      summary.set(loan.personName, existing);
    }

    return Array.from(summary.entries()).map(([personName, data]) => ({
      personName,
      totalLent: data.totalLent,
      totalReturned: data.totalReturned,
      outstanding: data.totalLent - data.totalReturned,
    }));
  },
};
