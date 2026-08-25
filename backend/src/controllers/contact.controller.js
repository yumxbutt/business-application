const { validationResult } = require('express-validator');
const contactService = require('../services/contact.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  if (msg.includes('Not allowed')) return res.status(403).json({ error: msg });
  return res.status(400).json({ error: msg });
};

const resolveValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * GET /api/contacts?recordType=customer&isActive=active
 */
const listContacts = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const branchId = req.user.role === 'main_admin'
    ? (req.query.branchId ? Number(req.query.branchId) : undefined)
    : Number(req.user.branchId);
  const filters = {
    search: req.query.search,
    recordType: req.query.recordType,
    isActive: req.query.isActive,
  };

  try {
    const contacts = await contactService.listContacts({ branchId, filters, actor: req.user });
    return res.json({ contacts });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * POST /api/contacts
 */
const createContact = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const payload = req.body;

  try {
    const contact = await contactService.createContact(payload, req.user);
    return res.status(201).json({ contact });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * PUT /api/contacts/:id
 */
const updateContact = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { id } = req.params;
  const payload = req.body;

  try {
    const contact = await contactService.updateContact(Number(id), payload, req.user);
    return res.json({ contact });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * PATCH /api/contacts/:id/status
 */
const changeStatus = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const contact = await contactService.changeContactStatus(Number(id), isActive, req.user);
    return res.json({ contact });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/contacts/customers
 */
const getCustomers = async (req, res) => {
  const branchId = req.user.role === 'main_admin'
    ? (req.query.branchId ? Number(req.query.branchId) : undefined)
    : Number(req.user.branchId);

  try {
    const customers = await contactService.getCustomers(branchId);
    return res.json({ customers });
  } catch (err) {
    return mapError(err, res);
  }
};

const getDefaultCustomer = async (req, res) => {
  const branchId = req.user.role === 'main_admin'
    ? (req.query.branchId ? Number(req.query.branchId) : undefined)
    : Number(req.user.branchId);

  if (!branchId) {
    return res.status(400).json({ error: 'branchId is required' });
  }

  try {
    const customer = await contactService.getDefaultCustomer(branchId);
    if (!customer) {
      return res.status(404).json({ error: 'Default walk-in customer not found for this branch' });
    }
    return res.json({ customer });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/contacts/suppliers
 */
const getSuppliers = async (req, res) => {
  const branchId = req.user.role === 'main_admin'
    ? (req.query.branchId ? Number(req.query.branchId) : undefined)
    : Number(req.user.branchId);

  try {
    const suppliers = await contactService.getSuppliers(branchId);
    return res.json({ suppliers });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listContacts,
  createContact,
  updateContact,
  changeStatus,
  getCustomers,
  getDefaultCustomer,
  getSuppliers,
};
