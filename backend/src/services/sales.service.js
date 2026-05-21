const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { refreshContactBalance } = require('./contact-balance.service');
const { stockOut, reverseStockOut, consumeStockOutAllocations } = require('./fifo.service');
const {
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  SaleItemBatch,
  SaleReturnItemBatch,
  InventoryBatch,
  Branch,
  Product,
  Contact,
  ContactBalance,
  InventoryBalance,
  LedgerEntry,
  AccountHead,
  PaymentTransaction,
  PaymentAccount,
  PaymentTransactionSplit,
  Unit,
} = require('../models');

const toNumber = (value) => Number(value || 0);

const parseBranchId = (actor, branchIdInput) => {
  if (actor.role === 'main_admin') {
    const branchId = Number(branchIdInput || actor.branchId);
    if (!branchId) throw new Error('branchId is required for main admin');
    return branchId;
  }

  if (!actor.branchId) throw new Error('User branch is not configured');
  return Number(actor.branchId);
};

const ensureCustomerContact = async (branchId, contactId, transaction) => {
  const contact = await Contact.findOne({ where: { id: contactId, branchId, isActive: true }, transaction });
  if (!contact) throw new Error('Contact not found for selected branch');
  if (!['customer', 'both'].includes(contact.recordType)) {
    throw new Error('Selected contact is not a customer');
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

const computeTotals = (items, discount = 0, paidAmount = 0) => {
  const subTotal = items.reduce((sum, item) => {
    // If payload includes unitQty, treat unitPrice as "price in selected unit".
    // Otherwise, keep legacy meaning: quantity/unitPrice are already in base units.
    const unitQty = item.unitQty != null ? toNumber(item.unitQty) : null;
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    return sum + (unitQty != null ? unitQty * unitPrice : quantity * unitPrice);
  }, 0);

  const safeDiscount = toNumber(discount);
  const safePaid = toNumber(paidAmount);
  const totalAmount = subTotal - safeDiscount;
  const dueAmount = totalAmount - safePaid;

  if (totalAmount < 0) throw new Error('Discount cannot exceed subtotal');
  if (safePaid > totalAmount) throw new Error('Paid amount cannot exceed total amount');

  return { subTotal, discount: safeDiscount, totalAmount, paidAmount: safePaid, dueAmount };
};

const listSales = async ({ branchId, filters = {} }) => {
  const whereClause = {};

  if (branchId) whereClause.branchId = Number(branchId);

  if (filters.search) {
    whereClause.invoiceNo = { [Op.like]: `%${filters.search}%` };
  }

  if (filters.status && filters.status !== 'all') {
    whereClause.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    whereClause.saleDate = {};
    if (filters.startDate) whereClause.saleDate[Op.gte] = filters.startDate;
    if (filters.endDate) whereClause.saleDate[Op.lte] = filters.endDate;
  }

  return Sale.findAll({
    where: whereClause,
    include: [{ model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType'] }],
    order: [['saleDate', 'DESC'], ['id', 'DESC']],
  });
};

const getSale = async ({ saleId, actor }) => {
  const sale = await Sale.findByPk(saleId, {
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name', 'recordType'] },
      {
        model: SaleItem,
        as: 'items',
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: Branch, as: 'sourceBranch', attributes: ['id', 'name', 'code'] },
          { model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] },
        ],
      },
    ],
  });

  if (!sale) throw new Error('Sale not found');

  if (actor.role !== 'main_admin' && Number(sale.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to view this sale');
  }

  // Attach payment splits for print display
  const paymentTxns = await PaymentTransaction.findAll({
    where: { referenceNo: sale.invoiceNo, branchId: sale.branchId, transactionType: 'receipt' },
    include: [{
      model: PaymentTransactionSplit,
      as: 'splits',
      include: [{ model: PaymentAccount, as: 'paymentAccount', attributes: ['id', 'name', 'accountType', 'bankName'] }],
    }],
  });
  sale.dataValues.paymentSplits = paymentTxns.flatMap((txn) =>
    (txn.splits || []).map((s) => ({
      name: s.paymentAccount?.name || 'Cash',
      accountType: s.paymentAccount?.accountType || 'cash',
      bankName: s.paymentAccount?.bankName || null,
      amount: Number(s.amount),
    }))
  );

  // Attach contact balance (receivable after this sale)
  const contactBal = await ContactBalance.findOne({
    where: { branchId: sale.branchId, contactId: sale.contactId },
  });
  sale.dataValues.contactBalance = contactBal ? Number(contactBal.receivableBalance || 0) : null;

  return sale;
};

const listSaleReturns = async ({ branchId, filters = {} }) => {
  const whereClause = {};

  if (branchId) whereClause.branchId = Number(branchId);

  if (filters.saleId) {
    whereClause.saleIdReference = Number(filters.saleId);
  }

  if (filters.startDate || filters.endDate) {
    whereClause.returnDate = {};
    if (filters.startDate) whereClause.returnDate[Op.gte] = filters.startDate;
    if (filters.endDate) whereClause.returnDate[Op.lte] = filters.endDate;
  }

  return SaleReturn.findAll({
    where: whereClause,
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: Sale, as: 'sale', attributes: ['id', 'invoiceNo', 'saleDate'] },
      { model: SaleReturnItem, as: 'items', attributes: ['id', 'saleItemId', 'productId', 'quantity', 'unitPrice', 'lineAmount'] },
    ],
    order: [['returnDate', 'DESC'], ['id', 'DESC']],
  });
};

const getSaleReturn = async ({ returnId, actor }) => {
  const saleReturn = await SaleReturn.findByPk(returnId, {
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'name'] },
      { model: Sale, as: 'sale', attributes: ['id', 'invoiceNo', 'saleDate'] },
      {
        model: SaleReturnItem,
        as: 'items',
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          {
            model: SaleItem,
            as: 'saleItem',
            attributes: ['id', 'quantity', 'unitQty', 'unitId', 'conversionFactor', 'unitPrice'],
            include: [
              { model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] },
            ],
          },
        ],
      },
    ],
  });

  if (!saleReturn) throw new Error('Sale return not found');

  if (actor.role !== 'main_admin' && Number(saleReturn.branchId) !== Number(actor.branchId)) {
    throw new Error('Not allowed to view this sale return');
  }

  // Attach contact balance for print display
  const contactBal = await ContactBalance.findOne({
    where: { branchId: saleReturn.branchId, contactId: saleReturn.contactId },
  });
  saleReturn.dataValues.contactBalance = contactBal ? Number(contactBal.receivableBalance || 0) : null;

  return saleReturn;
};

const postLedgerForSale = async ({
  branchId,
  contactId,
  sale,
  payments = [],
  createdById,
  transaction,
}) => {
  const receivableHead = await AccountHead.findOne({ where: { code: 'AR-001' }, transaction });
  const incomeHead = await AccountHead.findOne({ where: { code: 'INC-001' }, transaction });
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' }, transaction });

  if (!receivableHead || !incomeHead || !cashHead) {
    throw new Error('Required account heads are missing (AR-001, INC-001, AST-001)');
  }

  await LedgerEntry.bulkCreate(
    [
      {
        branchId,
        contactId,
        accountHeadId: receivableHead.id,
        entryDate: sale.saleDate,
        referenceType: 'sale',
        referenceId: sale.id,
        referenceNo: sale.invoiceNo,
        description: `Receivable for invoice ${sale.invoiceNo}`,
        debit: sale.totalAmount,
        credit: 0,
        createdById,
      },
      {
        branchId,
        contactId: null,
        accountHeadId: incomeHead.id,
        entryDate: sale.saleDate,
        referenceType: 'sale',
        referenceId: sale.id,
        referenceNo: sale.invoiceNo,
        description: `Sales income invoice ${sale.invoiceNo}`,
        debit: 0,
        credit: sale.totalAmount,
        createdById,
      },
    ],
    { transaction }
  );

  if (toNumber(sale.paidAmount) > 0) {
    const receiptReferenceNo = `${sale.invoiceNo}-RCV`;

    // Resolve payment splits — if none provided fall back to single cash entry (backward compat)
    let resolvedSplits = payments.filter((p) => toNumber(p.amount) > 0);
    if (resolvedSplits.length === 0) {
      resolvedSplits = [{ paymentAccountId: null, accountHeadId: cashHead.id, amount: sale.paidAmount }];
    }

    // Load PaymentAccount rows for the provided accountIds so we can get accountHeadId
    const accountIds = resolvedSplits.map((p) => p.paymentAccountId).filter(Boolean);
    const accountRows = accountIds.length
      ? await PaymentAccount.findAll({ where: { id: accountIds }, transaction })
      : [];
    const accountMap = new Map(accountRows.map((a) => [a.id, a]));

    const receiptTxn = await PaymentTransaction.create(
      {
        branchId,
        contactId,
        transactionType: 'receipt',
        amount: sale.paidAmount,
        entryDate: sale.saleDate,
        referenceNo: receiptReferenceNo,
        description: `Receipt against invoice ${sale.invoiceNo}`,
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

    // Create one ledger pair + one split record per payment account
    for (const split of resolvedSplits) {
      const acc = split.paymentAccountId ? accountMap.get(Number(split.paymentAccountId)) : null;
      const headId = acc?.accountHeadId || split.accountHeadId || cashHead.id;
      const splitAmount = toNumber(split.amount);

      await LedgerEntry.bulkCreate(
        [
          {
            branchId,
            contactId: null,
            accountHeadId: headId,
            entryDate: sale.saleDate,
            referenceType: 'payment_received',
            referenceId: receiptTxn.id,
            referenceNo: receiptReferenceNo,
            description: acc
              ? `Receipt (${acc.name}) for invoice ${sale.invoiceNo}`
              : `Cash receipt for invoice ${sale.invoiceNo}`,
            debit: splitAmount,
            credit: 0,
            createdById,
          },
          {
            branchId,
            contactId,
            accountHeadId: receivableHead.id,
            entryDate: sale.saleDate,
            referenceType: 'payment_received',
            referenceId: receiptTxn.id,
            referenceNo: receiptReferenceNo,
            description: acc
              ? `Receivable settled (${acc.name}) for invoice ${sale.invoiceNo}`
              : `Receivable settled for invoice ${sale.invoiceNo}`,
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
            paymentTransactionId: receiptTxn.id,
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

const createSale = async ({ payload, actor }) => {
  const {
    branchId: branchIdInput,
    contactId,
    invoiceNo,
    saleDate,
    discount = 0,
    paidAmount = 0,
    payments = [],
    items = [],
  } = payload;

  const branchId = parseBranchId(actor, branchIdInput);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one sale item is required');
  }

  const txn = await sequelize.transaction();
  try {
    await ensureCustomerContact(branchId, Number(contactId), txn);
    await ensureProducts(items, txn);

    const duplicate = await Sale.findOne({ where: { branchId, invoiceNo }, transaction: txn });
    if (duplicate) throw new Error('Invoice number already exists for this branch');

    const totals = computeTotals(items, discount, paidAmount);

    const sale = await Sale.create(
      {
        branchId,
        contactId: Number(contactId),
        invoiceNo: String(invoiceNo).trim(),
        saleDate,
        subTotal: totals.subTotal,
        discount: totals.discount,
        totalAmount: totals.totalAmount,
        paidAmount: totals.paidAmount,
        dueAmount: totals.dueAmount,
        status: 'posted',
        createdById: actor.id,
      },
      { transaction: txn }
    );

    for (const item of items) {
      const productId = Number(item.productId);
      const unitId = item.unitId != null ? Number(item.unitId) : null;
      const unitQty = item.unitQty != null ? toNumber(item.unitQty) : null;
      const conversionFactor = toNumber(item.conversionFactor || 1) || 1;

      // Legacy payload: quantity/unitPrice already base. New payload: unitQty/unitPrice are in selected unit.
      const quantity = unitQty != null ? unitQty * conversionFactor : toNumber(item.quantity);
      const unitPrice = unitQty != null ? toNumber(item.unitPrice) / conversionFactor : toNumber(item.unitPrice);
      const lineAmount = unitQty != null ? unitQty * toNumber(item.unitPrice) : quantity * unitPrice;
      const sourceBranchId = Number(item.sourceBranchId || branchId);

      if (quantity <= 0) throw new Error('Item quantity must be greater than zero');

      const saleItem = await SaleItem.create(
        {
          saleId: sale.id,
          productId,
          sourceBranchId,
          quantity,
          unitPrice,
          lineAmount,
          unitId,
          unitQty,
          conversionFactor,
          notes: item.notes || null,
        },
        { transaction: txn }
      );

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId: sourceBranchId, productId },
        defaults: { branchId: sourceBranchId, productId, quantity: 0 },
        transaction: txn,
      });

      // Consume FIFO batches and persist which InventoryBatch layers were used.
      // Unbatched portion is still accounted for via inventory_balance only.
      const { allocations } = await consumeStockOutAllocations(
        { branchId: sourceBranchId, productId, qty: quantity },
        txn
      );

      if (allocations.length) {
        await Promise.all(
          allocations.map((a) =>
            SaleItemBatch.create(
              {
                saleItemId: saleItem.id,
                inventoryBatchId: a.batchId,
                quantityAllocated: a.quantity,
              },
              { transaction: txn }
            )
          )
        );
      }

      const nextQty = toNumber(inventoryBalance.quantity) - quantity;
      if (nextQty < 0) {
        throw new Error(`Insufficient stock for product ${productId}`);
      }
      inventoryBalance.quantity = nextQty;
      await inventoryBalance.save({ transaction: txn });
    }

    await postLedgerForSale({
      branchId,
      contactId: Number(contactId),
      sale,
      payments,
      createdById: actor.id,
      transaction: txn,
    });

    await txn.commit();
    return getSale({ saleId: sale.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const createSaleReturn = async ({ payload, actor }) => {
  const {
    branchId: branchIdInput,
    saleIdReference,
    returnDate,
    reason,
    items = [],
  } = payload;

  const branchId = parseBranchId(actor, branchIdInput);

  if (!saleIdReference) throw new Error('saleIdReference is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one return item is required');

  const txn = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: { id: Number(saleIdReference), branchId },
      include: [{ model: SaleItem, as: 'items' }],
      transaction: txn,
    });

    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'cancelled') throw new Error('Cannot return a cancelled sale');

    const saleItemMap = new Map();
    for (const saleItem of sale.items) {
      saleItemMap.set(saleItem.id, saleItem);
    }

    const alreadyReturnedRows = await SaleReturnItem.findAll({
      include: [{
        model: SaleReturn,
        as: 'saleReturn',
        where: { branchId, saleIdReference: sale.id },
        attributes: [],
      }],
      transaction: txn,
    });

    const alreadyReturnedQtyMap = new Map();
    for (const row of alreadyReturnedRows) {
      const key = row.saleItemId;
      alreadyReturnedQtyMap.set(key, (alreadyReturnedQtyMap.get(key) || 0) + toNumber(row.quantity));
    }

    const resolvedReturnItems = [];
    let totalReturnAmount = 0;

    for (const returnItem of items) {
      const originalItem = saleItemMap.get(Number(returnItem.saleItemId));
      if (!originalItem) throw new Error(`Sale item ${returnItem.saleItemId} does not belong to this invoice`);

      const returnQty = toNumber(returnItem.quantity);
      if (returnQty <= 0) throw new Error(`Return quantity must be greater than 0 for item ${returnItem.saleItemId}`);

      const alreadyReturnedQty = alreadyReturnedQtyMap.get(Number(returnItem.saleItemId)) || 0;
      const maxReturnable = toNumber(originalItem.quantity) - alreadyReturnedQty;
      if (returnQty > maxReturnable + 0.00001) {
        throw new Error(`Return quantity ${returnQty} exceeds returnable quantity for item ${returnItem.saleItemId}`);
      }

      const unitPrice = toNumber(returnItem.unitPrice || originalItem.unitPrice);
      const lineAmount = returnQty * unitPrice;
      totalReturnAmount += lineAmount;

      resolvedReturnItems.push({
        originalItem,
        returnQty,
        alreadyReturnedQty,
        unitPrice,
        lineAmount,
        notes: returnItem.notes || null,
      });
    }

    if (totalReturnAmount <= 0) throw new Error('Total return amount must be greater than 0');

    const saleReturn = await SaleReturn.create(
      {
        branchId,
        saleIdReference: sale.id,
        contactId: sale.contactId,
        returnDate,
        totalAmount: totalReturnAmount,
        reason: reason || null,
        createdById: actor.id,
      },
      { transaction: txn }
    );

    for (const { originalItem, returnQty, alreadyReturnedQty: offsetQty, unitPrice, lineAmount, notes } of resolvedReturnItems) {
      const sourceBranchId = Number(originalItem.sourceBranchId || sale.branchId);

      const saleReturnItem = await SaleReturnItem.create(
        {
          saleReturnId: saleReturn.id,
          saleItemId: originalItem.id,
          productId: originalItem.productId,
          quantity: returnQty,
          unitPrice,
          lineAmount,
          notes,
        },
        { transaction: txn }
      );

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId: sourceBranchId, productId: originalItem.productId },
        defaults: { branchId: sourceBranchId, productId: originalItem.productId, quantity: 0 },
        transaction: txn,
      });

      inventoryBalance.quantity = toNumber(inventoryBalance.quantity) + returnQty;
      await inventoryBalance.save({ transaction: txn });

      // Restore InventoryBatch deterministically from the sale_item_batches allocation.
      const saleItemBatchRows = await SaleItemBatch.findAll({
        where: { saleItemId: originalItem.id },
        include: [{ model: InventoryBatch, as: 'inventoryBatch', attributes: ['id', 'receivedDate'] }],
        order: [
          [{ model: InventoryBatch, as: 'inventoryBatch' }, 'receivedDate', 'ASC'],
          ['id', 'ASC'],
        ],
        transaction: txn,
      });

      // Ensure deterministic allocation order even if dialect/order syntax differs.
      saleItemBatchRows.sort((a, b) => {
        const aDate = new Date(a.inventoryBatch?.receivedDate);
        const bDate = new Date(b.inventoryBatch?.receivedDate);
        const diff = aDate.getTime() - bDate.getTime();
        if (diff !== 0) return diff;
        return Number(a.id) - Number(b.id);
      });

      // Fallback for old sales (before batch allocation was tracked).
      if (!saleItemBatchRows.length) {
        await reverseStockOut(
          { branchId: sourceBranchId, productId: originalItem.productId, qty: returnQty },
          txn
        );
        continue;
      }

      const start = toNumber(offsetQty);
      const end = start + toNumber(returnQty);
      let cursor = 0;

      const allocationsToRestore = [];
      for (const row of saleItemBatchRows) {
        const batchQty = toNumber(row.quantityAllocated);
        const batchStart = cursor;
        const batchEnd = cursor + batchQty;

        const overlap = Math.max(0, Math.min(batchEnd, end) - Math.max(batchStart, start));
        if (overlap > 0.0000001) {
          allocationsToRestore.push({ inventoryBatchId: row.inventoryBatchId, quantity: overlap });
        }

        cursor = batchEnd;
        if (cursor >= end) break;
      }

      if (allocationsToRestore.length) {
        const restoreMap = new Map();
        for (const a of allocationsToRestore) {
          const key = Number(a.inventoryBatchId);
          restoreMap.set(key, (restoreMap.get(key) || 0) + toNumber(a.quantity));
        }

        const batchIds = Array.from(restoreMap.keys());
        const batches = await InventoryBatch.findAll({
          where: { id: { [Op.in]: batchIds } },
          transaction: txn,
          lock: txn.LOCK.UPDATE,
        });

        await Promise.all(
          batches.map(async (batch) => {
            const restoreQty = restoreMap.get(batch.id) || 0;
            if (!restoreQty) return;
            batch.quantityRemaining = toNumber(batch.quantityRemaining) + restoreQty;
            await batch.save({ transaction: txn });
          })
        );

        await SaleReturnItemBatch.bulkCreate(
          allocationsToRestore.map((a) => ({
            saleReturnItemId: saleReturnItem.id,
            inventoryBatchId: a.inventoryBatchId,
            quantityAllocated: a.quantity,
          })),
          { transaction: txn }
        );
      }
    }

    const receivableHead = await AccountHead.findOne({ where: { code: 'AR-001' }, transaction: txn });
    const incomeHead = await AccountHead.findOne({ where: { code: 'INC-001' }, transaction: txn });

    if (!receivableHead || !incomeHead) {
      throw new Error('Required account heads are missing (AR-001, INC-001)');
    }

    const refNo = `${sale.invoiceNo}-RET-${saleReturn.id}`;
    await LedgerEntry.bulkCreate(
      [
        {
          branchId,
          contactId: null,
          accountHeadId: incomeHead.id,
          entryDate: returnDate,
          referenceType: 'sale_return',
          referenceId: saleReturn.id,
          referenceNo: refNo,
          description: `Sales return for invoice ${sale.invoiceNo}`,
          debit: totalReturnAmount,
          credit: 0,
          createdById: actor.id,
        },
        {
          branchId,
          contactId: sale.contactId,
          accountHeadId: receivableHead.id,
          entryDate: returnDate,
          referenceType: 'sale_return',
          referenceId: saleReturn.id,
          referenceNo: refNo,
          description: `Receivable reversal for invoice ${sale.invoiceNo}`,
          debit: 0,
          credit: totalReturnAmount,
          createdById: actor.id,
        },
      ],
      { transaction: txn }
    );

    sale.dueAmount = Math.max(0, toNumber(sale.dueAmount) - totalReturnAmount);
    await sale.save({ transaction: txn });

    await refreshContactBalance({
      branchId,
      contactId: sale.contactId,
      transaction: txn,
    });

    await txn.commit();
    return getSaleReturn({ returnId: saleReturn.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const updateSale = async () => {
  throw new Error('Sale update is not available yet');
};

const cancelSale = async ({ saleId, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const sale = await Sale.findByPk(Number(saleId), {
      include: [{ model: SaleItem, as: 'items' }],
      transaction: txn,
    });

    if (!sale) throw new Error('Sale not found');

    const branchId = parseBranchId(actor, sale.branchId);
    if (Number(branchId) !== Number(sale.branchId)) {
      throw new Error('Not allowed to cancel this sale');
    }

    if (sale.status === 'cancelled') {
      throw new Error('Sale is already cancelled');
    }

    const returnCount = await SaleReturn.count({
      where: { branchId: sale.branchId, saleIdReference: sale.id },
      transaction: txn,
    });
    if (returnCount > 0) {
      throw new Error('Cannot cancel sale after returns are recorded');
    }

    // Restore InventoryBatch rows deterministically from stored SaleItemBatch allocations.
    const saleItemIds = (sale.items || []).map((i) => i.id).filter(Boolean);
    const saleItemBatchRows = saleItemIds.length
      ? await SaleItemBatch.findAll({
          where: { saleItemId: { [Op.in]: saleItemIds } },
          transaction: txn,
        })
      : [];

    if (saleItemBatchRows.length > 0) {
      const batchRestoreQtyMap = new Map();
      for (const row of saleItemBatchRows) {
        const key = Number(row.inventoryBatchId);
        batchRestoreQtyMap.set(key, (batchRestoreQtyMap.get(key) || 0) + toNumber(row.quantityAllocated));
      }

      const batchIds = Array.from(batchRestoreQtyMap.keys());
      if (batchIds.length) {
        const batches = await InventoryBatch.findAll({
          where: { id: { [Op.in]: batchIds } },
          transaction: txn,
          lock: txn.LOCK.UPDATE,
        });

        await Promise.all(
          batches.map(async (batch) => {
            const restoreQty = batchRestoreQtyMap.get(batch.id) || 0;
            if (!restoreQty) return;
            batch.quantityRemaining = toNumber(batch.quantityRemaining) + restoreQty;
            await batch.save({ transaction: txn });
          })
        );
      }
    }

    for (const item of sale.items || []) {
      const productId = Number(item.productId);
      const quantity = toNumber(item.quantity);
      const sourceBranchId = Number(item.sourceBranchId || sale.branchId);

      // Fallback for old sales without saved batch allocations.
      if (!saleItemBatchRows.length) {
        await reverseStockOut({ branchId: sourceBranchId, productId, qty: quantity }, txn);
      }

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId: sourceBranchId, productId },
        defaults: { branchId: sourceBranchId, productId, quantity: 0 },
        transaction: txn,
      });

      inventoryBalance.quantity = toNumber(inventoryBalance.quantity) + quantity;
      await inventoryBalance.save({ transaction: txn });
    }

    const receiptReferenceNo = `${sale.invoiceNo}-RCV`;

    await LedgerEntry.destroy({
      where: {
        branchId: sale.branchId,
        [Op.or]: [
          { referenceType: 'sale', referenceId: sale.id },
          { referenceType: 'payment_received', referenceNo: receiptReferenceNo },
        ],
      },
      transaction: txn,
    });

    await PaymentTransaction.destroy({
      where: {
        branchId: sale.branchId,
        referenceNo: receiptReferenceNo,
      },
      transaction: txn,
    });

    await refreshContactBalance({
      branchId: sale.branchId,
      contactId: sale.contactId,
      transaction: txn,
    });

    sale.status = 'cancelled';
    await sale.save({ transaction: txn });

    await txn.commit();
    return sale;
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const repostSale = async ({ saleId, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const sale = await Sale.findByPk(Number(saleId), {
      include: [{ model: SaleItem, as: 'items' }],
      transaction: txn,
    });

    if (!sale) throw new Error('Sale not found');

    const branchId = parseBranchId(actor, sale.branchId);
    if (Number(branchId) !== Number(sale.branchId)) {
      throw new Error('Not allowed to repost this sale');
    }

    if (sale.status !== 'cancelled') {
      throw new Error('Only cancelled sales can be reposted');
    }

    const returnCount = await SaleReturn.count({
      where: { branchId: sale.branchId, saleIdReference: sale.id },
      transaction: txn,
    });
    if (returnCount > 0) {
      throw new Error('Cannot repost sale after returns are recorded');
    }

    const saleItemIds = (sale.items || []).map((i) => i.id).filter(Boolean);
    if (saleItemIds.length) {
      await SaleItemBatch.destroy({
        where: { saleItemId: { [Op.in]: saleItemIds } },
        transaction: txn,
      });
    }

    for (const item of sale.items || []) {
      const productId = Number(item.productId);
      const quantity = toNumber(item.quantity);
      const sourceBranchId = Number(item.sourceBranchId || sale.branchId);

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId: sourceBranchId, productId },
        defaults: { branchId: sourceBranchId, productId, quantity: 0 },
        transaction: txn,
      });

      // Consume FIFO batches and persist which InventoryBatch layers were used.
      const { allocations } = await consumeStockOutAllocations(
        { branchId: sourceBranchId, productId, qty: quantity },
        txn
      );
      if (allocations.length) {
        await Promise.all(
          allocations.map((a) =>
            SaleItemBatch.create(
              {
                saleItemId: item.id,
                inventoryBatchId: a.batchId,
                quantityAllocated: a.quantity,
              },
              { transaction: txn }
            )
          )
        );
      }

      const nextQty = toNumber(inventoryBalance.quantity) - quantity;
      if (nextQty < 0) {
        throw new Error(`Insufficient stock for product ${productId}`);
      }
      inventoryBalance.quantity = nextQty;
      await inventoryBalance.save({ transaction: txn });
    }

    await postLedgerForSale({
      branchId: sale.branchId,
      contactId: sale.contactId,
      sale,
      createdById: actor.id,
      transaction: txn,
    });

    await refreshContactBalance({
      branchId: sale.branchId,
      contactId: sale.contactId,
      transaction: txn,
    });

    sale.status = 'posted';
    await sale.save({ transaction: txn });

    await txn.commit();
    return getSale({ saleId: sale.id, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const cancelSaleReturn = async ({ returnId, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const saleReturn = await SaleReturn.findByPk(returnId, {
      include: [{ model: SaleReturnItem, as: 'items' }],
      transaction: txn,
    });
    if (!saleReturn) throw new Error('Sale return not found');

    const branchId = saleReturn.branchId;
    if (actor.role !== 'main_admin' && Number(actor.branchId) !== Number(branchId)) {
      throw new Error('Not allowed to cancel this return');
    }

    const sale = await Sale.findByPk(saleReturn.saleIdReference, { transaction: txn });
    if (!sale) throw new Error('Original sale not found');

    const returnItems = saleReturn.items || [];
    const saleReturnItemIds = returnItems.map((i) => i.id).filter(Boolean);

    // Prefer deterministic cancellation using SaleReturnItemBatch allocations.
    const saleReturnItemBatchRows =
      saleReturnItemIds.length > 0
        ? await SaleReturnItemBatch.findAll({
            where: { saleReturnItemId: { [Op.in]: saleReturnItemIds } },
            transaction: txn,
          })
        : [];

    const saleItemIds = returnItems.map((i) => i.saleItemId).filter(Boolean);
    const saleItems = saleItemIds.length
      ? await SaleItem.findAll({ where: { id: { [Op.in]: saleItemIds } }, transaction: txn })
      : [];
    const saleItemBranchMap = new Map(saleItems.map((s) => [Number(s.id), Number(s.sourceBranchId || sale.branchId)]));

    // Deduct InventoryBatch layers that were restored when the return was created.
    if (saleReturnItemBatchRows.length > 0) {
      const batchDeductQtyMap = new Map();
      for (const row of saleReturnItemBatchRows) {
        const key = Number(row.inventoryBatchId);
        batchDeductQtyMap.set(key, (batchDeductQtyMap.get(key) || 0) + toNumber(row.quantityAllocated));
      }

      const batchIds = Array.from(batchDeductQtyMap.keys());
      if (batchIds.length) {
        const batches = await InventoryBatch.findAll({
          where: { id: { [Op.in]: batchIds } },
          transaction: txn,
          lock: txn.LOCK.UPDATE,
        });

        await Promise.all(
          batches.map(async (batch) => {
            const deductQty = batchDeductQtyMap.get(Number(batch.id)) || 0;
            if (!deductQty) return;
            const nextQty = toNumber(batch.quantityRemaining) - deductQty;
            // Tolerate floating drift.
            if (nextQty < -0.00001) {
              throw new Error(`Insufficient batched stock to cancel return for batch ${batch.id}`);
            }
            batch.quantityRemaining = nextQty < 0 ? 0 : nextQty;
            await batch.save({ transaction: txn });
          })
        );
      }
    }

    // Always restore inventory_balance by subtracting the full returned quantity.
    // For batched portion, the batch layers are already adjusted above.
    for (const item of returnItems) {
      const quantity = toNumber(item.quantity);
      const sourceBranchId = saleItemBranchMap.get(Number(item.saleItemId)) || Number(sale.branchId);

      const [inventoryBalance] = await InventoryBalance.findOrCreate({
        where: { branchId: sourceBranchId, productId: item.productId },
        defaults: { branchId: sourceBranchId, productId: item.productId, quantity: 0 },
        transaction: txn,
      });

      const nextQty = toNumber(inventoryBalance.quantity) - quantity;
      if (nextQty < 0) {
        throw new Error(`Insufficient stock to reverse return for product ${item.productId}`);
      }
      inventoryBalance.quantity = nextQty;
      await inventoryBalance.save({ transaction: txn });

      // Fallback for old returns: if no allocation rows exist, we need to re-consume FIFO batches.
      if (saleReturnItemBatchRows.length === 0) {
        await stockOut({ branchId: sourceBranchId, productId: item.productId, qty: quantity }, txn);
      }
    }

    await LedgerEntry.destroy({
      where: { referenceType: 'sale_return', referenceId: returnId },
      transaction: txn,
    });

    sale.dueAmount = toNumber(sale.dueAmount) + toNumber(saleReturn.totalAmount);
    await sale.save({ transaction: txn });

    await refreshContactBalance({
      branchId,
      contactId: saleReturn.contactId,
      transaction: txn,
    });

    if (saleReturnItemIds.length) {
      await SaleReturnItemBatch.destroy({
        where: { saleReturnItemId: { [Op.in]: saleReturnItemIds } },
        transaction: txn,
      });
    }

    await SaleReturnItem.destroy({ where: { saleReturnId: returnId }, transaction: txn });
    await SaleReturn.destroy({ where: { id: returnId }, transaction: txn });

    await txn.commit();
    return { success: true, id: returnId };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

const updateSaleReturn = async ({ returnId, payload, actor }) => {
  const txn = await sequelize.transaction();
  try {
    const saleReturn = await SaleReturn.findByPk(returnId, { transaction: txn });
    if (!saleReturn) throw new Error('Sale return not found');

    if (actor.role !== 'main_admin' && Number(actor.branchId) !== Number(saleReturn.branchId)) {
      throw new Error('Not allowed to update this return');
    }

    if (payload.returnDate) {
      saleReturn.returnDate = payload.returnDate;

      // Keep ledger entry timeline aligned with the return header date.
      await LedgerEntry.update(
        { entryDate: payload.returnDate },
        {
          where: { referenceType: 'sale_return', referenceId: returnId },
          transaction: txn,
        }
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'reason')) {
      saleReturn.reason = payload.reason || null;
    }

    await saleReturn.save({ transaction: txn });
    await txn.commit();
    return getSaleReturn({ returnId, actor });
  } catch (error) {
    await txn.rollback();
    throw error;
  }
};

module.exports = {
  listSales,
  getSale,
  listSaleReturns,
  getSaleReturn,
  createSale,
  createSaleReturn,
  cancelSaleReturn,
  updateSaleReturn,
  updateSale,
  cancelSale,
  repostSale,
};