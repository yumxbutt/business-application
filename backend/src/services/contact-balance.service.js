const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { Contact, ContactBalance } = require('../models');

const toNumber = (value) => Number(value || 0);

const refreshContactBalance = async ({ branchId, contactId, transaction }) => {
  if (!branchId || !contactId) return null;

  const rows = await sequelize.query(
    `
      SELECT
        SUM(CASE WHEN ah.code = 'AR-001' THEN (le.debit - le.credit) ELSE 0 END) AS receivable_balance,
        SUM(CASE WHEN ah.code = 'AP-001' THEN (le.credit - le.debit) ELSE 0 END) AS payable_balance
      FROM ledger_entries le
      INNER JOIN account_heads ah ON ah.id = le.account_head_id
      WHERE le.branch_id = :branchId AND le.contact_id = :contactId
    `,
    {
      replacements: { branchId: Number(branchId), contactId: Number(contactId) },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const row = rows[0] || {};
  const receivableBalance = toNumber(row.receivable_balance);
  const payableBalance = toNumber(row.payable_balance);
  const netBalance = receivableBalance - payableBalance;

  await ContactBalance.upsert(
    {
      branchId: Number(branchId),
      contactId: Number(contactId),
      receivableBalance,
      payableBalance,
      netBalance,
    },
    { transaction }
  );

  return { receivableBalance, payableBalance, netBalance };
};

const refreshAllContactBalances = async ({ branchId, transaction } = {}) => {
  const contacts = await Contact.findAll({
    where: {
      ...(branchId ? { branchId: Number(branchId) } : {}),
    },
    attributes: ['id', 'branchId'],
    transaction,
  });

  for (const contact of contacts) {
    await refreshContactBalance({
      branchId: contact.branchId,
      contactId: contact.id,
      transaction,
    });
  }

  return contacts.length;
};

module.exports = {
  refreshContactBalance,
  refreshAllContactBalances,
};