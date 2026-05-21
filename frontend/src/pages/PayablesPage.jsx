import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { useAuth } from '../context/AuthContext';
import { branchService } from '../services/branchService';
import { ledgerService } from '../services/ledgerService';

export default function PayablesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(
    user?.role === 'main_admin' ? '' : String(user?.branchId || '')
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'main_admin') {
      branchService.getBranches().then(setBranches).catch(() => {});
    }
  }, [user]);

  const load = async () => {
    if (user?.role === 'main_admin' && !selectedBranchId) {
      setError('Please select a branch.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const branchId = selectedBranchId ? Number(selectedBranchId) : user?.branchId;
      const data = await ledgerService.getPayables({ branchId });
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedBranchId, user?.branchId, user?.role]);

  const fmtAbs = (n) => Math.round(Math.abs(Number(n || 0))).toLocaleString('en-US');
  // We owe suppliers: positive = Cr (they are credited), negative = Dr
  const drCr = (n) => Number(n) >= 0 ? 'Cr' : 'Dr';
  const amtClass = (n) => Number(n) >= 0 ? 'ledger-credit' : 'ledger-debit';

  const total = rows.reduce((sum, r) => sum + Number(r.outstandingAmount || 0), 0);

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Suppliers</span>
          <span className="page-stat-tile__value">{rows.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Total Payable</span>
          <span className="page-stat-tile__value">{Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Fully Settled</span>
          <span className="page-stat-tile__value">{rows.filter((r) => Number(r.outstandingAmount || 0) === 0).length}</span>
        </div>
      </div>
      <PageCard
        title="Supplier Balances"
        subtitle="Outstanding amounts owed to suppliers"
        actions={
          <button type="button" className="secondary-action-button" onClick={load}>
            Refresh
          </button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        {user?.role === 'main_admin' && (
          <div className="table-filters">
            <label className="form-field" htmlFor="payablesBranch">
              <span>Branch *</span>
              <select
                id="payablesBranch"
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
          </div>
        )}

        {loading ? (
          <p>Loading payables…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th className="text-right">Outstanding Balance</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.contactId}>
                    <td>{row.contactName}</td>
                    <td>{row.phone || '–'}</td>
                    <td className={`text-right ${amtClass(row.outstandingAmount)}`}>
                      {fmtAbs(row.outstandingAmount)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{drCr(row.outstandingAmount)}</span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="table-action-button"
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('contactId', row.contactId);
                          if (selectedBranchId) params.set('branchId', selectedBranchId);
                          navigate(`/ledger?${params.toString()}`);
                        }}
                      >
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state-cell">
                      No outstanding payables.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="table-total-row">
                    <td colSpan="2">
                      <strong>Total Supplier Balance</strong>
                    </td>
                    <td className={`text-right ${amtClass(total)}`}>
                      <strong>{fmtAbs(total)} <span style={{ fontSize: '0.75rem' }}>{drCr(total)}</span></strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}
