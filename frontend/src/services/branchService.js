import { httpClient } from './httpClient';

export const branchService = {
  async getBranches() {
    const data = await httpClient.get('/branches');
    return data.branches || [];
  },
};
