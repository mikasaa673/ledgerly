// ============================================================
// Ledgerly - Activity Log & Audit Ledger Service
// ============================================================

import { db } from '../db';
import type { ActivityLog, ActivityModule, ActivityActionType } from '../types';
import { generateId, nowISO, todayISO, formatCurrency } from '../utils';

const INITIAL_SYNC_FLAG = 'ledgerly_activity_initial_synced_v3';
const DELETED_ACTIVITY_LOGS_KEY = 'ledgerly_deleted_activity_ids';

export function getDeletedActivityIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_ACTIVITY_LOGS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedActivityId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getDeletedActivityIds();
    set.add(id);
    localStorage.setItem(DELETED_ACTIVITY_LOGS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export const activityLogService = {
  /**
   * Record a new activity entry into the audit ledger
   */
  async log(entry: {
    module: ActivityModule;
    actionType: ActivityActionType;
    title: string;
    description: string;
    amount?: number;
    flow?: 'credit' | 'debit' | 'neutral';
    bankAccountId?: string;
    bankAccountName?: string;
    secondaryBankAccountId?: string;
    secondaryBankAccountName?: string;
    entityId?: string;
    personName?: string;
    category?: string;
    date?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityLog> {
    const timestamp = entry.timestamp || nowISO();
    const date = entry.date || (timestamp.includes('T') ? timestamp.split('T')[0] : todayISO());

    // Resolve bank account name if not provided
    let bankAccountName = entry.bankAccountName;
    if (entry.bankAccountId && !bankAccountName) {
      try {
        const acc = await db.bankAccounts.get(entry.bankAccountId);
        if (acc) {
          bankAccountName = `${acc.nickname} (${acc.bankName})`;
        }
      } catch {
        // ignore
      }
    }

    let secondaryBankAccountName = entry.secondaryBankAccountName;
    if (entry.secondaryBankAccountId && !secondaryBankAccountName) {
      try {
        const acc = await db.bankAccounts.get(entry.secondaryBankAccountId);
        if (acc) {
          secondaryBankAccountName = `${acc.nickname} (${acc.bankName})`;
        }
      } catch {
        // ignore
      }
    }

    const logItem: ActivityLog = {
      id: generateId(),
      timestamp,
      date,
      module: entry.module,
      actionType: entry.actionType,
      title: entry.title,
      description: entry.description,
      amount: entry.amount,
      flow: entry.flow || (entry.amount ? 'neutral' : 'neutral'),
      bankAccountId: entry.bankAccountId,
      bankAccountName,
      secondaryBankAccountId: entry.secondaryBankAccountId,
      secondaryBankAccountName,
      entityId: entry.entityId,
      personName: entry.personName,
      category: entry.category,
      metadata: entry.metadata,
      createdAt: nowISO(),
    };

    try {
      await db.activityLogs.put(logItem);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerly-activity-recorded', { detail: logItem }));
      }
    } catch (err) {
      console.error('Failed to write activity log:', err);
    }

    return logItem;
  },

  /**
   * Get all activity logs, newest first
   */
  async getAll(): Promise<ActivityLog[]> {
    try {
      const logs = await db.activityLogs.toArray();
      return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (err) {
      console.error('Failed to get activity logs:', err);
      return [];
    }
  },

  /**
   * Filter activity logs with custom criteria
   */
  async getFiltered(filters: {
    module?: ActivityModule | 'all';
    flow?: 'credit' | 'debit' | 'neutral' | 'all';
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
    bankAccountId?: string;
    limit?: number;
  }): Promise<ActivityLog[]> {
    let logs = await this.getAll();

    if (filters.module && filters.module !== 'all') {
      logs = logs.filter((l) => l.module === filters.module);
    }

    if (filters.flow && filters.flow !== 'all') {
      logs = logs.filter((l) => l.flow === filters.flow);
    }

    if (filters.bankAccountId) {
      logs = logs.filter(
        (l) => l.bankAccountId === filters.bankAccountId || l.secondaryBankAccountId === filters.bankAccountId
      );
    }

    if (filters.startDate) {
      logs = logs.filter((l) => l.date >= filters.startDate!);
    }

    if (filters.endDate) {
      logs = logs.filter((l) => l.date <= filters.endDate!);
    }

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      logs = logs.filter((l) => {
        return (
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.personName && l.personName.toLowerCase().includes(q)) ||
          (l.bankAccountName && l.bankAccountName.toLowerCase().includes(q)) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.amount !== undefined && String(l.amount).includes(q))
        );
      });
    }

    if (filters.limit) {
      return logs.slice(0, filters.limit);
    }

    return logs;
  },

  /**
   * One-time initial migration: backfill legacy activities from transactions if never synced before.
   * If activityLogs already has entries or has already been synced once, it will NEVER resurrect deleted logs.
   */
  async syncFromExistingData(): Promise<number> {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(INITIAL_SYNC_FLAG) === 'true') {
        return 0; // Already synced once, never backfill again
      }

      const existingCount = await db.activityLogs.count();
      if (existingCount > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(INITIAL_SYNC_FLAG, 'true');
        }
        return 0; // Already has logs
      }

      const txCount = await db.transactions.count();
      if (txCount === 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(INITIAL_SYNC_FLAG, 'true');
        }
        return 0;
      }

      const deletedIds = getDeletedActivityIds();
      const [transactions, accounts] = await Promise.all([
        db.transactions.toArray(),
        db.bankAccounts.toArray(),
      ]);

      const accountMap = new Map<string, string>();
      accounts.forEach((a) => accountMap.set(a.id, `${a.nickname} (${a.bankName})`));

      const newLogs: ActivityLog[] = [];

      for (const tx of transactions) {
        const logId = `log_legacy_${tx.id}`;
        if (deletedIds.has(logId)) continue; // Never recreate previously deleted entries

        let module: ActivityModule = 'system';
        let actionType: ActivityActionType = 'settings_updated';
        let flow: 'credit' | 'debit' | 'neutral' = 'neutral';
        let title = 'Transaction Recorded';

        switch (tx.type) {
          case 'business_principal_lent':
            module = 'business_lending';
            actionType = 'loan_created';
            flow = 'debit';
            title = 'Business Loan Lent';
            break;
          case 'interest_collection':
            module = 'business_lending';
            actionType = 'interest_collected';
            flow = 'credit';
            title = 'Interest Collected';
            break;
          case 'business_principal_returned':
            module = 'business_lending';
            actionType = 'principal_repaid';
            flow = 'credit';
            title = 'Principal Repaid';
            break;
          case 'personal_lent':
            module = 'personal_lending';
            actionType = 'personal_lent';
            flow = 'debit';
            title = 'Personal Loan Lent';
            break;
          case 'personal_repayment':
            module = 'personal_lending';
            actionType = 'personal_repayment';
            flow = 'credit';
            title = 'Personal Repayment Received';
            break;
          case 'expense':
            module = 'expense';
            actionType = 'expense_added';
            flow = 'debit';
            title = 'Expense Logged';
            break;
          case 'income':
            module = 'income';
            actionType = 'income_added';
            flow = 'credit';
            title = 'Income Received';
            break;
          case 'bank_transfer':
            module = 'bank_transfer';
            actionType = 'bank_transfer';
            flow = 'neutral';
            title = 'Internal Bank Transfer';
            break;
        }

        const date = tx.date;
        const timestamp = tx.createdAt || `${date}T12:00:00.000Z`;

        newLogs.push({
          id: logId,
          timestamp,
          date,
          module,
          actionType,
          title,
          description: tx.description,
          amount: tx.amount,
          flow,
          bankAccountId: tx.bankAccountId,
          bankAccountName: accountMap.get(tx.bankAccountId),
          secondaryBankAccountId: tx.secondaryBankAccountId,
          secondaryBankAccountName: tx.secondaryBankAccountId ? accountMap.get(tx.secondaryBankAccountId) : undefined,
          entityId: tx.relatedEntityId,
          category: tx.category,
          createdAt: tx.createdAt || nowISO(),
        });
      }

      if (newLogs.length > 0) {
        await db.activityLogs.bulkPut(newLogs);
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(INITIAL_SYNC_FLAG, 'true');
      }

      return newLogs.length;
    } catch (err) {
      console.error('Failed to sync legacy activities:', err);
      return 0;
    }
  },

  /**
   * Export activity logs to CSV format for download
   */
  exportToCsv(logs: ActivityLog[]): void {
    if (!logs.length) return;

    const headers = ['Timestamp', 'Date', 'Module', 'Action', 'Title', 'Description', 'Flow', 'Amount (INR)', 'Bank Account', 'Secondary Account', 'Category', 'Entity ID'];

    const rows = logs.map((l) => [
      l.timestamp,
      l.date,
      l.module,
      l.actionType,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      l.flow || 'neutral',
      l.amount !== undefined ? l.amount : '',
      `"${(l.bankAccountName || '').replace(/"/g, '""')}"`,
      `"${(l.secondaryBankAccountName || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      l.entityId || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ledgerly_activity_log_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Delete a single activity log entry by id
   */
  async delete(id: string): Promise<boolean> {
    try {
      const existing = await db.activityLogs.get(id);
      recordDeletedActivityId(id);
      if (existing?.entityId) {
        recordDeletedActivityId(existing.entityId);
        recordDeletedActivityId(`log_legacy_${existing.entityId}`);
      }
      await db.activityLogs.delete(id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerly-activity-deleted', { detail: { id } }));
      }
      return true;
    } catch (err) {
      console.error('Failed to delete activity log:', err);
      return false;
    }
  },

  /**
   * Delete all activity logs associated with a bank account
   */
  async deleteByBankAccountId(bankAccountId: string): Promise<number> {
    try {
      const all = await db.activityLogs.toArray();
      const matches = all.filter(
        (l) => l.bankAccountId === bankAccountId || l.secondaryBankAccountId === bankAccountId
      );
      if (matches.length > 0) {
        matches.forEach((m) => {
          recordDeletedActivityId(m.id);
          if (m.entityId) {
            recordDeletedActivityId(m.entityId);
            recordDeletedActivityId(`log_legacy_${m.entityId}`);
          }
        });
        await db.activityLogs.bulkDelete(matches.map((m) => m.id));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ledgerly-activity-deleted', { detail: { bankAccountId } }));
        }
      }
      return matches.length;
    } catch (err) {
      console.error('Failed to delete activity logs by bank account:', err);
      return 0;
    }
  },

  /**
   * Clear all activity logs
   */
  async clearAll(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(INITIAL_SYNC_FLAG, 'true');
      }
      const all = await db.activityLogs.toArray();
      all.forEach((m) => {
        recordDeletedActivityId(m.id);
        if (m.entityId) {
          recordDeletedActivityId(m.entityId);
          recordDeletedActivityId(`log_legacy_${m.entityId}`);
        }
      });
      await db.activityLogs.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerly-activity-deleted'));
      }
    } catch (err) {
      console.error('Failed to clear activity logs:', err);
    }
  },
};
