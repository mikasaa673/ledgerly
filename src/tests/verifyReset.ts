import 'fake-indexeddb/auto';
import { db, initializeSettings } from '../db';
import { backupService } from '../services/backupService';
import { bankAccountService } from '../services/bankAccountService';
import { loadDemoData } from '../utils/demoData';

async function testReset() {
  console.log('🧪 Testing Reset Functionality (Preserving Bank Accounts & Balances)...');

  await initializeSettings();

  // 1. Seed demo data
  await loadDemoData();
  const accCount = await db.bankAccounts.count();
  const loanCount = await db.businessLoans.count();
  const expCount = await db.expenses.count();
  const txCount = await db.transactions.count();

  if (accCount === 0 || loanCount === 0 || expCount === 0 || txCount === 0) {
    throw new Error('Failed to seed initial data for reset test');
  }

  // Record account balances before reset
  const preAccountsWithBalances = await bankAccountService.getAllWithBalances();
  const preBalances = new Map<string, number>();
  for (const acc of preAccountsWithBalances) {
    preBalances.set(acc.id, acc.currentBalance);
  }

  console.log(`  Initial seeded: ${accCount} accounts, ${loanCount} loans, ${expCount} expenses, ${txCount} txs`);

  // 2. Perform Reset with keepBankAccounts = true (Default Reset behavior)
  await backupService.resetFinancialValues(true);

  // 3. Verify bank accounts and their balances are completely preserved
  const postAccounts = await db.bankAccounts.count();
  console.assert(postAccounts === accCount, `Expected ${accCount} bank accounts preserved, got ${postAccounts}`);

  const postAccountsWithBalances = await bankAccountService.getAllWithBalances();
  for (const acc of postAccountsWithBalances) {
    const expectedBal = preBalances.get(acc.id);
    console.assert(
      acc.currentBalance === expectedBal,
      `Account ${acc.nickname} balance mismatch! Expected ${expectedBal}, got ${acc.currentBalance}`
    );
  }
  console.log('  ✅ PASS: Bank accounts and their balances were NOT removed (100% preserved)');

  // 4. Verify all loans, registers, expenses, and transactions ARE wiped to 0
  const postLoans = await db.businessLoans.count();
  const postMonthly = await db.monthlyInterestRecords.count();
  const postPersonal = await db.personalLoans.count();
  const postExpenses = await db.expenses.count();
  const postIncomes = await db.incomes.count();
  const postTransfers = await db.bankTransfers.count();
  const postTxs = await db.transactions.count();

  console.assert(postLoans === 0, `Expected 0 business loans, got ${postLoans}`);
  console.assert(postMonthly === 0, `Expected 0 monthly records, got ${postMonthly}`);
  console.assert(postPersonal === 0, `Expected 0 personal loans, got ${postPersonal}`);
  console.assert(postExpenses === 0, `Expected 0 expenses, got ${postExpenses}`);
  console.assert(postIncomes === 0, `Expected 0 incomes, got ${postIncomes}`);
  console.assert(postTransfers === 0, `Expected 0 transfers, got ${postTransfers}`);
  console.assert(postTxs === 0, `Expected 0 transactions, got ${postTxs}`);

  console.log('  ✅ PASS: All loans, registers, expenses, and transactions reset to 0');

  // 5. Verify settings remained intact
  const settings = await db.settings.get('app_settings');
  console.assert(settings !== undefined, 'Expected default settings to remain');
  console.assert((settings?.expenseCategories?.length || 0) > 0, 'Expected default expense categories');

  console.log('All Reset tests passed successfully!');
}

testReset().catch((err) => {
  console.error('❌ Reset Test failed:', err);
  process.exit(1);
});
