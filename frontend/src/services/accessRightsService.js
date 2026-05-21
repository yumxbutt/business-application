import { httpClient } from './httpClient';

export const accessRightsService = {
  async getCatalog() {
    const data = await httpClient.get('/access-rights/catalog');
    return data.catalog || [];
  },

  async updateUserRights(userId, accessRights) {
    const data = await httpClient.put(`/access-rights/users/${userId}`, { accessRights });
    return data.user;
  },
};
