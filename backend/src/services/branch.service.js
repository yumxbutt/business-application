const { sequelize } = require('../config/database');
const { Branch, PaymentAccount, AccountHead, Contact } = require('../models');
const { ROLES } = require('../constants/roles');
const { WALK_IN_CUSTOMER_NAME } = require('../constants/contacts');

const listBranches = async (actor) => {
  if (actor.role === ROLES.MAIN_ADMIN) {
    return Branch.findAll({ order: [['id', 'ASC']] });
  }

  if (!actor.branchId) return [];
  return Branch.findAll({ where: { id: actor.branchId, isActive: true } });
};

const seedDefaultCashAccount = async (branchId, transaction) => {
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' }, transaction });
  const existing = await PaymentAccount.findOne({
    where: { branchId, accountType: 'cash' },
    transaction,
  });

  if (!existing) {
    await PaymentAccount.create(
      {
        branchId,
        accountType: 'cash',
        accountHeadId: cashHead?.id || null,
        name: 'Main Cash',
        openingBalance: 0,
        isActive: 1,
        sortOrder: 0,
      },
      { transaction }
    );
  }
};

const seedWalkInCustomer = async (branchId, transaction) => {
  const existing = await Contact.findOne({
    where: { branchId, name: WALK_IN_CUSTOMER_NAME },
    transaction,
  });
  if (!existing) {
    await Contact.create(
      {
        branchId,
        name: WALK_IN_CUSTOMER_NAME,
        recordType: 'customer',
        openingBalance: 0,
        isActive: true,
      },
      { transaction }
    );
  }
};

const createBranch = async ({ payload }) => {
  const { name, code, address = '', phone = '' } = payload;

  if (!name?.trim()) throw new Error('Branch name is required');

  let branchCode = code?.trim();
  if (!branchCode) {
    const count = await Branch.count();
    branchCode = `BR-${String(count + 1).padStart(3, '0')}`;
  }

  const duplicate = await Branch.findOne({ where: { code: branchCode } });
  if (duplicate) throw new Error('Branch code already exists');

  return sequelize.transaction(async (transaction) => {
    const branch = await Branch.create(
      {
        name: name.trim(),
        code: branchCode,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        isActive: true,
      },
      { transaction }
    );

    await seedDefaultCashAccount(branch.id, transaction);
    await seedWalkInCustomer(branch.id, transaction);
    return branch;
  });
};

const updateBranch = async ({ branchId, payload }) => {
  const branch = await Branch.findByPk(Number(branchId));
  if (!branch) throw new Error('Branch not found');

  if (payload.code !== undefined) {
    const nextCode = String(payload.code).trim();
    if (!nextCode) throw new Error('Branch code cannot be empty');

    const duplicate = await Branch.findOne({
      where: { code: nextCode },
    });
    if (duplicate && duplicate.id !== branch.id) {
      throw new Error('Branch code already exists');
    }
    branch.code = nextCode;
  }

  if (payload.name !== undefined) {
    const nextName = String(payload.name).trim();
    if (!nextName) throw new Error('Branch name cannot be empty');
    branch.name = nextName;
  }

  if (payload.address !== undefined) branch.address = payload.address?.trim() || null;
  if (payload.phone !== undefined) branch.phone = payload.phone?.trim() || null;

  await branch.save();
  return branch;
};

const setBranchStatus = async ({ branchId, isActive }) => {
  const branch = await Branch.findByPk(Number(branchId));
  if (!branch) throw new Error('Branch not found');

  branch.isActive = Boolean(isActive);
  await branch.save();
  return branch;
};

module.exports = {
  listBranches,
  createBranch,
  updateBranch,
  setBranchStatus,
};
