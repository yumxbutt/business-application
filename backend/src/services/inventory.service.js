const { Op } = require('sequelize');
const {
  InventoryBalance,
  Product,
  Unit,
  ProductUnit,
  InventoryBatch,
  Purchase,
  PurchaseItem,
  PurchaseReturnItem,
  PurchaseReturn,
  Sale,
  SaleItem,
  Contact,
  ProductCategory,
} = require('../models');
const { breakdownStock, convertToUnit } = require('../utils/stock-conversion');

/**
 * Fetch product-unit mappings for a product, sorted largest-factor first.
 */
async function getProductUnits(productId) {
  const rows = await ProductUnit.findAll({
    where: { productId },
    include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
    order: [['conversionFactor', 'DESC']],
  });

  return rows.map((r) => ({
    unitId: r.unitId,
    unitName: r.unit.name,
    unitCode: r.unit.code,
    conversionFactor: parseFloat(r.conversionFactor),
    isBaseUnit: r.isBaseUnit,
    isPurchaseUnit: r.isPurchaseUnit,
    isSaleUnit: r.isSaleUnit,
  }));
}

/**
 * Get or create a balance record (returns 0 quantity if not present).
 */
async function findBalance(branchId, productId) {
  const [balance] = await InventoryBalance.findOrCreate({
    where: { branchId, productId },
    defaults: { branchId, productId, quantity: 0 },
  });
  return balance;
}

/**
 * Return the stock for (branch, product) broken down into all mapped units.
 * If no ProductUnit mappings exist, falls back to returning raw base-unit qty.
 *
 * Response shape: { baseQty, breakdown: [...] }
 */
async function getStockBreakdown(branchId, productId) {
  const balance = await findBalance(branchId, productId);
  const baseQty = parseFloat(balance.quantity) || 0;
  const units = await getProductUnits(productId);

  if (units.length === 0) {
    // No unit mappings — return raw quantity with default unit info
    const product = await Product.findByPk(productId, {
      include: [{ model: Unit, as: 'defaultUnit', attributes: ['id', 'name', 'code'] }],
    });
    const defaultUnit = product && product.defaultUnit
      ? { unitId: product.defaultUnit.id, unitName: product.defaultUnit.name, unitCode: product.defaultUnit.code, conversionFactor: 1, isBaseUnit: true, qty: baseQty }
      : { unitId: null, unitName: 'Units', unitCode: 'PCS', conversionFactor: 1, isBaseUnit: true, qty: baseQty };
    return { baseQty, breakdown: [defaultUnit] };
  }

  const breakdown = breakdownStock(baseQty, units);
  return { baseQty, breakdown };
}

/**
 * Return stock for (branch, product) converted to a SINGLE specific unit.
 *
 * Response shape: { baseQty, unitId, unitCode, unitName, qty }
 */
async function getStockInUnit(branchId, productId, unitId) {
  const balance = await findBalance(branchId, productId);
  const baseQty = parseFloat(balance.quantity) || 0;

  const pu = await ProductUnit.findOne({
    where: { productId, unitId },
    include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
  });

  if (!pu) {
    throw new Error(`Unit mapping not found for product ${productId} / unit ${unitId}`);
  }

  const factor = parseFloat(pu.conversionFactor) || 1;
  const qty = convertToUnit(baseQty, factor);
  return { baseQty, unitId: pu.unitId, unitCode: pu.unit.code, unitName: pu.unit.name, qty };
}

/**
 * List stock for all products in a branch, with optional breakdown per product.
 *
 * mode: 'all'   → multi-unit breakdown per product
 * mode: 'unit'  → single specific unit per product (unitId required)
 */
async function listBranchStock(branchId, { mode = 'all', unitId } = {}) {
  const balances = await InventoryBalance.findAll({
    where: { branchId },
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku', 'categoryId'],
        include: [
          { model: Unit, as: 'defaultUnit', attributes: ['id', 'name', 'code'] },
          { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'code'] },
        ],
      },
    ],
    order: [[{ model: Product, as: 'product' }, 'name', 'ASC']],
  });

  const results = await Promise.all(
    balances.map(async (balance) => {
      const baseQty = parseFloat(balance.quantity) || 0;
      const product = balance.product;
      const category = product.category || { id: null, name: 'Uncategorized', code: 'UNCATEGORIZED' };

      if (mode === 'unit' && unitId) {
        try {
          const converted = await getStockInUnit(branchId, product.id, unitId);
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            categoryId: category.id,
            categoryName: category.name,
            categoryCode: category.code,
            baseQty,
            mode: 'unit',
            ...converted,
          };
        } catch {
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            categoryId: category.id,
            categoryName: category.name,
            categoryCode: category.code,
            baseQty,
            mode: 'unit',
            qty: 0,
            unitId,
            unitCode: '-',
            unitName: '-',
          };
        }
      }

      const { breakdown } = await getStockBreakdown(branchId, product.id);
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        categoryId: category.id,
        categoryName: category.name,
        categoryCode: category.code,
        baseQty,
        mode: 'all',
        breakdown,
      };
    })
  );

  return results;
}

/**
 * Adjust (add/subtract) quantity for a product in a branch.
 * deltaQty is in BASE units. Use negative numbers for reductions.
 *
 * Returns updated balance.
 */
async function adjustStock(branchId, productId, deltaQty, { reason = null, actorId = null } = {}) {
  const [balance, created] = await InventoryBalance.findOrCreate({
    where: { branchId, productId },
    defaults: { branchId, productId, quantity: 0 },
  });

  const current = parseFloat(balance.quantity) || 0;
  const delta = parseFloat(deltaQty) || 0;
  const newQty = parseFloat((current + delta).toFixed(4));

  if (newQty < 0) throw new Error('Stock cannot go below zero');

  balance.quantity = newQty;
  await balance.save();

  return { branchId, productId, previousQty: current, deltaQty: delta, newQty, reason, created };
}

/**
 * Set absolute quantity for a product in a branch (e.g., physical count).
 */
async function setStock(branchId, productId, quantity) {
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty < 0) throw new Error('Invalid quantity');

  const [balance] = await InventoryBalance.findOrCreate({
    where: { branchId, productId },
    defaults: { branchId, productId, quantity: qty },
  });

  balance.quantity = qty;
  await balance.save();

  return { branchId, productId, quantity: qty };
}

/**
 * FIFO verification report for inventory batches.
 */
async function listFifoBatches(branchId, { productId, fromDate, toDate, onlyOpen = false } = {}) {
  const where = { branchId };

  if (productId) where.productId = Number(productId);

  if (fromDate || toDate) {
    where.receivedDate = {};
    if (fromDate) where.receivedDate[Op.gte] = fromDate;
    if (toDate) where.receivedDate[Op.lte] = toDate;
  }

  if (onlyOpen) {
    where.quantityRemaining = { [Op.gt]: 0 };
  }

  const rows = await InventoryBatch.findAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      {
        model: Purchase,
        as: 'purchase',
        attributes: ['id', 'billNo', 'purchaseDate', 'contactId'],
        include: [{ model: Contact, as: 'contact', attributes: ['id', 'name'] }],
      },
      {
        model: PurchaseItem,
        as: 'purchaseItem',
        attributes: ['id', 'quantity', 'unitPrice', 'salePrice', 'batchId'],
        include: [{ model: PurchaseReturnItem, as: 'returnItems', attributes: ['id', 'quantity'] }],
      },
    ],
    order: [['receivedDate', 'ASC'], ['id', 'ASC']],
  });

  const parsedRows = rows.map((batch) => {
    const quantityReceived = parseFloat(batch.quantityReceived || 0);
    const quantityRemaining = parseFloat(batch.quantityRemaining || 0);
    const returnedQty = (batch.purchaseItem?.returnItems || []).reduce(
      (sum, item) => sum + (parseFloat(item.quantity || 0) || 0),
      0
    );
    const expectedRemaining = Number((quantityReceived - returnedQty).toFixed(4));
    const normalizedRemaining = Number(quantityRemaining.toFixed(4));

    const isBatchLinked = Number(batch.purchaseItem?.batchId || 0) === Number(batch.id);
    const isQtyValid = normalizedRemaining >= 0 && normalizedRemaining <= Number(quantityReceived.toFixed(4));
    const matchesReturnMath = Math.abs(normalizedRemaining - expectedRemaining) < 0.0001;
    const isVerified = isBatchLinked && isQtyValid && matchesReturnMath;

    return {
      id: batch.id,
      receivedDate: batch.receivedDate,
      productId: batch.productId,
      productName: batch.product?.name || '-',
      sku: batch.product?.sku || '-',
      purchaseId: batch.purchaseId,
      billNo: batch.purchase?.billNo || '-',
      supplierName: batch.purchase?.contact?.name || '-',
      purchaseItemId: batch.purchaseItemId,
      quantityReceived,
      returnedQty: Number(returnedQty.toFixed(4)),
      quantityRemaining: normalizedRemaining,
      expectedRemaining,
      costPrice: parseFloat(batch.costPrice || 0),
      salePrice: parseFloat(batch.salePrice || 0),
      verification: {
        isBatchLinked,
        isQtyValid,
        matchesReturnMath,
        isVerified,
      },
    };
  });

  const summary = {
    totalBatches: parsedRows.length,
    verifiedBatches: parsedRows.filter((row) => row.verification.isVerified).length,
    openBatches: parsedRows.filter((row) => row.quantityRemaining > 0).length,
  };

  return { summary, rows: parsedRows };
}

/**
 * Product movement history for a branch.
 * Combines stock-in (purchases) and stock-out (sales, purchase returns).
 */
async function listProductHistory(branchId, { productId, startDate, endDate } = {}) {
  const normalizedBranchId = Number(branchId);
  const normalizedProductId = productId ? Number(productId) : null;

  const withDateFilter = (field) => {
    if (!startDate && !endDate) return undefined;
    const clause = {};
    if (startDate) clause[Op.gte] = startDate;
    if (endDate) clause[Op.lte] = endDate;
    return { [field]: clause };
  };

  const purchaseDateWhere = withDateFilter('purchaseDate');
  const saleDateWhere = withDateFilter('saleDate');
  const returnDateWhere = withDateFilter('returnDate');

  const productWhere = normalizedProductId ? { id: normalizedProductId } : undefined;
  const itemWhere = normalizedProductId ? { productId: normalizedProductId } : undefined;

  const purchaseItems = await PurchaseItem.findAll({
    where: itemWhere,
    include: [
      {
        model: Purchase,
        as: 'purchase',
        attributes: ['id', 'billNo', 'purchaseDate'],
        where: {
          branchId: normalizedBranchId,
          ...(purchaseDateWhere || {}),
        },
        required: true,
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku'],
        where: productWhere,
        required: true,
      },
    ],
    order: [['id', 'ASC']],
  });

  const saleItems = await SaleItem.findAll({
    where: itemWhere,
    include: [
      {
        model: Sale,
        as: 'sale',
        attributes: ['id', 'invoiceNo', 'saleDate'],
        where: {
          branchId: normalizedBranchId,
          ...(saleDateWhere || {}),
        },
        required: true,
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku'],
        where: productWhere,
        required: true,
      },
    ],
    order: [['id', 'ASC']],
  });

  const purchaseReturnItems = await PurchaseReturnItem.findAll({
    where: itemWhere,
    include: [
      {
        model: PurchaseReturn,
        as: 'purchaseReturn',
        attributes: ['id', 'returnDate', 'purchaseIdReference'],
        where: {
          branchId: normalizedBranchId,
          ...(returnDateWhere || {}),
        },
        required: true,
        include: [{ model: Purchase, as: 'purchase', attributes: ['id', 'billNo'] }],
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku'],
        where: productWhere,
        required: true,
      },
    ],
    order: [['id', 'ASC']],
  });

  const movements = [];

  purchaseItems.forEach((row) => {
    const qty = parseFloat(row.quantity || 0);
    movements.push({
      movementDate: row.purchase.purchaseDate,
      productId: row.product.id,
      productName: row.product.name,
      sku: row.product.sku || null,
      movementType: 'stock_in',
      source: 'purchase',
      referenceNo: row.purchase.billNo || `PUR-${row.purchase.id}`,
      quantityIn: qty,
      quantityOut: 0,
      deltaQty: qty,
    });
  });

  saleItems.forEach((row) => {
    const qty = parseFloat(row.quantity || 0);
    movements.push({
      movementDate: row.sale.saleDate,
      productId: row.product.id,
      productName: row.product.name,
      sku: row.product.sku || null,
      movementType: 'stock_out',
      source: 'sale',
      referenceNo: row.sale.invoiceNo || `SAL-${row.sale.id}`,
      quantityIn: 0,
      quantityOut: qty,
      deltaQty: -qty,
    });
  });

  purchaseReturnItems.forEach((row) => {
    const qty = parseFloat(row.quantity || 0);
    movements.push({
      movementDate: row.purchaseReturn.returnDate,
      productId: row.product.id,
      productName: row.product.name,
      sku: row.product.sku || null,
      movementType: 'stock_out',
      source: 'purchase_return',
      referenceNo: row.purchaseReturn.purchase?.billNo
        ? `${row.purchaseReturn.purchase.billNo}-RET`
        : `PR-${row.purchaseReturn.id}`,
      quantityIn: 0,
      quantityOut: qty,
      deltaQty: -qty,
    });
  });

  movements.sort((a, b) => {
    if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
    if (a.movementDate !== b.movementDate) return String(a.movementDate).localeCompare(String(b.movementDate));
    return a.referenceNo.localeCompare(b.referenceNo);
  });

  const runningByProduct = new Map();
  const summaryByProduct = new Map();

  const rows = movements.map((movement) => {
    const productKey = movement.productId;
    const currentRunning = runningByProduct.get(productKey) || 0;
    const runningQty = Number((currentRunning + movement.deltaQty).toFixed(4));
    runningByProduct.set(productKey, runningQty);

    const currentSummary = summaryByProduct.get(productKey) || {
      productId: movement.productId,
      productName: movement.productName,
      sku: movement.sku,
      totalStockIn: 0,
      totalStockOut: 0,
      netMovement: 0,
      closingStockFromHistory: 0,
    };

    currentSummary.totalStockIn = Number((currentSummary.totalStockIn + movement.quantityIn).toFixed(4));
    currentSummary.totalStockOut = Number((currentSummary.totalStockOut + movement.quantityOut).toFixed(4));
    currentSummary.netMovement = Number((currentSummary.totalStockIn - currentSummary.totalStockOut).toFixed(4));
    currentSummary.closingStockFromHistory = runningQty;
    summaryByProduct.set(productKey, currentSummary);

    return {
      ...movement,
      runningQty,
    };
  });

  return {
    summary: Array.from(summaryByProduct.values()),
    movements: rows,
  };
}

module.exports = {
  getStockBreakdown,
  getStockInUnit,
  listBranchStock,
  adjustStock,
  setStock,
  listFifoBatches,
  listProductHistory,
};
