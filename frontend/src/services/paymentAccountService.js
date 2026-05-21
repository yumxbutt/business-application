import { httpClient } from './httpClient';

export const paymentAccountService = {
  /** Returns all payment accounts visible to a branch (used in PaymentSelector) */
  async getAccountsForBranch(branchId) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    return httpClient.get(`/payment-accounts/for-branch?${params.toString()}`);
  },

  /** Admin list with full detail */
  async listAccounts({ branchId, accountType, isActive } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (accountType) params.set('accountType', accountType);
    if (isActive !== undefined) params.set('isActive', String(isActive));
    return httpClient.get(`/payment-accounts?${params.toString()}`);
  },

  async createAccount(payload) {
    return httpClient.post('/payment-accounts', payload);
  },

  async updateAccount(id, payload) {
    return httpClient.put(`/payment-accounts/${id}`, payload);
  },

  async toggleAccount(id) {
    return httpClient.patch(`/payment-accounts/${id}/toggle`, {});
  },

  async getAccountStatement(id, { startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return httpClient.get(`/payment-accounts/${id}/statement?${params.toString()}`);
  },
};
