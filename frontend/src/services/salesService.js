import { httpClient } from './httpClient';

export const salesService = {
  async getSales(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.branchId) params.set('branchId', String(filters.branchId));

    const query = params.toString();
    const data = await httpClient.get(`/sales${query ? `?${query}` : ''}`);
    return data.sales || [];
  },

  async getSale(id) {
    const data = await httpClient.get(`/sales/${id}`);
    return data.sale;
  },

  async createSale(payload) {
    const data = await httpClient.post('/sales', payload);
    return data.sale;
  },

  async getReturns(filters = {}) {
    const params = new URLSearchParams();
    if (filters.saleId) params.set('saleId', String(filters.saleId));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.branchId) params.set('branchId', String(filters.branchId));

    const query = params.toString();
    const data = await httpClient.get(`/sales/returns${query ? `?${query}` : ''}`);
    return data.returns || [];
  },

  async getReturn(id) {
    const data = await httpClient.get(`/sales/returns/${id}`);
    return data.saleReturn;
  },

  async createReturn(payload) {
    const data = await httpClient.post('/sales/returns', payload);
    return data.saleReturn;
  },

  async cancelReturn(id) {
    return httpClient.delete(`/sales/returns/${id}`);
  },

  async updateReturn(id, payload) {
    const data = await httpClient.patch(`/sales/returns/${id}`, payload);
    return data.saleReturn;
  },

  async cancelSale(id) {
    const data = await httpClient.patch(`/sales/${id}/cancel`, {});
    return data.sale;
  },

  async repostSale(id) {
    const data = await httpClient.patch(`/sales/${id}/post`, {});
    return data.sale;
  },
};