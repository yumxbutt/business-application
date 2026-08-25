import { httpClient } from './httpClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.branchId) params.set('branchId', String(filters.branchId));
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const reportsService = {
  async getSalesSummary(filters = {}) {
    return httpClient.get(`/reports/sales-summary${buildQuery(filters)}`);
  },

  async getPurchaseSummary(filters = {}) {
    return httpClient.get(`/reports/purchase-summary${buildQuery(filters)}`);
  },

  async getProfitLoss(filters = {}) {
    return httpClient.get(`/reports/profit-loss${buildQuery(filters)}`);
  },
};
