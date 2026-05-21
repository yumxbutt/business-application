const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { refreshContactBalance } = require('./contact-balance.service');
const {
  PaymentTransaction,
  PaymentAccount,
  PaymentTransactionSplit,
  LedgerEntry,
  AccountHead,
  Contact,
} = require('../models');

const toNumber = (value) => Number(value || 0);

const resolveBranchId = (actor, branchIdInput) => {
  if (actor.role === 'main_admin') {
    const branchId = Number(branchIdInput || actor.branchId);
    if (!branchId) throw new Error('branchId is required for main admin');
    return branchId;
  }

  if (!actor.branchId) throw new Error('User branch is not configured');
  return Number(actor.branchId);
};

const ensureContactForVoucher = async ({ branchId, contactId, transaction }) => {
  const contact = await Contact.findOne({
    where: {
      id: Number(contactId),
      branchId: Number(branchId),
      isActive: true,
    },
    transaction,
  });

  if (!contact) throw new Error('Contact not found for selected branch');

  return contact;
};

const getRequiredHeads = async (transaction) => {
  const [cashHead, receivableHead, payableHead] = await Promise.all([
    AccountHead.findOne({ where: { code: 'AST-001' }, transaction }),
    AccountHead.findOne({ where: { code: 'AR-001' }, transaction }),
    AccountHead.findOne({ where: { code: 'AP-001' }, transaction }),
  ]);

  if (!cashHead || !receivableHead || !payableHead) {
    throw new Error('Required account heads are missing (AST-001, AR-001, AP-001)');
  }

  return { cashHead, receivableHead, payableHead };
};

const generateVoucherNo = (transactionType) => {
  const prefix = transactionType === 'receipt' ? 'CRV' : 'CPV';
  return `${prefix}-${Date.now()}`;
};

const createCashVoucher = async ({ actor, payload }) => {
  const { branchId: branchIdInput, contactId, transactionType, amount, entryDate, description, referenceNo, payments = [] } = payload;

  const branchId = resolveBranchId(actor, branchIdInput);
  const voucherAmount = toNumber(amount);

  if (!['receipt', 'payment'].includes(transactionType)) {
    throw new Error('transactionType must be receipt or payment');
  }
  if (!contactId) throw new Error('contactId is required');
  if (!entryDate) throw new Error('entryDate is required');
  if (voucherAmount <= 0) throw new Error('amount must be greater than zero');

  return sequelize.transaction(async (transaction) => {
    const [heads, contact] = await Promise.all([
      getRequiredHeads(transaction),
      ensureContactForVoucher({ branchId, contactId, transaction }),
    ]);

    const voucherNo = referenceNo?.trim() || generateVoucherNo(transactionType);

    // Resolve splits — fallback to single cash entry
    let resolvedSplits = payments.filter((p) => toNumber(p.amount) > 0);
    if (resolvedSplits.length === 0) {
      resolvedSplits = [{ paymentAccountId: null, accountHeadId: heads.cashHead.id, amount: voucherAmount }];
    }

    const accountIds = resolvedSplits.map((p) => p.paymentAccountId).filter(Boolean);
    const accountRows = accountIds.length
      ? await PaymentAccount.findAll({ where: { id: accountIds }, transaction })
      : [];
    const accountMap = new Map(accountRows.map((a) => [a.id, a]));

    const paymentTransaction = await PaymentTransaction.create(
      {
        branchId,
        contactId: Number(contactId),
        transactionType,
        amount: voucherAmount,
        entryDate,
        referenceNo: voucherNo,
        description: description?.trim() || null,
        paymentMethod: resolvedSplits.length === 1 && !resolvedSplits[0].paymentAccountId
          ? 'cash'
          : resolvedSplits.map((s) => {
              const acc = s.paymentAccountId ? accountMap.get(Number(s.paymentAccountId)) : null;
              return acc ? `${acc.accountType}:${acc.name}` : 'cash';
            }).join('; '),
        createdById: actor.id,
      },
      { transaction }
    );

    const isReceipt = transactionType === 'receipt';
    const referenceType = isReceipt ? 'payment_received' : 'payment_made';

    for (const split of resolvedSplits) {
      const acc = split.paymentAccountId ? accountMap.get(Number(split.paymentAccountId)) : null;
      const headId = acc?.accountHeadId || split.accountHeadId || heads.cashHead.id;
      const splitAmount = toNumber(split.amount);

      const ledgerRows = isReceipt
        ? [
            {
              branchId,
              contactId: null,
              accountHeadId: headId,
              entryDate,
              referenceType,
              referenceId: paymentTransaction.id,
              referenceNo: voucherNo,
              description: (description?.trim() || `Receipt voucher ${voucherNo}`) + (acc ? ` [${acc.name}]` : ''),
              debit: splitAmount,
              credit: 0,
              createdById: actor.id,
            },
            {
              branchId,
              contactId: Number(contactId),
              accountHeadId: heads.receivableHead.id,
              entryDate,
              referenceType,
              referenceId: paymentTransaction.id,
              referenceNo: voucherNo,
              description: (description?.trim() || `Receivable settlement ${voucherNo}`) + (acc ? ` [${acc.name}]` : ''),
              debit: 0,
              credit: splitAmount,
              createdById: actor.id,
            },
          ]
        : [
            {
              branchId,
              contactId: Number(contactId),
              accountHeadId: heads.payableHead.id,
              entryDate,
              referenceType,
              referenceId: paymentTransaction.id,
              referenceNo: voucherNo,
              description: (description?.trim() || `Payable settlement ${voucherNo}`) + (acc ? ` [${acc.name}]` : ''),
              debit: splitAmount,
              credit: 0,
              createdById: actor.id,
            },
            {
              branchId,
              contactId: null,
              accountHeadId: headId,
              entryDate,
              referenceType,
              referenceId: paymentTransaction.id,
              referenceNo: voucherNo,
              description: (description?.trim() || `Payment voucher ${voucherNo}`) + (acc ? ` [${acc.name}]` : ''),
              debit: 0,
              credit: splitAmount,
              createdById: actor.id,
            },
          ];

      await LedgerEntry.bulkCreate(ledgerRows, { transaction });

      if (acc) {
        await PaymentTransactionSplit.create(
          {
            paymentTransactionId: paymentTransaction.id,
            paymentAccountId: acc.id,
            accountHeadId: headId,
            amount: splitAmount,
          },
          { transaction }
        );
      }
    }

    await refreshContactBalance({ branchId, contactId: Number(contactId), transaction });

    const paymentSplits = resolvedSplits.map((s) => {
      const acc = s.paymentAccountId ? accountMap.get(Number(s.paymentAccountId)) : null;
      return {
        name: acc?.name || 'Cash',
        accountType: acc?.accountType || 'cash',
        bankName: acc?.bankName || null,
        amount: Number(s.amount),
      };
    });

    return {
      paymentTransaction,
      paymentSplits,
      contact: {
        id: contact.id,
        name: contact.name,
        recordType: contact.recordType,
      },
    };
  });
};

const listCashVouchers = async ({ actor, filters = {} }) => {
  const branchId = resolveBranchId(actor, filters.branchId);

  const where = {
    branchId,
    paymentMethod: 'cash',
  };

  if (filters.transactionType && filters.transactionType !== 'all') {
    where.transactionType = filters.transactionType;
  }

  if (filters.startDate || filters.endDate) {
    where.entryDate = {};
    if (filters.startDate) where.entryDate[Op.gte] = filters.startDate;
    if (filters.endDate) where.entryDate[Op.lte] = filters.endDate;
  }

  const rows = await PaymentTransaction.findAll({
    where,
    include: [{ model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType', 'phone'] }],
    order: [['entryDate', 'DESC'], ['id', 'DESC']],
  });

  return rows;
};

module.exports = {
  createCashVoucher,
  listCashVouchers,
};
