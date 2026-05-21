import { httpClient } from './httpClient';

export const inventoryService = {
  /**
   * Get stock for a single product (breakdown or specific unit).
   * mode: 'all' → multi-unit breakdown   mode: 'unit' → specific unit
   */
  async getProductStock(branchId, productId, { mode = 'all', unitId } = {}) {
    const params = new URLSearchParams({ branchId, productId, mode });
    if (unitId) params.set('unitId', String(unitId));
    return httpClient.get(`/inventory/stock?${params.toString()}`);
  },

  /**
   * Get all products' stock for a branch.
   * mode: 'all' → multi-unit breakdown per product
   * mode: 'unit' + unitId → single unit per product
   */
  async getBranchStock(branchId, { mode = 'all', unitId } = {}) {
    const params = new URLSearchParams({ branchId, mode });
    if (unitId) params.set('unitId', String(unitId));
    const data = await httpClient.get(`/inventory/stock?${params.toString()}`);
    return data.stock || [];
  },

  /**
   * FIFO batch verification report.
   */
  async getFifoReport({ branchId, productId, fromDate, toDate, onlyOpen = false }) {
    const params = new URLSearchParams({ branchId: String(branchId) });
    if (productId) params.set('productId', String(productId));
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    params.set('onlyOpen', onlyOpen ? 'true' : 'false');
    return httpClient.get(`/inventory/fifo-report?${params.toString()}`);
  },

  async getProductHistory({ branchId, productId, startDate, endDate }) {
    const params = new URLSearchParams({ branchId: String(branchId) });
    if (productId) params.set('productId', String(productId));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return httpClient.get(`/inventory/product-history?${params.toString()}`);
  },

  /**
   * Adjust stock (delta in base units positive/negative).
   */
  async adjustStock({ branchId, productId, deltaQty, reason = '' }) {
    return httpClient.post('/inventory/adjustments', { branchId, productId, deltaQty, reason });
  },

  /**
   * Set absolute stock quantity (base units).
   */
  async setStock({ branchId, productId, quantity }) {
    return httpClient.post('/inventory/set', { branchId, productId, quantity });
  },
};
