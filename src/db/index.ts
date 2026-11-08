// ============================================================
// Ledgerly - Dexie Database Definition
// ============================================================

import Dexie, { type Table } from 'dexie';
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
  CustomColumnValue,
  AppSettings,
  ActivityLog,
} from '../types';

export class LedgerlyDB extends Dexie {
  bankAccounts!: Table<BankAccount, string>;
  businessLoans!: Table<BusinessLoan, string>;
  monthlyInterestRecords!: Table<MonthlyInterestRecord, string>;
  principalRepayments!: Table<PrincipalRepayment, string>;
  personalLoans!: Table<PersonalLoan, string>;
  personalRepayments!: Table<PersonalRepayment, string>;
  expenses!: Table<Expense, string>;
  incomes!: Table<Income, string>;
  bankTransfers!: Table<BankTransfer, string>;
  transactions!: Table<Transaction, string>;
  activityLogs!: Table<ActivityLog, string>;
  customColumnValues!: Table<CustomColumnValue, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('LedgerlyDB');

    this.version(1).stores({
      bankAccounts: 'id, bankName, nickname, isDeleted',
      businessLoans: 'id, status, dateLent, bankAccountId',
      monthlyInterestRecords: 'id, loanId, [month+year], [loanId+month+year], status, dueDate',
      principalRepayments: 'id, loanId, date, bankAccountId',
      personalLoans: 'id, personName, status, bankAccountId',
      personalRepayments: 'id, personalLoanId, date, bankAccountId',
      expenses: 'id, date, category, bankAccountId, spentFor',
      incomes: 'id, date, source, bankAccountId, relatedTransactionId',
      bankTransfers: 'id, fromAccountId, toAccountId, date',
      transactions: 'id, type, date, bankAccountId, secondaryBankAccountId, relatedEntityId',
      customColumnValues: 'id, loanId, columnId, [loanId+columnId]',
      settings: 'id',
    });

    this.version(2).stores({
      activityLogs: 'id, timestamp, date, module, actionType, flow, bankAccountId, entityId',
    });
  }
}

export const db = new LedgerlyDB();

// Initialize default settings if not present
export async function initializeSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app_settings');
  if (existing) return existing;

  const defaultSettings: AppSettings = {
    id: 'app_settings',
    theme: 'light',
    defaultDateRange: 'this_month',
    expenseCategories: [
      'Food',
      'Shopping',
      'Travel / Transport',
      'Fuel',
      'Bills / Electricity',
      'Mobile / Internet',
      'Entertainment',
      'Gym / Fitness',
      'Medical',
      'Gifts',
      'Girlfriend',
      'Family',
      'Education',
      'Subscriptions',
      'Miscellaneous',
    ],
    incomeSources: [
      'Freelancing',
      'Gifts',
      'Salary',
      'Other Income',
    ],
    spentForOptions: [
      'Me',
      'Girlfriend',
      'Family',
      'Other',
    ],
    lendingTableColumns: [
      { id: 'col_principal', name: 'Amount', key: 'principal', type: 'number', isVisible: true, isProtected: true, order: 0 },
      { id: 'col_interest', name: 'Monthly Interest', key: 'monthlyInterest', type: 'number', isVisible: true, isProtected: true, order: 1 },
      { id: 'col_due', name: 'Due Date', key: 'dueDate', type: 'date', isVisible: true, isProtected: true, order: 2 },
      { id: 'col_status', name: 'Status', key: 'status', type: 'text', isVisible: true, isProtected: true, order: 3 },
      { id: 'col_notes', name: 'Notes', key: 'notes', type: 'text', isVisible: true, isProtected: false, order: 4 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.settings.put(defaultSettings);
  return defaultSettings;
}
