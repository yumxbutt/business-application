import { useEffect, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import ModalDialog from '../components/ui/ModalDialog';
import { Button, Input, Select } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { paymentAccountService } from '../services/paymentAccountService';
import { branchService } from '../services/branchService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';
import Spinner from '../components/ui/Spinner';

const defaultForm = {
  accountType: 'cash',
  name: '',
  bankName: '',
  accountNumber: '',
  bankBranchName: '',
  openingBalance: '0',
  openingDate: new Date().toISOString().split('T')[0],
  branchId: '',
  sortOrder: '0',
};

export default function PaymentAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);

  // Statement modal
  const [stmtAcc, setStmtAcc] = useState(null);
  const [stmtData, setStmtData] = useState(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState('');
  const [stmtFilters, setStmtFilters] = useState({ startDate: '', endDate: '' });
  const [company, setCompany] = useState({});

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paymentAccountService.listAccounts({
        branchId: user?.role !== 'main_admin' ? user?.branchId : undefined,
      });
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadAccounts();
    if (user?.role === 'main_admin') loadBranches();
    settingsService.getCompanySettings().then((s) => setCompany(s || {})).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openStatement = async (acc) => {
    setStmtAcc(acc);
    setStmtData(null);
    setStmtError('');
    setStmtFilters({ startDate: '', endDate: '' });
    setStmtLoading(true);
    try {
      const data = await paymentAccountService.getAccountStatement(acc.id, {});
      setStmtData(data);
    } catch (e) {
      setStmtError(e.message || 'Failed to load statement');
    } finally {
      setStmtLoading(false);
    }
  };

  const applyStmtFilters = async () => {
    if (!stmtAcc) return;
    setStmtLoading(true);
    setStmtError('');
    try {
      const data = await paymentAccountService.getAccountStatement(stmtAcc.id, stmtFilters);
      setStmtData(data);
    } catch (e) {
      setStmtError(e.message || 'Failed to load statement');
    } finally {
      setStmtLoading(false);
    }
  };

  const printStatement = () => {
    if (!stmtData) return;
    const acc = stmtData.account;
    const fmtBal = (n) => {
      const v = Number(n || 0);
      return v === 0 ? '0.00' : (v > 0 ? `${fmtNum(v)} Dr` : `${fmtNum(Math.abs(v))} Cr`);
    };
    const rows = stmtData.rows.map((r) => `
      <tr>
        <td>${fmtPrintDate(r.date)}</td>
        <td>${r.referenceNo || '—'}</td>
        <td>${r.contactName || '—'}</td>
        <td>${r.description || '—'}</td>
        <td class="tr">${r.debit > 0 ? fmtNum(r.debit) : ''}</td>
        <td class="tr">${r.credit > 0 ? fmtNum(r.credit) : ''}</td>
        <td class="tr">${fmtBal(r.balance)}</td>
      </tr>`).join('');
    const body = `
      <div style="margin-bottom:12px;padding:10px 0;border-bottom:1px solid #e5e7eb;display:flex;gap:32px;flex-wrap:wrap;font-size:11px">
        <div><span style="color:#6b7280;text-transform:uppercase;font-size:9px">Type</span><br><strong>${acc.accountType === 'cash' ? '💵 Cash' : '🏦 Bank'}</strong></div>
        ${acc.bankName ? `<div><span style="color:#6b7280;text-transform:uppercase;font-size:9px">Bank</span><br><strong>${acc.bankName}</strong></div>` : ''}
        ${acc.accountNumber ? `<div><span style="color:#6b7280;text-transform:uppercase;font-size:9px">Account No.</span><br><strong>${acc.accountNumber}</strong></div>` : ''}
        <div><span style="color:#6b7280;text-transform:uppercase;font-size:9px">Branch</span><br><strong>${acc.branchName}</strong></div>
        <div><span style="color:#6b7280;text-transform:uppercase;font-size:9px">Opening Balance</span><br><strong>${fmtBal(acc.openingBalance)}</strong></div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Reference</th><th>Party</th><th>Narration</th>
          <th class="tr">Debit (Dr)</th><th class="tr">Credit (Cr)</th><th class="tr">Balance</th>
        </tr></thead>
        <tbody>
          <tr style="background:#f3f4f6;font-style:italic">
            <td colspan="6">Opening Balance</td>
            <td class="tr">${fmtBal(stmtData.openingBalance)}</td>
          </tr>
          ${rows || '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:12px">No transactions in this period</td></tr>'}
        </tbody>
        <tfoot><tr>
          <td colspan="6" style="font-weight:700">Closing Balance</td>
          <td class="tr">${fmtBal(stmtData.closingBalance)}</td>
        </tr></tfoot>
      </table>`;
    openPrintWindow({
      title: `Statement: ${acc.name}`,
      titleBar: 'ACCOUNT STATEMENT',
      company,
      metaFields: [
        ['Account', acc.name],
        ['Type', acc.accountType === 'cash' ? 'Cash Account' : 'Bank Account'],
        ['Period', stmtFilters.startDate || stmtFilters.endDate
          ? `${stmtFilters.startDate || 'Start'} → ${stmtFilters.endDate || 'Today'}`
          : 'All Transactions'],
        ['Branch', acc.branchName],
      ],
      bodyHtml: body,
      showSignatures: false,
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...defaultForm,
      branchId: user?.role !== 'main_admin' ? String(user?.branchId || '') : '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setForm({
      accountType: acc.accountType || 'cash',
      name: acc.name || '',
      bankName: acc.bankName || '',
      accountNumber: acc.accountNumber || '',
      bankBranchName: acc.bankBranchName || '',
      openingBalance: String(acc.openingBalance ?? '0'),
      openingDate: acc.openingDate || new Date().toISOString().split('T')[0],
      branchId: acc.branchId ? String(acc.branchId) : '',
      sortOrder: String(acc.sortOrder ?? '0'),
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setError('');
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        accountType: form.accountType,
        name: form.name,
        bankName: form.bankName || undefined,
        accountNumber: form.accountNumber || undefined,
        bankBranchName: form.bankBranchName || undefined,
        openingBalance: Number(form.openingBalance || 0),
        openingDate: form.openingDate || undefined,
        branchId: form.branchId ? Number(form.branchId) : null,
        sortOrder: Number(form.sortOrder || 0),
      };
      if (editingId) {
        await paymentAccountService.updateAccount(editingId, payload);
        setSuccess('Account updated successfully');
      } else {
        await paymentAccountService.createAccount(payload);
        setSuccess('Account created successfully');
      }
      closeModal();
      await loadAccounts();
    } catch (e) {
      setError(e.message || 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (acc) => {
    try {
      await paymentAccountService.toggleAccount(acc.id);
      await loadAccounts();
    } catch (e) {
      setError(e.message || 'Failed to toggle account');
    }
  };

  // Stat strip
  const total = accounts.length;
  const active = accounts.filter((a) => a.isActive).length;
  const banks = accounts.filter((a) => a.accountType === 'bank').length;
  const cashCount = accounts.filter((a) => a.accountType === 'cash').length;

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Payment Accounts"
        subtitle="Manage cash accounts and bank accounts used across all transactions"
        actions={
          <Button variant="primary" onClick={openCreate}>
            + Add Account
          </Button>
        }
      >
        {success && (
          <div className="alert-box alert-box--success" style={{ marginBottom: 12 }}>
            {success}
            <button className="alert-box__close" onClick={() => setSuccess('')}>×</button>
          </div>
        )}
        {error && !isModalOpen && (
          <div className="alert-box alert-box--error" style={{ marginBottom: 12 }}>
            {error}
            <button className="alert-box__close" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Stat strip */}
        <div className="page-stats-strip" style={{ marginBottom: 16 }}>
          <div className="page-stat-tile page-stat-tile--primary">
            <span className="page-stat-tile__label">Total Accounts</span>
            <span className="page-stat-tile__value">{total}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--success">
            <span className="page-stat-tile__label">Active</span>
            <span className="page-stat-tile__value">{active}</span>
          </div>
          <div className="page-stat-tile">
            <span className="page-stat-tile__label">Cash Accounts</span>
            <span className="page-stat-tile__value">{cashCount}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--purple">
            <span className="page-stat-tile__label">Bank Accounts</span>
            <span className="page-stat-tile__value">{banks}</span>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Bank Name</th>
                  <th>Account No.</th>
                  <th>Branch</th>
                  <th className="text-right">Opening Balance</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted,#888)', padding: '24px' }}>
                      No payment accounts configured yet.
                    </td>
                  </tr>
                )}
                {accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td>
                      <span style={{ marginRight: 6 }}>{acc.accountType === 'cash' ? '💵' : '🏦'}</span>
                      {acc.name}
                    </td>
                    <td>
                      <span className={`badge badge--${acc.accountType === 'cash' ? 'info' : 'primary'}`}>
                        {acc.accountType === 'cash' ? 'Cash' : 'Bank'}
                      </span>
                    </td>
                    <td>{acc.bankName || '—'}</td>
                    <td>{acc.accountNumber || '—'}</td>
                    <td>{acc.branch?.name || (acc.branchId ? `Branch #${acc.branchId}` : 'All Branches')}</td>
                    <td className="text-right">{Number(acc.openingBalance || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge badge--${acc.isActive ? 'success' : 'danger'}`}>
                        {acc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button variant="secondary" size="sm" onClick={() => openStatement(acc)}>Statement</Button>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(acc)}>Edit</Button>
                        <Button
                          variant={acc.isActive ? 'danger' : 'primary'}
                          size="sm"
                          onClick={() => handleToggle(acc)}
                        >
                          {acc.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {/* Add / Edit Modal */}
      {/* Statement Modal */}
      {stmtAcc && (
        <ModalDialog
          isOpen={!!stmtAcc}
          onClose={() => { setStmtAcc(null); setStmtData(null); }}
          title={`Account Statement — ${stmtAcc.name}`}
        >
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
            <label className="form-field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
              <span style={{ fontSize: '0.8rem' }}>From Date</span>
              <Input type="date" value={stmtFilters.startDate}
                onChange={(e) => setStmtFilters((p) => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="form-field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
              <span style={{ fontSize: '0.8rem' }}>To Date</span>
              <Input type="date" value={stmtFilters.endDate}
                onChange={(e) => setStmtFilters((p) => ({ ...p, endDate: e.target.value }))} />
            </label>
            <Button variant="primary" onClick={applyStmtFilters} disabled={stmtLoading}>Apply</Button>
            <Button variant="secondary" onClick={printStatement} disabled={!stmtData || stmtLoading}>&#128424; Print</Button>
          </div>

          {stmtError && <div className="alert-box alert-box--error" style={{ marginBottom: 10 }}>{stmtError}</div>}

          {stmtLoading ? <Spinner /> : stmtData ? (
            <>
              {/* Summary strip */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 16px', marginBottom: 12, fontSize: '0.82rem' }}>
                <div><span style={{ color: '#6b7280' }}>Opening Balance: </span><strong>{stmtData.openingBalance >= 0 ? fmtNum(stmtData.openingBalance) + ' Dr' : fmtNum(Math.abs(stmtData.openingBalance)) + ' Cr'}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Transactions: </span><strong>{stmtData.rows.length}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Total Dr: </span><strong style={{ color: '#16a34a' }}>{fmtNum(stmtData.rows.reduce((s, r) => s + r.debit, 0))}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Total Cr: </span><strong style={{ color: '#dc2626' }}>{fmtNum(stmtData.rows.reduce((s, r) => s + r.credit, 0))}</strong></div>
                <div><span style={{ color: '#6b7280' }}>Closing Balance: </span><strong style={{ color: stmtData.closingBalance >= 0 ? '#15803d' : '#dc2626' }}>{stmtData.closingBalance >= 0 ? fmtNum(stmtData.closingBalance) + ' Dr' : fmtNum(Math.abs(stmtData.closingBalance)) + ' Cr'}</strong></div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Party</th>
                      <th>Narration</th>
                      <th className="text-right">Dr</th>
                      <th className="text-right">Cr</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#f3f4f6', fontStyle: 'italic', fontSize: '0.78rem' }}>
                      <td colSpan={6} style={{ color: '#6b7280' }}>Opening Balance</td>
                      <td className="text-right">
                        <strong>{stmtData.openingBalance >= 0
                          ? `${fmtNum(stmtData.openingBalance)} Dr`
                          : `${fmtNum(Math.abs(stmtData.openingBalance))} Cr`}
                        </strong>
                      </td>
                    </tr>
                    {stmtData.rows.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>No transactions found for this period</td></tr>
                    )}
                    {stmtData.rows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>{row.date}</td>
                        <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.76rem' }}>{row.referenceNo || '—'}</td>
                        <td>{row.contactName}</td>
                        <td style={{ color: '#6b7280', fontSize: '0.75rem' }}>{row.description || '—'}</td>
                        <td className="text-right" style={{ color: '#16a34a', fontWeight: row.debit > 0 ? 600 : 400 }}>
                          {row.debit > 0 ? fmtNum(row.debit) : ''}
                        </td>
                        <td className="text-right" style={{ color: '#dc2626', fontWeight: row.credit > 0 ? 600 : 400 }}>
                          {row.credit > 0 ? fmtNum(row.credit) : ''}
                        </td>
                        <td className="text-right" style={{ fontWeight: 600, color: row.balance >= 0 ? '#15803d' : '#dc2626' }}>
                          {row.balance >= 0
                            ? `${fmtNum(row.balance)} Dr`
                            : `${fmtNum(Math.abs(row.balance))} Cr`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f9fafb' }}>
                      <td colSpan={6} style={{ fontWeight: 700, padding: '8px' }}>Closing Balance</td>
                      <td className="text-right" style={{ fontWeight: 700, color: stmtData.closingBalance >= 0 ? '#15803d' : '#dc2626', padding: '8px' }}>
                        {stmtData.closingBalance >= 0
                          ? `${fmtNum(stmtData.closingBalance)} Dr`
                          : `${fmtNum(Math.abs(stmtData.closingBalance))} Cr`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : null}

          <div className="inline-actions inline-actions--end" style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => { setStmtAcc(null); setStmtData(null); }}>Close</Button>
          </div>
        </ModalDialog>
      )}

      {isModalOpen && (
      <ModalDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Payment Account' : 'Add Payment Account'}
      >
        {error && isModalOpen && (
          <div className="alert-box alert-box--error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="form-field">
            <span>Account Type</span>
            <Select
              name="accountType"
              value={form.accountType}
              onChange={onFormChange}
              options={[
                { value: 'cash', label: '💵 Cash' },
                { value: 'bank', label: '🏦 Bank' },
              ]}
            />
          </label>

          <label className="form-field">
            <span>Account Name <span style={{ color: 'var(--color-danger,red)' }}>*</span></span>
            <Input
              name="name"
              value={form.name}
              onChange={onFormChange}
              required
              placeholder={form.accountType === 'cash' ? 'e.g. Main Cash' : 'e.g. HBL Current A/C'}
            />
          </label>

          {form.accountType === 'bank' && (
            <>
              <label className="form-field">
                <span>Bank Name</span>
                <Input name="bankName" value={form.bankName} onChange={onFormChange} placeholder="e.g. Habib Bank Limited" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-field">
                  <span>Account Number</span>
                  <Input name="accountNumber" value={form.accountNumber} onChange={onFormChange} placeholder="e.g. 0123456789" />
                </label>
                <label className="form-field">
                  <span>Bank Branch Name</span>
                  <Input name="bankBranchName" value={form.bankBranchName} onChange={onFormChange} placeholder="e.g. Gulberg Branch" />
                </label>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="form-field">
              <span>Opening Balance</span>
              <Input name="openingBalance" type="number" step="0.01" value={form.openingBalance} onChange={onFormChange} />
            </label>
            <label className="form-field">
              <span>Opening Date</span>
              <Input name="openingDate" type="date" value={form.openingDate} onChange={onFormChange} />
            </label>
          </div>

          {user?.role === 'main_admin' && (
            <label className="form-field">
              <span>Branch Scope</span>
              <Select
                name="branchId"
                value={form.branchId}
                onChange={onFormChange}
                options={[
                  { value: '', label: 'All Branches (Global)' },
                  ...branches.map((b) => ({ value: String(b.id), label: b.name })),
                ]}
              />
            </label>
          )}

          <label className="form-field">
            <span>Sort Order</span>
            <Input name="sortOrder" type="number" min="0" value={form.sortOrder} onChange={onFormChange} />
          </label>

          <div className="inline-actions inline-actions--end" style={{ marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Account')}
            </Button>
          </div>
        </form>
      </ModalDialog>
      )}
    </div>
  );
}
