import { httpClient } from './httpClient';

export const purchaseService = {
  async getPurchases(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.branchId) params.set('branchId', String(filters.branchId));

    const query = params.toString();
    const data = await httpClient.get(`/purchases${query ? `?${query}` : ''}`);
    return data.purchases || [];
  },

  async getPurchase(id) {
    const data = await httpClient.get(`/purchases/${id}`);
    return data.purchase;
  },

  async createPurchase(payload) {
    const data = await httpClient.post('/purchases', payload);
    return data.purchase;
  },

  async updatePurchase(id, payload) {
    const data = await httpClient.put(`/purchases/${id}`, payload);
    return data.purchase;
  },

  async cancelPurchase(id) {
    const data = await httpClient.patch(`/purchases/${id}/cancel`, {});
    return data.purchase;
  },

  async getReturns(filters = {}) {
    const params = new URLSearchParams();
    if (filters.purchaseId) params.set('purchaseId', String(filters.purchaseId));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.branchId) params.set('branchId', String(filters.branchId));

    const query = params.toString();
    const data = await httpClient.get(`/purchases/returns${query ? `?${query}` : ''}`);
    return data.returns || [];
  },

  async getReturn(id) {
    const data = await httpClient.get(`/purchases/returns/${id}`);
    return data.purchaseReturn;
  },

  async createReturn(payload) {
    const data = await httpClient.post('/purchases/returns', payload);
    return data.purchaseReturn;
  },

  async cancelReturn(id) {
    const data = await httpClient.delete(`/purchases/returns/${id}`);
    return data;
  },

  async updateReturn(id, payload) {
    const data = await httpClient.patch(`/purchases/returns/${id}`, payload);
    return data.purchaseReturn;
  },
};
