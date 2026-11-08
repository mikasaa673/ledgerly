// ============================================================
// Ledgerly - Business Lending Service
// ============================================================

import { db } from '../db';
import type { BusinessLoan, MonthlyInterestRecord, PrincipalRepayment, Transaction } from '../types';
import { generateId, nowISO, todayISO, calculateNextDueDate, getCollectionStatus } from '../utils';
import { parseISO, addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { activityLogService } from './activityLogService';
import { cloudSyncService } from './cloudSyncService';

export const businessLendingService = {
  // --- Loan CRUD ---

  async getAllLoans(): Promise<BusinessLoan[]> {
    return db.businessLoans.toArray();
  },

  async getActiveLoans(): Promise<BusinessLoan[]> {
    return db.businessLoans.where('status').equals('active').toArray();
  },

  async getLoanById(id: string): Promise<BusinessLoan | undefined> {
    return db.businessLoans.get(id);
  },

  async createLoan(data: {
    principal: number;
    dateLent: string;
    monthlyInterest: number;
    firstDueDate: string;
    bankAccountId?: string;
    notes?: string;
    isOthersMoney?: boolean;
    othersName?: string;
  }): Promise<BusinessLoan> {
    const loan: BusinessLoan = {
      id: generateId(),
      principal: data.principal,
      dateLent: data.dateLent,
      monthlyInterest: data.monthlyInterest,
      firstDueDate: data.firstDueDate,
      bankAccountId: data.bankAccountId || '',
      notes: data.notes,
      isOthersMoney: Boolean(data.isOthersMoney),
      othersName: data.othersName?.trim() || undefined,
      status: 'active',
      principalRemaining: data.principal,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.transaction('rw', [db.businessLoans, db.transactions], async () => {
      await db.businessLoans.put(loan);

      // Record transaction for principal lent only if a bank account was chosen
      if (data.bankAccountId) {
        const tx: Transaction = {
          id: generateId(),
          type: 'business_principal_lent',
          amount: data.principal,
          date: data.dateLent,
          bankAccountId: data.bankAccountId,
          description: `Business loan - ₹${data.principal.toLocaleString('en-IN')} principal lent`,
          relatedEntityId: loan.id,
          createdAt: nowISO(),
        };
        await db.transactions.put(tx);
      }
    });

    // The first interest installment is due on firstDueDate!
    // Generate record for the month money was lent so it appears immediately in that month's register
    const lentDate = parseISO(data.dateLent);
    const lentMonth = lentDate.getMonth() + 1;
    const lentYear = lentDate.getFullYear();

    const firstDue = parseISO(data.firstDueDate);
    const firstDueMonth = firstDue.getMonth() + 1;
    const firstDueYear = firstDue.getFullYear();

    await this.generateRecordForMonth(loan, lentMonth, lentYear, data.firstDueDate);

    // If firstDueDate is in a different month/year, also generate record for that first due month
    if (firstDueMonth !== lentMonth || firstDueYear !== lentYear) {
      await this.generateRecordForMonth(loan, firstDueMonth, firstDueYear, data.firstDueDate);
    }

    await activityLogService.log({
      module: 'business_lending',
      actionType: 'loan_created',
      title: 'Business Loan Lent',
      description: `Lent ₹${data.principal.toLocaleString('en-IN')} at monthly interest of ₹${data.monthlyInterest.toLocaleString('en-IN')}${data.isOthersMoney ? ` (Funded by ${data.othersName || 'Others'})` : ''}`,
      amount: data.principal,
      flow: 'debit',
      bankAccountId: data.bankAccountId,
      entityId: loan.id,
      date: data.dateLent,
      category: data.isOthersMoney ? "Others' Money" : 'Own Capital',
    });

    cloudSyncService.scheduleAutoSync();

    return loan;
  },

  async updateLoan(id: string, data: Partial<BusinessLoan>): Promise<void> {
    await db.businessLoans.update(id, { ...data, updatedAt: nowISO() });
  },

  async updateLoanAndRecord(
    loanId: string,
    recordId: string | undefined,
    updates: {
      principal?: number;
      monthlyInterest?: number;
      dateLent?: string;
      dueDate?: string;
      notes?: string;
      isOthersMoney?: boolean;
      othersName?: string;
    }
  ): Promise<void> {
    const loan = await db.businessLoans.get(loanId);
    if (!loan) throw new Error('Loan not found');

    await db.transaction('rw', [db.businessLoans, db.monthlyInterestRecords, db.transactions], async () => {
      // 1. Calculate new principal and remaining
      let newPrincipal = loan.principal;
      let newRemaining = loan.principalRemaining;
      if (updates.principal !== undefined && !isNaN(updates.principal)) {
        const repaidSoFar = loan.principal - loan.principalRemaining;
        newPrincipal = updates.principal;
        newRemaining = Math.max(0, newPrincipal - repaidSoFar);
      }

      const newMonthlyInterest =
        updates.monthlyInterest !== undefined && !isNaN(updates.monthlyInterest)
          ? updates.monthlyInterest
          : loan.monthlyInterest;

      // Determine updated firstDueDate: only update firstDueDate if loan had none,
      // or if editing the record that corresponds to the loan's very first due month
      let updatedFirstDueDate = loan.firstDueDate;
      if (updates.dueDate) {
        if (!loan.firstDueDate) {
          updatedFirstDueDate = updates.dueDate;
        } else if (recordId) {
          const firstDue = parseISO(loan.firstDueDate);
          const firstMonth = firstDue.getMonth() + 1;
          const firstYear = firstDue.getFullYear();
          const targetRec = await db.monthlyInterestRecords.get(recordId);
          if (targetRec && targetRec.month === firstMonth && targetRec.year === firstYear) {
            updatedFirstDueDate = updates.dueDate;
          }
        }
      }

      // 2. Update the loan
      await db.businessLoans.update(loanId, {
        principal: newPrincipal,
        principalRemaining: newRemaining,
        monthlyInterest: newMonthlyInterest,
        dateLent: updates.dateLent ?? loan.dateLent,
        firstDueDate: updatedFirstDueDate,
        notes: updates.notes !== undefined ? updates.notes : loan.notes,
        isOthersMoney: updates.isOthersMoney !== undefined ? updates.isOthersMoney : loan.isOthersMoney,
        othersName: updates.othersName !== undefined ? (updates.othersName.trim() || undefined) : loan.othersName,
        updatedAt: nowISO(),
      });

      // 3. Update monthly interest records for this loan across months
      const allLoanRecords = await db.monthlyInterestRecords
        .where('loanId')
        .equals(loanId)
        .toArray();

      const firstDue = parseISO(updatedFirstDueDate);
      const firstDueMonth = firstDue.getMonth() + 1;
      const firstDueYear = firstDue.getFullYear();

      for (const rec of allLoanRecords) {
        let dueDate = rec.dueDate;
        if (updates.dueDate) {
          if (recordId) {
            // Update due date only for the specific month record being edited
            if (rec.id === recordId) {
              dueDate = updates.dueDate;
            }
          } else {
            const newDue = parseISO(updates.dueDate);
            const newDueDay = newDue.getDate();
            const newDueMonth = newDue.getMonth() + 1;
            const newDueYear = newDue.getFullYear();
            if (rec.month === newDueMonth && rec.year === newDueYear) {
              dueDate = updates.dueDate;
            } else {
              const daysInMonth = new Date(rec.year, rec.month, 0).getDate();
              const clamped = Math.min(newDueDay, daysInMonth);
              dueDate = format(new Date(rec.year, rec.month - 1, clamped), 'yyyy-MM-dd');
            }
          }
        }

        const isBeforeFirstDue = rec.year < firstDueYear || (rec.year === firstDueYear && rec.month < firstDueMonth);
        const expectedInterest = newMonthlyInterest;
        const collectedAmount = rec.collectedAmount;
        const pendingAmount = Math.max(0, expectedInterest - collectedAmount);
        const isFullyRepaid = newMonthlyInterest === 0 && newRemaining <= 0;

        let status: MonthlyInterestRecord['status'];
        if (isBeforeFirstDue && collectedAmount === 0) {
          status = 'coming_soon';
        } else if (pendingAmount === 0 && (expectedInterest > 0 || isFullyRepaid)) {
          status = 'collected';
        } else if (collectedAmount > 0) {
          status = 'partial';
        } else {
          status = getCollectionStatus(dueDate, 0, expectedInterest, isFullyRepaid);
        }

        await db.monthlyInterestRecords.update(rec.id, {
          principal: newPrincipal,
          expectedInterest,
          pendingAmount,
          dueDate,
          status,
          updatedAt: nowISO(),
        });
      }

      // 4. Update transaction if bank account was tied and principal changed
      if (updates.principal !== undefined && loan.bankAccountId) {
        const tx = await db.transactions
          .where('relatedEntityId')
          .equals(loan.id)
          .filter((t) => t.type === 'business_principal_lent')
          .first();
        if (tx) {
          await db.transactions.update(tx.id, {
            amount: updates.principal,
            date: updates.dateLent || tx.date,
            description: `Business loan - ₹${updates.principal.toLocaleString('en-IN')} principal lent`,
          });
        }
      }
    });

    // If dueDate was changed, also ensure a record exists for that target due month
    if (updates.dueDate) {
      const newDue = parseISO(updates.dueDate);
      const newDueMonth = newDue.getMonth() + 1;
      const newDueYear = newDue.getFullYear();
      const updatedLoan = await db.businessLoans.get(loanId);
      if (updatedLoan) {
        await this.generateRecordForMonth(updatedLoan, newDueMonth, newDueYear, updates.dueDate);
      }
    }

    cloudSyncService.scheduleAutoSync();
  },

  async closeLoan(id: string): Promise<void> {
    await db.businessLoans.update(id, { status: 'archived', updatedAt: nowISO() });
  },

  async deleteLoan(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.businessLoans,
        db.monthlyInterestRecords,
        db.principalRepayments,
        db.transactions,
        db.incomes,
        db.customColumnValues,
      ],
      async () => {
        // 1. Delete ALL monthly interest records for this loan across all months
        const loanRecs = await db.monthlyInterestRecords.where('loanId').equals(id).toArray();
        for (const rec of loanRecs) {
          await db.monthlyInterestRecords.delete(rec.id);
        }

        // 2. Delete custom column values
        const customs = await db.customColumnValues.where('loanId').equals(id).toArray();
        for (const cv of customs) {
          await db.customColumnValues.delete(cv.id);
        }

        // 3. Delete principal repayments
        const repayments = await db.principalRepayments.where('loanId').equals(id).toArray();
        for (const rep of repayments) {
          await db.principalRepayments.delete(rep.id);
        }

        // 4. Delete transactions and linked incomes
        const txs = await db.transactions.where('relatedEntityId').equals(id).toArray();
        for (const tx of txs) {
          await db.incomes.where('relatedTransactionId').equals(tx.id).delete();
          await db.transactions.delete(tx.id);
        }

        // 5. Delete loan entity completely from database
        await db.businessLoans.delete(id);
      }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
    }

    // Immediately clean up from Supabase cloud if connected
    cloudSyncService.deleteRecordsByField('monthly_interest_records', 'loan_id', id);
    cloudSyncService.deleteRecordsByField('principal_repayments', 'loan_id', id);
    cloudSyncService.deleteRecordsByField('transactions', 'related_entity_id', id);
    cloudSyncService.deleteRecord('business_loans', id);
    cloudSyncService.scheduleAutoSync();

    await activityLogService.log({
      module: 'business_lending',
      actionType: 'loan_deleted',
      title: 'Business Loan Deleted',
      description: 'Deleted business loan and associated monthly records',
      flow: 'neutral',
      entityId: id,
    });
  },

  async uncollectInterest(recordId: string): Promise<void> {
    const record = await db.monthlyInterestRecords.get(recordId);
    if (!record) throw new Error('Record not found');

    const loan = await db.businessLoans.get(record.loanId);

    await db.transaction('rw', [db.monthlyInterestRecords, db.transactions, db.incomes], async () => {
      // 1. Delete linked transactions
      const txs = await db.transactions
        .where('relatedEntityId')
        .equals(record.loanId)
        .filter(
          (t) =>
            t.type === 'interest_collection' &&
            (t.date === record.collectionDate || t.amount === record.collectedAmount)
        )
        .toArray();

      for (const tx of txs) {
        await db.incomes.where('relatedTransactionId').equals(tx.id).delete();
        await db.transactions.delete(tx.id);
      }

      // Also clean any directly created income entries for this collection
      const incomes = await db.incomes
        .where('source')
        .equals('Business Interest')
        .filter((i) => i.date === record.collectionDate && i.amount === record.collectedAmount)
        .toArray();

      for (const inc of incomes) {
        await db.incomes.delete(inc.id);
      }

      // 2. Determine appropriate status after uncollecting
      let resetStatus: 'coming_soon' | 'due_today' | 'pending' = 'pending';
      if (loan) {
        const firstDue = parseISO(loan.firstDueDate);
        const firstDueMonth = firstDue.getMonth() + 1;
        const firstDueYear = firstDue.getFullYear();
        if (record.year < firstDueYear || (record.year === firstDueYear && record.month < firstDueMonth)) {
          resetStatus = 'coming_soon';
        } else {
          const isFullyRepaid = loan.monthlyInterest === 0 && loan.principalRemaining <= 0;
          resetStatus = getCollectionStatus(record.dueDate, 0, record.expectedInterest, isFullyRepaid) as any;
        }
      }

      // 3. Reset the record fields
      await db.monthlyInterestRecords.update(recordId, {
        collectedAmount: 0,
        pendingAmount: record.expectedInterest,
        collectionDate: undefined,
        collectionBankAccountId: undefined,
        status: resetStatus,
        updatedAt: nowISO(),
      });
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
    }

    await activityLogService.log({
      module: 'business_lending',
      actionType: 'loan_updated',
      title: 'Interest Collection Reversed',
      description: `Reversed interest collection for ${record.month}/${record.year}`,
      flow: 'neutral',
      entityId: record.loanId,
    });

    cloudSyncService.scheduleAutoSync();
  },

  // --- Monthly Interest Records ---

  async generateRecordForMonth(
    loan: BusinessLoan,
    month: number,
    year: number,
    dueDate: string
  ): Promise<MonthlyInterestRecord> {
    const existing = await db.monthlyInterestRecords
      .where('[loanId+month+year]')
      .equals([loan.id, month, year])
      .first();

    const firstDue = parseISO(loan.firstDueDate);
    const firstDueMonth = firstDue.getMonth() + 1;
    const firstDueYear = firstDue.getFullYear();

    const isBeforeFirstDue = year < firstDueYear || (year === firstDueYear && month < firstDueMonth);
    const expectedInterest = loan.monthlyInterest;
    const pendingAmount = loan.monthlyInterest;

    const isFullyRepaid = loan.monthlyInterest === 0 && loan.principalRemaining <= 0;
    const currentStatus = isBeforeFirstDue && loan.monthlyInterest > 0
      ? 'coming_soon'
      : getCollectionStatus(dueDate, 0, expectedInterest, isFullyRepaid);

    if (existing) {
      // PRESERVE user's customized due date!
      const actualDueDate = existing.dueDate || dueDate;
      const isBeforeFirstDueExisting = year < firstDueYear || (year === firstDueYear && month < firstDueMonth);
      const effStatus = isBeforeFirstDueExisting && existing.collectedAmount === 0
        ? 'coming_soon'
        : (existing.pendingAmount === 0 && (existing.expectedInterest > 0 || isFullyRepaid)
          ? 'collected'
          : (existing.collectedAmount > 0
            ? 'partial'
            : getCollectionStatus(actualDueDate, 0, existing.expectedInterest, isFullyRepaid)));

      let needsUpdate = false;
      const updates: Partial<MonthlyInterestRecord> = {};

      if (existing.principal !== loan.principal) {
        updates.principal = loan.principal;
        needsUpdate = true;
      }
      if (existing.status !== effStatus) {
        updates.status = effStatus;
        needsUpdate = true;
      }
      if (existing.collectedAmount === 0 && existing.expectedInterest !== expectedInterest) {
        updates.expectedInterest = expectedInterest;
        updates.pendingAmount = expectedInterest;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.updatedAt = nowISO();
        await db.monthlyInterestRecords.update(existing.id, updates);
        return { ...existing, ...updates };
      }
      return existing;
    }

    const record: MonthlyInterestRecord = {
      id: generateId(),
      loanId: loan.id,
      month,
      year,
      principal: loan.principal,
      expectedInterest,
      collectedAmount: 0,
      pendingAmount,
      dueDate,
      status: currentStatus,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    await db.monthlyInterestRecords.put(record);
    return record;
  },

  async generateMonthlyRecord(loan: BusinessLoan, dueDate: string): Promise<MonthlyInterestRecord> {
    const due = parseISO(dueDate);
    const month = due.getMonth() + 1;
    const year = due.getFullYear();
    return this.generateRecordForMonth(loan, month, year, dueDate);
  },

  async getMonthlyRecords(month: number, year: number): Promise<MonthlyInterestRecord[]> {
    const raw = await db.monthlyInterestRecords
      .where('[month+year]')
      .equals([month, year])
      .toArray();

    // Deduplicate by loanId if multiple records exist for the same loan in the same month
    const seenLoans = new Set<string>();
    const unique: MonthlyInterestRecord[] = [];
    for (const rec of raw) {
      if (!seenLoans.has(rec.loanId)) {
        seenLoans.add(rec.loanId);
        unique.push(rec);
      }
    }
    return unique;
  },

  async getRecordsForLoan(loanId: string): Promise<MonthlyInterestRecord[]> {
    return db.monthlyInterestRecords.where('loanId').equals(loanId).toArray();
  },

  async collectInterest(recordId: string, data: {
    bankAccountId: string;
    amount: number;
    collectionDate: string;
  }): Promise<void> {
    const record = await db.monthlyInterestRecords.get(recordId);
    if (!record) throw new Error('Record not found');

    const newCollectedAmount = record.collectedAmount + data.amount;
    const newPendingAmount = Math.max(0, record.expectedInterest - newCollectedAmount);
    const newStatus = newCollectedAmount >= record.expectedInterest ? 'collected' : 'partial';

    await db.transaction('rw', [db.monthlyInterestRecords, db.transactions, db.incomes], async () => {
      await db.monthlyInterestRecords.update(recordId, {
        collectedAmount: newCollectedAmount,
        pendingAmount: newPendingAmount,
        collectionDate: data.collectionDate,
        collectionBankAccountId: data.bankAccountId,
        status: newStatus,
        updatedAt: nowISO(),
      });

      // Record as transaction
      const txId = generateId();
      const tx: Transaction = {
        id: txId,
        type: 'interest_collection',
        amount: data.amount,
        date: data.collectionDate,
        bankAccountId: data.bankAccountId,
        description: `Interest collected - ₹${data.amount.toLocaleString('en-IN')}`,
        relatedEntityId: record.loanId,
        createdAt: nowISO(),
      };
      await db.transactions.put(tx);

      // Record as income (linked to avoid double counting)
      await db.incomes.put({
        id: generateId(),
        amount: data.amount,
        source: 'Business Interest',
        bankAccountId: data.bankAccountId,
        date: data.collectionDate,
        description: `Interest collected for lending`,
        relatedTransactionId: txId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ledgerly-income-updated'));
    }

    await activityLogService.log({
      module: 'business_lending',
      actionType: 'interest_collected',
      title: 'Business Interest Collected',
      description: `Collected ₹${data.amount.toLocaleString('en-IN')} interest for ${record.month}/${record.year}`,
      amount: data.amount,
      flow: 'credit',
      bankAccountId: data.bankAccountId,
      entityId: record.loanId,
      date: data.collectionDate,
      category: 'Business Interest',
    });

    cloudSyncService.scheduleAutoSync();
  },

  // --- Principal Repayment ---

  async recordPrincipalRepayment(data: {
    loanId: string;
    recordId?: string;
    amount: number;
    bankAccountId: string;
    date: string;
    notes?: string;
  }): Promise<void> {
    const loan = await db.businessLoans.get(data.loanId);
    if (!loan) throw new Error('Loan not found');

    const newRemaining = Math.max(0, loan.principalRemaining - data.amount);

    await db.transaction('rw', [db.businessLoans, db.principalRepayments, db.monthlyInterestRecords, db.transactions], async () => {
      const repayment: PrincipalRepayment = {
        id: generateId(),
        loanId: data.loanId,
        amount: data.amount,
        bankAccountId: data.bankAccountId,
        date: data.date,
        notes: data.notes,
        createdAt: nowISO(),
      };
      await db.principalRepayments.put(repayment);

      await db.businessLoans.update(data.loanId, {
        principalRemaining: newRemaining,
        status: newRemaining <= 0 ? 'closed' : 'active',
        updatedAt: nowISO(),
      });

      // If associated with a monthly record (e.g. 0% EMI loan installment), mark as collected/repaid!
      if (data.recordId) {
        const rec = await db.monthlyInterestRecords.get(data.recordId);
        if (rec) {
          await db.monthlyInterestRecords.update(rec.id, {
            collectedAmount: (rec.collectedAmount || 0) + data.amount,
            status: 'collected',
            collectionDate: data.date,
            collectionBankAccountId: data.bankAccountId,
            updatedAt: nowISO(),
          });
        }
      } else if (newRemaining <= 0) {
        // If loan is fully repaid, mark uncollected EMI records as collected
        const recs = await db.monthlyInterestRecords.where('loanId').equals(data.loanId).toArray();
        for (const r of recs) {
          if (r.expectedInterest === 0 && r.collectedAmount === 0) {
            await db.monthlyInterestRecords.update(r.id, {
              status: 'collected',
              updatedAt: nowISO(),
            });
          }
        }
      }

      const tx: Transaction = {
        id: generateId(),
        type: 'business_principal_returned',
        amount: data.amount,
        date: data.date,
        bankAccountId: data.bankAccountId,
        description: `Principal repayment - ₹${data.amount.toLocaleString('en-IN')} received`,
        relatedEntityId: data.loanId,
        createdAt: nowISO(),
      };
      await db.transactions.put(tx);
    });

    await activityLogService.log({
      module: 'business_lending',
      actionType: 'principal_repaid',
      title: 'Principal Repaid',
      description: `Principal repayment of ₹${data.amount.toLocaleString('en-IN')} recorded`,
      amount: data.amount,
      flow: 'credit',
      bankAccountId: data.bankAccountId,
      entityId: data.loanId,
      date: data.date,
      category: 'Principal Repayment',
    });

    cloudSyncService.scheduleAutoSync();
  },

  async uncollectEmi(recordId: string): Promise<void> {
    const record = await db.monthlyInterestRecords.get(recordId);
    if (!record) throw new Error('Record not found');

    const loan = await db.businessLoans.get(record.loanId);
    if (!loan) throw new Error('Loan not found');

    await db.transaction('rw', [db.businessLoans, db.monthlyInterestRecords, db.principalRepayments, db.transactions], async () => {
      // Find the repayment matching this collection
      const repayments = await db.principalRepayments
        .where('loanId')
        .equals(record.loanId)
        .filter((r) => r.amount === record.collectedAmount && (!record.collectionDate || r.date === record.collectionDate))
        .toArray();

      if (repayments.length > 0) {
        const rep = repayments[0];
        await db.principalRepayments.delete(rep.id);

        // Delete matching transaction
        const txs = await db.transactions
          .where('relatedEntityId')
          .equals(record.loanId)
          .filter((t) => t.type === 'business_principal_returned' && t.amount === rep.amount)
          .toArray();
        for (const tx of txs) {
          await db.transactions.delete(tx.id);
        }

        // Restore loan principal remaining
        const restoredRemaining = loan.principalRemaining + rep.amount;
        await db.businessLoans.update(loan.id, {
          principalRemaining: restoredRemaining,
          status: 'active',
          updatedAt: nowISO(),
        });
      }

      // Reset record status dynamically
      const resetStatus = getCollectionStatus(record.dueDate, 0, 0, false);
      await db.monthlyInterestRecords.update(recordId, {
        collectedAmount: 0,
        collectionDate: undefined,
        collectionBankAccountId: undefined,
        status: resetStatus,
        updatedAt: nowISO(),
      });
    });

    cloudSyncService.scheduleAutoSync();
  },

  // --- Monthly Carry Forward ---

  async carryForwardLoans(month: number, year: number): Promise<void> {
    const activeLoans = await this.getActiveLoans();

    for (const loan of activeLoans) {
      const lentDate = parseISO(loan.dateLent);
      const lentMonth = lentDate.getMonth() + 1;
      const lentYear = lentDate.getFullYear();

      // If requested month/year is BEFORE the loan was lent, do NOT show it in that past month
      if (year < lentYear || (year === lentYear && month < lentMonth)) {
        continue;
      }

      const firstDue = parseISO(loan.firstDueDate);
      const firstDueMonth = firstDue.getMonth() + 1;
      const firstDueYear = firstDue.getFullYear();

      // Determine due date for this month
      let dueDate: string;
      if (year === firstDueYear && month === firstDueMonth) {
        dueDate = loan.firstDueDate;
      } else if (year === lentYear && month === lentMonth) {
        dueDate = loan.firstDueDate;
      } else {
        const dayOfMonth = firstDue.getDate();
        const daysInTargetMonth = new Date(year, month, 0).getDate();
        const clampedDay = Math.min(dayOfMonth, daysInTargetMonth);
        const targetDate = new Date(year, month - 1, clampedDay);
        dueDate = format(targetDate, 'yyyy-MM-dd');
      }

      await this.generateRecordForMonth(loan, month, year, dueDate);
    }
  },

  // --- Aggregations ---

  async getTotalPrincipalLent(): Promise<number> {
    const loans = await db.businessLoans.toArray();
    return loans.reduce((sum, l) => sum + l.principal, 0);
  },

  async getOutstandingPrincipal(): Promise<number> {
    const loans = await this.getActiveLoans();
    return loans.reduce((sum, l) => sum + l.principalRemaining, 0);
  },

  async getYourBusinessAmount(): Promise<{
    totalAmount: number;
    totalEmiAmount: number;
    othersMoney: number;
    yourAmount: number;
    activeCount: number;
    emiCount: number;
    othersCount: number;
  }> {
    const loans = await this.getActiveLoans();
    const totalAmount = loans.reduce((sum, l) => sum + (l.principalRemaining || 0), 0);
    const totalEmiAmount = loans
      .filter((l) => (l.monthlyInterest || 0) === 0)
      .reduce((sum, l) => sum + (l.principalRemaining || 0), 0);
    const othersMoney = loans
      .filter((l) => Boolean(l.isOthersMoney))
      .reduce((sum, l) => sum + (l.principalRemaining || 0), 0);
    const yourAmount = Math.max(0, totalAmount - totalEmiAmount - othersMoney);
    return {
      totalAmount,
      totalEmiAmount,
      othersMoney,
      yourAmount,
      activeCount: loans.length,
      emiCount: loans.filter((l) => (l.monthlyInterest || 0) === 0).length,
      othersCount: loans.filter((l) => Boolean(l.isOthersMoney)).length,
    };
  },

  async getInterestCollectedForMonth(month: number, year: number): Promise<number> {
    const records = await this.getMonthlyRecords(month, year);
    return records.reduce((sum, r) => sum + r.collectedAmount, 0);
  },

  async getInterestExpectedForMonth(month: number, year: number): Promise<number> {
    const records = await this.getMonthlyRecords(month, year);
    return records.reduce((sum, r) => sum + r.expectedInterest, 0);
  },

  async getInterestPendingForMonth(month: number, year: number): Promise<number> {
    const records = await this.getMonthlyRecords(month, year);
    return records.reduce((sum, r) => sum + r.pendingAmount, 0);
  },

  async getTotalLifetimeInterestCollected(): Promise<number> {
    const records = await db.monthlyInterestRecords.toArray();
    return records.reduce((sum, r) => sum + r.collectedAmount, 0);
  },

  async getPrincipalRepayments(loanId: string): Promise<PrincipalRepayment[]> {
    return db.principalRepayments.where('loanId').equals(loanId).toArray();
  },

  // --- Update statuses based on current date & sync edits across all months ---
  async refreshStatuses(): Promise<void> {
    const records = await db.monthlyInterestRecords.toArray();
    const seenByLoanMonth = new Map<string, MonthlyInterestRecord>();

    for (const record of records) {
      const loan = await db.businessLoans.get(record.loanId);

      // 1. Clean up orphaned records (loan deleted or not found)
      if (!loan) {
        await db.monthlyInterestRecords.delete(record.id);
        continue;
      }

      // 2. Clean up uncollected records for archived loans
      if (loan.status === 'archived' && record.collectedAmount === 0) {
        await db.monthlyInterestRecords.delete(record.id);
        continue;
      }

      // 3. Clean up exact duplicate records for the same loan in the same month
      const key = `${record.loanId}_${record.month}_${record.year}`;
      if (seenByLoanMonth.has(key)) {
        const existing = seenByLoanMonth.get(key)!;
        if (existing.collectedAmount === 0 && record.collectedAmount > 0) {
          await db.monthlyInterestRecords.delete(existing.id);
          seenByLoanMonth.set(key, record);
        } else {
          await db.monthlyInterestRecords.delete(record.id);
          continue;
        }
      } else {
        seenByLoanMonth.set(key, record);
      }

      // 4. Auto-sync uncollected interest with loan's current monthly interest
      const firstDue = parseISO(loan.firstDueDate);
      const firstDueMonth = firstDue.getMonth() + 1;
      const firstDueYear = firstDue.getFullYear();
      const isBeforeFirstDue = record.year < firstDueYear || (record.year === firstDueYear && record.month < firstDueMonth);

      let updatedExpected = record.expectedInterest;
      let updatedPending = record.pendingAmount;

      if (record.collectedAmount === 0) {
        if (loan.monthlyInterest === 0) {
          updatedExpected = 0;
          updatedPending = 0;
        } else {
          updatedExpected = loan.monthlyInterest;
          updatedPending = loan.monthlyInterest;
        }
      }

      // 5. Calculate status dynamically:
      // If current date is past due date, status is ALWAYS 'pending' if not collected!
      const isFullyRepaid = loan.monthlyInterest === 0 && loan.principalRemaining <= 0;
      const newStatus = isBeforeFirstDue && record.collectedAmount === 0
        ? 'coming_soon'
        : getCollectionStatus(record.dueDate, record.collectedAmount, updatedExpected, isFullyRepaid);

      if (
        newStatus !== record.status ||
        updatedExpected !== record.expectedInterest ||
        updatedPending !== record.pendingAmount
      ) {
        await db.monthlyInterestRecords.update(record.id, {
          expectedInterest: updatedExpected,
          pendingAmount: updatedPending,
          status: newStatus,
          updatedAt: nowISO(),
        });
      }
    }
  },
};
