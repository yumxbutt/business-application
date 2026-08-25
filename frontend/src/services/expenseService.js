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

export const expenseService = {
  async getExpenses(filters = {}) {
    const data = await httpClient.get(`/expenses${buildQuery(filters)}`);
    return data.expenses || [];
  },

  async getExpense(id) {
    const data = await httpClient.get(`/expenses/${id}`);
    return data.expense;
  },

  async createExpense(payload) {
    const data = await httpClient.post('/expenses', payload);
    return data.expense;
  },

  async cancelExpense(id) {
    const data = await httpClient.patch(`/expenses/${id}/cancel`, {});
    return data.expense;
  },
};
