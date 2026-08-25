const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Sale,
  SaleReturn,
  Purchase,
  PurchaseReturn,
  Contact,
  LedgerEntry,
  AccountHead,
} = require('../models');

const toNumber = (value) => Number(value || 0);

const buildDateWhere = (field, startDate, endDate) => {
  if (!startDate && !endDate) return {};

  const range = {};
  if (startDate) range[Op.gte] = startDate;
  if (endDate) range[Op.lte] = endDate;

  return { [field]: range };
};

const aggregateDocumentTotals = async (Model, branchId, dateField, startDate, endDate, { excludeCancelled = false } = {}) => {
  const where = { branchId };
  if (excludeCancelled) {
    where.status = { [Op.ne]: 'cancelled' };
  }
  Object.assign(where, buildDateWhere(dateField, startDate, endDate));

  const row = await Model.findOne({
    where,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'documentCount'],
      [sequelize.fn('SUM', sequelize.col('sub_total')), 'subTotal'],
      [sequelize.fn('SUM', sequelize.col('discount')), 'discount'],
      [sequelize.fn('SUM', sequelize.col('additional_expenses_total')), 'additionalExpensesTotal'],
      [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalAmount'],
      [sequelize.fn('SUM', sequelize.col('paid_amount')), 'paidAmount'],
      [sequelize.fn('SUM', sequelize.col('due_amount')), 'dueAmount'],
    ],
    raw: true,
  });

  return {
    documentCount: toNumber(row?.documentCount),
    subTotal: toNumber(row?.subTotal),
    discount: toNumber(row?.discount),
    additionalExpensesTotal: toNumber(row?.additionalExpensesTotal),
    totalAmount: toNumber(row?.totalAmount),
    paidAmount: toNumber(row?.paidAmount),
    dueAmount: toNumber(row?.dueAmount),
  };
};

const aggregateReturnTotals = async (Model, branchId, dateField, startDate, endDate) => {
  const where = { branchId, ...buildDateWhere(dateField, startDate, endDate) };

  const row = await Model.findOne({
    where,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'returnCount'],
      [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalAmount'],
    ],
    raw: true,
  });

  return {
    returnCount: toNumber(row?.returnCount),
    totalAmount: toNumber(row?.totalAmount),
  };
};

const getSalesSummary = async (branchId, startDate, endDate) => {
  const salesWhere = {
    branchId,
    status: { [Op.ne]: 'cancelled' },
    ...buildDateWhere('saleDate', startDate, endDate),
  };

  const [sales, returns, byCustomer] = await Promise.all([
    aggregateDocumentTotals(Sale, branchId, 'saleDate', startDate, endDate, { excludeCancelled: true }),
    aggregateReturnTotals(SaleReturn, branchId, 'returnDate', startDate, endDate),
    Sale.findAll({
      where: salesWhere,
      attributes: [
        'contactId',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'invoiceCount'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.col('paid_amount')), 'paidAmount'],
        [sequelize.fn('SUM', sequelize.col('due_amount')), 'dueAmount'],
      ],
      include: [{ model: Contact, as: 'contact', attributes: ['id', 'name'] }],
      group: ['contactId', 'contact.id', 'contact.name'],
      order: [[sequelize.literal('totalAmount'), 'DESC']],
      raw: true,
      nest: true,
    }),
  ]);

  const netTotalAmount = Number((sales.totalAmount - returns.totalAmount).toFixed(2));

  return {
    branchId,
    startDate: startDate || null,
    endDate: endDate || null,
    sales,
    returns,
    netTotalAmount,
    byCustomer: byCustomer.map((row) => ({
      contactId: row.contactId,
      contactName: row.contact?.name || 'Unknown',
      invoiceCount: toNumber(row.invoiceCount),
      totalAmount: toNumber(row.totalAmount),
      paidAmount: toNumber(row.paidAmount),
      dueAmount: toNumber(row.dueAmount),
    })),
  };
};

const getPurchaseSummary = async (branchId, startDate, endDate) => {
  const purchaseWhere = {
    branchId,
    status: { [Op.ne]: 'cancelled' },
    ...buildDateWhere('purchaseDate', startDate, endDate),
  };

  const [purchases, returns, bySupplier] = await Promise.all([
    aggregateDocumentTotals(Purchase, branchId, 'purchaseDate', startDate, endDate, { excludeCancelled: true }),
    aggregateReturnTotals(PurchaseReturn, branchId, 'returnDate', startDate, endDate),
    Purchase.findAll({
      where: purchaseWhere,
      attributes: [
        'contactId',
        [sequelize.fn('COUNT', sequelize.col('Purchase.id')), 'billCount'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.col('paid_amount')), 'paidAmount'],
        [sequelize.fn('SUM', sequelize.col('due_amount')), 'dueAmount'],
      ],
      include: [{ model: Contact, as: 'contact', attributes: ['id', 'name'] }],
      group: ['contactId', 'contact.id', 'contact.name'],
      order: [[sequelize.literal('totalAmount'), 'DESC']],
      raw: true,
      nest: true,
    }),
  ]);

  const netTotalAmount = Number((purchases.totalAmount - returns.totalAmount).toFixed(2));

  return {
    branchId,
    startDate: startDate || null,
    endDate: endDate || null,
    purchases,
    returns,
    netTotalAmount,
    bySupplier: bySupplier.map((row) => ({
      contactId: row.contactId,
      contactName: row.contact?.name || 'Unknown',
      billCount: toNumber(row.billCount),
      totalAmount: toNumber(row.totalAmount),
      paidAmount: toNumber(row.paidAmount),
      dueAmount: toNumber(row.dueAmount),
    })),
  };
};

const getProfitLoss = async (branchId, startDate, endDate) => {
  const dateFilter = {};
  if (startDate) dateFilter[Op.gte] = startDate;
  if (endDate) dateFilter[Op.lte] = endDate;

  const where = { branchId };
  if (startDate || endDate) {
    where.entryDate = dateFilter;
  }

  const rows = await LedgerEntry.findAll({
    where,
    attributes: [
      'accountHeadId',
      [sequelize.fn('SUM', sequelize.col('debit')), 'totalDebit'],
      [sequelize.fn('SUM', sequelize.col('credit')), 'totalCredit'],
    ],
    include: [
      {
        model: AccountHead,
        as: 'accountHead',
        attributes: ['id', 'name', 'code', 'type'],
        where: { type: { [Op.in]: ['income', 'expense'] } },
        required: true,
      },
    ],
    group: ['accountHeadId', 'accountHead.id', 'accountHead.name', 'accountHead.code', 'accountHead.type'],
    order: [[{ model: AccountHead, as: 'accountHead' }, 'type', 'ASC'], [{ model: AccountHead, as: 'accountHead' }, 'name', 'ASC']],
    raw: true,
    nest: true,
  });

  const income = [];
  const expense = [];
  let totalIncome = 0;
  let totalExpense = 0;

  rows.forEach((row) => {
    const debit = toNumber(row.totalDebit);
    const credit = toNumber(row.totalCredit);
    const type = row.accountHead?.type;
    const amount = type === 'income'
      ? Number((credit - debit).toFixed(2))
      : Number((debit - credit).toFixed(2));

    const entry = {
      accountHeadId: row.accountHeadId,
      name: row.accountHead?.name || 'Unknown',
      code: row.accountHead?.code || null,
      type,
      amount,
    };

    if (type === 'income') {
      income.push(entry);
      totalIncome += amount;
    } else if (type === 'expense') {
      expense.push(entry);
      totalExpense += amount;
    }
  });

  totalIncome = Number(totalIncome.toFixed(2));
  totalExpense = Number(totalExpense.toFixed(2));
  const netProfit = Number((totalIncome - totalExpense).toFixed(2));

  return {
    branchId,
    startDate: startDate || null,
    endDate: endDate || null,
    income,
    expense,
    totalIncome,
    totalExpense,
    netProfit,
  };
};

module.exports = {
  getSalesSummary,
  getPurchaseSummary,
  getProfitLoss,
};
