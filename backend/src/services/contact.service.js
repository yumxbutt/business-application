const { Op } = require('sequelize');
const { Contact, Branch, ContactBalance } = require('../models');
const { WALK_IN_CUSTOMER_NAME } = require('../constants/contacts');

const withBalanceInclude = {
  model: ContactBalance,
  as: 'balance',
  attributes: ['receivableBalance', 'payableBalance', 'netBalance'],
  required: false,
};

const withBranchInclude = {
  model: Branch,
  as: 'branch',
  attributes: ['id', 'name'],
  required: false,
};

const withDefaultBalance = (contact) => {
  const row = contact.toJSON();
  row.balance = row.balance || {
    receivableBalance: 0,
    payableBalance: 0,
    netBalance: 0,
  };
  return row;
};

const ensureManagerRole = (actor) => {
  if (!['main_admin', 'branch_admin'].includes(actor.role)) {
    throw new Error('Not allowed to manage contacts');
  }
};

const ensureCanCreateContact = (actor, recordType) => {
  if (['main_admin', 'branch_admin'].includes(actor.role)) return;
  if (actor.role === 'staff') {
    if (recordType !== 'customer') {
      throw new Error('Staff can only create customers');
    }
    return;
  }
  throw new Error('Not allowed to manage contacts');
};

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const listContacts = async ({ branchId, filters = {}, actor }) => {
  const whereClause = {};

  if (branchId) {
    whereClause.branchId = Number(branchId);
  }

  if (filters.search) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${filters.search}%` } },
      { phone: { [Op.like]: `%${filters.search}%` } },
    ];
  }

  if (filters.recordType && filters.recordType !== 'all') {
    whereClause.recordType = filters.recordType;
  }

  if (filters.isActive !== undefined && filters.isActive !== 'all') {
    whereClause.isActive = filters.isActive === 'active';
  }

  // Get all contacts matching filters
  const contacts = await Contact.findAll({
    where: whereClause,
    include: [withBalanceInclude, withBranchInclude],
    order: [['name', 'ASC']],
  });

  // If main_admin, group by name and aggregate branches
  if (actor && actor.role === 'main_admin') {
    const grouped = {};
    for (const c of contacts) {
      const key = c.name;
      const branchLabel = c.branch?.name || `Branch ${c.branchId}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...c.toJSON(),
          branches: new Set([branchLabel]),
        };
      } else {
        grouped[key].branches.add(branchLabel);
      }
    }
    // Remove duplicate fields (keep one row per name)
    return Object.values(grouped).map((row) => {
      row.branches = Array.from(row.branches).join(', ');
      return row;
    });
  }

  // For branch users, return only contacts for their branch (no grouping)
  return contacts.map(withDefaultBalance);
};

const getContact = async (contactId) => {
  const contact = await Contact.findByPk(contactId);
  if (!contact) throw new Error(`Contact #${contactId} not found`);
  return contact;
};

const createContact = async (payload, actor) => {
  const { name, phone, address, recordType, openingBalance, branchId, applyToAllBranches, branchIds } = payload;

  if (!name || !name.trim()) throw new Error('Contact name is required');
  if (!['customer', 'supplier', 'both'].includes(recordType)) {
    throw new Error('Invalid record type');
  }

  ensureCanCreateContact(actor, recordType);

  // Check for duplicate name across all branches
  const existing = await Contact.findOne({ where: { name: normalizeText(name) } });
  if (existing) throw new Error('Contact name must be unique across all branches');

  // Helper to create a single contact for a given branch id
  const createForBranch = async (bId) => Contact.create({
    branchId: Number(bId),
    name: normalizeText(name),
    phone: normalizeText(phone),
    address: normalizeText(address),
    recordType,
    openingBalance: parseFloat(openingBalance) || 0,
    isActive: true,
  });

  // Staff: always own branch, customer only
  if (actor.role === 'staff') {
    if (!actor.branchId) throw new Error('Branch is required for contact');
    return createForBranch(actor.branchId);
  }

  // If main admin requested apply to all branches, create for every branch
  if (applyToAllBranches && actor.role === 'main_admin') {
    const allBranches = await Branch.findAll({ attributes: ['id'] });
    if (!allBranches || allBranches.length === 0) throw new Error('No branches available');
    const created = await Promise.all(allBranches.map((b) => createForBranch(b.id)));
    return created[0];
  }

  // If explicit branchIds array provided, create for each specified branch
  if (Array.isArray(branchIds) && branchIds.length > 0 && actor.role === 'main_admin') {
    const created = await Promise.all(branchIds.map((b) => createForBranch(b)));
    return created[0];
  }

  // Default behavior: resolve branch from actor or supplied branchId
  const resolvedBranchId = actor.role === 'main_admin'
    ? Number(branchId || actor.branchId)
    : Number(actor.branchId);

  if (!resolvedBranchId) {
    throw new Error('Branch is required for contact');
  }

  const contact = await Contact.create({
    branchId: resolvedBranchId,
    name: normalizeText(name),
    phone: normalizeText(phone),
    address: normalizeText(address),
    recordType,
    openingBalance: parseFloat(openingBalance) || 0,
    isActive: true,
  });

  return contact;
};

const updateContact = async (contactId, payload, actor) => {
  ensureManagerRole(actor);

  const contact = await getContact(contactId);
  if (actor.role !== 'main_admin' && Number(contact.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to manage contacts from another branch');
  }

  const { name, phone, address, recordType, openingBalance, branchId, branchIds } = payload;

  // Update fields on the existing contact
  if (name && name.trim()) contact.name = normalizeText(name);
  if (recordType && ['customer', 'supplier', 'both'].includes(recordType)) {
    contact.recordType = recordType;
  }
  if (phone !== undefined) contact.phone = normalizeText(phone);
  if (address !== undefined) contact.address = normalizeText(address);
  if (openingBalance !== undefined) {
    contact.openingBalance = parseFloat(openingBalance) || 0;
  }

  // If main admin provided branchIds for multi-branch assignment:
  if (Array.isArray(branchIds) && branchIds.length > 0 && actor.role === 'main_admin') {
    // Update the current contact to use the first branch
    contact.branchId = Number(branchIds[0]) || contact.branchId;
    await contact.save();

    // Create contacts for any remaining branchIds
    const remaining = branchIds.slice(1);
    if (remaining.length > 0) {
      const base = {
        name: contact.name,
        phone: contact.phone,
        address: contact.address,
        recordType: contact.recordType,
        openingBalance: contact.openingBalance,
        isActive: contact.isActive,
      };
      await Promise.all(remaining.map((b) => Contact.create({ ...base, branchId: Number(b) })));
    }

    return contact;
  }

  // Single-branch change allowed for main_admin
  if (branchId !== undefined && actor.role === 'main_admin') {
    contact.branchId = Number(branchId) || contact.branchId;
  }

  await contact.save();
  return contact;
};

const changeContactStatus = async (contactId, isActive, actor) => {
  ensureManagerRole(actor);

  const contact = await getContact(contactId);
  if (actor.role !== 'main_admin' && Number(contact.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to manage contacts from another branch');
  }
  contact.isActive = !!isActive;
  await contact.save();
  return contact;
};

const sortCustomersForPos = (contacts) => {
  return contacts.sort((a, b) => {
    if (a.name === WALK_IN_CUSTOMER_NAME) return -1;
    if (b.name === WALK_IN_CUSTOMER_NAME) return 1;
    return String(a.name).localeCompare(String(b.name));
  });
};

const getCustomers = async (branchId) => {
  const contacts = await Contact.findAll({
    where: {
      ...(branchId ? { branchId: Number(branchId) } : {}),
      recordType: { [Op.in]: ['customer', 'both'] },
      isActive: true,
    },
    include: [withBalanceInclude],
    order: [['name', 'ASC']],
  });

  return sortCustomersForPos(contacts.map(withDefaultBalance));
};

const getDefaultCustomer = async (branchId) => {
  if (!branchId) return null;
  const contact = await Contact.findOne({
    where: {
      branchId: Number(branchId),
      name: WALK_IN_CUSTOMER_NAME,
      recordType: { [Op.in]: ['customer', 'both'] },
      isActive: true,
    },
    include: [withBalanceInclude],
  });
  return contact ? withDefaultBalance(contact) : null;
};

const getSuppliers = async (branchId) => {
  const contacts = await Contact.findAll({
    where: {
      ...(branchId ? { branchId: Number(branchId) } : {}),
      recordType: { [Op.in]: ['supplier', 'both'] },
      isActive: true,
    },
    include: [withBalanceInclude],
    order: [['name', 'ASC']],
  });

  return contacts.map(withDefaultBalance);
};

const getAll = async (branchId) => {
  const contacts = await Contact.findAll({
    where: { ...(branchId ? { branchId: Number(branchId) } : {}), isActive: true },
    include: [withBalanceInclude],
    order: [['name', 'ASC']],
  });

  return contacts.map(withDefaultBalance);
};

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  changeContactStatus,
  getCustomers,
  getDefaultCustomer,
  getSuppliers,
  getAll,
  WALK_IN_CUSTOMER_NAME,
};
