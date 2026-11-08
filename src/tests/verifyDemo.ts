// ============================================================
// Ledgerly - Demo Data Verification Test
// ============================================================

import 'fake-indexeddb/auto';
import { db, initializeSettings } from '../db';
import { loadDemoData, removeDemoData } from '../utils/demoData';

async function testDemoData() {
  console.log('🧪 Testing Demo Data Seeding & Cleanup...\n');

  await initializeSettings();

  // 1. Load demo data
  await loadDemoData();
  const accCount = await db.bankAccounts.count();
  const loanCount = await db.businessLoans.count();
  const pLoanCount = await db.personalLoans.count();
  const expCount = await db.expenses.count();
  const txCount = await db.transactions.count();

  console.log(`  Loaded counts: ${accCount} accounts, ${loanCount} loans, ${pLoanCount} personal loans, ${expCount} expenses, ${txCount} transactions`);

  if (accCount === 3 && loanCount === 4 && pLoanCount === 2 && expCount === 6) {
    console.log('  ✅ PASS: Demo data correctly seeded');
  } else {
    console.error('  ❌ FAIL: Demo data seeding counts mismatch');
    process.exit(1);
  }

  // 2. Remove demo data
  await removeDemoData();
  const accAfter = await db.bankAccounts.count();
  const loanAfter = await db.businessLoans.count();
  const pLoanAfter = await db.personalLoans.count();
  const expAfter = await db.expenses.count();

  console.log(`  Remaining counts after cleanup: ${accAfter} accounts, ${loanAfter} loans, ${pLoanAfter} personal loans, ${expAfter} expenses`);

  if (accAfter === 0 && loanAfter === 0 && pLoanAfter === 0 && expAfter === 0) {
    console.log('  ✅ PASS: Demo data completely and cleanly removed');
  } else {
    console.error('  ❌ FAIL: Demo data cleanup left orphaned records');
    process.exit(1);
  }

  console.log('\nAll Demo Data tests passed!\n');
}

testDemoData();
