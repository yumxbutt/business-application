require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { bootstrapDatabase } = require('../config/bootstrap');
const {
  Branch,
  User,
  Contact,
  Sale,
  Purchase,
  SaleReturn,
  PurchaseReturn,
  PaymentTransaction,
  Expense,
  LedgerEntry,
} = require('../models');

const DEMO_TAG = '[DEMO_TXN_SEED]';

const ensureContact = async ({ branchId, name, phone, recordType, openingBalance = 0 }) => {
  const [contact] = await Contact.findOrCreate({
    where: { branchId, name },
    defaults: {
      branchId,
      name,
      phone,
      recordType,
      openingBalance,
      isActive: true,
    },
  });
  return contact;
};

const ensureSale = async ({ branchId, contactId, createdById, invoiceNo, saleDate, totalAmount, paidAmount }) => {
  const dueAmount = Number(totalAmount) - Number(paidAmount);

  const [sale] = await Sale.findOrCreate({
    where: { branchId, invoiceNo },
    defaults: {
      branchId,
      contactId,
      invoiceNo,
      saleDate,
      subTotal: totalAmount,
      discount: 0,
      totalAmount,
      paidAmount,
      dueAmount,
      status: 'posted',
      createdById,
    },
  });

  return sale;
};

const ensurePurchase = async ({ branchId, contactId, createdById, billNo, purchaseDate, totalAmount, paidAmount }) => {
  const dueAmount = Number(totalAmount) - Number(paidAmount);

  const [purchase] = await Purchase.findOrCreate({
    where: { branchId, billNo },
    defaults: {
      branchId,
      contactId,
      billNo,
      purchaseDate,
      subTotal: totalAmount,
      discount: 0,
      totalAmount,
      paidAmount,
      dueAmount,
      status: 'posted',
      createdById,
    },
  });

  return purchase;
};

const ensurePayment = async ({ branchId, contactId, createdById, transactionType, amount, entryDate, referenceNo, description }) => {
  const [payment] = await PaymentTransaction.findOrCreate({
    where: { branchId, referenceNo },
    defaults: {
      branchId,
      contactId,
      createdById,
      transactionType,
      amount,
      entryDate,
      referenceNo,
      paymentMethod: 'cash',
      description,
    },
  });

  return payment;
};

const ensureExpense = async ({ branchId, contactId, createdById, amount, expenseDate, accountHeadId, category, receiptNo, description }) => {
  const [expense] = await Expense.findOrCreate({
    where: { branchId, receiptNo },
    defaults: {
      branchId,
      contactId,
      createdById,
      amount,
      expenseDate,
      accountHeadId,
      category,
      receiptNo,
      description,
    },
  });

  return expense;
};

const ensureSaleReturn = async ({ branchId, contactId, createdById, saleIdReference, returnDate, totalAmount, reason }) => {
  const [record] = await SaleReturn.findOrCreate({
    where: { branchId, reason },
    defaults: {
      branchId,
      contactId,
      createdById,
      saleIdReference,
      returnDate,
      totalAmount,
      reason,
    },
  });

  return record;
};

const ensurePurchaseReturn = async ({ branchId, contactId, createdById, purchaseIdReference, returnDate, totalAmount, reason }) => {
  const [record] = await PurchaseReturn.findOrCreate({
    where: { branchId, reason },
    defaults: {
      branchId,
      contactId,
      createdById,
      purchaseIdReference,
      returnDate,
      totalAmount,
      reason,
    },
  });

  return record;
};

const ensureLedgerPair = async ({
  branchId,
  entryDate,
  referenceType,
  referenceId,
  referenceNo,
  description,
  debitAccountHeadId,
  debitContactId,
  creditAccountHeadId,
  creditContactId,
  amount,
  createdById,
}) => {
  const existing = await LedgerEntry.findOne({ where: { branchId, referenceType, referenceNo } });
  if (existing) return;

  await LedgerEntry.bulkCreate([
    {
      branchId,
      entryDate,
      referenceType,
      referenceId,
      referenceNo,
      description,
      accountHeadId: debitAccountHeadId,
      contactId: debitContactId || null,
      debit: amount,
      credit: 0,
      createdById,
    },
    {
      branchId,
      entryDate,
      referenceType,
      referenceId,
      referenceNo,
      description,
      accountHeadId: creditAccountHeadId,
      contactId: creditContactId || null,
      debit: 0,
      credit: amount,
      createdById,
    },
  ]);
};

const run = async () => {
  const connected = await connectDB();

  if (!connected) {
    console.error('Seed aborted: database connection failed.');
    process.exit(1);
  }

  await bootstrapDatabase();

  const branch = await Branch.findOne({ where: { code: 'BR-001' } });
  const actor = await User.findOne({ where: { username: 'branch1admin' } });

  if (!branch || !actor) {
    throw new Error('Required seed dependencies (branch/admin) not found.');
  }

  const customer = await ensureContact({
    branchId: branch.id,
    name: 'Demo Customer Mart',
    phone: '+92-300-8881001',
    recordType: 'customer',
  });

  const supplier = await ensureContact({
    branchId: branch.id,
    name: 'Demo Supplier Hub',
    phone: '+92-300-8882002',
    recordType: 'supplier',
  });

  const both = await ensureContact({
    branchId: branch.id,
    name: 'Demo Trading Co',
    phone: '+92-300-8883003',
    recordType: 'both',
  });

  const saleOne = await ensureSale({
    branchId: branch.id,
    contactId: customer.id,
    createdById: actor.id,
    invoiceNo: 'DEMO-S-1001',
    saleDate: '2026-03-20',
    totalAmount: 12000,
    paidAmount: 3000,
  });

  const saleTwo = await ensureSale({
    branchId: branch.id,
    contactId: both.id,
    createdById: actor.id,
    invoiceNo: 'DEMO-S-1002',
    saleDate: '2026-03-24',
    totalAmount: 6500,
    paidAmount: 1000,
  });

  const purchaseOne = await ensurePurchase({
    branchId: branch.id,
    contactId: supplier.id,
    createdById: actor.id,
    billNo: 'DEMO-P-2001',
    purchaseDate: '2026-03-18',
    totalAmount: 9000,
    paidAmount: 2000,
  });

  const purchaseTwo = await ensurePurchase({
    branchId: branch.id,
    contactId: both.id,
    createdById: actor.id,
    billNo: 'DEMO-P-2002',
    purchaseDate: '2026-03-26',
    totalAmount: 4800,
    paidAmount: 800,
  });

  const saleReturn = await ensureSaleReturn({
    branchId: branch.id,
    contactId: customer.id,
    createdById: actor.id,
    saleIdReference: saleOne.id,
    returnDate: '2026-03-27',
    totalAmount: 1500,
    reason: `${DEMO_TAG} Sale return against DEMO-S-1001`,
  });

  const purchaseReturn = await ensurePurchaseReturn({
    branchId: branch.id,
    contactId: supplier.id,
    createdById: actor.id,
    purchaseIdReference: purchaseOne.id,
    returnDate: '2026-03-28',
    totalAmount: 900,
    reason: `${DEMO_TAG} Purchase return against DEMO-P-2001`,
  });

  const receipt = await ensurePayment({
    branchId: branch.id,
    contactId: customer.id,
    createdById: actor.id,
    transactionType: 'receipt',
    amount: 2500,
    entryDate: '2026-03-29',
    referenceNo: 'DEMO-RCP-3001',
    description: `${DEMO_TAG} Receipt from Demo Customer Mart`,
  });

  const payment = await ensurePayment({
    branchId: branch.id,
    contactId: supplier.id,
    createdById: actor.id,
    transactionType: 'payment',
    amount: 1700,
    entryDate: '2026-03-30',
    referenceNo: 'DEMO-PMT-3002',
    description: `${DEMO_TAG} Payment to Demo Supplier Hub`,
  });

  const expense = await ensureExpense({
    branchId: branch.id,
    contactId: null,
    createdById: actor.id,
    amount: 2200,
    expenseDate: '2026-03-31',
    accountHeadId: 3,
    category: 'Utility',
    receiptNo: 'DEMO-EXP-4001',
    description: `${DEMO_TAG} Utility expense paid in cash`,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: saleOne.saleDate,
    referenceType: 'sale',
    referenceId: saleOne.id,
    referenceNo: saleOne.invoiceNo,
    description: `${DEMO_TAG} Sale posted`,
    debitAccountHeadId: 1,
    debitContactId: customer.id,
    creditAccountHeadId: 2,
    creditContactId: null,
    amount: 12000,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: saleTwo.saleDate,
    referenceType: 'sale',
    referenceId: saleTwo.id,
    referenceNo: saleTwo.invoiceNo,
    description: `${DEMO_TAG} Sale posted`,
    debitAccountHeadId: 1,
    debitContactId: both.id,
    creditAccountHeadId: 2,
    creditContactId: null,
    amount: 6500,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: purchaseOne.purchaseDate,
    referenceType: 'purchase',
    referenceId: purchaseOne.id,
    referenceNo: purchaseOne.billNo,
    description: `${DEMO_TAG} Purchase posted`,
    debitAccountHeadId: 3,
    debitContactId: null,
    creditAccountHeadId: 4,
    creditContactId: supplier.id,
    amount: 9000,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: purchaseTwo.purchaseDate,
    referenceType: 'purchase',
    referenceId: purchaseTwo.id,
    referenceNo: purchaseTwo.billNo,
    description: `${DEMO_TAG} Purchase posted`,
    debitAccountHeadId: 3,
    debitContactId: null,
    creditAccountHeadId: 4,
    creditContactId: both.id,
    amount: 4800,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: saleReturn.returnDate,
    referenceType: 'sale_return',
    referenceId: saleReturn.id,
    referenceNo: 'DEMO-SR-5001',
    description: `${DEMO_TAG} Sale return posted`,
    debitAccountHeadId: 2,
    debitContactId: null,
    creditAccountHeadId: 1,
    creditContactId: customer.id,
    amount: 1500,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: purchaseReturn.returnDate,
    referenceType: 'purchase_return',
    referenceId: purchaseReturn.id,
    referenceNo: 'DEMO-PR-5002',
    description: `${DEMO_TAG} Purchase return posted`,
    debitAccountHeadId: 4,
    debitContactId: supplier.id,
    creditAccountHeadId: 3,
    creditContactId: null,
    amount: 900,
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: receipt.entryDate,
    referenceType: 'payment_received',
    referenceId: receipt.id,
    referenceNo: receipt.referenceNo,
    description: receipt.description,
    debitAccountHeadId: 5,
    debitContactId: null,
    creditAccountHeadId: 1,
    creditContactId: customer.id,
    amount: Number(receipt.amount),
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: payment.entryDate,
    referenceType: 'payment_made',
    referenceId: payment.id,
    referenceNo: payment.referenceNo,
    description: payment.description,
    debitAccountHeadId: 4,
    debitContactId: supplier.id,
    creditAccountHeadId: 5,
    creditContactId: null,
    amount: Number(payment.amount),
    createdById: actor.id,
  });

  await ensureLedgerPair({
    branchId: branch.id,
    entryDate: expense.expenseDate,
    referenceType: 'expense',
    referenceId: expense.id,
    referenceNo: expense.receiptNo,
    description: expense.description,
    debitAccountHeadId: 3,
    debitContactId: null,
    creditAccountHeadId: 5,
    creditContactId: null,
    amount: Number(expense.amount),
    createdById: actor.id,
  });

  const receivablesRows = await LedgerEntry.sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM ledger_entries
      WHERE branch_id = $1
        AND account_head_id = 1
        AND contact_id IS NOT NULL
    `,
    { bind: [branch.id], type: 'SELECT' }
  );

  const payablesRows = await LedgerEntry.sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM ledger_entries
      WHERE branch_id = $1
        AND account_head_id = 4
        AND contact_id IS NOT NULL
    `,
    { bind: [branch.id], type: 'SELECT' }
  );

  console.log('Transaction test data seeded successfully.');
  console.log(`A/R contact ledger rows: ${receivablesRows[0].count}`);
  console.log(`A/P contact ledger rows: ${payablesRows[0].count}`);

  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Transaction seed failed:', error);
  try {
    await sequelize.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
