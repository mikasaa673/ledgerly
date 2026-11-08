// ============================================================
// Ledgerly - Core Type Definitions
// ============================================================

// --- Base Types ---

export type ID = string;

export type TransactionType =
  | 'expense'
  | 'income'
  | 'interest_collection'
  | 'business_principal_lent'
  | 'business_principal_returned'
  | 'personal_lent'
  | 'personal_repayment'
  | 'bank_transfer';

export type CollectionStatus = 'coming_soon' | 'due_today' | 'pending' | 'collected' | 'partial';

export type LoanStatus = 'active' | 'closed' | 'archived';

// --- Bank Account ---

export interface BankAccount {
  id: ID;
  bankName: string;
  nickname: string;
  openingBalance: number;
  lastFourDigits?: string;
  logo?: string; // bank key (e.g. 'hdfc', 'sbi', 'icici', etc.) or custom image URL
  color?: string; // brand color code
  createdAt: string; // ISO string
  updatedAt: string;
  isDeleted: boolean;
}

// --- Activity / Ledger Log ---

export type ActivityModule =
  | 'business_lending'
  | 'personal_lending'
  | 'expense'
  | 'income'
  | 'bank_transfer'
  | 'bank_account'
  | 'system';

export type ActivityActionType =
  | 'loan_created'
  | 'loan_updated'
  | 'loan_deleted'
  | 'loan_archived'
  | 'interest_collected'
  | 'principal_repaid'
  | 'personal_lent'
  | 'personal_repayment'
  | 'personal_loan_closed'
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'income_added'
  | 'income_updated'
  | 'income_deleted'
  | 'bank_transfer'
  | 'account_created'
  | 'account_updated'
  | 'account_deleted'
  | 'settings_updated'
  | 'data_reset';

export interface ActivityLog {
  id: ID;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  module: ActivityModule;
  actionType: ActivityActionType;
  title: string;
  description: string;
  amount?: number;
  flow?: 'credit' | 'debit' | 'neutral'; // credit: money in (+), debit: money out (-), neutral: status/edit
  bankAccountId?: ID;
  bankAccountName?: string;
  secondaryBankAccountId?: ID;
  secondaryBankAccountName?: string;
  entityId?: ID;
  personName?: string;
  category?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// --- Business Lending ---

export interface BusinessLoan {
  id: ID;
  principal: number;
  dateLent: string; // ISO date string
  monthlyInterest: number;
  firstDueDate: string; // ISO date string
  bankAccountId?: ID;
  notes?: string;
  status: LoanStatus;
  principalRemaining: number;
  isOthersMoney?: boolean; // Lent using funds borrowed from someone else
  othersName?: string; // Person who provided this money
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyInterestRecord {
  id: ID;
  loanId: ID;
  month: number; // 1-12
  year: number;
  principal: number; // snapshot of principal at that time
  expectedInterest: number;
  collectedAmount: number;
  pendingAmount: number;
  dueDate: string; // ISO date string
  collectionDate?: string;
  collectionBankAccountId?: ID;
  status: CollectionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrincipalRepayment {
  id: ID;
  loanId: ID;
  amount: number;
  bankAccountId: ID;
  date: string; // ISO date string
  notes?: string;
  createdAt: string;
}

// --- Personal Lending ---

export interface PersonalLoan {
  id: ID;
  personName: string;
  amountLent: number;
  dateLent?: string; // ISO date string (optional)
  expectedRepaymentDate?: string;
  bankAccountId?: ID; // Bank account (optional)
  notes?: string;
  amountReturned: number;
  outstandingBalance: number;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalRepayment {
  id: ID;
  personalLoanId: ID;
  amount: number;
  bankAccountId?: ID; // Bank account (optional)
  date: string; // ISO date string
  notes?: string;
  createdAt: string;
}

// --- Expenses ---

export interface Expense {
  id: ID;
  amount: number;
  bankAccountId?: ID; // Bank account (optional)
  category: string;
  spentFor: string; // 'me' | 'girlfriend' | 'family' | 'other' | custom
  date: string; // ISO date string
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Income ---

export interface Income {
  id: ID;
  amount: number;
  source: string;
  bankAccountId: ID;
  date: string; // ISO date string
  description?: string;
  relatedTransactionId?: ID; // links to interest collection
  createdAt: string;
  updatedAt: string;
}

// --- Bank Transfer ---

export interface BankTransfer {
  id: ID;
  fromAccountId: ID;
  toAccountId: ID;
  amount: number;
  date: string; // ISO date string
  notes?: string;
  createdAt: string;
}

// --- Transaction (unified log) ---

export interface Transaction {
  id: ID;
  type: TransactionType;
  amount: number;
  date: string; // ISO date string
  bankAccountId: ID;
  secondaryBankAccountId?: ID; // for transfers
  description: string;
  category?: string;
  relatedEntityId?: ID; // loan ID, expense ID, etc.
  createdAt: string;
}

// --- Custom Columns for Lending Table ---

export interface CustomColumn {
  id: ID;
  name: string;
  key: string;
  type: 'text' | 'number' | 'date';
  isVisible: boolean;
  isProtected: boolean;
  order: number;
}

export interface CustomColumnValue {
  id: ID;
  loanId: ID;
  columnId: ID;
  value: string;
}

// --- Settings ---

export interface AppSettings {
  id: string; // always 'app_settings'
  theme: 'light' | 'dark' | 'system';
  defaultDateRange: 'this_month' | 'previous_month' | 'this_year' | 'previous_year' | 'all_time';
  expenseCategories: string[];
  incomeSources: string[];
  spentForOptions: string[];
  lendingTableColumns: CustomColumn[];
  createdAt: string;
  updatedAt: string;
}

// --- Backup ---

export interface BackupData {
  version: string;
  exportedAt: string;
  bankAccounts: BankAccount[];
  businessLoans: BusinessLoan[];
  monthlyInterestRecords: MonthlyInterestRecord[];
  principalRepayments: PrincipalRepayment[];
  personalLoans: PersonalLoan[];
  personalRepayments: PersonalRepayment[];
  expenses: Expense[];
  incomes: Income[];
  bankTransfers: BankTransfer[];
  transactions: Transaction[];
  activityLogs?: ActivityLog[];
  customColumnValues: CustomColumnValue[];
  settings: AppSettings;
}

// --- UI Types ---

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface DashboardFilter {
  type: 'this_month' | 'previous_month' | 'this_year' | 'previous_year' | 'all_time' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface MonthYear {
  month: number;
  year: number;
}

// --- Notification ---

export interface LendingNotification {
  id: ID;
  type: 'due_today' | 'due_soon' | 'pending' | 'recently_collected';
  loanId: ID;
  recordId: ID;
  amount: number;
  dueDate: string;
  message: string;
}
