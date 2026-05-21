const { listBranches } = require('../services/branch.service');

const getBranches = async (req, res, next) => {
  try {
    const branches = await listBranches(req.user);
    res.json({ branches });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBranches };
