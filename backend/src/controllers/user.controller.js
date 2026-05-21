const { validationResult } = require('express-validator');
const {
  listUsers,
  createUser,
  updateUser,
  changeUserStatus,
} = require('../services/user.service');

const getUsers = async (req, res, next) => {
  try {
    const users = await listUsers({
      actor: req.user,
      branchId: req.query.branchId ? Number(req.query.branchId) : null,
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await createUser({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'User created', user });
  } catch (error) {
    if (error.message.includes('exists') || error.message.includes('required')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('cannot') || error.message.includes('Not allowed')) {
      return res.status(403).json({ message: error.message });
    }
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await updateUser({
      actor: req.user,
      userId: Number(req.params.id),
      payload: req.body,
    });

    res.json({ message: 'User updated', user });
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ message: error.message });
    if (error.message.includes('cannot') || error.message.includes('Not allowed')) {
      return res.status(403).json({ message: error.message });
    }
    return next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const user = await changeUserStatus({
      actor: req.user,
      userId: Number(req.params.id),
      isActive: req.body.isActive,
    });

    res.json({ message: 'User status updated', user });
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ message: error.message });
    if (error.message.includes('Not allowed')) return res.status(403).json({ message: error.message });
    return next(error);
  }
};

module.exports = {
  getUsers,
  create,
  update,
  updateStatus,
};
