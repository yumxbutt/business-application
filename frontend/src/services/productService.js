import { httpClient } from './httpClient';

export const productService = {
  async getMeta() {
    return httpClient.get('/products/meta');
  },

  async getProducts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.categoryId) params.set('categoryId', String(filters.categoryId));
    if (filters.typeId) params.set('typeId', String(filters.typeId));
    if (filters.isActive !== 'all') params.set('isActive', filters.isActive === 'active' ? 'true' : 'false');

    const query = params.toString();
    const data = await httpClient.get(`/products${query ? `?${query}` : ''}`);
    return data.products || [];
  },

  async searchProducts(q = '') {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const data = await httpClient.get(`/products/search?${params.toString()}`);
    return data.products || [];
  },

  async getProductUnits(productId) {
    const data = await httpClient.get(`/products/${productId}/units`);
    return data.units || [];
  },

  async createProduct(payload) {
    const data = await httpClient.post('/products', payload);
    return data.product;
  },

  async updateProduct(id, payload) {
    const data = await httpClient.put(`/products/${id}`, payload);
    return data.product;
  },

  async updateStatus(id, isActive) {
    const data = await httpClient.patch(`/products/${id}/status`, { isActive });
    return data.product;
  },

  async getCategories() {
    const data = await httpClient.get('/products/categories');
    return data.categories || [];
  },

  async createCategory(payload) {
    const data = await httpClient.post('/products/categories', payload);
    return data.category;
  },

  async updateCategory(id, payload) {
    const data = await httpClient.put(`/products/categories/${id}`, payload);
    return data.category;
  },

  async getTypes() {
    const data = await httpClient.get('/products/types');
    return data.types || [];
  },

  async createType(payload) {
    const data = await httpClient.post('/products/types', payload);
    return data.type;
  },

  async updateType(id, payload) {
    const data = await httpClient.put(`/products/types/${id}`, payload);
    return data.type;
  },

  async getUnits() {
    const data = await httpClient.get('/products/units');
    return data.units || [];
  },

  async createUnit(payload) {
    const data = await httpClient.post('/products/units', payload);
    return data.unit;
  },

  async updateUnit(id, payload) {
    const data = await httpClient.put(`/products/units/${id}`, payload);
    return data.unit;
  },

  async getAttributes() {
    const data = await httpClient.get('/products/attributes');
    return data.attributes || [];
  },

  async createAttribute(payload) {
    const data = await httpClient.post('/products/attributes', payload);
    return data.attribute;
  },

  async updateAttribute(id, payload) {
    const data = await httpClient.put(`/products/attributes/${id}`, payload);
    return data.attribute;
  },

  async addAttributeValue(id, payload) {
    const data = await httpClient.post(`/products/attributes/${id}/values`, payload);
    return data.value;
  },

  async getVariants(filters = {}) {
    const params = new URLSearchParams();
    if (filters.productId) params.set('productId', String(filters.productId));
    if (filters.isActive !== undefined && filters.isActive !== 'all') {
      params.set('isActive', filters.isActive === 'active' ? 'true' : 'false');
    }
    const query = params.toString();
    const data = await httpClient.get(`/products/variants${query ? `?${query}` : ''}`);
    return data.variants || [];
  },

  async createVariant(payload) {
    const data = await httpClient.post('/products/variants', payload);
    return data.variant;
  },

  async updateVariant(id, payload) {
    const data = await httpClient.put(`/products/variants/${id}`, payload);
    return data.variant;
  },

  async updateVariantStatus(id, isActive) {
    const data = await httpClient.patch(`/products/variants/${id}/status`, { isActive });
    return data.variant;
  },

  async getBranchSettings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.productId) params.set('productId', String(filters.productId));
    if (filters.branchId) params.set('branchId', String(filters.branchId));
    const query = params.toString();
    const data = await httpClient.get(`/products/branch-settings${query ? `?${query}` : ''}`);
    return data.settings || [];
  },

  async createBranchSetting(payload) {
    const data = await httpClient.post('/products/branch-settings', payload);
    return data.setting;
  },

  async updateBranchSetting(id, payload) {
    const data = await httpClient.put(`/products/branch-settings/${id}`, payload);
    return data.setting;
  },

  async updateBranchSettingAvailability(id, isAvailable) {
    const data = await httpClient.patch(`/products/branch-settings/${id}/availability`, { isAvailable });
    return data.setting;
  },
};