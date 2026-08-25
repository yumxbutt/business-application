import { httpClient } from './httpClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.isActive && filters.isActive !== 'all') params.set('isActive', filters.isActive);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const accountHeadService = {
  async list(filters = {}) {
    const data = await httpClient.get(`/account-heads${buildQuery(filters)}`);
    return {
      accountHeads: data.accountHeads || [],
      types: data.types || [],
    };
  },

  async get(id) {
    const data = await httpClient.get(`/account-heads/${id}`);
    return data.accountHead;
  },

  async create(payload) {
    const data = await httpClient.post('/account-heads', payload);
    return data.accountHead;
  },

  async update(id, payload) {
    const data = await httpClient.put(`/account-heads/${id}`, payload);
    return data.accountHead;
  },

  async updateStatus(id, isActive) {
    const data = await httpClient.patch(`/account-heads/${id}/status`, { isActive });
    return data.accountHead;
  },
};
