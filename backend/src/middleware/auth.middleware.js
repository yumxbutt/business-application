const jwt = require('jsonwebtoken');

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

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const authCookieName = process.env.AUTH_COOKIE_NAME || 'bms_auth';
  const tokenFromCookie = req.cookies?.[authCookieName];
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Missing access token' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'development_secret';
    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      branchId: payload.branchId,
      accessRights: normalizeAccessRights(payload.accessRights),
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = { authenticate };
