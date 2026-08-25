import { httpClient } from './httpClient';

const USER_KEY = 'bms_user';

export const authService = {
  async login(credentials) {
    const data = await httpClient.post('/auth/login', credentials);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },

  async refreshSession() {
    const data = await httpClient.post('/auth/refresh-session', {});
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  async me() {
    const data = await httpClient.get('/auth/me');
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  async logout() {
    await httpClient.post('/auth/logout', {});
    sessionStorage.removeItem(USER_KEY);
  },

  async updateProfile(payload) {
    const data = await httpClient.put('/auth/profile', payload);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  async getLoginActivities(filters = {}) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.status) params.set('status', filters.status);
    if (filters.username) params.set('username', filters.username);
    const query = params.toString();
    return httpClient.get(`/auth/login-activities${query ? `?${query}` : ''}`);
  },

  getUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
