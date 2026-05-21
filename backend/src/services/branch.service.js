const { Branch } = require('../models');
const { ROLES } = require('../constants/roles');

const listBranches = async (actor) => {
  if (actor.role === ROLES.MAIN_ADMIN) {
    return Branch.findAll({ where: { isActive: true }, order: [['id', 'ASC']] });
  }

  if (!actor.branchId) return [];
  return Branch.findAll({ where: { id: actor.branchId, isActive: true } });
};

module.exports = { listBranches };
