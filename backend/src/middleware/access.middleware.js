const { ROLES } = require('../constants/roles');

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

const requireAccess = (...rights) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.role === ROLES.MAIN_ADMIN) {
      return next();
    }

    const userRights = normalizeAccessRights(req.user.accessRights);
    const hasRight = rights.some((right) => userRights.includes(right));

    if (!hasRight) {
      return res.status(403).json({ message: 'Forbidden: insufficient access rights' });
    }

    return next();
  };
};

module.exports = { requireAccess };
