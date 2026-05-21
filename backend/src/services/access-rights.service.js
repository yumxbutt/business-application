const { User } = require('../models');
const { ROLES } = require('../constants/roles');
const { ACCESS_RIGHTS_CATALOG, getAllRightCodes } = require('../constants/access-rights');

const canManageUser = (actor, targetUser) => {
  if (actor.role === ROLES.MAIN_ADMIN) return true;
  if (actor.role === ROLES.BRANCH_ADMIN && targetUser.branchId === actor.branchId && targetUser.role !== ROLES.MAIN_ADMIN) {
    return true;
  }
  return false;
};

const getCatalog = () => ACCESS_RIGHTS_CATALOG;

const updateUserAccessRights = async ({ actor, userId, rights }) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (!canManageUser(actor, user)) {
    throw new Error('Not allowed to update access rights for this user');
  }

  const availableRights = new Set(getAllRightCodes());
  const sanitizedRights = Array.from(new Set((rights || []).filter((item) => availableRights.has(item))));

  user.accessRights = sanitizedRights;
  await user.save();

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    accessRights: user.accessRights,
    isActive: user.isActive,
  };
};

module.exports = {
  getCatalog,
  updateUserAccessRights,
};
