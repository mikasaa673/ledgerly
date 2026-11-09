// ============================================================
// Ledgerly - Supabase Cloud Synchronization Service
// ============================================================

import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  BankAccount,
  BusinessLoan,
  MonthlyInterestRecord,
  PrincipalRepayment,
  PersonalLoan,
  PersonalRepayment,
  Expense,
  Income,
  BankTransfer,
  Transaction,
  ActivityLog,
  AppSettings,
} from '../types';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

let _autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;

function getDeletedIdsSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('ledgerly_deleted_activity_ids');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export const cloudSyncService = {
  /**
   * Check if there are local records in IndexedDB that can be migrated to cloud
   */
  async hasLocalData(): Promise<boolean> {
    try {
      const [accounts, bLoans, pLoans, txs] = await Promise.all([
        db.bankAccounts.count(),
        db.businessLoans.count(),
        db.personalLoans.count(),
        db.transactions.count(),
      ]);
      return (accounts + bLoans + pLoans + txs) > 0;
    } catch {
      return false;
    }
  },

  /**
   * Upload all local records from IndexedDB to Supabase cloud account
   */
  async migrateLocalDataToCloud(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    if (!supabase || !userId) {
      return { success: false, count: 0, error: 'Supabase is not configured or user not logged in' };
    }

    try {
      let totalCount = 0;

      // 1. Bank Accounts
      const accounts = await db.bankAccounts.toArray();
      if (accounts.length > 0) {
        const rows = accounts.map((a) => ({
          id: a.id,
          user_id: userId,
          bank_name: a.bankName,
          nickname: a.nickname,
          opening_balance: a.openingBalance,
          last_four_digits: a.lastFourDigits || null,
          logo: a.logo || null,
          color: a.color || null,
          is_deleted: Boolean(a.isDeleted),
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        }));
        const { error } = await supabase.from('bank_accounts').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync bank_accounts:', error);
          throw new Error(`Bank Accounts: ${error.message}`);
        }
        totalCount += accounts.length;
      }

      // 2. Business Loans
      const bLoans = await db.businessLoans.toArray();
      if (bLoans.length > 0) {
        const rows = bLoans.map((l) => ({
          id: l.id,
          user_id: userId,
          principal: l.principal,
          date_lent: l.dateLent,
          monthly_interest: l.monthlyInterest,
          first_due_date: l.firstDueDate,
          bank_account_id: l.bankAccountId || null,
          notes: l.notes || null,
          status: l.status,
          principal_remaining: l.principalRemaining,
          is_others_money: Boolean(l.isOthersMoney),
          others_name: l.othersName || null,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
        }));
        const { error } = await supabase.from('business_loans').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync business_loans:', error);
          throw new Error(`Business Loans: ${error.message}`);
        }
        totalCount += bLoans.length;
      }

      // 3. Monthly Interest Records
      const interestRecords = await db.monthlyInterestRecords.toArray();
      if (interestRecords.length > 0) {
        const rows = interestRecords.map((r) => ({
          id: r.id,
          user_id: userId,
          loan_id: r.loanId,
          month: r.month,
          year: r.year,
          principal: r.principal,
          expected_interest: r.expectedInterest,
          collected_amount: r.collectedAmount,
          pending_amount: r.pendingAmount,
          due_date: r.dueDate,
          collection_date: r.collectionDate || null,
          collection_bank_account_id: r.collectionBankAccountId || null,
          status: r.status,
          notes: r.notes || null,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        }));
        const { error } = await supabase.from('monthly_interest_records').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync monthly_interest_records:', error);
          throw new Error(`Monthly Interest: ${error.message}`);
        }
        totalCount += interestRecords.length;
      }

      // 4. Principal Repayments
      const principalRepayments = await db.principalRepayments.toArray();
      if (principalRepayments.length > 0) {
        const rows = principalRepayments.map((p) => ({
          id: p.id,
          user_id: userId,
          loan_id: p.loanId,
          amount: p.amount,
          bank_account_id: p.bankAccountId,
          date: p.date,
          notes: p.notes || null,
          created_at: p.createdAt,
        }));
        const { error } = await supabase.from('principal_repayments').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync principal_repayments:', error);
          throw new Error(`Principal Repayments: ${error.message}`);
        }
        totalCount += principalRepayments.length;
      }

      // 5. Personal Loans
      const pLoans = await db.personalLoans.toArray();
      if (pLoans.length > 0) {
        const rows = pLoans.map((p) => ({
          id: p.id,
          user_id: userId,
          person_name: p.personName,
          amount_lent: p.amountLent,
          date_lent: p.dateLent || null,
          expected_repayment_date: p.expectedRepaymentDate || null,
          bank_account_id: p.bankAccountId || null,
          notes: p.notes || null,
          amount_returned: p.amountReturned,
          outstanding_balance: p.outstandingBalance,
          status: p.status,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        }));
        const { error } = await supabase.from('personal_loans').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync personal_loans:', error);
          throw new Error(`Personal Loans: ${error.message}`);
        }
        totalCount += pLoans.length;
      }

      // 6. Personal Repayments
      const pRepayments = await db.personalRepayments.toArray();
      if (pRepayments.length > 0) {
        const rows = pRepayments.map((p) => ({
          id: p.id,
          user_id: userId,
          personal_loan_id: p.personalLoanId,
          amount: p.amount,
          bank_account_id: p.bankAccountId || null,
          date: p.date,
          notes: p.notes || null,
          created_at: p.createdAt,
        }));
        const { error } = await supabase.from('personal_repayments').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync personal_repayments:', error);
          throw new Error(`Personal Repayments: ${error.message}`);
        }
        totalCount += pRepayments.length;
      }

      // 7. Expenses
      const expenses = await db.expenses.toArray();
      if (expenses.length > 0) {
        const rows = expenses.map((e) => ({
          id: e.id,
          user_id: userId,
          amount: e.amount,
          bank_account_id: e.bankAccountId || null,
          category: e.category,
          spent_for: e.spentFor,
          date: e.date,
          description: e.description || null,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        }));
        const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync expenses:', error);
          throw new Error(`Expenses: ${error.message}`);
        }
        totalCount += expenses.length;
      }

      // 8. Incomes
      const incomes = await db.incomes.toArray();
      if (incomes.length > 0) {
        const rows = incomes.map((i) => ({
          id: i.id,
          user_id: userId,
          amount: i.amount,
          source: i.source,
          bank_account_id: i.bankAccountId,
          date: i.date,
          description: i.description || null,
          related_transaction_id: i.relatedTransactionId || null,
          created_at: i.createdAt,
          updated_at: i.updatedAt,
        }));
        const { error } = await supabase.from('incomes').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync incomes:', error);
          throw new Error(`Incomes: ${error.message}`);
        }
        totalCount += incomes.length;
      }

      // 9. Bank Transfers
      const transfers = await db.bankTransfers.toArray();
      if (transfers.length > 0) {
        const rows = transfers.map((t) => ({
          id: t.id,
          user_id: userId,
          from_account_id: t.fromAccountId,
          to_account_id: t.toAccountId,
          amount: t.amount,
          date: t.date,
          notes: t.notes || null,
          created_at: t.createdAt,
        }));
        const { error } = await supabase.from('bank_transfers').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync bank_transfers:', error);
          throw new Error(`Bank Transfers: ${error.message}`);
        }
        totalCount += transfers.length;
      }

      // 10. Transactions
      const txs = await db.transactions.toArray();
      if (txs.length > 0) {
        const rows = txs.map((t) => ({
          id: t.id,
          user_id: userId,
          type: t.type,
          amount: t.amount,
          date: t.date,
          bank_account_id: t.bankAccountId,
          secondary_bank_account_id: t.secondaryBankAccountId || null,
          description: t.description,
          category: t.category || null,
          related_entity_id: t.relatedEntityId || null,
          created_at: t.createdAt,
        }));
        const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync transactions:', error);
          throw new Error(`Transactions: ${error.message}`);
        }
        totalCount += txs.length;
      }

      // 11. Activity Logs
      const logs = await db.activityLogs.toArray();
      if (logs.length > 0) {
        const rows = logs.map((l) => ({
          id: l.id,
          user_id: userId,
          timestamp: l.timestamp,
          date: l.date,
          module: l.module,
          action_type: l.actionType,
          title: l.title,
          description: l.description,
          amount: l.amount || null,
          flow: l.flow || null,
          bank_account_id: l.bankAccountId || null,
          bank_account_name: l.bankAccountName || null,
          secondary_bank_account_id: l.secondaryBankAccountId || null,
          secondary_bank_account_name: l.secondaryBankAccountName || null,
          entity_id: l.entityId || null,
          person_name: l.personName || null,
          category: l.category || null,
          metadata: l.metadata || null,
          created_at: l.createdAt,
        }));
        const { error } = await supabase.from('activity_logs').upsert(rows, { onConflict: 'id,user_id' });
        if (error) {
          console.error('Failed to sync activity_logs:', error);
          throw new Error(`Activity Logs: ${error.message}`);
        }
        totalCount += logs.length;
      }

      // 12. App Settings
      const appSettings = await db.settings.get('app_settings');
      if (appSettings) {
        const { error } = await supabase.from('app_settings').upsert(
          {
            id: 'app_settings',
            user_id: userId,
            settings: appSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id,user_id' }
        );
        if (error) {
          console.warn('Failed to sync app_settings:', error.message);
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('ledgerly_cloud_synced_at', new Date().toISOString());
      }

      return { success: true, count: totalCount };
    } catch (err: any) {
      console.error('Failed to migrate local data to cloud:', err);
      return { success: false, count: 0, error: err.message || 'Migration error' };
    }
  },

  /**
   * Push local data to cloud (alias with auto-sync support)
   */
  async pushLocalToCloud(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    return this.migrateLocalDataToCloud(userId);
  },

  /**
   * Trigger a non-blocking debounced auto-sync to cloud when data changes locally
   */
  scheduleAutoSync(userId?: string) {
    if (!supabase) return;
    if (_autoSyncTimeout) {
      clearTimeout(_autoSyncTimeout);
    }
    _autoSyncTimeout = setTimeout(async () => {
      try {
        let uid = userId;
        if (!uid) {
          const { data } = await supabase.auth.getSession();
          uid = data.session?.user?.id;
        }
        if (uid) {
          await this.pushLocalToCloud(uid);
        }
      } catch (err) {
        console.warn('Auto cloud sync notice:', err);
      }
    }, 1500);
  },

  /**
   * Delete an entity from Supabase immediately so it won't resurrect on pull
   */
  async deleteRecord(table: string, id: string): Promise<void> {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      await supabase.from(table).delete().eq('id', id).eq('user_id', uid);
    } catch (err) {
      console.warn(`Failed to delete record ${id} from cloud ${table}:`, err);
    }
  },

  /**
   * Delete multiple records by field from Supabase
   */
  async deleteRecordsByField(table: string, field: string, value: string): Promise<void> {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      await supabase.from(table).delete().eq(field, value).eq('user_id', uid);
    } catch (err) {
      console.warn(`Failed to delete from cloud ${table} where ${field}=${value}:`, err);
    }
  },

  /**
   * Pull all records from Supabase cloud into local IndexedDB
   * Used when logging into a fresh device or syncing updates
   */
  async pullFromCloud(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    if (!supabase || !userId) {
      return { success: false, count: 0, error: 'Supabase client not initialized' };
    }

    try {
      let count = 0;

      // 1. Bank Accounts
      const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('user_id', userId);
      if (accounts && accounts.length > 0) {
        const localAccounts: BankAccount[] = accounts.map((a: any) => ({
          id: a.id,
          bankName: a.bank_name,
          nickname: a.nickname,
          openingBalance: Number(a.opening_balance),
          lastFourDigits: a.last_four_digits || undefined,
          logo: a.logo || undefined,
          color: a.color || undefined,
          isDeleted: Boolean(a.is_deleted),
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        }));
        await db.bankAccounts.bulkPut(localAccounts);
        count += localAccounts.length;
      }

      // 2. Business Loans
      const { data: bLoans } = await supabase.from('business_loans').select('*').eq('user_id', userId);
      if (bLoans && bLoans.length > 0) {
        const localBLoans: BusinessLoan[] = bLoans.map((l: any) => ({
          id: l.id,
          principal: Number(l.principal),
          dateLent: l.date_lent,
          monthlyInterest: Number(l.monthly_interest),
          firstDueDate: l.first_due_date,
          bankAccountId: l.bank_account_id || undefined,
          notes: l.notes || undefined,
          status: l.status,
          principalRemaining: Number(l.principal_remaining),
          isOthersMoney: Boolean(l.is_others_money),
          othersName: l.others_name || undefined,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        }));
        await db.businessLoans.bulkPut(localBLoans);
        count += localBLoans.length;
      }

      // 3. Monthly Interest Records
      const { data: interestRecords } = await supabase.from('monthly_interest_records').select('*').eq('user_id', userId);
      if (interestRecords && interestRecords.length > 0) {
        const localInterest: MonthlyInterestRecord[] = interestRecords.map((r: any) => ({
          id: r.id,
          loanId: r.loan_id,
          month: Number(r.month),
          year: Number(r.year),
          principal: Number(r.principal),
          expectedInterest: Number(r.expected_interest),
          collectedAmount: Number(r.collected_amount),
          pendingAmount: Number(r.pending_amount),
          dueDate: r.due_date,
          collectionDate: r.collection_date || undefined,
          collectionBankAccountId: r.collection_bank_account_id || undefined,
          status: r.status,
          notes: r.notes || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        await db.monthlyInterestRecords.bulkPut(localInterest);
        count += localInterest.length;
      }

      // 4. Principal Repayments
      const { data: repayments } = await supabase.from('principal_repayments').select('*').eq('user_id', userId);
      if (repayments && repayments.length > 0) {
        const localRepayments: PrincipalRepayment[] = repayments.map((p: any) => ({
          id: p.id,
          loanId: p.loan_id,
          amount: Number(p.amount),
          bankAccountId: p.bank_account_id,
          date: p.date,
          notes: p.notes || undefined,
          createdAt: p.created_at,
        }));
        await db.principalRepayments.bulkPut(localRepayments);
        count += localRepayments.length;
      }

      // 5. Personal Loans
      const { data: pLoans } = await supabase.from('personal_loans').select('*').eq('user_id', userId);
      if (pLoans && pLoans.length > 0) {
        const deletedIds = getDeletedIdsSet();
        const idsToPurge: string[] = [];
        const localPLoans: PersonalLoan[] = [];

        for (const p of pLoans) {
          if (deletedIds.has(p.id)) {
            idsToPurge.push(p.id);
            continue;
          }
          localPLoans.push({
            id: p.id,
            personName: p.person_name,
            amountLent: Number(p.amount_lent),
            dateLent: p.date_lent || undefined,
            expectedRepaymentDate: p.expected_repayment_date || undefined,
            bankAccountId: p.bank_account_id || undefined,
            notes: p.notes || undefined,
            amountReturned: Number(p.amount_returned),
            outstandingBalance: Number(p.outstanding_balance),
            status: p.status,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          });
        }
        if (idsToPurge.length > 0) {
          supabase.from('personal_loans').delete().in('id', idsToPurge).eq('user_id', userId).then();
        }
        if (localPLoans.length > 0) {
          await db.personalLoans.bulkPut(localPLoans);
          count += localPLoans.length;
        }
      }

      // 6. Personal Repayments
      const { data: pRepayments } = await supabase.from('personal_repayments').select('*').eq('user_id', userId);
      if (pRepayments && pRepayments.length > 0) {
        const localPRepayments: PersonalRepayment[] = pRepayments.map((p: any) => ({
          id: p.id,
          personalLoanId: p.personal_loan_id,
          amount: Number(p.amount),
          bankAccountId: p.bank_account_id || undefined,
          date: p.date,
          notes: p.notes || undefined,
          createdAt: p.created_at,
        }));
        await db.personalRepayments.bulkPut(localPRepayments);
        count += localPRepayments.length;
      }

      // 7. Expenses
      const { data: expenses } = await supabase.from('expenses').select('*').eq('user_id', userId);
      if (expenses && expenses.length > 0) {
        const localExpenses: Expense[] = expenses.map((e: any) => ({
          id: e.id,
          amount: Number(e.amount),
          bankAccountId: e.bank_account_id || undefined,
          category: e.category,
          spentFor: e.spent_for,
          date: e.date,
          description: e.description || undefined,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }));
        await db.expenses.bulkPut(localExpenses);
        count += localExpenses.length;
      }

      // 8. Incomes
      const { data: incomes } = await supabase.from('incomes').select('*').eq('user_id', userId);
      if (incomes && incomes.length > 0) {
        const localIncomes: Income[] = incomes.map((i: any) => ({
          id: i.id,
          amount: Number(i.amount),
          source: i.source,
          bankAccountId: i.bank_account_id,
          date: i.date,
          description: i.description || undefined,
          relatedTransactionId: i.related_transaction_id || undefined,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        }));
        await db.incomes.bulkPut(localIncomes);
        count += localIncomes.length;
      }

      // 9. Bank Transfers
      const { data: transfers } = await supabase.from('bank_transfers').select('*').eq('user_id', userId);
      if (transfers && transfers.length > 0) {
        const localTransfers: BankTransfer[] = transfers.map((t: any) => ({
          id: t.id,
          fromAccountId: t.from_account_id,
          toAccountId: t.to_account_id,
          amount: Number(t.amount),
          date: t.date,
          notes: t.notes || undefined,
          createdAt: t.created_at,
        }));
        await db.bankTransfers.bulkPut(localTransfers);
        count += localTransfers.length;
      }

      // 10. Transactions
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId);
      if (txs && txs.length > 0) {
        const deletedIds = getDeletedIdsSet();
        const idsToPurge: string[] = [];
        const localTxs: Transaction[] = [];

        for (const t of txs) {
          if (
            deletedIds.has(t.id) ||
            deletedIds.has(`log_legacy_${t.id}`) ||
            (t.related_entity_id && deletedIds.has(t.related_entity_id))
          ) {
            idsToPurge.push(t.id);
            continue;
          }
          localTxs.push({
            id: t.id,
            type: t.type,
            amount: Number(t.amount),
            date: t.date,
            bankAccountId: t.bank_account_id,
            secondaryBankAccountId: t.secondary_bank_account_id || undefined,
            description: t.description,
            category: t.category || undefined,
            relatedEntityId: t.related_entity_id || undefined,
            createdAt: t.created_at,
          });
        }
        if (idsToPurge.length > 0) {
          supabase.from('transactions').delete().in('id', idsToPurge).eq('user_id', userId).then();
        }
        if (localTxs.length > 0) {
          await db.transactions.bulkPut(localTxs);
          count += localTxs.length;
        }
      }

      // 11. Activity Logs
      const { data: logs } = await supabase.from('activity_logs').select('*').eq('user_id', userId);
      if (logs && logs.length > 0) {
        const deletedIds = getDeletedIdsSet();
        const idsToPurge: string[] = [];
        const localLogs: ActivityLog[] = [];

        for (const l of logs) {
          if (
            deletedIds.has(l.id) ||
            (l.entity_id && deletedIds.has(l.entity_id)) ||
            deletedIds.has(`log_legacy_${l.id}`) ||
            (l.entity_id && deletedIds.has(`log_legacy_${l.entity_id}`))
          ) {
            idsToPurge.push(l.id);
            continue;
          }

          localLogs.push({
            id: l.id,
            timestamp: l.timestamp,
            date: l.date,
            module: l.module,
            actionType: l.action_type,
            title: l.title,
            description: l.description,
            amount: l.amount ? Number(l.amount) : undefined,
            flow: l.flow || undefined,
            bankAccountId: l.bank_account_id || undefined,
            bankAccountName: l.bank_account_name || undefined,
            secondaryBankAccountId: l.secondary_bank_account_id || undefined,
            secondaryBankAccountName: l.secondary_bank_account_name || undefined,
            entityId: l.entity_id || undefined,
            personName: l.person_name || undefined,
            category: l.category || undefined,
            metadata: l.metadata || undefined,
            createdAt: l.created_at,
          });
        }

        if (idsToPurge.length > 0) {
          supabase.from('activity_logs').delete().in('id', idsToPurge).eq('user_id', userId).then();
        }
        if (localLogs.length > 0) {
          await db.activityLogs.bulkPut(localLogs);
          count += localLogs.length;
        }
      }

      // 12. App Settings
      try {
        const { data: sData } = await supabase
          .from('app_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();
        if (sData?.settings) {
          await db.settings.put(sData.settings);
        }
      } catch (e) {
        console.warn('App settings pull warning:', e);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('ledgerly_cloud_synced_at', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('ledgerly-data-reset'));
      }

      return { success: true, count };
    } catch (err: any) {
      console.error('Failed to pull records from cloud:', err);
      return { success: false, count: 0, error: err.message || 'Pull error' };
    }
  },
};
