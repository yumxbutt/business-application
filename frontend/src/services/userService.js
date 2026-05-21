import { httpClient } from './httpClient';

export const userService = {
  async getUsers(branchId) {
    const query = branchId ? `?branchId=${branchId}` : '';
    const data = await httpClient.get(`/users${query}`);
    return data.users || [];
  },

  async createUser(payload) {
    const data = await httpClient.post('/users', payload);
    return data.user;
  },

  async updateUser(id, payload) {
    const data = await httpClient.put(`/users/${id}`, payload);
    return data.user;
  },

  async updateStatus(id, isActive) {
    const data = await httpClient.patch(`/users/${id}/status`, { isActive });
    return data.user;
  },
};
