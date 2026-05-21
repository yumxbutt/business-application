import { httpClient } from './httpClient';

export const settingsService = {
  async getCompanySettings() {
    try {
      return await httpClient.get('/settings');
    } catch {
      return {};
    }
  },

  async saveCompanySettings(payload) {
    return httpClient.post('/settings', payload);
  },
};
