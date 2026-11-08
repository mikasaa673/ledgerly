// ============================================================
// Ledgerly - Backup Service
// ============================================================

import { db, initializeSettings } from '../db';
import type { BackupData, AppSettings, BankAccount } from '../types';
import { nowISO, getCollectionStatus } from '../utils';
import { parseISO } from 'date-fns';
import { bankAccountService } from './bankAccountService';

const APP_VERSION = '1.0.0';

export interface ResetOptions {
  businessLending?: boolean;
  personalLending?: boolean;
  expenses?: boolean;
  income?: boolean;
  bankTransfers?: boolean;
}

export const backupService = {
  async exportAll(): Promise<BackupData> {
    const [
      bankAccounts,
      businessLoans,
      monthlyInterestRecords,
      principalRepayments,
      personalLoans,
      personalRepayments,
      expenses,
      incomes,
      bankTransfers,
      transactions,
      activityLogs,
      customColumnValues,
      settings,
    ] = await Promise.all([
      db.bankAccounts.toArray(),
      db.businessLoans.toArray(),
      db.monthlyInterestRecords.toArray(),
      db.principalRepayments.toArray(),
      db.personalLoans.toArray(),
      db.personalRepayments.toArray(),
      db.expenses.toArray(),
      db.incomes.toArray(),
      db.bankTransfers.toArray(),
      db.transactions.toArray(),
      db.activityLogs.toArray(),
      db.customColumnValues.toArray(),
      db.settings.get('app_settings'),
    ]);

    return {
      version: APP_VERSION,
      exportedAt: nowISO(),
      bankAccounts,
      businessLoans,
      monthlyInterestRecords,
      principalRepayments,
      personalLoans,
      personalRepayments,
      expenses,
      incomes,
      bankTransfers,
      transactions,
      activityLogs,
      customColumnValues,
      settings: settings!,
    };
  },

  async importAll(data: BackupData): Promise<{ success: boolean; message: string }> {
    try {
      // Validate backup structure
      if (!data.version || !data.exportedAt) {
        return { success: false, message: 'Invalid backup file: missing version or export date' };
      }

      // Clear all existing data
      await db.transaction('rw',
        [db.bankAccounts, db.businessLoans, db.monthlyInterestRecords,
         db.principalRepayments, db.personalLoans, db.personalRepayments,
         db.expenses, db.incomes, db.bankTransfers, db.transactions,
         db.activityLogs, db.customColumnValues, db.settings],
        async () => {
          await db.bankAccounts.clear();
          await db.businessLoans.clear();
          await db.monthlyInterestRecords.clear();
          await db.principalRepayments.clear();
          await db.personalLoans.clear();
          await db.personalRepayments.clear();
          await db.expenses.clear();
          await db.incomes.clear();
          await db.bankTransfers.clear();
          await db.transactions.clear();
          await db.activityLogs.clear();
          await db.customColumnValues.clear();
          await db.settings.clear();

          // Import all data
          if (data.bankAccounts?.length) await db.bankAccounts.bulkPut(data.bankAccounts);
          if (data.businessLoans?.length) await db.businessLoans.bulkPut(data.businessLoans);
          if (data.monthlyInterestRecords?.length) await db.monthlyInterestRecords.bulkPut(data.monthlyInterestRecords);
          if (data.principalRepayments?.length) await db.principalRepayments.bulkPut(data.principalRepayments);
          if (data.personalLoans?.length) await db.personalLoans.bulkPut(data.personalLoans);
          if (data.personalRepayments?.length) await db.personalRepayments.bulkPut(data.personalRepayments);
          if (data.expenses?.length) await db.expenses.bulkPut(data.expenses);
          if (data.incomes?.length) await db.incomes.bulkPut(data.incomes);
          if (data.bankTransfers?.length) await db.bankTransfers.bulkPut(data.bankTransfers);
          if (data.transactions?.length) await db.transactions.bulkPut(data.transactions);
          if (data.activityLogs?.length) await db.activityLogs.bulkPut(data.activityLogs);
          if (data.customColumnValues?.length) await db.customColumnValues.bulkPut(data.customColumnValues);
          if (data.settings) await db.settings.put(data.settings);
        }
      );

      return { success: true, message: `Backup restored successfully (exported at ${data.exportedAt})` };
    } catch (error) {
      return { success: false, message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },

  async resetSelective(options: ResetOptions): Promise<void> {
    // 1. Fetch all accounts and snapshot their live calculated current balances
    const accountsWithBalances = await bankAccountService.getAllWithBalances();

    // Determine transaction types to delete based on selected categories
    const txTypesToDelete = new Set<string>();
    if (options.businessLending) {
      txTypesToDelete.add('business_principal_lent');
      txTypesToDelete.add('interest_collection');
      txTypesToDelete.add('business_principal_returned');
    }
    if (options.personalLending) {
      txTypesToDelete.add('personal_lent');
      txTypesToDelete.add('personal_repayment');
    }
    if (options.expenses) {
      txTypesToDelete.add('expense');
    }
    if (options.income) {
      txTypesToDelete.add('income');
      txTypesToDelete.add('interest_collection');
    }
    if (options.bankTransfers) {
      txTypesToDelete.add('bank_transfer');
    }

    // 2. Fetch all transactions and calculate the net effect of remaining transactions
    const allTransactions = await db.transactions.toArray();
    const remainingTransactions = allTransactions.filter((tx) => !txTypesToDelete.has(tx.type));

    // Calculate new opening balances so current balances are 100% PRESERVED to the exact rupee
    const preservedAccounts: BankAccount[] = accountsWithBalances.map((acc) => {
      let remainingNet = 0;
      for (const tx of remainingTransactions) {
        if (tx.bankAccountId === acc.id) {
          switch (tx.type) {
            case 'income':
            case 'interest_collection':
            case 'business_principal_returned':
            case 'personal_repayment':
              remainingNet += tx.amount;
              break;
            case 'expense':
            case 'business_principal_lent':
            case 'personal_lent':
            case 'bank_transfer':
              remainingNet -= tx.amount;
              break;
          }
        }
        if (tx.secondaryBankAccountId === acc.id && tx.type === 'bank_transfer') {
          remainingNet += tx.amount;
        }
      }

      return {
        id: acc.id,
        bankName: acc.bankName,
        nickname: acc.nickname,
        openingBalance: acc.currentBalance - remainingNet,
        lastFourDigits: acc.lastFourDigits,
        isDeleted: false,
        createdAt: acc.createdAt,
        updatedAt: nowISO(),
      };
    });

    // 3. Perform atomic Dexie transaction to reset only selected tables
    await db.transaction(
      'rw',
      [
        db.bankAccounts,
        db.businessLoans,
        db.monthlyInterestRecords,
        db.principalRepayments,
        db.personalLoans,
        db.personalRepayments,
        db.expenses,
        db.incomes,
        db.bankTransfers,
        db.transactions,
        db.customColumnValues,
      ],
      async () => {
        if (options.businessLending) {
          await db.businessLoans.clear();
          await db.monthlyInterestRecords.clear();
          await db.principalRepayments.clear();
          await db.customColumnValues.clear();
          // Remove auto-generated business interest income entries
          const bizIncomes = await db.incomes.where('source').equals('Business Interest').toArray();
          for (const inc of bizIncomes) {
            await db.incomes.delete(inc.id);
          }
        }

        if (options.personalLending) {
          await db.personalLoans.clear();
          await db.personalRepayments.clear();
        }

        if (options.expenses) {
          await db.expenses.clear();
        }

        if (options.income) {
          await db.incomes.clear();

          // Reset interest collections in monthly records back to pending/coming_soon
          const collectedRecords = await db.monthlyInterestRecords.filter((r) => r.collectedAmount > 0).toArray();
          for (const rec of collectedRecords) {
            const loan = await db.businessLoans.get(rec.loanId);
            let resetStatus = 'pending';
            if (loan) {
              const firstDue = parseISO(loan.firstDueDate);
              const firstDueMonth = firstDue.getMonth() + 1;
              const firstDueYear = firstDue.getFullYear();
              if (rec.year < firstDueYear || (rec.year === firstDueYear && rec.month < firstDueMonth)) {
                resetStatus = 'coming_soon';
              } else {
                const isFullyRepaid = loan.monthlyInterest === 0 && loan.principalRemaining <= 0;
                resetStatus = getCollectionStatus(rec.dueDate, 0, rec.expectedInterest, isFullyRepaid);
              }
            }
            await db.monthlyInterestRecords.update(rec.id, {
              collectedAmount: 0,
              pendingAmount: rec.expectedInterest,
              collectionDate: undefined,
              collectionBankAccountId: undefined,
              status: resetStatus as any,
              updatedAt: nowISO(),
            });
          }
        }

        if (options.bankTransfers) {
          await db.bankTransfers.clear();
        }

        // Delete the transactions corresponding to selected reset sections
        for (const tx of allTransactions) {
          if (txTypesToDelete.has(tx.type)) {
            await db.transactions.delete(tx.id);
          }
        }

        // Re-save bank accounts with their locked-in preserved balances
        if (preservedAccounts.length > 0) {
          await db.bankAccounts.bulkPut(preservedAccounts);
        }
      }
    );

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ledgerly_demo_loaded');
    }
  },

  async resetFinancialValues(keepBankAccounts = true): Promise<void> {
    if (keepBankAccounts) {
      await this.resetSelective({
        businessLending: true,
        personalLending: true,
        expenses: true,
        income: true,
        bankTransfers: true,
      });
    } else {
      await this.clearAllData();
    }
  },

  async clearAllData(): Promise<void> {
    await db.transaction('rw',
      [db.bankAccounts, db.businessLoans, db.monthlyInterestRecords,
       db.principalRepayments, db.personalLoans, db.personalRepayments,
       db.expenses, db.incomes, db.bankTransfers, db.transactions,
       db.customColumnValues, db.settings],
      async () => {
        await db.bankAccounts.clear();
        await db.businessLoans.clear();
        await db.monthlyInterestRecords.clear();
        await db.principalRepayments.clear();
        await db.personalLoans.clear();
        await db.personalRepayments.clear();
        await db.expenses.clear();
        await db.incomes.clear();
        await db.bankTransfers.clear();
        await db.transactions.clear();
        await db.customColumnValues.clear();
        await db.settings.clear();
      }
    );
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ledgerly_demo_loaded');
    }
    await initializeSettings();
  },

  validateBackup(data: unknown): data is BackupData {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return typeof d.version === 'string' && typeof d.exportedAt === 'string';
  },
};
