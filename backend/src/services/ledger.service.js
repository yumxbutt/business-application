const { LedgerEntry, Contact, AccountHead, User, BranchOpeningBalance } = require('../models');
const { Op } = require('sequelize');
const { refreshContactBalance } = require('./contact-balance.service');

/**
 * Create double-entry ledger posting.
 * Posts two entries: one debit side, one credit side.
 */
const createEntry = async ({
  branchId,
  entryDate,
  referenceType,
  referenceId,
  referenceNo,
  description,
  contactId,
  accountHeadId,
  debitAmount,
  creditAmount,
  createdById,
  transaction,
}) => {
  const entries = [];

  // Debit entry
  if (debitAmount > 0) {
    entries.push(
      LedgerEntry.create({
        branchId,
        contactId: contactId || null,
        accountHeadId,
        entryDate,
        referenceType,
        referenceId,
        referenceNo,
        description,
        debit: debitAmount,
        credit: 0,
        createdById,
      }, { transaction })
    );
  }

  // Credit entry (mirror posting to contact or opposite account)
  if (creditAmount > 0) {
    entries.push(
      LedgerEntry.create({
        branchId,
        contactId: contactId || null,
        accountHeadId,
        entryDate,
        referenceType,
        referenceId,
        referenceNo,
        description,
        debit: 0,
        credit: creditAmount,
        createdById,
      }, { transaction })
    );
  }

  const results = await Promise.all(entries);
  if (contactId) {
    await refreshContactBalance({ branchId, contactId, transaction });
  }
  return results;
};

/**
 * Get ledger entries for a contact with running balance (read-only).
 */
const getContactLedger = async (branchId, contactId, { startDate, endDate } = {}) => {
  const whereClause = { branchId, contactId };

  if (startDate) {
    whereClause.entryDate = { [Op.gte]: startDate };
  }
  if (endDate) {
    if (!whereClause.entryDate) whereClause.entryDate = {};
    whereClause.entryDate[Op.lte] = endDate;
  }

  const entries = await LedgerEntry.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['name'] },
      { model: AccountHead, as: 'accountHead', attributes: ['name', 'code', 'type'] },
    ],
    order: [['entryDate', 'ASC'], ['id', 'ASC']],
  });

  // Calculate running balance
  let balance = 0;
  const enriched = entries.map((entry) => {
    balance += parseFloat(entry.debit) - parseFloat(entry.credit);
    return {
      ...entry.toJSON(),
      runningBalance: balance,
    };
  });

  return enriched;
};

/**
 * Get receivables summary (customers with outstanding A/R).
 */
const getReceivables = async (branchId) => {
  // Query ledger for A/R account (1), group by contact, sum debit - credit
  const entries = await LedgerEntry.sequelize.query(
    `
    SELECT 
      contact_id,
      SUM(debit - credit) as outstanding_amount
    FROM ledger_entries
    WHERE branch_id = $1
      AND account_head_id = 1
      AND contact_id IS NOT NULL
    GROUP BY contact_id
    HAVING SUM(debit - credit) > 0
    `,
    {
      bind: [branchId],
      type: 'SELECT',
    }
  );

  // Load contact details
  const receivables = await Promise.all(
    entries.map(async (row) => {
      const contact = await Contact.findByPk(row.contact_id);
      return {
        contactId: row.contact_id,
        contactName: contact?.name || 'Unknown',
        phone: contact?.phone || null,
        outstandingAmount: parseFloat(row.outstanding_amount),
      };
    })
  );

  return receivables.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
};

/**
 * Get payables summary (suppliers with outstanding A/P).
 */
const getPayables = async (branchId) => {
  // Query ledger for A/P account (4), group by contact, sum credit - debit
  const entries = await LedgerEntry.sequelize.query(
    `
    SELECT 
      contact_id,
      SUM(credit - debit) as outstanding_amount
    FROM ledger_entries
    WHERE branch_id = $1
      AND account_head_id = 4
      AND contact_id IS NOT NULL
    GROUP BY contact_id
    HAVING SUM(credit - debit) > 0
    `,
    {
      bind: [branchId],
      type: 'SELECT',
    }
  );

  // Load contact details
  const payables = await Promise.all(
    entries.map(async (row) => {
      const contact = await Contact.findByPk(row.contact_id);
      return {
        contactId: row.contact_id,
        contactName: contact?.name || 'Unknown',
        phone: contact?.phone || null,
        outstandingAmount: parseFloat(row.outstanding_amount),
      };
    })
  );

  return payables.sort((a, b) => b.outstandingAmount - a.outstandingAmount);
};

/**
 * Get full ledger report for a branch (all accounts).
 */
const getLedgerReport = async (branchId, { startDate, endDate } = {}) => {
  const whereClause = { branchId };

  if (startDate) {
    whereClause.entryDate = { [Op.gte]: startDate };
  }
  if (endDate) {
    if (!whereClause.entryDate) whereClause.entryDate = {};
    whereClause.entryDate[Op.lte] = endDate;
  }

  const entries = await LedgerEntry.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['name'] },
      { model: AccountHead, as: 'accountHead', attributes: ['name', 'code', 'type'] },
      { model: User, as: 'createdBy', attributes: ['fullName'] },
    ],
    order: [['entryDate', 'ASC'], ['id', 'ASC']],
  });

  // Calculate running balance by account
  const balanceByAccount = {};
  const enriched = entries.map((entry) => {
    const key = entry.accountHeadId;
    if (!balanceByAccount[key]) balanceByAccount[key] = 0;
    balanceByAccount[key] += parseFloat(entry.debit) - parseFloat(entry.credit);

    return {
      ...entry.toJSON(),
      accountBalance: balanceByAccount[key],
    };
  });

  return enriched;
};

/**
 * Cash Book — only AST-001 (cash account) ledger entries, date-wise with opening/closing carry-forward.
 * DR = cash received (receipts), CR = cash paid out (payments).
 * Formula: closing = opening + debit - credit
 * Opening for period = stored opening balance + all cash entries before startDate.
 */
const getCashBook = async (branchId, { startDate, endDate } = {}) => {
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' } });
  if (!cashHead) {
    throw new Error('Required account head is missing (AST-001)');
  }

  // Get stored opening balance for this branch
  const storedOpening = await BranchOpeningBalance.findOne({ where: { branchId } });
  const baseOpening = storedOpening ? parseFloat(storedOpening.openingBalance) : 0;

  // All cash entries BEFORE the period start → carry forward opening balance
  const preEntries = startDate
    ? await LedgerEntry.findAll({
        where: {
          branchId,
          accountHeadId: cashHead.id,
          entryDate: { [Op.lt]: startDate },
        },
        attributes: ['debit', 'credit'],
      })
    : [];

  const periodOpening = Number(
    (
      baseOpening +
      preEntries.reduce((sum, e) => sum + parseFloat(e.debit || 0) - parseFloat(e.credit || 0), 0)
    ).toFixed(2)
  );

  const dateFilter = {};
  if (startDate) dateFilter[Op.gte] = startDate;
  if (endDate) dateFilter[Op.lte] = endDate;

  const whereClause = {
    branchId,
    accountHeadId: cashHead.id,   // ONLY cash entries
  };

  if (startDate || endDate) {
    whereClause.entryDate = dateFilter;
  }

  const entries = await LedgerEntry.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code'] },
      { model: User, as: 'createdBy', attributes: ['fullName'] },
    ],
    order: [['entryDate', 'ASC'], ['id', 'ASC']],
  });

  let carriedOpening = periodOpening;
  let overallTotalDebit = 0;
  let overallTotalCredit = 0;
  const daysMap = new Map();

  entries.forEach((entry) => {
    const dayKey = String(entry.entryDate);
    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, {
        date: dayKey,
        openingBalance: carriedOpening,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: carriedOpening,
        entries: [],
      });
    }

    const day = daysMap.get(dayKey);
    const debit = parseFloat(entry.debit || 0);
    const credit = parseFloat(entry.credit || 0);

    day.totalDebit = Number((day.totalDebit + debit).toFixed(2));
    day.totalCredit = Number((day.totalCredit + credit).toFixed(2));
    // Cash Book: closing = opening + debit (cash in) - credit (cash out)
    day.closingBalance = Number((day.closingBalance + debit - credit).toFixed(2));

    const contactName = entry.contact?.name || null;
    const accountName = entry.accountHead?.name || null;
    const parts = [];
    if (contactName) parts.push(contactName);
    if (entry.description) parts.push(entry.description);
    const displayDescription = parts.length ? parts.join(' — ') : (accountName || '-');

    day.entries.push({
      id: entry.id,
      entryDate: entry.entryDate,
      referenceType: entry.referenceType,
      referenceNo: entry.referenceNo,
      description: entry.description,
      contactName,
      accountName,
      displayDescription,
      debit,
      credit,
    });

    overallTotalDebit += debit;
    overallTotalCredit += credit;
  });

  // Pass closing of each day as opening of next
  const daysArr = Array.from(daysMap.values());
  daysArr.forEach((day, i) => {
    if (i < daysArr.length - 1) {
      daysArr[i + 1].openingBalance = day.closingBalance;
      daysArr[i + 1].closingBalance = Number(
        (daysArr[i + 1].openingBalance + daysArr[i + 1].totalDebit - daysArr[i + 1].totalCredit).toFixed(2)
      );
    }
  });

  const closingBalance = daysArr.length ? daysArr[daysArr.length - 1].closingBalance : periodOpening;

  // Single-day cash report with no movements still shows opening = closing.
  if (startDate && endDate && startDate === endDate && daysArr.length === 0) {
    daysArr.push({
      date: startDate,
      openingBalance: periodOpening,
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: periodOpening,
      entries: [],
    });
  }

  return {
    openingBalance: periodOpening,
    totalDebit: Number(overallTotalDebit.toFixed(2)),
    totalCredit: Number(overallTotalCredit.toFixed(2)),
    closingBalance: Number(closingBalance.toFixed(2)),
    days: daysArr,
  };
};

/**
 * Get stored opening balance for a branch's trading register.
 */
const getOpeningBalance = async (branchId) => {
  const record = await BranchOpeningBalance.findOne({ where: { branchId } });
  return {
    openingBalance: record ? parseFloat(record.openingBalance) : 0,
    openingDate: record?.openingDate || null,
    notes: record?.notes || '',
    isSet: !!record,
  };
};

/**
 * Save/update opening balance for a branch's trading register.
 */
const setOpeningBalance = async (branchId, { openingBalance, openingDate, notes, setById }) => {
  const [record, created] = await BranchOpeningBalance.findOrCreate({
    where: { branchId },
    defaults: { branchId, openingBalance, openingDate, notes, setById },
  });

  if (!created) {
    await record.update({ openingBalance, openingDate, notes, setById });
  }

  return {
    openingBalance: parseFloat(record.openingBalance),
    openingDate: record.openingDate,
    notes: record.notes,
  };
};

/**
 * Trading Ledger Register — all non-cash entries, date-wise, with opening/closing carried per day.
 * Formula: closing = opening + credit - debit
 * Opening for period start = stored opening balance + all non-cash entries before startDate.
 */
const getTradingLedgerRegister = async (branchId, { startDate, endDate } = {}) => {
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' } });
  if (!cashHead) throw new Error('Required account head is missing (AST-001)');

  // Get stored initial opening balance for this branch
  const storedOpening = await BranchOpeningBalance.findOne({ where: { branchId } });
  const baseOpening = storedOpening ? parseFloat(storedOpening.openingBalance) : 0;

  // All non-cash entries BEFORE the period start → carry forward to compute opening
  const preEntries = startDate
    ? await LedgerEntry.findAll({
        where: {
          branchId,
          accountHeadId: { [Op.ne]: cashHead.id },
          entryDate: { [Op.lt]: startDate },
        },
        attributes: ['debit', 'credit'],
      })
    : [];

  const periodOpening = Number(
    (
      baseOpening +
      preEntries.reduce((sum, e) => sum + parseFloat(e.credit || 0) - parseFloat(e.debit || 0), 0)
    ).toFixed(2)
  );

  // Non-cash entries within the requested period
  const dateFilter = {};
  if (startDate) dateFilter[Op.gte] = startDate;
  if (endDate) dateFilter[Op.lte] = endDate;

  const whereClause = {
    branchId,
    accountHeadId: { [Op.ne]: cashHead.id },
  };
  if (startDate || endDate) whereClause.entryDate = dateFilter;

  const entries = await LedgerEntry.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: AccountHead, as: 'accountHead', attributes: ['id', 'name', 'code'] },
      { model: User, as: 'createdBy', attributes: ['fullName'] },
    ],
    order: [['entryDate', 'ASC'], ['id', 'ASC']],
  });

  let carriedOpening = periodOpening;
  let overallTotalDebit = 0;
  let overallTotalCredit = 0;
  const daysMap = new Map();

  entries.forEach((entry) => {
    const dayKey = String(entry.entryDate);
    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, {
        date: dayKey,
        openingBalance: carriedOpening,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: carriedOpening,
        entries: [],
      });
    }

    const day = daysMap.get(dayKey);
    const debit = parseFloat(entry.debit || 0);
    const credit = parseFloat(entry.credit || 0);

    day.totalDebit = Number((day.totalDebit + debit).toFixed(2));
    day.totalCredit = Number((day.totalCredit + credit).toFixed(2));
    // closing = opening + credit - debit
    day.closingBalance = Number((day.closingBalance + credit - debit).toFixed(2));

    const contactName = entry.contact?.name || null;
    const accountName = entry.accountHead?.name || null;
    const parts = [];
    if (contactName) parts.push(contactName);
    if (entry.description) parts.push(entry.description);
    const displayDescription = parts.length ? parts.join(' — ') : (accountName || '-');

    day.entries.push({
      id: entry.id,
      entryDate: entry.entryDate,
      referenceType: entry.referenceType,
      referenceNo: entry.referenceNo,
      description: entry.description,
      contactName,
      accountName,
      displayDescription,
      debit,
      credit,
    });

    overallTotalDebit += debit;
    overallTotalCredit += credit;
  });

  // Pass closing of each day as opening of next
  const daysArr = Array.from(daysMap.values());
  daysArr.forEach((day, i) => {
    if (i < daysArr.length - 1) {
      daysArr[i + 1].openingBalance = day.closingBalance;
      // Recompute closing for next day based on new opening
      daysArr[i + 1].closingBalance = Number(
        (daysArr[i + 1].openingBalance + daysArr[i + 1].totalCredit - daysArr[i + 1].totalDebit).toFixed(2)
      );
    }
    carriedOpening = day.closingBalance;
  });

  const closingBalance = daysArr.length ? daysArr[daysArr.length - 1].closingBalance : periodOpening;

  return {
    openingBalance: periodOpening,
    totalDebit: Number(overallTotalDebit.toFixed(2)),
    totalCredit: Number(overallTotalCredit.toFixed(2)),
    closingBalance: Number(closingBalance.toFixed(2)),
    days: daysArr,
  };
};

module.exports = {
  createEntry,
  getContactLedger,
  getReceivables,
  getPayables,
  getLedgerReport,
  getCashBook,
  getOpeningBalance,
  setOpeningBalance,
  getTradingLedgerRegister,
};
