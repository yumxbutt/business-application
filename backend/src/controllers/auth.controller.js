const { validationResult } = require('express-validator');
const {
  validateCredentials,
  createAccessToken,
  getCookieOptions,
  recordLoginActivity,
  listLoginActivities,
  sanitizeUser,
  updateOwnProfile,
  refreshSession,
} = require('../services/auth.service');

const authCookieName = process.env.AUTH_COOKIE_NAME || 'bms_auth';

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const user = await validateCredentials(username, password);
  const ipAddress = req.ip;
  const userAgent = req.get('user-agent') || '';

  if (!user) {
    await recordLoginActivity({
      usernameAttempted: username,
      ipAddress,
      userAgent,
      status: 'failed',
      reason: 'Invalid username or password',
    });
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const accessToken = createAccessToken(user);
  res.cookie(authCookieName, accessToken, getCookieOptions());

  await recordLoginActivity({
    userId: user.id,
    usernameAttempted: user.username,
    ipAddress,
    userAgent,
    status: 'success',
    reason: null,
  });

  return res.status(200).json({
    message: 'Login successful',
    user: sanitizeUser(user),
  });
};

const me = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

const logout = async (req, res) => {
  const clearOpts = { path: '/' };
  if (process.env.COOKIE_DOMAIN) {
    clearOpts.domain = process.env.COOKIE_DOMAIN;
  }
  res.clearCookie(authCookieName, clearOpts);
  return res.status(200).json({ message: 'Logout successful' });
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updatedUser = await updateOwnProfile({
      userId: req.user.id,
      fullName: req.body.fullName,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });

    const accessToken = createAccessToken(updatedUser);
    res.cookie(authCookieName, accessToken, getCookieOptions());

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('incorrect')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
};

const getLoginActivities = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await listLoginActivities({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      username: req.query.username,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const refreshSessionHandler = async (req, res, next) => {
  try {
    const user = await refreshSession(req.user.id);
    const accessToken = createAccessToken(user);
    res.cookie(authCookieName, accessToken, getCookieOptions());
    return res.status(200).json({
      message: 'Session refreshed',
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  login,
  me,
  logout,
  updateProfile,
  getLoginActivities,
  refreshSessionHandler,
};
