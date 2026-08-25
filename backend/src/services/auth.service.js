const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, LoginActivity } = require('../models');

const normalizeAccessRights = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v));
  if (!value) return [];
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map((v) => String(v));
    } catch {
      // fall through
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
};

const buildTokenPayload = (user) => ({
  sub: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  branchId: user.branchId,
  accessRights: normalizeAccessRights(user.accessRights),
});

const createAccessToken = (user) => {
  const payload = buildTokenPayload(user);
  const secret = process.env.JWT_SECRET || 'development_secret';
  const expiresIn = process.env.JWT_EXPIRE || '7d';

  return jwt.sign(payload, secret, { expiresIn });
};

const getCookieOptions = () => {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }
  return options;
};

const findUserByUsername = async (username) => {
  return User.findOne({ where: { username: String(username).toLowerCase() } });
};

const validateCredentials = async (username, password) => {
  const user = await findUserByUsername(username);
  if (!user || !user.isActive) return null;

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return null;

  return user;
};

const updateOwnProfile = async ({ userId, fullName, currentPassword, newPassword }) => {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) {
    throw new Error('User not found');
  }

  if (fullName !== undefined && String(fullName).trim()) {
    user.fullName = String(fullName).trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to set a new password');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await user.save();
  return user;
};

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  branchId: user.branchId,
  accessRights: normalizeAccessRights(user.accessRights),
  isActive: user.isActive,
});

const listLoginActivities = async ({ page = 1, limit = 20, status, username } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const where = {};
  if (status) where.status = status;
  if (username) {
    where.usernameAttempted = { [Op.like]: `%${String(username).trim()}%` };
  }

  const { count, rows } = await LoginActivity.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'username', 'fullName', 'role'] }],
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return {
    items: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      totalPages: Math.ceil(count / safeLimit) || 0,
    },
  };
};

const recordLoginActivity = async ({ userId, usernameAttempted, ipAddress, userAgent, status, reason }) => {
  try {
    await LoginActivity.create({
      userId: userId || null,
      usernameAttempted,
      ipAddress,
      userAgent,
      status,
      reason,
    });
  } catch (error) {
    console.error('Failed to store login activity:', error.message);
  }
};

const refreshSession = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) {
    throw new Error('User not found');
  }
  return user;
};

module.exports = {
  sanitizeUser,
  createAccessToken,
  getCookieOptions,
  validateCredentials,
  updateOwnProfile,
  recordLoginActivity,
  listLoginActivities,
  refreshSession,
};
