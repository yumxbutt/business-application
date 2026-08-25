import { httpClient } from './httpClient';

export const branchService = {
  async getBranches() {
    const data = await httpClient.get('/branches');
    return data.branches || [];
  },

  async createBranch(payload) {
    const data = await httpClient.post('/branches', payload);
    return data.branch;
  },

  async updateBranch(id, payload) {
    const data = await httpClient.put(`/branches/${id}`, payload);
    return data.branch;
  },

  async updateBranchStatus(id, isActive) {
    const data = await httpClient.patch(`/branches/${id}/status`, { isActive });
    return data.branch;
  },
};
