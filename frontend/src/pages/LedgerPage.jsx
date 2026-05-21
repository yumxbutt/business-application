import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { useAuth } from '../context/AuthContext';
import { contactService } from '../services/contactService';
import { branchService } from '../services/branchService';
import { ledgerService } from '../services/ledgerService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';

export default function LedgerPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const shouldAutoLoad = useRef(Boolean(searchParams.get('contactId')));
  const autoLoaded = useRef(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    const urlBranchId = searchParams.get('branchId');
    if (urlBranchId) return String(urlBranchId);
    if (user?.role === 'main_admin') return '';
    return String(user?.branchId || '');
  });
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(searchParams.get('contactId') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entries, setEntries] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [company, setCompany] = useState({});

  useEffect(() => {
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
    if (user?.role === 'main_admin') {
      branchService.getBranches().then(setBranches).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const branchId = selectedBranchId ? Number(selectedBranchId) : user?.branchId;
    contactService.getContacts({ branchId, isActive: 'active' }).then(setContacts).catch(() => {});
  }, [selectedBranchId, user?.branchId]);

  const loadLedger = async () => {
    if (user?.role === 'main_admin' && !selectedBranchId) {
      setError('Please select a branch.');
      return;
    }
    if (!selectedContactId) {
      setError('Please select a contact.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(false);
    try {
      const branchId = selectedBranchId ? Number(selectedBranchId) : user?.branchId;
      const result = await ledgerService.getContactLedger(selectedContactId, {
        branchId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      
      // Filter entries by date range if specified
      let filteredEntries = result.entries || [];
      if (startDate) {
        const startdt = new Date(startDate);
        filteredEntries = filteredEntries.filter(e => new Date(e.entryDate) >= startdt);
      }
      if (endDate) {
        const enddt = new Date(endDate);
        filteredEntries = filteredEntries.filter(e => new Date(e.entryDate) <= enddt);
      }
      
      setOpeningBalance(result.openingBalance ?? null);
      setEntries(filteredEntries);
      setSearched(true);
    } catch (e) {
      console.error('Ledger load error:', e);
      setError(e.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const fmt = (n) => Number(n || 0).toFixed(2);
  const fmtBalance = (n) => {
    const value = Number(n || 0);
    if (value === 0) return '0.00';
    return `${Math.abs(value).toFixed(2)} ${value >= 0 ? 'Dr' : 'Cr'}`;
  };

  const handlePrint = () => {
    if (!searched) return;
    const contactObj = contacts.find((c) => String(c.id) === String(selectedContactId));
    const branchObj = branches.find((b) => String(b.id) === String(selectedBranchId));
    const branchLabel = branchObj ? branchObj.name : (user?.role !== 'main_admin' ? 'My Branch' : '–');
    const tableRows = entries.map((e) =>
      `<tr>
        <td>${fmtPrintDate(e.entryDate)}</td>
        <td>${e.referenceType ? `<span class="badge badge-b">${e.referenceType}</span>` : '–'}</td>
        <td>${e.referenceNo || '–'}</td>
        <td>${e.description || '–'}</td>
        <td class="tr dr">${Number(e.debit) > 0 ? fmtNum(e.debit) : '–'}</td>
        <td class="tr cr">${Number(e.credit) > 0 ? fmtNum(e.credit) : '–'}</td>
        <td class="tr">${fmtBalance(e.runningBalance)}</td>
      </tr>`
    ).join('');
    const openingRow = openingBalance !== null
      ? `<tr><td colspan="3" style="font-style:italic;color:#6b7280">Opening Balance</td><td></td><td class="tr">–</td><td class="tr">–</td><td class="tr">${fmtBalance(openingBalance)}</td></tr>`
      : '';
    const body = `<table>
      <thead><tr>
        <th>Date</th><th>Type</th><th>Ref No.</th><th>Description</th>
        <th class="tr">Debit</th><th class="tr">Credit</th><th class="tr">Balance</th>
      </tr></thead>
      <tbody>${openingRow}${tableRows}${entries.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:20px;color:#6b7280">No entries found.</td></tr>' : ''}</tbody>
    </table>`;
    openPrintWindow({
      title: 'Contact Ledger',
      titleBar: 'CONTACT LEDGER',
      company,
      metaFields: [
        ['Contact', contactObj ? contactObj.name : '–'],
        ['Branch', branchLabel],
        ['From', startDate || 'All'],
        ['To', endDate || 'All'],
      ],
      bodyHtml: body,
    });
  };

  useEffect(() => {
    if (!shouldAutoLoad.current || autoLoaded.current) return;
    if (!selectedContactId) return;
    if (user?.role === 'main_admin' && !selectedBranchId) return;

    autoLoaded.current = true;
    loadLedger();
  }, [selectedContactId, selectedBranchId, user?.role]);

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Contact Ledger"
        subtitle="View full transaction history and running balance for any contact"
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters">
          {user?.role === 'main_admin' && (
            <label className="form-field" htmlFor="ledgerBranch">
              <span>Branch *</span>
              <select
                id="ledgerBranch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="">— Select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field" htmlFor="ledgerContact">
            <span>Contact *</span>
            <select
              id="ledgerContact"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
            >
              <option value="">— Select contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.recordType})
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" htmlFor="ledgerStart">
            <span>From</span>
            <input
              id="ledgerStart"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="form-field" htmlFor="ledgerEnd">
            <span>To</span>
            <input
              id="ledgerEnd"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="inline-actions inline-actions--end">
          <button type="button" className="secondary-action-button" onClick={handlePrint} disabled={!searched}>
            &#128424; Print
          </button>
          <button type="button" className="primary-action-button" onClick={loadLedger}>
            Load Ledger
          </button>
        </div>

        {loading ? (
          <p>Loading ledger entries…</p>
        ) : searched ? (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry Date</th>
                  <th>Reference</th>
                  <th>Ref No.</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {openingBalance !== null ? (
                  <tr className="ledger-opening-row">
                    <td colSpan="3">Opening Balance</td>
                    <td />
                    <td className="text-right">–</td>
                    <td className="text-right">–</td>
                    <td className="text-right">{fmtBalance(openingBalance)}</td>
                  </tr>
                ) : null}

                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.entryDate)}</td>
                    <td>
                      {entry.referenceType ? (
                        <span className="badge badge--gray">{entry.referenceType}</span>
                      ) : '–'}
                    </td>
                    <td>{entry.referenceNo || '–'}</td>
                    <td>{entry.description || '–'}</td>
                    <td className="text-right ledger-debit">{entry.debit > 0 ? fmt(entry.debit) : '–'}</td>
                    <td className="text-right ledger-credit">{entry.credit > 0 ? fmt(entry.credit) : '–'}</td>
                    <td className="text-right">{fmtBalance(entry.runningBalance)}</td>
                  </tr>
                ))}

                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state-cell">
                      No ledger entries found for the selected period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </PageCard>
    </div>
  );
}
