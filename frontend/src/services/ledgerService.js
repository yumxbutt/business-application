import { httpClient } from './httpClient';

export const ledgerService = {
  async getContactLedger(contactId, { branchId, startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const query = params.toString();
    const data = await httpClient.get(`/ledger/contact/${contactId}${query ? `?${query}` : ''}`);
    
    // Backend returns { entries: [...] }, unwrap and calculate opening balance
    const entries = data.entries || [];
    
    // Calculate opening balance: sum of all entries before startDate
    let openingBalance = 0;
    if (startDate && entries.length > 0) {
      const startdt = new Date(startDate);
      entries.forEach(entry => {
        if (new Date(entry.entryDate) < startdt) {
          openingBalance += parseFloat(entry.debit || 0) - parseFloat(entry.credit || 0);
        }
      });
    }
    
    return {
      openingBalance: startDate ? openingBalance : null,
      entries,
    };
  },

  async getReceivables({ branchId } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));

    const query = params.toString();
    const data = await httpClient.get(`/ledger/receivables${query ? `?${query}` : ''}`);
    return data.receivables || [];
  },

  async getPayables({ branchId } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));

    const query = params.toString();
    const data = await httpClient.get(`/ledger/payables${query ? `?${query}` : ''}`);
    return data.payables || [];
  },

  async getLedgerReport({ branchId, startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const query = params.toString();
    const data = await httpClient.get(`/ledger/report${query ? `?${query}` : ''}`);
    return data.entries || [];
  },

  async getCashBook({ branchId, startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const query = params.toString();
    return httpClient.get(`/ledger/cash-book${query ? `?${query}` : ''}`);
  },

  async getTradingLedgerRegister({ branchId, startDate, endDate } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return httpClient.get(`/ledger/trading-register${query ? `?${query}` : ''}`);
  },

  async getOpeningBalance({ branchId } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    const query = params.toString();
    return httpClient.get(`/ledger/opening-balance${query ? `?${query}` : ''}`);
  },

  async setOpeningBalance({ branchId, openingBalance, openingDate, notes } = {}) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', String(branchId));
    const query = params.toString();
    return httpClient.post(`/ledger/opening-balance${query ? `?${query}` : ''}`, {
      openingBalance,
      openingDate,
      notes,
    });
  },
};
