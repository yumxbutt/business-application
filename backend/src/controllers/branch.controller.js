const { validationResult } = require('express-validator');
const {
  listBranches,
  createBranch,
  updateBranch,
  setBranchStatus,
} = require('../services/branch.service');

const resolveValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  return res.status(400).json({ error: msg });
};

const getBranches = async (req, res, next) => {
  try {
    const branches = await listBranches(req.user);
    res.json({ branches });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branch = await createBranch({ payload: req.body });
    return res.status(201).json({ message: 'Branch created', branch });
  } catch (err) {
    return mapError(err, res);
  }
};

const update = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branch = await updateBranch({
      branchId: Number(req.params.id),
      payload: req.body,
    });
    return res.json({ message: 'Branch updated', branch });
  } catch (err) {
    return mapError(err, res);
  }
};

const updateStatus = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branch = await setBranchStatus({
      branchId: Number(req.params.id),
      isActive: req.body.isActive,
    });
    return res.json({ message: 'Branch status updated', branch });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  getBranches,
  create,
  update,
  updateStatus,
};
