const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  StockTransfer,
  StockTransferItem,
  Branch,
  Product,
  InventoryBalance,
  InventoryBatch,
} = require('../models');
const { stockIn, reverseStockOut, reverseStockIn, consumeStockOutAllocations } = require('./fifo.service');
const { ROLES } = require('../constants/roles');

const toNumber = (value) => Number(value || 0);

const generateTransferNo = () => `ST-${Date.now()}`;

const canAccessTransfer = (actor, transfer) => {
  if (actor.role === ROLES.MAIN_ADMIN) return true;
  const branchId = Number(actor.branchId);
  return branchId === Number(transfer.fromBranchId) || branchId === Number(transfer.toBranchId);
};

const getTransferIncludes = () => [
  { model: Branch, as: 'fromBranch', attributes: ['id', 'name', 'code'] },
  { model: Branch, as: 'toBranch', attributes: ['id', 'name', 'code'] },
  {
    model: StockTransferItem,
    as: 'items',
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
  },
];

const getTransfer = async ({ transferId, actor }) => {
  const transfer = await StockTransfer.findByPk(Number(transferId), {
    include: getTransferIncludes(),
  });

  if (!transfer) throw new Error('Stock transfer not found');
  if (!canAccessTransfer(actor, transfer)) {
    throw new Error('Not allowed to view this stock transfer');
  }

  return transfer;
};

const listTransfers = async ({ actor, filters = {} }) => {
  const where = {};

  if (actor.role !== ROLES.MAIN_ADMIN) {
    if (!actor.branchId) return [];
    where[Op.or] = [
      { fromBranchId: Number(actor.branchId) },
      { toBranchId: Number(actor.branchId) },
    ];
  } else if (filters.branchId) {
    const branchId = Number(filters.branchId);
    where[Op.or] = [{ fromBranchId: branchId }, { toBranchId: branchId }];
  }

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.transferDate = {};
    if (filters.startDate) where.transferDate[Op.gte] = filters.startDate;
    if (filters.endDate) where.transferDate[Op.lte] = filters.endDate;
  }

  return StockTransfer.findAll({
    where,
    include: getTransferIncludes(),
    order: [['transferDate', 'DESC'], ['id', 'DESC']],
  });
};

const ensureBranches = async ({ fromBranchId, toBranchId, transaction }) => {
  if (fromBranchId === toBranchId) {
    throw new Error('Source and destination branches must be different');
  }

  const [fromBranch, toBranch] = await Promise.all([
    Branch.findOne({ where: { id: fromBranchId, isActive: true }, transaction }),
    Branch.findOne({ where: { id: toBranchId, isActive: true }, transaction }),
  ]);

  if (!fromBranch) throw new Error('Source branch not found or inactive');
  if (!toBranch) throw new Error('Destination branch not found or inactive');

  return { fromBranch, toBranch };
};

const ensureProducts = async (items, transaction) => {
  const productIds = [...new Set(items.map((item) => Number(item.productId)))];
  const products = await Product.findAll({
    where: { id: { [Op.in]: productIds }, isActive: true },
    transaction,
  });

  if (products.length !== productIds.length) {
    throw new Error('One or more selected products are invalid or inactive');
  }

  return products;
};

const applyInventoryDelta = async ({ branchId, productId, deltaQty, transaction }) => {
  const [inventoryBalance] = await InventoryBalance.findOrCreate({
    where: { branchId, productId },
    defaults: { branchId, productId, quantity: 0 },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const nextQty = toNumber(inventoryBalance.quantity) + toNumber(deltaQty);
  if (nextQty < 0) {
    throw new Error(`Insufficient stock for product ${productId}`);
  }

  inventoryBalance.quantity = nextQty;
  await inventoryBalance.save({ transaction });
};

const createTransfer = async ({ actor, payload }) => {
  const {
    fromBranchId: fromBranchIdInput,
    toBranchId: toBranchIdInput,
    transferDate,
    transferNo,
    remarks,
    items = [],
  } = payload;

  let fromBranchId = Number(fromBranchIdInput);
  let toBranchId = Number(toBranchIdInput);

  if (actor.role !== ROLES.MAIN_ADMIN) {
    if (!actor.branchId) throw new Error('User branch is not configured');
    fromBranchId = Number(actor.branchId);
  }

  if (!fromBranchId) throw new Error('fromBranchId is required');
  if (!toBranchId) throw new Error('toBranchId is required');
  if (!transferDate) throw new Error('transferDate is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one transfer item is required');
  }

  return sequelize.transaction(async (transaction) => {
    await ensureBranches({ fromBranchId, toBranchId, transaction });
    await ensureProducts(items, transaction);

    const referenceNo = transferNo?.trim() || generateTransferNo();
    const duplicate = await StockTransfer.findOne({ where: { transferNo: referenceNo }, transaction });
    if (duplicate) throw new Error('Transfer number already exists');

    const transfer = await StockTransfer.create(
      {
        fromBranchId,
        toBranchId,
        transferDate,
        transferNo: referenceNo,
        remarks: remarks?.trim() || null,
        status: 'posted',
        createdById: actor.id,
      },
      { transaction }
    );

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = toNumber(item.quantity);
      if (quantity <= 0) throw new Error('Transfer quantity must be greater than zero');

      const { allocations } = await consumeStockOutAllocations(
        { branchId: fromBranchId, productId, qty: quantity },
        transaction
      );

      let totalCost = 0;
      let totalQtyFromBatches = 0;
      let lastSalePrice = null;

      for (const allocation of allocations) {
        const sourceBatch = await InventoryBatch.findByPk(allocation.batchId, { transaction });
        if (!sourceBatch) continue;
        totalCost += toNumber(allocation.quantity) * toNumber(sourceBatch.costPrice);
        totalQtyFromBatches += toNumber(allocation.quantity);
        lastSalePrice = sourceBatch.salePrice;
      }

      const unitCost = totalQtyFromBatches > 0
        ? Number((totalCost / totalQtyFromBatches).toFixed(2))
        : 0;

      const destinationBatchId = await stockIn(
        {
          branchId: toBranchId,
          productId,
          qty: quantity,
          costPrice: unitCost,
          salePrice: lastSalePrice,
          receivedDate: transferDate,
        },
        transaction
      );

      const transferItem = await StockTransferItem.create(
        {
          stockTransferId: transfer.id,
          productId,
          quantity,
          unitCost,
          destinationBatchId,
          notes: item.notes?.trim() || null,
        },
        { transaction }
      );

      await applyInventoryDelta({
        branchId: fromBranchId,
        productId,
        deltaQty: -quantity,
        transaction,
      });

      await applyInventoryDelta({
        branchId: toBranchId,
        productId,
        deltaQty: quantity,
        transaction,
      });

      transferItem.destinationBatchId = destinationBatchId;
      await transferItem.save({ transaction });
    }

    return StockTransfer.findByPk(transfer.id, {
      include: getTransferIncludes(),
      transaction,
    });
  });
};

const cancelTransfer = async ({ transferId, actor }) => {
  return sequelize.transaction(async (transaction) => {
    const transfer = await StockTransfer.findByPk(Number(transferId), {
      include: [{ model: StockTransferItem, as: 'items' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!transfer) throw new Error('Stock transfer not found');
    if (!canAccessTransfer(actor, transfer)) {
      throw new Error('Not allowed to cancel this stock transfer');
    }

    if (transfer.status === 'cancelled') {
      throw new Error('Stock transfer is already cancelled');
    }

    for (const item of transfer.items || []) {
      const productId = Number(item.productId);
      const quantity = toNumber(item.quantity);

      if (item.destinationBatchId) {
        const destinationBatch = await InventoryBatch.findByPk(item.destinationBatchId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (destinationBatch) {
          const remaining = toNumber(destinationBatch.quantityRemaining);
          if (remaining < quantity) {
            throw new Error(`Cannot cancel transfer: destination stock already consumed for product ${productId}`);
          }
          await reverseStockIn(item.destinationBatchId, quantity, transaction);
          await destinationBatch.destroy({ transaction });
        }
      }

      await applyInventoryDelta({
        branchId: transfer.toBranchId,
        productId,
        deltaQty: -quantity,
        transaction,
      });

      await reverseStockOut(
        { branchId: transfer.fromBranchId, productId, qty: quantity },
        transaction
      );

      await applyInventoryDelta({
        branchId: transfer.fromBranchId,
        productId,
        deltaQty: quantity,
        transaction,
      });
    }

    transfer.status = 'cancelled';
    await transfer.save({ transaction });

    return getTransfer({ transferId: transfer.id, actor });
  });
};

module.exports = {
  listTransfers,
  getTransfer,
  createTransfer,
  cancelTransfer,
};
