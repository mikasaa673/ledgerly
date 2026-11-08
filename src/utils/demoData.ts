// ============================================================
// Ledgerly - Demo / Sample Data Generator & Cleaner
// ============================================================

import { db } from '../db';
import { generateId, nowISO, todayISO } from './index';
import type {
  BankAccount,
  BusinessLoan,
  MonthlyInterestRecord,
  PersonalLoan,
  PersonalRepayment,
  Expense,
  Income,
  BankTransfer,
  Transaction,
} from '../types';

export const DEMO_FLAG_KEY = 'ledgerly_has_demo_data';

export async function hasDemoData(): Promise<boolean> {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === 'true';
}

export async function loadDemoData(): Promise<void> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. Bank Accounts (3 accounts)
  const accHdfcId = 'demo_acc_hdfc';
  const accSbiId = 'demo_acc_sbi';
  const accIciciId = 'demo_acc_icici';

  const accounts: BankAccount[] = [
    {
      id: accHdfcId,
      bankName: 'HDFC Bank',
      nickname: 'Salary & Savings',
      openingBalance: 125000,
      lastFourDigits: '4128',
      logo: 'hdfc',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDeleted: false,
    },
    {
      id: accSbiId,
      bankName: 'State Bank of India',
      nickname: 'Lending Capital',
      openingBalance: 250000,
      lastFourDigits: '8902',
      logo: 'sbi',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDeleted: false,
    },
    {
      id: accIciciId,
      bankName: 'ICICI Bank',
      nickname: 'Daily Expenses',
      openingBalance: 45000,
      lastFourDigits: '3310',
      logo: 'icici',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      isDeleted: false,
    },
  ];

  // 2. Business Loans (Matches user prompt's exact notebook examples)
  // | ₹15,000 | 06 Oct | ₹1,500 |
  // | ₹20,000 | 07 Oct | ₹2,000 |
  // | ₹5,000  | 11 Oct | ₹400   |
  // | ₹10,000 | 12 Oct | ₹1,200 |
  const loan1Id = 'demo_loan_1';
  const loan2Id = 'demo_loan_2';
  const loan3Id = 'demo_loan_3';
  const loan4Id = 'demo_loan_4';

  const businessLoans: BusinessLoan[] = [
    {
      id: loan1Id,
      principal: 15000,
      dateLent: `${currentYear}-09-06`,
      monthlyInterest: 1500,
      firstDueDate: `${currentYear}-10-06`,
      bankAccountId: accSbiId,
      notes: 'Shop expansion loan',
      status: 'active',
      principalRemaining: 15000,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: loan2Id,
      principal: 20000,
      dateLent: `${currentYear}-09-07`,
      monthlyInterest: 2000,
      firstDueDate: `${currentYear}-10-07`,
      bankAccountId: accSbiId,
      notes: 'Inventory financing',
      status: 'active',
      principalRemaining: 20000,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: loan3Id,
      principal: 5000,
      dateLent: `${currentYear}-09-11`,
      monthlyInterest: 400,
      firstDueDate: `${currentYear}-10-11`,
      bankAccountId: accHdfcId,
      notes: 'Urgent working capital',
      status: 'active',
      principalRemaining: 5000,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: loan4Id,
      principal: 10000,
      dateLent: `${currentYear}-09-12`,
      monthlyInterest: 1200,
      firstDueDate: `${currentYear}-10-12`,
      bankAccountId: accSbiId,
      notes: 'Electronic goods trade',
      status: 'active',
      principalRemaining: 10000,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  // 3. Monthly Interest Records for current month & previous month
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const monthlyRecords: MonthlyInterestRecord[] = [
    // Previous Month (All collected)
    {
      id: 'demo_rec_prev_1',
      loanId: loan1Id,
      month: prevMonth,
      year: prevYear,
      principal: 15000,
      expectedInterest: 1500,
      collectedAmount: 1500,
      pendingAmount: 0,
      dueDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-06`,
      collectionDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-06`,
      collectionBankAccountId: accSbiId,
      status: 'collected',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_rec_prev_2',
      loanId: loan2Id,
      month: prevMonth,
      year: prevYear,
      principal: 20000,
      expectedInterest: 2000,
      collectedAmount: 2000,
      pendingAmount: 0,
      dueDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-07`,
      collectionDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-08`,
      collectionBankAccountId: accSbiId,
      status: 'collected',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    // Current Month
    {
      id: 'demo_rec_cur_1',
      loanId: loan1Id,
      month: currentMonth,
      year: currentYear,
      principal: 15000,
      expectedInterest: 1500,
      collectedAmount: 1500,
      pendingAmount: 0,
      dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      collectionDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      collectionBankAccountId: accSbiId,
      status: 'collected',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_rec_cur_2',
      loanId: loan2Id,
      month: currentMonth,
      year: currentYear,
      principal: 20000,
      expectedInterest: 2000,
      collectedAmount: 0,
      pendingAmount: 2000,
      dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-07`,
      status: 'due_today',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_rec_cur_3',
      loanId: loan3Id,
      month: currentMonth,
      year: currentYear,
      principal: 5000,
      expectedInterest: 400,
      collectedAmount: 0,
      pendingAmount: 400,
      dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-11`,
      status: 'coming_soon',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_rec_cur_4',
      loanId: loan4Id,
      month: currentMonth,
      year: currentYear,
      principal: 10000,
      expectedInterest: 1200,
      collectedAmount: 0,
      pendingAmount: 1200,
      dueDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-12`,
      status: 'coming_soon',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  // 4. Personal Lending (Interest-free)
  // Rahul: Lent 10,000, returned 3,000, returned 2,000 -> 5,000 outstanding
  const pLoan1Id = 'demo_ploan_1';
  const pLoan2Id = 'demo_ploan_2';

  const personalLoans: PersonalLoan[] = [
    {
      id: pLoan1Id,
      personName: 'Rahul Sharma',
      amountLent: 10000,
      dateLent: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
      expectedRepaymentDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-25`,
      bankAccountId: accHdfcId,
      notes: 'Emergency medical support',
      amountReturned: 5000,
      outstandingBalance: 5000,
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: pLoan2Id,
      personName: 'Vikram Patel',
      amountLent: 8000,
      dateLent: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03`,
      expectedRepaymentDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-30`,
      bankAccountId: accHdfcId,
      notes: 'Computer purchase support',
      amountReturned: 0,
      outstandingBalance: 8000,
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  const personalRepayments: PersonalRepayment[] = [
    {
      id: 'demo_prepay_1',
      personalLoanId: pLoan1Id,
      amount: 3000,
      bankAccountId: accHdfcId,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04`,
      notes: 'Part payment 1 via UPI',
      createdAt: nowISO(),
    },
    {
      id: 'demo_prepay_2',
      personalLoanId: pLoan1Id,
      amount: 2000,
      bankAccountId: accHdfcId,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      notes: 'Part payment 2 via UPI',
      createdAt: nowISO(),
    },
  ];

  // 5. Expenses
  const expenses: Expense[] = [
    {
      id: 'demo_exp_1',
      amount: 3200,
      bankAccountId: accIciciId,
      category: 'Food',
      spentFor: 'Sarayu',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
      description: 'Fine dining anniversary dinner',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_exp_2',
      amount: 4500,
      bankAccountId: accHdfcId,
      category: 'Gifts',
      spentFor: 'Sarayu',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03`,
      description: 'Perfume and flowers',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_exp_3',
      amount: 2800,
      bankAccountId: accIciciId,
      category: 'Fuel',
      spentFor: 'Me',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04`,
      description: 'Petrol car tank full',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_exp_4',
      amount: 7500,
      bankAccountId: accHdfcId,
      category: 'Bills / Electricity',
      spentFor: 'Family',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
      description: 'Home electricity bill and broadband',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_exp_5',
      amount: 1499,
      bankAccountId: accIciciId,
      category: 'Subscriptions',
      spentFor: 'Me',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-05`,
      description: 'Cloud and streaming services',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_exp_6',
      amount: 6200,
      bankAccountId: accHdfcId,
      category: 'Shopping',
      spentFor: 'Sarayu',
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      description: 'Clothing and accessories',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  // 6. Income Entries
  const incomes: Income[] = [
    {
      id: 'demo_inc_1',
      amount: 120000,
      source: 'Salary',
      bankAccountId: accHdfcId,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
      description: 'Monthly consulting stipend',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: 'demo_inc_2',
      amount: 25000,
      source: 'Freelancing',
      bankAccountId: accHdfcId,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04`,
      description: 'Full stack dashboard contract',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    // Auto interest collection entry linked to demo_rec_cur_1
    {
      id: 'demo_inc_3',
      amount: 1500,
      source: 'Business Interest',
      bankAccountId: accSbiId,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      description: 'Interest collected for lending',
      relatedTransactionId: 'demo_tx_int_1',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  // 7. Internal Bank Transfer (HDFC -> SBI 15,000 for lending)
  const transfers: BankTransfer[] = [
    {
      id: 'demo_tr_1',
      fromAccountId: accHdfcId,
      toAccountId: accSbiId,
      amount: 15000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
      notes: 'Capital replenishment for lending',
      createdAt: nowISO(),
    },
  ];

  // 8. Transactions Log
  const transactions: Transaction[] = [
    {
      id: 'demo_tx_inc_1',
      type: 'income',
      amount: 120000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
      bankAccountId: accHdfcId,
      description: 'Salary - Monthly consulting stipend',
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_pl_1',
      type: 'personal_lent',
      amount: 10000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
      bankAccountId: accHdfcId,
      description: 'Lent to Rahul Sharma - ₹10,000',
      relatedEntityId: pLoan1Id,
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_tr_1',
      type: 'bank_transfer',
      amount: 15000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
      bankAccountId: accHdfcId,
      secondaryBankAccountId: accSbiId,
      description: 'Transfer: Capital replenishment for lending',
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_exp_1',
      type: 'expense',
      amount: 3200,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-02`,
      bankAccountId: accIciciId,
      category: 'Food',
      description: 'Fine dining anniversary dinner',
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_exp_2',
      type: 'expense',
      amount: 4500,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-03`,
      bankAccountId: accHdfcId,
      category: 'Gifts',
      description: 'Perfume and flowers',
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_prepay_1',
      type: 'personal_repayment',
      amount: 3000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04`,
      bankAccountId: accHdfcId,
      description: 'Repayment from Rahul Sharma - ₹3,000',
      relatedEntityId: pLoan1Id,
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_inc_2',
      type: 'income',
      amount: 25000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-04`,
      bankAccountId: accHdfcId,
      description: 'Freelancing - Full stack dashboard contract',
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_prepay_2',
      type: 'personal_repayment',
      amount: 2000,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      bankAccountId: accHdfcId,
      description: 'Repayment from Rahul Sharma - ₹2,000',
      relatedEntityId: pLoan1Id,
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_int_1',
      type: 'interest_collection',
      amount: 1500,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      bankAccountId: accSbiId,
      description: 'Interest collected - ₹1,500',
      relatedEntityId: loan1Id,
      createdAt: nowISO(),
    },
    {
      id: 'demo_tx_exp_6',
      type: 'expense',
      amount: 6200,
      date: `${currentYear}-${String(currentMonth).padStart(2, '0')}-06`,
      bankAccountId: accHdfcId,
      category: 'Shopping',
      description: 'Clothing and accessories',
      createdAt: nowISO(),
    },
  ];

  // Bulk put into Dexie
  await db.transaction('rw', [
    db.bankAccounts,
    db.businessLoans,
    db.monthlyInterestRecords,
    db.personalLoans,
    db.personalRepayments,
    db.expenses,
    db.incomes,
    db.bankTransfers,
    db.transactions,
  ], async () => {
    await db.bankAccounts.bulkPut(accounts);
    await db.businessLoans.bulkPut(businessLoans);
    await db.monthlyInterestRecords.bulkPut(monthlyRecords);
    await db.personalLoans.bulkPut(personalLoans);
    await db.personalRepayments.bulkPut(personalRepayments);
    await db.expenses.bulkPut(expenses);
    await db.incomes.bulkPut(incomes);
    await db.bankTransfers.bulkPut(transfers);
    await db.transactions.bulkPut(transactions);
  });

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEMO_FLAG_KEY, 'true');
  }
}

export async function removeDemoData(): Promise<void> {
  const demoIds = {
    accounts: ['demo_acc_hdfc', 'demo_acc_sbi', 'demo_acc_icici'],
    loans: ['demo_loan_1', 'demo_loan_2', 'demo_loan_3', 'demo_loan_4'],
    pLoans: ['demo_ploan_1', 'demo_ploan_2'],
  };

  await db.transaction('rw', [
    db.bankAccounts,
    db.businessLoans,
    db.monthlyInterestRecords,
    db.personalLoans,
    db.personalRepayments,
    db.expenses,
    db.incomes,
    db.bankTransfers,
    db.transactions,
  ], async () => {
    // Delete demo bank accounts
    for (const id of demoIds.accounts) {
      await db.bankAccounts.delete(id);
    }
    // Delete demo loans
    for (const id of demoIds.loans) {
      await db.businessLoans.delete(id);
      await db.monthlyInterestRecords.where('loanId').equals(id).delete();
    }
    // Delete demo personal loans
    for (const id of demoIds.pLoans) {
      await db.personalLoans.delete(id);
      await db.personalRepayments.where('personalLoanId').equals(id).delete();
    }
    // Delete expenses, incomes, transfers, and transactions that start with demo_
    await db.expenses.filter((e) => e.id.startsWith('demo_')).delete();
    await db.incomes.filter((i) => i.id.startsWith('demo_')).delete();
    await db.bankTransfers.filter((t) => t.id.startsWith('demo_')).delete();
    await db.transactions.filter((t) => t.id.startsWith('demo_')).delete();
  });

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DEMO_FLAG_KEY);
  }
}
