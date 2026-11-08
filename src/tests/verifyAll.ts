// ============================================================
// Ledgerly - Automated Verification & Test Suite
// ============================================================

import 'fake-indexeddb/auto';
import { db, initializeSettings } from '../db';
import {
  bankAccountService,
  businessLendingService,
  personalLendingService,
  expenseService,
  incomeService,
  bankTransferService,
  transactionService,
  backupService,
} from '../services';
import { formatDate, computeNextMonthDate } from '../utils';

async function runTests() {
  console.log('🧪 Starting Ledgerly Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 0. Initialize DB & Settings
    await initializeSettings();
    const settings = await db.settings.get('app_settings');
    assert(!!settings && settings.expenseCategories.length > 0, 'Settings initialized with default categories');

    // ── Test 1: Bank Accounts & Opening Balances ──
    console.log('\n--- 1. Testing Bank Accounts ---');
    const hdfc = await bankAccountService.create({
      bankName: 'HDFC Bank',
      nickname: 'Main Salary',
      openingBalance: 50000,
      lastFourDigits: '1111',
    });
    const sbi = await bankAccountService.create({
      bankName: 'State Bank of India',
      nickname: 'Lending Capital',
      openingBalance: 100000,
      lastFourDigits: '2222',
    });

    let hdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    let sbiBal = await bankAccountService.calculateBalance(sbi.id);
    assert(hdfcBal === 50000, `HDFC initial balance is ₹50,000 (actual: ${hdfcBal})`);
    assert(sbiBal === 100000, `SBI initial balance is ₹100,000 (actual: ${sbiBal})`);

    // ── Test 2: Business Lending & Principal Deduction ──
    console.log('\n--- 2. Testing Business Lending ---');
    const loan = await businessLendingService.createLoan({
      principal: 20000,
      dateLent: '2026-10-01',
      monthlyInterest: 2000,
      firstDueDate: '2026-11-01',
      bankAccountId: sbi.id,
      notes: 'Test loan for manufacturing',
    });

    sbiBal = await bankAccountService.calculateBalance(sbi.id);
    assert(sbiBal === 80000, `SBI balance after lending ₹20k is ₹80,000 (actual: ${sbiBal})`);
    assert(loan.principalRemaining === 20000, 'Loan principal remaining initialized to ₹20,000');

    // Check transaction created
    const txs = await db.transactions.where('relatedEntityId').equals(loan.id).toArray();
    assert(txs.length === 1 && txs[0].type === 'business_principal_lent' && txs[0].amount === 20000, 'Principal lent recorded as transaction');

    // Test creating a business loan without bank account (notebook style - no bank deduction)
    const notebookLoan = await businessLendingService.createLoan({
      principal: 15000,
      dateLent: '2026-10-06',
      monthlyInterest: 1500,
      firstDueDate: '2026-11-06',
      notes: 'Notebook loan without bank deduction',
    });
    const sbiBalAfterNotebook = await bankAccountService.calculateBalance(sbi.id);
    assert(sbiBalAfterNotebook === 80000, 'SBI balance unchanged when creating loan without bank account');
    const notebookTxs = await db.transactions.where('relatedEntityId').equals(notebookLoan.id).toArray();
    assert(notebookTxs.length === 0, 'No bank transaction created when bankAccountId is omitted');

    // Test editing entered record
    const notebookRec = (await businessLendingService.getMonthlyRecords(11, 2026)).find(r => r.loanId === notebookLoan.id);
    await businessLendingService.updateLoanAndRecord(notebookLoan.id, notebookRec?.id, {
      principal: 18000,
      monthlyInterest: 1800,
      notes: 'Updated notebook remarks',
    });
    const editedLoan = await businessLendingService.getLoanById(notebookLoan.id);
    assert(editedLoan?.principal === 18000, 'Edited loan principal updated to ₹18,000');
    assert(editedLoan?.monthlyInterest === 1800, 'Edited monthly interest updated to ₹1,800');
    assert(editedLoan?.notes === 'Updated notebook remarks', 'Edited loan notes updated successfully');

    await businessLendingService.deleteLoan(notebookLoan.id);
    await db.businessLoans.delete(notebookLoan.id);

    // Test formatDate to dd-mm-yyyy and computeNextMonthDate
    assert(formatDate('2026-11-06') === '06-11-2026', 'Date formatted as dd-mm-yyyy (06-11-2026)');
    assert(computeNextMonthDate('2026-11-06') === '2026-12-06', 'Automatic next month date picker picks same day next month (2026-12-06)');

    // Test loan lent yesterday has first due date in next month (December) with coming_soon status
    const yesterdayLoan = await businessLendingService.createLoan({
      principal: 25000,
      dateLent: '2026-11-06',
      monthlyInterest: 2500,
      firstDueDate: '2026-12-06',
      notes: 'Lent yesterday',
    });
    // In November, loan has 0 expected interest (interest is not due until December)
    const novRecsForYesterday = (await businessLendingService.getMonthlyRecords(11, 2026)).filter(r => r.loanId === yesterdayLoan.id);
    assert(novRecsForYesterday.length === 0 || novRecsForYesterday[0]?.expectedInterest === 0, 'Loan lent yesterday has NO interest due in November');

    // In December, first due date arrives with coming_soon status
    const yesterdayDecRec = (await businessLendingService.getMonthlyRecords(12, 2026)).find(r => r.loanId === yesterdayLoan.id);
    assert(yesterdayDecRec?.status === 'coming_soon', 'Loan lent yesterday has coming_soon status in December');
    assert(yesterdayDecRec?.dueDate === '2026-12-06', 'Loan lent yesterday has first due date 2026-12-06');
    await businessLendingService.deleteLoan(yesterdayLoan.id);

    // Test 0% EMI loan (No interest)
    const emiLoan = await businessLendingService.createLoan({
      principal: 30000,
      dateLent: '2026-11-07',
      monthlyInterest: 0,
      firstDueDate: '2026-12-07',
      notes: '0% EMI loan',
    });
    const emiRec = (await businessLendingService.getMonthlyRecords(12, 2026)).find(r => r.loanId === emiLoan.id);
    assert(emiRec?.expectedInterest === 0, '0% EMI loan has 0 expected interest');
    assert(emiRec?.status === 'coming_soon', '0% EMI loan status is coming_soon before due date');
    await businessLendingService.deleteLoan(emiLoan.id);

    // Test that editing interest updates across all uncollected months (including next month)
    const multiMonthLoan = await businessLendingService.createLoan({
      principal: 50000,
      dateLent: '2026-10-01',
      monthlyInterest: 5000,
      firstDueDate: '2026-11-01',
      notes: 'Testing multi-month interest edit',
    });
    // Carry forward to Dec
    await businessLendingService.carryForwardLoans(12, 2026);
    const novRecM = (await businessLendingService.getMonthlyRecords(11, 2026)).find(r => r.loanId === multiMonthLoan.id);
    const decRecM = (await businessLendingService.getMonthlyRecords(12, 2026)).find(r => r.loanId === multiMonthLoan.id);
    assert(novRecM?.expectedInterest === 5000, 'Initial Nov interest is ₹5,000');
    assert(decRecM?.expectedInterest === 5000, 'Initial Dec interest is ₹5,000');

    // Edit to 500
    await businessLendingService.updateLoanAndRecord(multiMonthLoan.id, novRecM?.id, {
      monthlyInterest: 500,
    });
    const updatedNovRecM = await db.monthlyInterestRecords.get(novRecM!.id);
    const updatedDecRecM = await db.monthlyInterestRecords.get(decRecM!.id);
    assert(updatedNovRecM?.expectedInterest === 500, 'Nov record updated to ₹500 interest');
    assert(updatedDecRecM?.expectedInterest === 500, 'Next month (Dec) record automatically updated to ₹500 interest');

    // Test deleteLoan removes all uncollected records and hard deletes loan when uncollected
    await businessLendingService.deleteLoan(multiMonthLoan.id);
    const deletedLoanCheck = await businessLendingService.getLoanById(multiMonthLoan.id);
    const deletedRecsCheck = (await db.monthlyInterestRecords.toArray()).filter(r => r.loanId === multiMonthLoan.id);
    assert(!deletedLoanCheck, 'Uncollected loan is hard deleted completely');
    assert(deletedRecsCheck.length === 0, 'All monthly interest records for deleted loan removed');

    // Check first monthly record generated
    const recs = await businessLendingService.getMonthlyRecords(11, 2026);
    assert(recs.length === 1 && recs[0].expectedInterest === 2000, 'First monthly interest record auto-generated for November');

    // ── Test 3: Monthly Carry-Forward Engine ──
    console.log('\n--- 3. Testing Monthly Carry-Forward ---');
    // Carry forward to December 2026
    await businessLendingService.carryForwardLoans(12, 2026);
    const decRecs = await businessLendingService.getMonthlyRecords(12, 2026);
    assert(decRecs.length === 1 && decRecs[0].expectedInterest === 2000, 'December interest record auto-carried forward with same interest');
    assert(decRecs[0].principal === 20000, 'December record preserves current principal snapshot');

    // ── Test 4: Partial & Full Interest Collection ──
    console.log('\n--- 4. Testing Interest Collection ---');
    const novRec = recs[0];
    // Partial collection: collect 1,200 of 2,000
    await businessLendingService.collectInterest(novRec.id, {
      amount: 1200,
      bankAccountId: sbi.id,
      collectionDate: '2026-11-02',
    });

    const updatedNovRec = await db.monthlyInterestRecords.get(novRec.id);
    assert(updatedNovRec?.status === 'partial', 'Record status is partial after collecting ₹1,200/₹2,000');
    assert(updatedNovRec?.pendingAmount === 800, 'Pending amount is ₹800');

    sbiBal = await bankAccountService.calculateBalance(sbi.id);
    assert(sbiBal === 81200, `SBI balance increased by ₹1,200 interest to ₹81,200 (actual: ${sbiBal})`);

    // Collect remaining 800
    await businessLendingService.collectInterest(novRec.id, {
      amount: 800,
      bankAccountId: sbi.id,
      collectionDate: '2026-11-05',
    });
    const completedNovRec = await db.monthlyInterestRecords.get(novRec.id);
    assert(completedNovRec?.status === 'collected', 'Record status is collected after full payment');
    assert(completedNovRec?.pendingAmount === 0, 'Pending amount is ₹0');

    sbiBal = await bankAccountService.calculateBalance(sbi.id);
    assert(sbiBal === 82000, `SBI balance is now ₹82,000 after full interest collection (actual: ${sbiBal})`);

    // ── Test 5: Principal Repayment (Capital return, NOT profit) ──
    console.log('\n--- 5. Testing Principal Repayment ---');
    await businessLendingService.recordPrincipalRepayment({
      loanId: loan.id,
      amount: 5000,
      bankAccountId: sbi.id,
      date: '2026-11-10',
      notes: 'Partial principal returned',
    });

    const updatedLoan = await businessLendingService.getLoanById(loan.id);
    assert(updatedLoan?.principalRemaining === 15000, `Remaining principal updated to ₹15,000 (actual: ${updatedLoan?.principalRemaining})`);
    assert(updatedLoan?.status === 'active', 'Loan remains active');

    sbiBal = await bankAccountService.calculateBalance(sbi.id);
    assert(sbiBal === 87000, `SBI balance increased by ₹5,000 principal to ₹87,000 (actual: ${sbiBal})`);

    // Verify it is NOT counted in realized income
    const novIncomes = await incomeService.getByMonth(11, 2026);
    const totalNovIncome = novIncomes.reduce((sum, i) => sum + i.amount, 0);
    assert(totalNovIncome === 2000, `Total realized income for Nov is only the ₹2,000 interest, NOT the ₹5,000 principal repayment (actual: ${totalNovIncome})`);

    // ── Test 6: Personal Lending (Interest-free) ──
    console.log('\n--- 6. Testing Personal Lending ---');
    // Lend 10,000 to Rahul from HDFC
    const pLoan = await personalLendingService.create({
      personName: 'Rahul',
      amountLent: 10000,
      dateLent: '2026-11-01',
      bankAccountId: hdfc.id,
      notes: 'Emergency help',
    });

    hdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    assert(hdfcBal === 40000, `HDFC balance decreased to ₹40,000 after lending ₹10,000 (actual: ${hdfcBal})`);

    // Rahul returns 3,000
    await personalLendingService.recordRepayment({
      personalLoanId: pLoan.id,
      amount: 3000,
      bankAccountId: hdfc.id,
      date: '2026-11-05',
    });

    // Rahul returns 2,000
    await personalLendingService.recordRepayment({
      personalLoanId: pLoan.id,
      amount: 2000,
      bankAccountId: hdfc.id,
      date: '2026-11-06',
    });

    const updatedPLoan = await personalLendingService.getById(pLoan.id);
    assert(updatedPLoan?.amountReturned === 5000, 'Total returned is ₹5,000');
    assert(updatedPLoan?.outstandingBalance === 5000, 'Outstanding balance is ₹5,000');

    // Test editing personal loan record
    await personalLendingService.update(pLoan.id, {
      personName: 'Rahul Verma',
      notes: 'Updated personal loan remarks',
    });
    const editedPLoan = await personalLendingService.getById(pLoan.id);
    assert(editedPLoan?.personName === 'Rahul Verma', 'Personal loan personName updated to Rahul Verma');
    assert(editedPLoan?.notes === 'Updated personal loan remarks', 'Personal loan remarks updated');

    hdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    assert(hdfcBal === 45000, `HDFC balance increased back to ₹45,000 after ₹5,000 repayment (actual: ${hdfcBal})`);

    // ── Test 7: Expenses & Sarayu Spending ──
    console.log('\n--- 7. Testing Expenses ---');
    const exp1 = await expenseService.create({
      amount: 3500,
      bankAccountId: hdfc.id,
      category: 'Food',
      spentFor: 'Sarayu',
      date: '2026-11-03',
      description: 'Dinner date',
    });

    const exp2 = await expenseService.create({
      amount: 1500,
      bankAccountId: hdfc.id,
      category: 'Fuel',
      spentFor: 'Me',
      date: '2026-11-04',
      description: 'Petrol',
    });

    hdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    assert(hdfcBal === 40000, `HDFC balance decreased by ₹5,000 expenses to ₹40,000 (actual: ${hdfcBal})`);

    const sarayuSpend = await expenseService.getSarayuSpending(11, 2026);
    assert(sarayuSpend === 3500, `Sarayu spending correctly calculated as ₹3,500 (actual: ${sarayuSpend})`);

    // ── Test 8: Internal Bank Transfer ──
    console.log('\n--- 8. Testing Internal Transfers ---');
    // Transfer 10,000 from SBI to HDFC
    await bankTransferService.create({
      fromAccountId: sbi.id,
      toAccountId: hdfc.id,
      amount: 10000,
      date: '2026-11-05',
      notes: 'Internal fund movement',
    });

    sbiBal = await bankAccountService.calculateBalance(sbi.id);
    hdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    assert(sbiBal === 77000, `SBI balance decreased by ₹10,000 to ₹77,000 (actual: ${sbiBal})`);
    assert(hdfcBal === 50000, `HDFC balance increased by ₹10,000 to ₹50,000 (actual: ${hdfcBal})`);

    // Ensure transfer didn't register as expense or income
    const novTotalExp = await expenseService.getTotalForMonth(11, 2026);
    assert(novTotalExp === 5000, `Total November expenses remain ₹5,000 (transfer is NOT expense, actual: ${novTotalExp})`);

    // ── Test 9: Complete Backup & Restore ──
    console.log('\n--- 9. Testing Backup Export & Restore ---');
    const backup = await backupService.exportAll();
    assert(backup.version === '1.0.0', 'Backup export contains version 1.0.0');
    assert(backup.bankAccounts.length === 2, `Backup has 2 bank accounts (actual: ${backup.bankAccounts.length})`);
    assert(backup.businessLoans.length === 1, 'Backup has 1 business loan');
    assert(backup.transactions.length > 0, `Backup has ${backup.transactions.length} transactions`);

    // Wipe and restore
    await backupService.clearAllData();
    const countAfterWipe = await db.bankAccounts.count();
    assert(countAfterWipe === 0, 'Database completely cleared');

    const restoreRes = await backupService.importAll(backup);
    assert(restoreRes.success, 'Backup restored successfully');

    const countAfterRestore = await db.bankAccounts.count();
    assert(countAfterRestore === 2, `Restored 2 bank accounts (actual: ${countAfterRestore})`);

    const restoredHdfcBal = await bankAccountService.calculateBalance(hdfc.id);
    assert(restoredHdfcBal === 50000, `Restored HDFC balance reconciles exactly to ₹50,000 (actual: ${restoredHdfcBal})`);

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled test failure:', error);
    process.exit(1);
  }
}

runTests();
