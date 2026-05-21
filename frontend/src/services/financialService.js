import { httpClient } from './httpClient';

export const financialService = {
  async getCashVouchers({ branchId, transactionType = 'all', startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (transactionType) params.set('transactionType', transactionType);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const query = params.toString();
    const data = await httpClient.get(`/financials/cash-vouchers${query ? `?${query}` : ''}`);
    return data.vouchers || [];
  },

  async createCashVoucher(payload) {
    return httpClient.post('/financials/cash-vouchers', payload);
  },
};
