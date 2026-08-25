const { InventoryBatch, InventoryBalance } = require('../models');

const toNumber = (v) => Number(v || 0);

/**
 * Record stock in for a single purchase line item.
 * Creates one InventoryBatch row and returns the new batch id.
 *
 * @param {{ branchId, productId, purchaseId, purchaseItemId, qty, costPrice, salePrice, receivedDate }} params
 * @param {import('sequelize').Transaction} t
 * @returns {Promise<number>} batchId
 */
const stockIn = async (
  { branchId, productId, purchaseId = null, purchaseItemId = null, qty, costPrice, salePrice, receivedDate },
  t
) => {
  const qty4 = toNumber(qty);
  if (qty4 <= 0) throw new Error('stockIn: quantity must be greater than 0');

  const batch = await InventoryBatch.create(
    {
      branchId,
      productId,
      purchaseId,
      purchaseItemId,
      receivedDate,
      quantityReceived: qty4,
      quantityRemaining: qty4,
      costPrice: toNumber(costPrice),
      salePrice: salePrice != null ? toNumber(salePrice) : null,
    },
    { transaction: t }
  );

  return batch.id;
};

/**
 * Consume stock using FIFO (oldest batch first).
 * Decrements quantityRemaining across batches oldest-first.
 * Throws if insufficient stock.
 *
 * @param {{ branchId, productId, qty }} params
 * @param {import('sequelize').Transaction} t
 * @returns {Promise<void>}
 */
const stockOut = async ({ branchId, productId, qty }, t) => {
  let remaining = toNumber(qty);
  if (remaining <= 0) throw new Error('stockOut: quantity must be greater than 0');

  // Lock rows for update so concurrent transactions don't double-deduct
  const batches = await InventoryBatch.findAll({
    where: { branchId, productId },
    order: [['receivedDate', 'ASC'], ['id', 'ASC']],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  const totalAvailable = batches.reduce((s, b) => s + toNumber(b.quantityRemaining), 0);
  if (totalAvailable < remaining) {
    const balance = await InventoryBalance.findOne({
      where: { branchId, productId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const balanceQty = toNumber(balance?.quantity || 0);

    if (balanceQty < remaining) {
      const effectiveAvailable = Math.max(totalAvailable, balanceQty);
      throw new Error(`Insufficient stock for product ${productId} (available: ${effectiveAvailable}, requested: ${remaining})`);
    }

    return;
  }

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(toNumber(batch.quantityRemaining), remaining);
    batch.quantityRemaining = toNumber(batch.quantityRemaining) - take;
    await batch.save({ transaction: t });
    remaining -= take;
  }
};

/**
 * Reduce remaining quantity in a purchase batch.
 * Used by purchase returns (partial) and by update/cancel flows before deleting old batches.
 *
 * @param {number} batchId   The InventoryBatch id created by stockIn
 * @param {number} qty       How much to reduce from quantityRemaining
 * @param {import('sequelize').Transaction} t
 * @returns {Promise<void>}
 */
const reverseStockIn = async (batchId, qty, t) => {
  const batch = await InventoryBatch.findByPk(batchId, { transaction: t, lock: t.LOCK.UPDATE });
  if (!batch) throw new Error(`InventoryBatch ${batchId} not found`);

  const reduceBy = toNumber(qty);
  if (reduceBy <= 0) throw new Error('reverseStockIn: quantity must be greater than 0');

  const currentRemaining = toNumber(batch.quantityRemaining);
  if (reduceBy > currentRemaining) {
    throw new Error(`reverseStockIn: cannot reduce ${reduceBy}; only ${currentRemaining} remaining in batch ${batchId}`);
  }

  batch.quantityRemaining = currentRemaining - reduceBy;
  await batch.save({ transaction: t });
};

/**
 * Reverse stockOut for a product by adding quantity back to previously consumed batches.
 * Restores into FIFO batches oldest-first up to each batch's original received quantity.
 *
 * @param {{ branchId, productId, qty }} params
 * @param {import('sequelize').Transaction} t
 * @returns {Promise<void>}
 */
const reverseStockOut = async ({ branchId, productId, qty }, t) => {
  let restoreQty = toNumber(qty);
  if (restoreQty <= 0) throw new Error('reverseStockOut: quantity must be greater than 0');

  const batches = await InventoryBatch.findAll({
    where: { branchId, productId },
    order: [['receivedDate', 'ASC'], ['id', 'ASC']],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  for (const batch of batches) {
    if (restoreQty <= 0) break;

    const received = toNumber(batch.quantityReceived);
    const remaining = toNumber(batch.quantityRemaining);
    const consumed = Math.max(0, received - remaining);
    if (consumed <= 0) continue;

    const putBack = Math.min(consumed, restoreQty);
    batch.quantityRemaining = remaining + putBack;
    await batch.save({ transaction: t });
    restoreQty -= putBack;
  }

  // If there is "unbatched" stock (represented only in inventory_balances), restore only what
  // exists in batches. The remaining quantity is still accounted for via inventory_balance updates
  // done by the caller.
};

/**
 * Consume stock using FIFO and return the exact batch allocations (for batched portion).
 * Any remaining qty that can't be covered by InventoryBatch rows is treated as "unbatched" stock
 * (validated only against InventoryBalance).
 *
 * @returns {{ allocations: Array<{ batchId: number, quantity: number }>, unbatchedQty: number }}
 */
const consumeStockOutAllocations = async ({ branchId, productId, qty }, t) => {
  let remaining = toNumber(qty);
  if (remaining <= 0) throw new Error('consumeStockOutAllocations: quantity must be greater than 0');

  const batches = await InventoryBatch.findAll({
    where: { branchId, productId },
    order: [['receivedDate', 'ASC'], ['id', 'ASC']],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  const allocations = [];
  let totalAvailableBatches = 0;
  for (const b of batches) totalAvailableBatches += toNumber(b.quantityRemaining);

  // If batches can fully cover the request, consume only within batches.
  if (totalAvailableBatches >= remaining) {
    for (const batch of batches) {
      if (remaining <= 0) break;
      const batchQty = toNumber(batch.quantityRemaining);
      const take = Math.min(batchQty, remaining);
      if (take <= 0) continue;

      batch.quantityRemaining = batchQty - take;
      await batch.save({ transaction: t });
      allocations.push({ batchId: batch.id, quantity: take });
      remaining -= take;
    }

    return { allocations, unbatchedQty: 0 };
  }

  // Not enough across batches: consume all available batches, remainder is unbatched.
  for (const batch of batches) {
    const batchQty = toNumber(batch.quantityRemaining);
    if (batchQty <= 0) continue;
    batch.quantityRemaining = 0;
    await batch.save({ transaction: t });
    allocations.push({ batchId: batch.id, quantity: batchQty });
    remaining -= batchQty;
  }

  // Validate that unbatched stock exists in inventory_balances.
  const balance = await InventoryBalance.findOne({
    where: { branchId, productId },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  const balanceQty = toNumber(balance?.quantity || 0);
  const requestedQty = toNumber(qty);
  if (balanceQty < requestedQty) {
    throw new Error(`Insufficient stock for product ${productId} (available: ${balanceQty}, requested: ${requestedQty})`);
  }

  // remaining > 0 is the unbatched remainder; we don't allocate it to batches.
  return { allocations, unbatchedQty: remaining };
};

module.exports = {
  stockIn,
  stockOut,
  reverseStockIn,
  reverseStockOut,
  consumeStockOutAllocations,
};
