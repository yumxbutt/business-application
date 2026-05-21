const { validationResult } = require('express-validator');
const {
  getCatalog,
  updateUserAccessRights,
} = require('../services/access-rights.service');

const getRightsCatalog = async (req, res) => {
  const catalog = getCatalog();
  res.json({ catalog });
};

const updateRights = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await updateUserAccessRights({
      actor: req.user,
      userId: Number(req.params.id),
      rights: req.body.accessRights,
    });

    return res.json({ message: 'Access rights updated', user });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('Not allowed')) {
      return res.status(403).json({ message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  getRightsCatalog,
  updateRights,
};
