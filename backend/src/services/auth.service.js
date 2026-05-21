const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, LoginActivity } = require('../models');

const buildTokenPayload = (user) => ({
  sub: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role,
  branchId: user.branchId,
  accessRights: user.accessRights || [],
});

const createAccessToken = (user) => {
  const payload = buildTokenPayload(user);
  const secret = process.env.JWT_SECRET || 'development_secret';
  const expiresIn = process.env.JWT_EXPIRE || '7d';

  return jwt.sign(payload, secret, { expiresIn });
};

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

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
  accessRights: user.accessRights || [],
  isActive: user.isActive,
});

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

module.exports = {
  sanitizeUser,
  createAccessToken,
  getCookieOptions,
  validateCredentials,
  updateOwnProfile,
  recordLoginActivity,
};
