const { Op } = require('sequelize');
const { PaymentAccount, AccountHead, Branch, PaymentTransactionSplit, PaymentTransaction, Contact } = require('../models');

const toNumber = (v) => Number(v || 0);

const parseBranchFilter = (actor, branchIdInput) => {
  if (actor.role === 'main_admin') {
    return branchIdInput ? Number(branchIdInput) : null; // null = show all
  }
  return Number(actor.branchId);
};

/**
 * Returns all active payment accounts visible to a branch:
 *  – accounts with matching branchId
 *  – accounts with branchId = NULL (global, visible to all)
 */
const getAccountsForBranch = async ({ actor, branchIdInput }) => {
  const branchId = actor.role === 'main_admin'
    ? (branchIdInput ? Number(branchIdInput) : null)
    : Number(actor.branchId);

  const where = {
    isActive: 1,
    [Op.or]: [{ branchId: null }],
  };
  if (branchId) {
    where[Op.or].push({ branchId });
  }

  const rows = await PaymentAccount.findAll({
    where,
    include: [
      { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code', 'type'] },
    ],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });

  return rows;
};

const listAccounts = async ({ actor, filters = {} }) => {
  const branchId = parseBranchFilter(actor, filters.branchId);

  const where = {};
  if (branchId) where.branchId = branchId;
  if (filters.accountType) where.accountType = filters.accountType;
  if (filters.isActive !== undefined && filters.isActive !== '') {
    where.isActive = filters.isActive === 'false' || filters.isActive === false ? 0 : 1;
  }

  const rows = await PaymentAccount.findAll({
    where,
    include: [
      { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code', 'type'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] },
    ],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });

  return rows;
};

const createAccount = async ({ actor, payload }) => {
  const {
    branchId: branchIdInput,
    accountType,
    name,
    bankName,
    accountNumber,
    bankBranchName,
    openingBalance = 0,
    openingDate,
    isActive = 1,
    sortOrder = 0,
  } = payload;

  if (!name?.trim()) throw new Error('Account name is required');
  if (!['cash', 'bank'].includes(accountType)) throw new Error('accountType must be cash or bank');

  // Resolve branchId — main_admin may pass null for global
  const branchId = actor.role === 'main_admin'
    ? (branchIdInput ? Number(branchIdInput) : null)
    : Number(actor.branchId);

  // Auto-assign account head based on type
  const headCode = accountType === 'cash' ? 'AST-001' : 'AST-002';
  const accountHead = await AccountHead.findOne({ where: { code: headCode } });
  if (!accountHead) throw new Error(`Account head ${headCode} not found`);

  const account = await PaymentAccount.create({
    branchId,
    accountType,
    accountHeadId: accountHead.id,
    name: name.trim(),
    bankName: bankName?.trim() || null,
    accountNumber: accountNumber?.trim() || null,
    bankBranchName: bankBranchName?.trim() || null,
    openingBalance: toNumber(openingBalance),
    openingDate: openingDate || null,
    isActive: isActive ? 1 : 0,
    sortOrder: toNumber(sortOrder),
  });

  return account;
};

const updateAccount = async ({ actor, accountId, payload }) => {
  const account = await PaymentAccount.findByPk(accountId);
  if (!account) throw new Error('Payment account not found');

  // Non-admin can only update their branch accounts
  if (actor.role !== 'main_admin' && account.branchId !== Number(actor.branchId)) {
    throw new Error('Not authorised to update this account');
  }

  const {
    name,
    bankName,
    accountNumber,
    bankBranchName,
    openingBalance,
    openingDate,
    sortOrder,
    accountType,
  } = payload;

  if (name !== undefined) account.name = name.trim();
  if (bankName !== undefined) account.bankName = bankName?.trim() || null;
  if (accountNumber !== undefined) account.accountNumber = accountNumber?.trim() || null;
  if (bankBranchName !== undefined) account.bankBranchName = bankBranchName?.trim() || null;
  if (openingBalance !== undefined) account.openingBalance = toNumber(openingBalance);
  if (openingDate !== undefined) account.openingDate = openingDate || null;
  if (sortOrder !== undefined) account.sortOrder = toNumber(sortOrder);

  // If accountType changed, update accountHeadId too
  if (accountType !== undefined && accountType !== account.accountType) {
    if (!['cash', 'bank'].includes(accountType)) throw new Error('accountType must be cash or bank');
    const headCode = accountType === 'cash' ? 'AST-001' : 'AST-002';
    const accountHead = await AccountHead.findOne({ where: { code: headCode } });
    if (!accountHead) throw new Error(`Account head ${headCode} not found`);
    account.accountType = accountType;
    account.accountHeadId = accountHead.id;
  }

  await account.save();
  return account;
};

const toggleAccount = async ({ actor, accountId }) => {
  const account = await PaymentAccount.findByPk(accountId);
  if (!account) throw new Error('Payment account not found');

  if (actor.role !== 'main_admin' && account.branchId !== Number(actor.branchId)) {
    throw new Error('Not authorised to update this account');
  }

  account.isActive = account.isActive ? 0 : 1;
  await account.save();
  return account;
};

const getAccountStatement = async ({ actor, accountId, startDate, endDate }) => {
  const account = await PaymentAccount.findByPk(accountId, {
    include: [
      { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] },
    ],
  });
  if (!account) throw new Error('Payment account not found');

  // Access check: non-main_admin can only view their branch accounts (or global ones)
  if (actor.role !== 'main_admin') {
    if (account.branchId && Number(account.branchId) !== Number(actor.branchId)) {
      throw new Error('Not authorised to view this account statement');
    }
  }

  // Build where clause for splits within date range
  const txnWhere = {};
  if (startDate || endDate) {
    txnWhere.entryDate = {};
    if (startDate) txnWhere.entryDate[Op.gte] = startDate;
    if (endDate) txnWhere.entryDate[Op.lte] = endDate;
  }

  const splits = await PaymentTransactionSplit.findAll({
    where: { paymentAccountId: accountId },
    include: [
      {
        model: PaymentTransaction,
        as: 'paymentTransaction',
        where: txnWhere,
        include: [
          { model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType'] },
        ],
      },
    ],
    order: [
      [{ model: PaymentTransaction, as: 'paymentTransaction' }, 'entryDate', 'ASC'],
      [{ model: PaymentTransaction, as: 'paymentTransaction' }, 'id', 'ASC'],
    ],
  });

  // Build statement rows — receipt = DR (money in), payment = CR (money out)
  let runningBalance = toNumber(account.openingBalance);
  const rows = splits.map((split) => {
    const txn = split.paymentTransaction;
    const amount = toNumber(split.amount);
    const isReceipt = txn.transactionType === 'receipt';
    const debit = isReceipt ? amount : 0;
    const credit = isReceipt ? 0 : amount;
    runningBalance += debit - credit;
    return {
      date: txn.entryDate,
      referenceNo: txn.referenceNo,
      transactionType: txn.transactionType,
      contactName: txn.contact?.name || '—',
      contactId: txn.contactId,
      description: txn.description,
      debit,
      credit,
      balance: runningBalance,
    };
  });

  return {
    account: {
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      openingBalance: toNumber(account.openingBalance),
      openingDate: account.openingDate,
      branchName: account.branch?.name || 'All Branches',
      accountHeadCode: account.accountHead?.code,
    },
    openingBalance: toNumber(account.openingBalance),
    closingBalance: runningBalance,
    rows,
    filters: { startDate: startDate || null, endDate: endDate || null },
  };
};

module.exports = { getAccountsForBranch, listAccounts, createAccount, updateAccount, toggleAccount, getAccountStatement };
