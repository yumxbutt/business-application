import { httpClient } from './httpClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.branchId) params.set('branchId', String(filters.branchId));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const stockTransferService = {
  async listTransfers(filters = {}) {
    const data = await httpClient.get(`/inventory/transfers${buildQuery(filters)}`);
    return data.transfers || [];
  },

  async getTransfer(id) {
    const data = await httpClient.get(`/inventory/transfers/${id}`);
    return data.transfer;
  },

  async createTransfer(payload) {
    const data = await httpClient.post('/inventory/transfers', payload);
    return data.transfer;
  },

  async cancelTransfer(id) {
    const data = await httpClient.patch(`/inventory/transfers/${id}/cancel`, {});
    return data.transfer;
  },
};
