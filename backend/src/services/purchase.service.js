const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { refreshContactBalance } = require('./contact-balance.service');
const { stockIn, reverseStockIn } = require('./fifo.service');
const {
  Purchase,
  PurchaseItem,
  PurchaseReturn,
  PurchaseReturnItem,
  InventoryBatch,
  Product,
  Contact,
  ContactBalance,
  Branch,
  InventoryBalance,
  LedgerEntry,
  AccountHead,
  PaymentTransaction,
  PaymentAccount,
  PaymentTransactionSplit,
  ProductUnit,
  Unit,
} = require('../models');

const toNumber = (value) => Number(value || 0);
const roundMoney = (value) => Number((toNumber(value)).toFixed(2));

const parseAdditionalExpenses = (raw) => {
  const source = Array.isArray(raw)
    ? raw
    : (() => {
        if (!raw) return [];
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      })();

  const normalized = source
    .map((entry, idx) => {
      const amount = toNumber(entry?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Additional expense amount must be 0 or more');
      }
      if (amount <= 0) return null;

      const name = String(entry?.name || '').trim() || `Expense ${idx + 1}`;
      return { name, amount: Number(amount.toFixed(2)) };
    })
    .filter(Boolean);

  const total = normalized.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  return {
    rows: normalized,
    total: Number(total.toFixed(2)),
  };
};

const enrichPurchaseExpenses = (purchase) => {
  if (!purchase) return purchase;
  const parsed = parseAdditionalExpenses(purchase.additionalExpenses);
  purchase.dataValues.additionalExpenses = parsed.rows;
  purchase.dataValues.additionalExpensesTotal = toNumber(purchase.additionalExpensesTotal || parsed.total);
  return purchase;
};

const parseBranchId = (actor, branchIdInput) => {
  if (actor.role === 'main_admin') {
    const branchId = Number(branchIdInput || actor.branchId);
    if (!branchId) throw new Error('branchId is required for main admin');
    return branchId;
  }

  if (!actor.branchId) throw new Error('User branch is not configured');
  return Number(actor.branchId);
};

const ensureSupplierContact = async (branchId, contactId, transaction) => {
  const contact = await Contact.findOne({ where: { id: contactId, branchId, isActive: true }, transaction });
  if (!contact) throw new Error('Contact not found for selected branch');
  if (!['supplier', 'both'].includes(contact.recordType)) {
    throw new Error('Selected contact is not a supplier');
  }
  return contact;
};

const ensureProducts = async (items, transaction) => {
  const productIds = [...new Set(items.map((item) => Number(item.productId)))];
  const products = await Product.findAll({ where: { id: { [Op.in]: productIds }, isActive: true }, transaction });
  if (products.length !== productIds.length) {
    throw new Error('One or more selected products are invalid or inactive');
  }
  return products;
};

/**
 * Given a raw item from the request payload, look up its ProductUnit conversion
 * factor and return a resolved object with both unitQty and baseQty computed.
 * Falls back to factor = 1 when no unitId is provided or no matching ProductUnit found.
 */
const resolveItemUnit = async (item, transaction) => {
  const unitQty = toNumber(item.quantity);
  const unitPrice = toNumber(item.unitPrice);
  const salePrice = item.salePrice != null ? toNumber(item.salePrice) : null;
  const unitId = item.unitId ? Number(item.unitId) : null;

  let conversionFactor = 1;
  if (unitId) {
    const pu = await ProductUnit.findOne({
      where: { productId: Number(item.productId), unitId },
      transaction,
    });
    if (pu) conversionFactor = toNumber(pu.conversionFactor) || 1;
  }

  const baseQty = unitQty * conversionFactor;
  const lineAmount = unitQty * unitPrice;
  const fifoUnitCost = conversionFactor > 0 ? unitPrice / conversionFactor : unitPrice;

  return {
    productId: Number(item.productId),
    unitId,
    unitQty,
    unitPrice,
    salePrice,
    conversionFactor,
    baseQty,
    lineAmount,
    fifoUnitCost,
    notes: item.notes || null,
  };
};

const computeTotals = (items, discount = 0, paidAmount = 0, additionalExpensesTotal = 0) => {
  const subTotalRaw = items.reduce((sum, item) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    return sum + quantity * unitPrice;
  }, 0);

  const subTotal = roundMoney(subTotalRaw);
  const safeDiscount = roundMoney(discount);
  const safePaid = roundMoney(paidAmount);
  const safeAdditionalExpensesTotal = roundMoney(additionalExpensesTotal);
  const totalAmount = roundMoney(subTotal + safeAdditionalExpensesTotal - safeDiscount);
  const dueAmount = roundMoney(totalAmount - safePaid);

  if (totalAmount < 0) throw new Error('Discount cannot exceed subtotal plus additional expenses');
  if (safePaid > totalAmount) throw new Error('Paid amount cannot exceed total amount');

  return {
    subTotal,
    discount: safeDiscount,
    additionalExpensesTotal: safeAdditionalExpensesTotal,
    totalAmount,
    paidAmount: safePaid,
    dueAmount,
  };
};

const normalizePaymentSplits = (payments = [], paidAmount = 0, cashHeadId = null) => {
  const expected = roundMoney(paidAmount);
  let splits = (Array.isArray(payments) ? payments : [])
    .map((p) => ({
      ...p,
      amount: roundMoney(p.amount),
    }))
    .filter((p) => p.amount > 0);

  if (expected <= 0) return [];

  if (splits.length === 0) {
    return [{ paymentAccountId: null, accountHeadId: cashHeadId, amount: expected }];
  }

  const currentTotal = roundMoney(splits.reduce((sum, p) => sum + p.amount, 0));
  const diff = roundMoney(expected - currentTotal);

  if (Math.abs(diff) >= 0.01) {
    const targetIndex = splits.length - 1;
    const adjusted = roundMoney(splits[targetIndex].amount + diff);
    if (adjusted <= 0) {
      throw new Error('Payment split total must match paid amount exactly');
    }
    splits[targetIndex] = { ...splits[targetIndex], amount: adjusted };
  }

  const normalizedTotal = roundMoney(splits.reduce((sum, p) => sum + p.amount, 0));
  if (normalizedTotal !== expected) {
    throw new Error('Payment split total must match paid amount exactly');
  }

  return splits;
};

const listPurchases = async ({ branchId, filters = {} }) => {
  const whereClause = {};

  if (branchId) {
    whereClause.branchId = Number(branchId);
  }

  if (filters.search) {
    whereClause.billNo = { [Op.like]: `%${filters.search}%` };
  }

  if (filters.status && filters.status !== 'all') {
    whereClause.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    whereClause.purchaseDate = {};
    if (filters.startDate) whereClause.purchaseDate[Op.gte] = filters.startDate;
    if (filters.endDate) whereClause.purchaseDate[Op.lte] = filters.endDate;
  }

  return Purchase.findAll({
    where: whereClause,
    include: [{ model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType'] }],
    order: [['purchaseDate', 'DESC'], ['id', 'DESC']],
  });
};

const getPurchase = async ({ purchaseId, actor }) => {
  const purchase = await Purchase.findByPk(purchaseId, {
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType'] },
      {
        model: PurchaseItem,
        as: 'items',
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: InventoryBatch, as: 'batch', attributes: ['id', 'quantityReceived', 'quantityRemaining', 'costPrice', 'salePrice'] },
        ],
      },
    ],
  });

  if (!purchase) throw new Error('Purchase not found');

  if (actor.role !== 'main_admin' && Number(purchase.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to view this purchase');
  }

  // Attach payment splits for print display
  const paymentTxns = await PaymentTransaction.findAll({
    where: { referenceNo: purchase.billNo, branchId: purchase.branchId, transactionType: 'payment' },
    include: [{
      model: PaymentTransactionSplit,
      as: 'splits',
      include: [{ model: PaymentAccount, as: 'paymentAccount', attributes: ['id', 'name', 'accountType', 'bankName'] }],
    }],
  });
  purchase.dataValues.paymentSplits = paymentTxns.flatMap((txn) =>
    (txn.splits || []).map((s) => ({
      name: s.paymentAccount?.name || 'Cash',
      accountType: s.paymentAccount?.accountType || 'cash',
      bankName: s.paymentAccount?.bankName || null,
      amount: Number(s.amount),
    }))
  );

  // Attach contact balance (payable after this purchase)
  const contactBal = await ContactBalance.findOne({
    where: { branchId: purchase.branchId, contactId: purchase.contactId },
  });
  purchase.dataValues.contactBalance = contactBal ? Number(contactBal.payableBalance || 0) : null;

  return enrichPurchaseExpenses(purchase);
};

const getPurchaseReturn = async ({ returnId, actor }) => {
  const purchaseReturn = await PurchaseReturn.findByPk(returnId, {
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: Purchase, as: 'purchase', attributes: ['id', 'billNo', 'purchaseDate'] },
      {
        model: PurchaseReturnItem,
        as: 'items',
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] },
          {
            model: PurchaseItem,
            as: 'purchaseItem',
            attributes: ['id', 'quantity', 'unitPrice', 'salePrice'],
          },
        ],
      },
    ],
  });

  if (!purchaseReturn) throw new Error('Purchase return not found');

  if (actor.role !== 'main_admin' && Number(purchaseReturn.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to view this purchase return');
  }

  // Attach contact balance for print display
  const contactBal = await ContactBalance.findOne({
    where: { branchId: purchaseReturn.branchId, contactId: purchaseReturn.contactId },
  });
  purchaseReturn.dataValues.contactBalance = contactBal ? Number(contactBal.payableBalance || 0) : null;

  return purchaseReturn;
};

const postLedgerForPurchase = async ({
  branchId,
  contactId,
  purchase,
  payments = [],
  createdById,
  transaction,
}) => {
  const expenseHead = await AccountHead.findOne({ where: { code: 'EXP-001' }, transaction });
  const payableHead = await AccountHead.findOne({ where: { code: 'AP-001' }, transaction });
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' }, transaction });

  if (!expenseHead || !payableHead || !cashHead) {
    throw new Error('Required account heads are missing (EXP-001, AP-001, AST-001)');
  }

  await LedgerEntry.bulkCreate(
    [
      {
        branchId,
        contactId: null,
        accountHeadId: expenseHead.id,
        entryDate: purchase.purchaseDate,
        referenceType: 'purchase',
        referenceId: purchase.id,
        referenceNo: purchase.billNo,
        description: `Purchase bill ${purchase.billNo}`,
        debit: purchase.totalAmount,
        credit: 0,
        createdById,
      },
      {
        branchId,
        contactId,
        accountHeadId: payableHead.id,
        entryDate: purchase.purchaseDate,
        referenceType: 'purchase',
        referenceId: purchase.id,
        referenceNo: purchase.billNo,
        description: `Payable for bill ${purchase.billNo}`,
        debit: 0,
        credit: purchase.totalAmount,
        createdById,
      },
    ],
    { transaction }
  );

  if (toNumber(purchase.paidAmount) > 0) {
    const paymentReferenceNo = `${purchase.billNo}-PMT`;

    // Resolve payment splits — fallback to single cash entry if none provided
    const resolvedSplits = normalizePaymentSplits(payments, purchase.paidAmount, cashHead.id);

    const accountIds = resolvedSplits.map((p) => p.paymentAccountId).filter(Boolean);
    const accountRows = accountIds.length
      ? await PaymentAccount.findAll({ where: { id: accountIds }, transaction })
      : [];
    const accountMap = new Map(accountRows.map((a) => [a.id, a]));

    const paymentTxn = await PaymentTransaction.create(
      {
        branchId,
        contactId,
        transactionType: 'payment',
        amount: purchase.paidAmount,
        entryDate: purchase.purchaseDate,
        referenceNo: paymentReferenceNo,
        description: `Payment against bill ${purchase.billNo}`,
        paymentMethod: resolvedSplits.length === 1 && !resolvedSplits[0].paymentAccountId
          ? 'cash'
          : resolvedSplits.map((s) => {
              const acc = s.paymentAccountId ? accountMap.get(Number(s.paymentAccountId)) : null;
              return acc ? `${acc.accountType}:${acc.name}` : 'cash';
            }).join('; '),
        createdById,
      },
      { transaction }
    );

    for (const split of resolvedSplits) {
      const acc = split.paymentAccountId ? accountMap.get(Number(split.paymentAccountId)) : null;
      const headId = acc?.accountHeadId || split.accountHeadId || cashHead.id;
      const splitAmount = roundMoney(split.amount);

      await LedgerEntry.bulkCreate(
        [
          {
            branchId,
            contactId,
            accountHeadId: payableHead.id,
            entryDate: purchase.purchaseDate,
            referenceType: 'payment_made',
            referenceId: paymentTxn.id,
            referenceNo: paymentReferenceNo,
            description: acc
              ? `Payable settled (${acc.name}) for bill ${purchase.billNo}`
              : `Payable settled for bill ${purchase.billNo}`,
            debit: splitAmount,
            credit: 0,
            createdById,
          },
          {
            branchId,
            contactId: null,
            accountHeadId: headId,
            entryDate: purchase.purchaseDate,
            referenceType: 'payment_made',
            referenceId: paymentTxn.id,
            referenceNo: paymentReferenceNo,
            description: acc
              ? `Payment (${acc.name}) for bill ${purchase.billNo}`
              : `Cash payment for bill ${purchase.billNo}`,
            debit: 0,
            credit: splitAmount,
            createdById,
          },
        ],
        { transaction }
      );

      if (acc) {
        await PaymentTransactionSplit.create(
          {
            paymentTransactionId: paymentTxn.id,
            paymentAccountId: acc.id,
            accountHeadId: headId,
            amount: splitAmount,
          },
          { transaction }
        );
      }
    }
  }

  await refreshContactBalance({
    branchId,
    contactId,
    transaction,
  });
};

const clearPurchaseLedgerAndPayments = async ({ purchase, transaction }) => {
  const paymentReferenceNo = `${purchase.billNo}-PMT`;

  await LedgerEntry.destroy({
    where: {
      branchId: purchase.branchId,
      [Op.or]: [
        { referenceType: 'purchase', referenceId: purchase.id },
        { referenceType: 'payment_made', referenceNo: paymentReferenceNo },
      ],
    },
    transaction,
  });

  await PaymentTransaction.destroy({
    where: {
      branchId: purchase.branchId,
      referenceNo: paymentReferenceNo,
    },
    transaction,
  });

  await refreshContactBalance({
    branchId: purchase.branchId,
    contactId: purchase.contactId,
    transaction,
  });
};

const applyInventoryDelta = async ({ branchId, itemDeltas, transaction }) => {
  for (const [productId, deltaQty] of itemDeltas.entries()) {
    if (!deltaQty) continue;

    const [inventoryBalance] = await InventoryBalance.findOrCreate({
      where: { branchId, productId: Number(productId) },
      defaults: { branchId, productId: Number(productId), quantity: 0 },
      transaction,
    });

    const nextQty = toNumber(inventoryBalance.quantity) + toNumber(deltaQty);
    if (nextQty < 0) {
      throw new Error(`Insufficient stock to apply adjustment for product ${productId}`);
    }

    inventoryBalance.quantity = nextQty;
    await inventoryBalance.save({ transaction });
  }
};

const createPurchase = async ({ payload, actor }) => {
  const {
    branchId: branchIdInput,
    contactId,
    billNo,
    purchaseDate,
    discount = 0,
    paidAmount = 0,
    additionalExpenses = [],
    payments = [],
    items = [],
  } = payload;

  const branchId = parseBranchId(actor, branchIdInput);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one purchase item is required');
  }

  const txn = await sequelize.transaction();
  try {
    await ensureSupplierContact(branchId, Number(contactId), txn);
    await ensureProducts(items, txn);

    const duplicate = await Purchase.findOne({ where: { branchId, billNo }, transaction: txn });
    if (duplicate) throw new Error('Bill number already exists for this branch');

    const additionalExpenseMeta = parseAdditionalExpenses(additionalExpenses);
    const totals = computeTotals(items, discount, paidAmount, additionalExpenseMeta.total);

    const purchase = await Purchase.create(
      {
        branchId,
        contactId: Number(contactId),
        billNo: String(billNo).trim(),
        purchaseDate,
        subTotal: totals.subTotal,
        discount: totals.discount,
        additionalExpensesTotal: totals.additionalExpensesTotal,
        additionalExpenses: JSON.stringify(additionalExpenseMeta.rows),
        totalAmount: totals.totalAmount,
        paidAmount: totals.paidAmount,
        dueAmount: totals.dueAmount,
        status: 'posted',
        createdById: actor.id,
      },
      { transaction: txn }
    );

    for (const item of items) {
      const resolved = await resolveItemUnit(item, txn);
      const { productId, unitId, unitQty, unitPrice, salePrice, conversionFactor, baseQty, lineAmount, fifoUnitCost, notes } = resolved;

      const purchaseItem = await PurchaseItem.create(
        {
          purchaseId: purchase.id,
          productId,
          quantity: baseQty,        // stored in base units for backward compat
          unitPrice,
          salePrice,
          lineAmount,
          notes,
          unitId,
          unitQty,
          conversionFactor,
          baseQty,
        },
        { transaction: txn }
      );

      // FIFO: record stock in batch (base qty, cost per base unit)
      const batchId = await stockIn(
        {
          branchId,
          productId,
          purchaseId: purchase.id,
          purchaseItemId: purchaseItem.id,
          qty: baseQty,
          costPrice: fifoUnitCost,
          salePrice,
          receivedDate: purchaseDate,
        },
        txn
      );

      // Link item to its batch
      purchaseItem.batchId = batchId;
      await purchaseItem.save({ transaction: txn });

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId, productId },
        defaults: { branchId, productId, quantity: 0 },
        transaction: txn,
      });

      inventoryBalance.quantity = toNumber(inventoryBalance.quantity) + baseQty;
      await inventoryBalance.save({ transaction: txn });
    }

    await postLedgerForPurchase({
      branchId,
      contactId: Number(contactId),
      purchase,
      payments,
      createdById: actor.id,
      transaction: txn,
    });

    await txn.commit();

    return getPurchase({ purchaseId: purchase.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const listPurchaseReturns = async ({ branchId, filters = {} }) => {
  const whereClause = {};

  if (branchId) {
    whereClause.branchId = Number(branchId);
  }

  if (filters.purchaseId) {
    whereClause.purchaseIdReference = Number(filters.purchaseId);
  }

  if (filters.startDate || filters.endDate) {
    whereClause.returnDate = {};
    if (filters.startDate) whereClause.returnDate[Op.gte] = filters.startDate;
    if (filters.endDate) whereClause.returnDate[Op.lte] = filters.endDate;
  }

  return PurchaseReturn.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: Purchase, as: 'purchase', attributes: ['id', 'billNo', 'purchaseDate'] },
      { model: PurchaseReturnItem, as: 'items', attributes: ['id', 'purchaseItemId', 'productId', 'quantity', 'unitPrice', 'salePrice', 'lineAmount'] },
    ],
    order: [['returnDate', 'DESC'], ['id', 'DESC']],
  });
};

const createPurchaseReturn = async ({ payload, actor }) => {
  const {
    branchId: branchIdInput,
    purchaseIdReference,
    returnDate,
    reason,
    items = [],
  } = payload;

  const branchId = parseBranchId(actor, branchIdInput);

  if (!purchaseIdReference) throw new Error('purchaseIdReference is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one return item is required');

  const txn = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: { id: Number(purchaseIdReference), branchId },
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: txn,
    });

    if (!purchase) throw new Error('Purchase not found');
    if (purchase.status === 'cancelled') throw new Error('Cannot return a cancelled purchase');

    // Build map of original purchase items for quantity validation
    const itemMap = new Map();
    for (const pi of purchase.items) {
      itemMap.set(pi.id, pi);
    }

    // Calculate already-returned quantities per purchase item
    const alreadyReturnedRows = await PurchaseReturnItem.findAll({
      include: [{
        model: PurchaseReturn,
        as: 'purchaseReturn',
        where: { branchId, purchaseIdReference: purchase.id },
        attributes: [],
      }],
      transaction: txn,
    });

    const alreadyReturnedQtyMap = new Map();
    for (const row of alreadyReturnedRows) {
      const key = row.purchaseItemId;
      alreadyReturnedQtyMap.set(key, (alreadyReturnedQtyMap.get(key) || 0) + toNumber(row.quantity));
    }

    // Pre-resolve unit conversions for return items and validate quantities
    const resolvedReturnItems = [];
    let totalReturnAmount = 0;

    for (const ri of items) {
      const originalItem = itemMap.get(Number(ri.purchaseItemId));
      if (!originalItem) throw new Error(`Purchase item ${ri.purchaseItemId} does not belong to this purchase`);

      // Resolve return unit
      const returnQty = toNumber(ri.quantity);
      const unitId = ri.unitId ? Number(ri.unitId) : null;
      let conversionFactor = 1;
      if (unitId) {
        const pu = await ProductUnit.findOne({
          where: { productId: originalItem.productId, unitId },
          transaction: txn,
        });
        if (pu) conversionFactor = toNumber(pu.conversionFactor) || 1;
      }
      const returnBaseQty = returnQty * conversionFactor;

      const alreadyReturned = alreadyReturnedQtyMap.get(Number(ri.purchaseItemId)) || 0;
      // maxReturnable is in base units (originalItem.quantity is stored as baseQty)
      const maxReturnable = toNumber(originalItem.quantity) - alreadyReturned;

      if (returnQty <= 0) throw new Error(`Return quantity must be greater than 0 for item ${ri.purchaseItemId}`);
      if (returnBaseQty > maxReturnable + 0.00001) {
        throw new Error(`Return quantity ${returnQty} exceeds returnable quantity for item ${ri.purchaseItemId}`);
      }

      const unitPrice = toNumber(ri.unitPrice || originalItem.unitPrice);
      const salePrice = ri.salePrice != null ? toNumber(ri.salePrice) : toNumber(originalItem.salePrice);
      const lineAmount = returnQty * unitPrice;
      totalReturnAmount += lineAmount;

      resolvedReturnItems.push({ originalItem, returnQty, returnBaseQty, unitId, conversionFactor, unitPrice, salePrice, lineAmount, notes: ri.notes || null });
    }

    if (totalReturnAmount <= 0) throw new Error('Total return amount must be greater than 0');

    const purchaseReturn = await PurchaseReturn.create(
      {
        branchId,
        purchaseIdReference: purchase.id,
        contactId: purchase.contactId,
        returnDate,
        totalAmount: totalReturnAmount,
        reason: reason || null,
        createdById: actor.id,
      },
      { transaction: txn }
    );

    // Create return items + reverse FIFO batches + update inventory balance
    for (const { originalItem, returnQty, returnBaseQty, unitId, conversionFactor, unitPrice, salePrice, lineAmount, notes } of resolvedReturnItems) {
      await PurchaseReturnItem.create(
        {
          purchaseReturnId: purchaseReturn.id,
          purchaseItemId: originalItem.id,
          productId: originalItem.productId,
          quantity: returnBaseQty,        // stored in base units for compat
          unitPrice,
          salePrice,
          lineAmount,
          notes,
          unitId,
          unitQty: returnQty,
          conversionFactor,
          baseQty: returnBaseQty,
        },
        { transaction: txn }
      );

      // Reverse FIFO batch (partial, in base units)
      if (originalItem.batchId) {
        await reverseStockIn(originalItem.batchId, returnBaseQty, txn);
      }

      // Decrement inventory balance (in base units)
      const inventoryBalance = await InventoryBalance.findOne({
        where: { branchId, productId: originalItem.productId },
        transaction: txn,
      });
      if (inventoryBalance) {
        const nextQty = Math.max(0, toNumber(inventoryBalance.quantity) - returnBaseQty);
        inventoryBalance.quantity = nextQty;
        await inventoryBalance.save({ transaction: txn });
      }
    }

    const payableHead = await AccountHead.findOne({ where: { code: 'AP-001' }, transaction: txn });
    const expenseHead = await AccountHead.findOne({ where: { code: 'EXP-001' }, transaction: txn });

    if (!payableHead || !expenseHead) {
      throw new Error('Required account heads are missing (AP-001, EXP-001)');
    }

    const refNo = `${purchase.billNo}-RET-${purchaseReturn.id}`;
    await LedgerEntry.bulkCreate(
      [
        {
          branchId,
          contactId: purchase.contactId,
          accountHeadId: payableHead.id,
          entryDate: returnDate,
          referenceType: 'purchase_return',
          referenceId: purchaseReturn.id,
          referenceNo: refNo,
          description: `Purchase return against ${purchase.billNo}`,
          debit: totalReturnAmount,
          credit: 0,
          createdById: actor.id,
        },
        {
          branchId,
          contactId: null,
          accountHeadId: expenseHead.id,
          entryDate: returnDate,
          referenceType: 'purchase_return',
          referenceId: purchaseReturn.id,
          referenceNo: refNo,
          description: `Purchase return expense reversal for ${purchase.billNo}`,
          debit: 0,
          credit: totalReturnAmount,
          createdById: actor.id,
        },
      ],
      { transaction: txn }
    );

    await refreshContactBalance({
      branchId,
      contactId: purchase.contactId,
      transaction: txn,
    });

    purchase.dueAmount = Math.max(0, toNumber(purchase.dueAmount) - totalReturnAmount);
    await purchase.save({ transaction: txn });

    await txn.commit();
    return getPurchaseReturn({ returnId: purchaseReturn.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const updatePurchase = async ({ purchaseId, payload, actor }) => {
  const {
    contactId,
    billNo,
    purchaseDate,
    discount = 0,
    paidAmount = 0,
    additionalExpenses = [],
    payments = [],
    items = [],
  } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one purchase item is required');
  }

  const txn = await sequelize.transaction();
  try {
    const purchase = await Purchase.findByPk(Number(purchaseId), {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: txn,
    });

    if (!purchase) throw new Error('Purchase not found');

    const branchId = parseBranchId(actor, purchase.branchId);
    if (Number(branchId) !== Number(purchase.branchId)) {
      throw new Error('Not allowed to update this purchase');
    }

    const returnCount = await PurchaseReturn.count({
      where: { branchId: purchase.branchId, purchaseIdReference: purchase.id },
      transaction: txn,
    });
    if (returnCount > 0) {
      throw new Error('Cannot update purchase after returns are recorded');
    }

    const effectiveBillNo = String(billNo || purchase.billNo).trim();
    const effectiveContactId = Number(contactId || purchase.contactId);
    const effectiveDate = purchaseDate || purchase.purchaseDate;

    await ensureSupplierContact(purchase.branchId, effectiveContactId, txn);
    await ensureProducts(items, txn);

    const duplicate = await Purchase.findOne({
      where: {
        branchId: purchase.branchId,
        billNo: effectiveBillNo,
        id: { [Op.ne]: purchase.id },
      },
      transaction: txn,
    });
    if (duplicate) throw new Error('Bill number already exists for this branch');

    const additionalExpenseMeta = parseAdditionalExpenses(additionalExpenses);
    const totals = computeTotals(items, discount, paidAmount, additionalExpenseMeta.total);

    // Pre-resolve unit conversion for all new items (async, so must be done before delta calc)
    const resolvedNewItems = await Promise.all(items.map((item) => resolveItemUnit(item, txn)));

    const oldItemQtyMap = new Map();
    for (const oldItem of purchase.items || []) {
      const key = Number(oldItem.productId);
      // oldItem.quantity is stored as baseQty
      oldItemQtyMap.set(key, (oldItemQtyMap.get(key) || 0) + toNumber(oldItem.quantity));
    }

    const newItemQtyMap = new Map();
    for (const resolved of resolvedNewItems) {
      const key = resolved.productId;
      newItemQtyMap.set(key, (newItemQtyMap.get(key) || 0) + resolved.baseQty);
    }

    const allProductIds = new Set([...oldItemQtyMap.keys(), ...newItemQtyMap.keys()]);
    const itemDeltas = new Map();
    for (const productId of allProductIds) {
      const delta = (newItemQtyMap.get(productId) || 0) - (oldItemQtyMap.get(productId) || 0);
      itemDeltas.set(productId, delta);
    }

    await applyInventoryDelta({
      branchId: purchase.branchId,
      itemDeltas,
      transaction: txn,
    });

    // Reverse all existing FIFO batches for this purchase before re-creating items
    const oldBatches = await InventoryBatch.findAll({ where: { purchaseId: purchase.id }, transaction: txn });
    for (const batch of oldBatches) {
      await reverseStockIn(batch.id, toNumber(batch.quantityReceived), txn);
    }
    await InventoryBatch.destroy({ where: { purchaseId: purchase.id }, transaction: txn });

    await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction: txn });

    for (const resolved of resolvedNewItems) {
      const { productId, unitId, unitQty, unitPrice, salePrice, conversionFactor, baseQty, lineAmount, fifoUnitCost, notes } = resolved;

      const purchaseItem = await PurchaseItem.create(
        {
          purchaseId: purchase.id,
          productId,
          quantity: baseQty,
          unitPrice,
          salePrice,
          lineAmount,
          notes,
          unitId,
          unitQty,
          conversionFactor,
          baseQty,
        },
        { transaction: txn }
      );

      const batchId = await stockIn(
        {
          branchId: purchase.branchId,
          productId,
          purchaseId: purchase.id,
          purchaseItemId: purchaseItem.id,
          qty: baseQty,
          costPrice: fifoUnitCost,
          salePrice,
          receivedDate: effectiveDate,
        },
        txn
      );

      purchaseItem.batchId = batchId;
      await purchaseItem.save({ transaction: txn });
    }

    await clearPurchaseLedgerAndPayments({ purchase, transaction: txn });

    purchase.contactId = effectiveContactId;
    purchase.billNo = effectiveBillNo;
    purchase.purchaseDate = effectiveDate;
    purchase.subTotal = totals.subTotal;
    purchase.discount = totals.discount;
    purchase.additionalExpensesTotal = totals.additionalExpensesTotal;
    purchase.additionalExpenses = JSON.stringify(additionalExpenseMeta.rows);
    purchase.totalAmount = totals.totalAmount;
    purchase.paidAmount = totals.paidAmount;
    purchase.dueAmount = totals.dueAmount;
    purchase.status = 'posted';
    await purchase.save({ transaction: txn });

    await postLedgerForPurchase({
      branchId: purchase.branchId,
      contactId: effectiveContactId,
      purchase,
      payments,
      createdById: actor.id,
      transaction: txn,
    });

    await txn.commit();
    return getPurchase({ purchaseId: purchase.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const cancelPurchase = async ({ purchaseId, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const purchase = await Purchase.findByPk(Number(purchaseId), {
      include: [{ model: PurchaseItem, as: 'items' }],
      transaction: txn,
    });

    if (!purchase) throw new Error('Purchase not found');

    const branchId = parseBranchId(actor, purchase.branchId);
    if (Number(branchId) !== Number(purchase.branchId)) {
      throw new Error('Not allowed to cancel this purchase');
    }

    if (purchase.status === 'cancelled') {
      throw new Error('Purchase is already cancelled');
    }

    const returnCount = await PurchaseReturn.count({
      where: { branchId: purchase.branchId, purchaseIdReference: purchase.id },
      transaction: txn,
    });
    if (returnCount > 0) {
      throw new Error('Cannot cancel purchase after returns are recorded');
    }

    const reverseDeltas = new Map();
    for (const item of purchase.items || []) {
      const key = Number(item.productId);
      reverseDeltas.set(key, (reverseDeltas.get(key) || 0) - toNumber(item.quantity));
    }

    await applyInventoryDelta({
      branchId: purchase.branchId,
      itemDeltas: reverseDeltas,
      transaction: txn,
    });

    // Reverse all FIFO batches
    const batches = await InventoryBatch.findAll({ where: { purchaseId: purchase.id }, transaction: txn });
    for (const batch of batches) {
      await reverseStockIn(batch.id, toNumber(batch.quantityReceived), txn);
    }
    await InventoryBatch.destroy({ where: { purchaseId: purchase.id }, transaction: txn });

    await clearPurchaseLedgerAndPayments({ purchase, transaction: txn });

    purchase.status = 'cancelled';
    await purchase.save({ transaction: txn });

    await txn.commit();
    return purchase;
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const cancelPurchaseReturn = async ({ returnId, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const purchaseReturn = await PurchaseReturn.findByPk(returnId, {
      include: [{ model: PurchaseReturnItem, as: 'items' }],
      transaction: txn,
    });
    if (!purchaseReturn) throw new Error('Purchase return not found');

    const branchId = purchaseReturn.branchId;
    if (actor.role !== 'main_admin' && Number(actor.branchId) !== Number(branchId)) {
      throw new Error('Not allowed to cancel this return');
    }

    const purchase = await Purchase.findByPk(purchaseReturn.purchaseIdReference, { transaction: txn });
    if (!purchase) throw new Error('Original purchase not found');

    for (const item of purchaseReturn.items) {
      const baseQty = toNumber(item.baseQty || item.quantity);

      // Restore inventory balance
      const inventoryBalance = await InventoryBalance.findOne({
        where: { branchId, productId: item.productId },
        transaction: txn,
      });
      if (inventoryBalance) {
        inventoryBalance.quantity = toNumber(inventoryBalance.quantity) + baseQty;
        await inventoryBalance.save({ transaction: txn });
      }

      // Restore FIFO batch (undo the reverseStockIn that was applied on return creation)
      const originalPurchaseItem = await PurchaseItem.findByPk(item.purchaseItemId, { transaction: txn });
      if (originalPurchaseItem && originalPurchaseItem.batchId) {
        const batch = await InventoryBatch.findByPk(originalPurchaseItem.batchId, {
          transaction: txn,
          lock: txn.LOCK.UPDATE,
        });
        if (batch) {
          batch.quantityRemaining = toNumber(batch.quantityRemaining) + baseQty;
          await batch.save({ transaction: txn });
        }
      }
    }

    // Delete ledger entries for this return
    await LedgerEntry.destroy({
      where: { referenceType: 'purchase_return', referenceId: returnId },
      transaction: txn,
    });

    // Restore purchase due amount
    purchase.dueAmount = toNumber(purchase.dueAmount) + toNumber(purchaseReturn.totalAmount);
    await purchase.save({ transaction: txn });

    // Refresh contact balance
    await refreshContactBalance({
      branchId,
      contactId: purchaseReturn.contactId,
      transaction: txn,
    });

    // Hard-delete return items then the return record
    await PurchaseReturnItem.destroy({ where: { purchaseReturnId: returnId }, transaction: txn });
    await PurchaseReturn.destroy({ where: { id: returnId }, transaction: txn });

    await txn.commit();
    return { success: true, id: returnId };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const updatePurchaseReturn = async ({ returnId, payload, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const purchaseReturn = await PurchaseReturn.findByPk(returnId, { transaction: txn });
    if (!purchaseReturn) throw new Error('Purchase return not found');

    if (actor.role !== 'main_admin' && Number(actor.branchId) !== Number(purchaseReturn.branchId)) {
      throw new Error('Not allowed to update this return');
    }

    if (payload.returnDate) {
      purchaseReturn.returnDate = payload.returnDate;

      // Keep ledger entry timeline aligned with the return header date.
      await LedgerEntry.update(
        { entryDate: payload.returnDate },
        {
          where: { referenceType: 'purchase_return', referenceId: returnId },
          transaction: txn,
        }
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'reason')) {
      purchaseReturn.reason = payload.reason || null;
    }

    await purchaseReturn.save({ transaction: txn });
    await txn.commit();
    return getPurchaseReturn({ returnId, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

module.exports = {
  listPurchases,
  getPurchase,
  getPurchaseReturn,
  createPurchase,
  listPurchaseReturns,
  createPurchaseReturn,
  cancelPurchaseReturn,
  updatePurchaseReturn,
  updatePurchase,
  cancelPurchase,
};
