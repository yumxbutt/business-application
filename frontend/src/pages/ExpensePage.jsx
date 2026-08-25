import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import PaymentSelector from '../components/PaymentSelector';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { productService } from '../services/productService';
import { expenseService } from '../services/expenseService';
import { downloadCsv, downloadPdfFromPrintArea } from '../utils/export';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const fmt = (n) => Number(n || 0).toFixed(2);

const blankForm = (branchId = '') => ({
  branchId,
  amount: '',
  expenseDate: today,
  category: '',
  description: '',
  receiptNo: '',
});

export default function ExpensePage() {
  const { user } = useAuth();
  const { has } = useAccess();
  const canCreateExpense = has('expenses:create');
  const canCancelExpense = has('expenses:cancel');
  const [branches, setBranches] = useState([]);
  const defaultBranchId = user?.role === 'main_admin' ? '' : String(user?.branchId || '');
  const [filters, setFilters] = useState({
    branchId: defaultBranchId,
    status: 'all',
    startDate: monthStart,
    endDate: today,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => blankForm(defaultBranchId));
  const [expensePayments, setExpensePayments] = useState([]);

  const selectedBranchName = useMemo(() => {
    const match = branches.find((b) => String(b.id) === String(filters.branchId));
    return match?.name || (user?.branchName || 'Branch');
  }, [branches, filters.branchId, user?.branchName]);

  const loadExpenses = async (nextFilters = filters) => {
    if (!nextFilters.branchId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await expenseService.getExpenses({
        branchId: Number(nextFilters.branchId),
        status: nextFilters.status,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
      });
      setRows(data);
    } catch (err) {
      setError(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productService.getMeta().then((meta) => {
      const list = meta.branches || [];
      setBranches(list);
      if (user?.role === 'main_admin' && !filters.branchId && list[0]) {
        const branchId = String(list[0].id);
        setFilters((prev) => ({ ...prev, branchId }));
        setForm(blankForm(branchId));
      }
    }).catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filters.branchId) loadExpenses();
  }, [filters.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setError('');
    setForm(blankForm(filters.branchId || defaultBranchId));
    setExpensePayments([]);
    setShowForm(true);
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        branchId: form.branchId ? Number(form.branchId) : undefined,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        category: form.category || undefined,
        description: form.description || undefined,
        receiptNo: form.receiptNo || undefined,
        payments: Number(form.amount) > 0 ? expensePayments : [],
      };
      await expenseService.createExpense(payload);
      setShowForm(false);
      setForm(blankForm(filters.branchId || defaultBranchId));
      setExpensePayments([]);
      await loadExpenses();
    } catch (err) {
      setError(err.message || 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  const onCancelExpense = async (expense) => {
    const yes = window.confirm(`Cancel expense ${expense.receiptNo || expense.id}?`);
    if (!yes) return;
    setError('');
    try {
      await expenseService.cancelExpense(expense.id);
      await loadExpenses();
    } catch (err) {
      setError(err.message || 'Failed to cancel expense');
    }
  };

  const exportCsv = () => {
    const csvRows = [
      ['Expense Report'],
      ['Branch', selectedBranchName],
      ['From', filters.startDate || ''],
      ['To', filters.endDate || ''],
      [],
      ['Date', 'Receipt No', 'Category', 'Description', 'Amount', 'Status'],
      ...rows.map((row) => [
        row.expenseDate,
        row.receiptNo || '',
        row.category || '',
        row.description || '',
        fmt(row.amount),
        row.status,
      ]),
    ];
    downloadCsv(csvRows, `expenses-${filters.startDate}-to-${filters.endDate}.csv`);
  };

  const exportPdf = async () => {
    if (!rows.length) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadPdfFromPrintArea(`expenses-${filters.startDate}-to-${filters.endDate}.pdf`, '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  const totalAmount = rows
    .filter((row) => row.status === 'posted')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip no-print">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Expenses</span>
          <span className="page-stat-tile__value">{rows.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Posted Amount</span>
          <span className="page-stat-tile__value">{fmt(totalAmount)}</span>
        </div>
      </div>

      <PageCard
        title="Expenses"
        subtitle="Record branch expenses with payment splits"
        actions={
          <>
            <button type="button" className="secondary-action-button no-print" onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </button>
            <button type="button" className="secondary-action-button no-print" onClick={exportPdf} disabled={!rows.length || exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
            {canCreateExpense ? (
              <Button variant="primary" className="no-print" onClick={openCreate}>
                New Expense
              </Button>
            ) : null}
          </>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="expenseBranchFilter">
              <span>Branch</span>
              <Select
                id="expenseBranchFilter"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'Select branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}
          <label className="form-field" htmlFor="expenseStatus">
            <span>Status</span>
            <Select
              id="expenseStatus"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'posted', label: 'Posted' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </label>
          <label className="form-field" htmlFor="expenseStart">
            <span>From</span>
            <input id="expenseStart" type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="expenseEnd">
            <span>To</span>
            <input id="expenseEnd" type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }}
            onClick={() => loadExpenses(filters)}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading expenses…</p>
        ) : (
          <div className="print-area">
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt No</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.expenseDate}</td>
                    <td>{row.receiptNo || '–'}</td>
                    <td>{row.category || '–'}</td>
                    <td>{row.description || '–'}</td>
                    <td>
                      <span className={row.status === 'posted' ? 'badge badge--green' : 'badge badge--red'}>
                        {row.status}
                      </span>
                    </td>
                    <td className="text-right">{fmt(row.amount)}</td>
                    <td className="text-right no-print">
                      {canCancelExpense ? (
                        <button
                          type="button"
                          className="table-action-button table-action-button--danger"
                          onClick={() => onCancelExpense(row)}
                          disabled={row.status === 'cancelled'}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state-cell">No expenses found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </PageCard>

      {showForm ? (
        <ModalDialog
          title="New Expense"
          subtitle="Posted expense with payment account split"
          onClose={() => setShowForm(false)}
        >
          <form className="auth-form" onSubmit={onSubmit}>
            {user?.role === 'main_admin' ? (
              <label className="form-field" htmlFor="expenseFormBranch">
                <span>Branch</span>
                <Select
                  id="expenseFormBranch"
                  name="branchId"
                  value={form.branchId}
                  onChange={onFormChange}
                  required
                  options={[{ value: '', label: 'Select branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
                />
              </label>
            ) : null}
            <FormField label="Date" name="expenseDate" type="date" value={form.expenseDate} onChange={onFormChange} required />
            <FormField label="Amount" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={onFormChange} required />
            {Number(form.amount) > 0 ? (
              <PaymentSelector
                totalAmount={Number(form.amount)}
                branchId={form.branchId ? Number(form.branchId) : (user?.branchId ? Number(user.branchId) : undefined)}
                onChange={setExpensePayments}
                disabled={saving}
                label="Payment Account"
              />
            ) : null}
            <FormField label="Category" name="category" value={form.category} onChange={onFormChange} placeholder="e.g. Utilities" />
            <FormField label="Receipt No" name="receiptNo" value={form.receiptNo} onChange={onFormChange} placeholder="Auto-generated if blank" />
            <FormField label="Description" name="description" value={form.description} onChange={onFormChange} />
            {error ? <p className="error-text">{error}</p> : null}
            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
