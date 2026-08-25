const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Expense,
  LedgerEntry,
  AccountHead,
  PaymentAccount,
  Branch,
  Contact,
} = require('../models');
const { ROLES } = require('../constants/roles');

const toNumber = (value) => Number(value || 0);

const resolveBranchId = (actor, branchIdInput) => {
  if (actor.role === ROLES.MAIN_ADMIN) {
    const branchId = Number(branchIdInput || actor.branchId);
    if (!branchId) throw new Error('branchId is required for main admin');
    return branchId;
  }

  if (!actor.branchId) throw new Error('User branch is not configured');
  return Number(actor.branchId);
};

const generateReceiptNo = () => `EXP-${Date.now()}`;

const getExpenseIncludes = () => [
  { model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] },
  { model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType', 'phone'] },
  { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code', 'type'] },
];

const getExpense = async ({ expenseId, actor }) => {
  const expense = await Expense.findByPk(Number(expenseId), {
    include: getExpenseIncludes(),
  });

  if (!expense) throw new Error('Expense not found');

  const branchId = resolveBranchId(actor, expense.branchId);
  if (Number(branchId) !== Number(expense.branchId)) {
    throw new Error('Not allowed to view this expense');
  }

  return expense;
};

const listExpenses = async ({ actor, filters = {} }) => {
  const branchId = resolveBranchId(actor, filters.branchId);
  const where = { branchId };

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) where.expenseDate[Op.gte] = filters.startDate;
    if (filters.endDate) where.expenseDate[Op.lte] = filters.endDate;
  }

  return Expense.findAll({
    where,
    include: getExpenseIncludes(),
    order: [['expenseDate', 'DESC'], ['id', 'DESC']],
  });
};

const createExpense = async ({ actor, payload }) => {
  const {
    branchId: branchIdInput,
    contactId,
    amount,
    expenseDate,
    accountHeadId,
    category,
    description,
    receiptNo,
    payments = [],
  } = payload;

  const branchId = resolveBranchId(actor, branchIdInput);
  const expenseAmount = toNumber(amount);

  if (!expenseDate) throw new Error('expenseDate is required');
  if (expenseAmount <= 0) throw new Error('amount must be greater than zero');

  return sequelize.transaction(async (transaction) => {
    const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' }, transaction });
    if (!cashHead) throw new Error('Required account head AST-001 is missing');

    let expenseHead;
    if (accountHeadId) {
      expenseHead = await AccountHead.findOne({
        where: { id: Number(accountHeadId), isActive: true },
        transaction,
      });
      if (!expenseHead) throw new Error('Expense account head not found');
    } else {
      expenseHead = await AccountHead.findOne({ where: { code: 'EXP-001' }, transaction });
      if (!expenseHead) throw new Error('Required account head EXP-001 is missing');
    }

    if (contactId) {
      const contact = await Contact.findOne({
        where: { id: Number(contactId), branchId, isActive: true },
        transaction,
      });
      if (!contact) throw new Error('Contact not found for selected branch');
    }

    const voucherNo = receiptNo?.trim() || generateReceiptNo();

    const duplicate = await Expense.findOne({
      where: { branchId, receiptNo: voucherNo },
      transaction,
    });
    if (duplicate) throw new Error('Receipt number already exists for this branch');

    const expense = await Expense.create(
      {
        branchId,
        contactId: contactId ? Number(contactId) : null,
        expenseDate,
        amount: expenseAmount,
        accountHeadId: expenseHead.id,
        category: category?.trim() || null,
        description: description?.trim() || null,
        receiptNo: voucherNo,
        status: 'posted',
        createdById: actor.id,
      },
      { transaction }
    );

    let resolvedSplits = payments.filter((p) => toNumber(p.amount) > 0);
    if (resolvedSplits.length === 0) {
      resolvedSplits = [{ paymentAccountId: null, accountHeadId: cashHead.id, amount: expenseAmount }];
    }

    const accountIds = resolvedSplits.map((p) => p.paymentAccountId).filter(Boolean);
    const accountRows = accountIds.length
      ? await PaymentAccount.findAll({ where: { id: accountIds }, transaction })
      : [];
    const accountMap = new Map(accountRows.map((a) => [a.id, a]));

    for (const split of resolvedSplits) {
      const acc = split.paymentAccountId ? accountMap.get(Number(split.paymentAccountId)) : null;
      const creditHeadId = acc?.accountHeadId || split.accountHeadId || cashHead.id;
      const splitAmount = toNumber(split.amount);
      const splitDescription = (description?.trim() || `Expense ${voucherNo}`) + (acc ? ` [${acc.name}]` : '');

      await LedgerEntry.bulkCreate(
        [
          {
            branchId,
            contactId: null,
            accountHeadId: expenseHead.id,
            entryDate: expenseDate,
            referenceType: 'expense',
            referenceId: expense.id,
            referenceNo: voucherNo,
            description: splitDescription,
            debit: splitAmount,
            credit: 0,
            createdById: actor.id,
          },
          {
            branchId,
            contactId: null,
            accountHeadId: creditHeadId,
            entryDate: expenseDate,
            referenceType: 'expense',
            referenceId: expense.id,
            referenceNo: voucherNo,
            description: splitDescription,
            debit: 0,
            credit: splitAmount,
            createdById: actor.id,
          },
        ],
        { transaction }
      );
    }

    return Expense.findByPk(expense.id, {
      include: getExpenseIncludes(),
      transaction,
    });
  });
};

const cancelExpense = async ({ expenseId, actor }) => {
  return sequelize.transaction(async (transaction) => {
    const expense = await Expense.findByPk(Number(expenseId), { transaction });
    if (!expense) throw new Error('Expense not found');

    const branchId = resolveBranchId(actor, expense.branchId);
    if (Number(branchId) !== Number(expense.branchId)) {
      throw new Error('Not allowed to cancel this expense');
    }

    if (expense.status === 'cancelled') {
      throw new Error('Expense is already cancelled');
    }

    await LedgerEntry.destroy({
      where: {
        branchId: expense.branchId,
        referenceType: 'expense',
        referenceId: expense.id,
      },
      transaction,
    });

    expense.status = 'cancelled';
    await expense.save({ transaction });

    return getExpense({ expenseId: expense.id, actor });
  });
};

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  cancelExpense,
};
