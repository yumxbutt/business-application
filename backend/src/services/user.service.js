const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Branch } = require('../models');
const { ROLES } = require('../constants/roles');
const { sanitizeUser } = require('./auth.service');

const canManageUser = (actor, targetUser) => {
  if (actor.role === ROLES.MAIN_ADMIN) return true;
  if (actor.role === ROLES.BRANCH_ADMIN && targetUser.branchId === actor.branchId && targetUser.role !== ROLES.MAIN_ADMIN) {
    return true;
  }
  return false;
};

const listUsers = async ({ actor, branchId }) => {
  const where = {};

  if (actor.role === ROLES.BRANCH_ADMIN) {
    where.branchId = actor.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const users = await User.findAll({
    where,
    include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] }],
    order: [['id', 'ASC']],
  });

  return users.map((user) => ({
    ...sanitizeUser(user),
    branch: user.branch ? { id: user.branch.id, name: user.branch.name, code: user.branch.code } : null,
  }));
};

const createUser = async ({ actor, payload }) => {
  const role = payload.role;
  let branchId = payload.branchId || null;

  if (actor.role === ROLES.BRANCH_ADMIN) {
    branchId = actor.branchId;
    if (role === ROLES.MAIN_ADMIN) {
      throw new Error('Branch admin cannot create main admin users');
    }
  }

  if (role !== ROLES.MAIN_ADMIN && !branchId) {
    throw new Error('Branch is required for branch users');
  }

  const existing = await User.findOne({ where: { username: payload.username.toLowerCase() } });
  if (existing) {
    throw new Error('Username already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);

  const user = await User.create({
    fullName: payload.fullName,
    username: payload.username.toLowerCase(),
    passwordHash,
    role,
    branchId,
    accessRights: payload.accessRights || [],
    isActive: payload.isActive ?? true,
  });

  const withBranch = await User.findByPk(user.id, {
    include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] }],
  });

  return {
    ...sanitizeUser(withBranch),
    branch: withBranch.branch
      ? { id: withBranch.branch.id, name: withBranch.branch.name, code: withBranch.branch.code }
      : null,
  };
};

const updateUser = async ({ actor, userId, payload }) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  if (!canManageUser(actor, user)) throw new Error('Not allowed to update this user');

  if (payload.fullName !== undefined) user.fullName = payload.fullName;
  if (payload.role !== undefined) {
    if (actor.role === ROLES.BRANCH_ADMIN && payload.role === ROLES.MAIN_ADMIN) {
      throw new Error('Branch admin cannot assign main admin role');
    }
    user.role = payload.role;
  }
  if (payload.branchId !== undefined) {
    user.branchId = actor.role === ROLES.BRANCH_ADMIN ? actor.branchId : payload.branchId;
  }
  if (payload.accessRights !== undefined) user.accessRights = payload.accessRights;
  if (payload.password) user.passwordHash = await bcrypt.hash(payload.password, 10);

  await user.save();

  const withBranch = await User.findByPk(user.id, {
    include: [{ model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] }],
  });

  return {
    ...sanitizeUser(withBranch),
    branch: withBranch.branch
      ? { id: withBranch.branch.id, name: withBranch.branch.name, code: withBranch.branch.code }
      : null,
  };
};

const changeUserStatus = async ({ actor, userId, isActive }) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  if (!canManageUser(actor, user)) throw new Error('Not allowed to update this user');

  user.isActive = Boolean(isActive);
  await user.save();

  return sanitizeUser(user);
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  changeUserStatus,
};
