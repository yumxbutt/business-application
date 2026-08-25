const { Op } = require('sequelize');
const { AccountHead, LedgerEntry, PaymentAccount, Expense } = require('../models');

const SYSTEM_CODES = ['AR-001', 'INC-001', 'EXP-001', 'AP-001', 'AST-001', 'AST-002'];

const ACCOUNT_TYPES = ['cash', 'bank', 'expense', 'income', 'receivable', 'payable', 'asset', 'liability'];

const serialize = (record) => ({
  id: record.id,
  name: record.name,
  code: record.code,
  type: record.type,
  description: record.description,
  isActive: record.isActive,
  isSystem: record.isSystem,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const listAccountHeads = async ({ filters = {} } = {}) => {
  const where = {};

  if (filters.type && filters.type !== 'all') {
    where.type = filters.type;
  }

  if (filters.isActive === 'active') where.isActive = true;
  if (filters.isActive === 'inactive') where.isActive = false;

  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    where[Op.or] = [
      { name: { [Op.like]: term } },
      { code: { [Op.like]: term } },
      { description: { [Op.like]: term } },
    ];
  }

  const rows = await AccountHead.findAll({
    where,
    order: [['type', 'ASC'], ['code', 'ASC'], ['name', 'ASC']],
  });

  return rows.map(serialize);
};

const getAccountHead = async (id) => {
  const record = await AccountHead.findByPk(id);
  if (!record) throw new Error('Account head not found');
  return serialize(record);
};

const assertUniqueCode = async (code, excludeId = null) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Account code is required');

  const where = { code: normalized };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const existing = await AccountHead.findOne({ where });
  if (existing) throw new Error('Account code already exists');

  return normalized;
};

const getUsageCounts = async (accountHeadId) => {
  const [ledgerCount, paymentAccountCount, expenseCount] = await Promise.all([
    LedgerEntry.count({ where: { accountHeadId } }),
    PaymentAccount.count({ where: { accountHeadId } }),
    Expense.count({ where: { accountHeadId } }),
  ]);

  return {
    ledgerCount,
    paymentAccountCount,
    expenseCount,
    total: ledgerCount + paymentAccountCount + expenseCount,
  };
};

const createAccountHead = async ({ name, code, type, description }) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) throw new Error('Account name is required');
  if (!ACCOUNT_TYPES.includes(type)) throw new Error('Invalid account type');

  const normalizedCode = await assertUniqueCode(code);

  const record = await AccountHead.create({
    name: trimmedName,
    code: normalizedCode,
    type,
    description: description ? String(description).trim() : null,
    isActive: true,
    isSystem: false,
  });

  return serialize(record);
};

const updateAccountHead = async (id, { name, type, description }) => {
  const record = await AccountHead.findByPk(id);
  if (!record) throw new Error('Account head not found');

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) throw new Error('Account name cannot be empty');
    record.name = trimmedName;
  }

  if (type !== undefined) {
    if (!ACCOUNT_TYPES.includes(type)) throw new Error('Invalid account type');
    if (record.isSystem || SYSTEM_CODES.includes(record.code)) {
      throw new Error('System account type cannot be changed');
    }
    record.type = type;
  }

  if (description !== undefined) {
    record.description = description ? String(description).trim() : null;
  }

  await record.save();
  return serialize(record);
};

const updateAccountHeadStatus = async (id, isActive) => {
  const record = await AccountHead.findByPk(id);
  if (!record) throw new Error('Account head not found');

  if (record.isSystem || SYSTEM_CODES.includes(record.code)) {
    throw new Error('System accounts cannot be deactivated');
  }

  if (!isActive) {
    const usage = await getUsageCounts(record.id);
    if (usage.total > 0) {
      throw new Error('Cannot deactivate account head that is already in use');
    }
  }

  record.isActive = Boolean(isActive);
  await record.save();
  return serialize(record);
};

module.exports = {
  ACCOUNT_TYPES,
  SYSTEM_CODES,
  listAccountHeads,
  getAccountHead,
  createAccountHead,
  updateAccountHead,
  updateAccountHeadStatus,
};
