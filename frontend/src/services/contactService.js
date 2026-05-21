import { httpClient } from './httpClient';

export const contactService = {
  async getContacts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.branchId) params.set('branchId', String(filters.branchId));
    if (filters.search) params.set('search', filters.search);
    if (filters.recordType) params.set('recordType', filters.recordType);
    if (filters.isActive && filters.isActive !== 'all') params.set('isActive', filters.isActive);

    const query = params.toString();
    const data = await httpClient.get(`/contacts${query ? `?${query}` : ''}`);
    return data.contacts || [];
  },

  async getCustomers(branchId) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    const query = params.toString();
    const data = await httpClient.get(`/contacts/list/customers${query ? `?${query}` : ''}`);
    return data.customers || [];
  },

  async getSuppliers(branchId) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    const query = params.toString();
    const data = await httpClient.get(`/contacts/list/suppliers${query ? `?${query}` : ''}`);
    return data.suppliers || [];
  },

  async createContact(payload) {
    const data = await httpClient.post('/contacts', payload);
    return data.contact;
  },

  async updateContact(id, payload) {
    const data = await httpClient.put(`/contacts/${id}`, payload);
    return data.contact;
  },

  async updateStatus(id, isActive) {
    const data = await httpClient.patch(`/contacts/${id}/status`, { isActive });
    return data.contact;
  },
};
