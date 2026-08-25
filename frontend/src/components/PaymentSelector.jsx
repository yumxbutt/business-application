import React, { useEffect, useState, useCallback } from 'react';
import { paymentAccountService } from '../services/paymentAccountService';

const toMoney = (value) => Number((Number(value || 0)).toFixed(2));

/**
 * PaymentSelector — reusable multi-account payment split widget.
 *
 * Props:
 *  totalAmount  {number}   — total amount to be paid/received
 *  branchId     {number}   — used to load branch-visible accounts
 *  onChange     {fn}       — called with payments[] = [{ paymentAccountId, accountName, accountType, amount }]
 *  disabled     {boolean}  — lock the UI (e.g. while submitting)
 *  label        {string}   — optional section label
 */
export default function PaymentSelector({ totalAmount = 0, branchId, onChange, disabled = false, label = 'Payment Method' }) {
  const [accounts, setAccounts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState('');

  // Load payment accounts when branchId changes
  useEffect(() => {
    if (!branchId) return;
    setLoadError('');
    paymentAccountService
      .getAccountsForBranch(branchId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAccounts(list);
        // Initialize with first account, full amount — and immediately notify parent
        if (list.length > 0) {
          const initialRows = [{ paymentAccountId: list[0].id, amount: toMoney(totalAmount) }];
          setRows(initialRows);
          if (onChange) {
            onChange([{
              paymentAccountId: list[0].id,
              accountName: list[0].name || '',
              accountType: list[0].accountType || 'cash',
              amount: toMoney(totalAmount),
            }]);
          }
        }
      })
      .catch(() => setLoadError('Could not load payment accounts'));
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent on every change
  const notifyChange = useCallback(
    (nextRows) => {
      if (!onChange) return;
      const payments = nextRows
        .filter((r) => Number(r.amount) > 0 && r.paymentAccountId)
        .map((r) => {
          const acc = accounts.find((a) => a.id === r.paymentAccountId);
          return {
            paymentAccountId: r.paymentAccountId,
            accountName: acc?.name || '',
            accountType: acc?.accountType || 'cash',
            amount: toMoney(r.amount),
          };
        });
      onChange(payments);
    },
    [accounts, onChange]
  );

  // When totalAmount changes and only one row is present, auto-update its amount
  useEffect(() => {
    if (rows.length === 1) {
      const updated = [{ ...rows[0], amount: toMoney(totalAmount) }];
      setRows(updated);
      notifyChange(updated);
    }
  }, [totalAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRowsAndNotify = (next) => {
    const resolved = typeof next === 'function' ? next(rows) : next;
    setRows(resolved);
    notifyChange(resolved);
  };

  const addRow = () => {
    const usedIds = new Set(rows.map((r) => r.paymentAccountId));
    const next = accounts.find((a) => !usedIds.has(a.id));
    setRowsAndNotify([...rows, { paymentAccountId: next?.id || accounts[0]?.id || null, amount: 0 }]);
  };

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index);
    setRowsAndNotify(next.length > 0 ? next : [{ paymentAccountId: accounts[0]?.id || null, amount: totalAmount }]);
  };

  const updateRow = (index, field, value) => {
    setRowsAndNotify((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: field === 'amount' ? toMoney(value) : value,
      };
      return next;
    });
  };

  const allocated = toMoney(rows.reduce((s, r) => s + Number(r.amount || 0), 0));
  const remaining = toMoney(totalAmount - allocated);
  const isBalanced = Math.abs(remaining) < 0.01;

  if (loadError) {
    return <p className="alert-box alert-box--error" style={{ marginTop: '8px' }}>{loadError}</p>;
  }

  if (accounts.length === 0) return null;

  return (
    <div className="payment-selector">
      {label && <div className="payment-selector__label">{label}</div>}

      <div className="payment-selector__rows">
        {rows.map((row, index) => (
            <div key={`${row.paymentAccountId || 'row'}-${index}`} className="payment-selector__row">
              <select
                className="form-input-sm payment-selector__account"
                value={row.paymentAccountId || ''}
                onChange={(e) => updateRow(index, 'paymentAccountId', Number(e.target.value) || null)}
                disabled={disabled}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountType === 'cash' ? '💵' : '🏦'} {a.name}
                    {a.bankName ? ` — ${a.bankName}` : ''}
                    {a.accountNumber ? ` (${a.accountNumber})` : ''}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input-sm payment-selector__amount text-right"
                value={row.amount}
                onChange={(e) => updateRow(index, 'amount', e.target.value)}
                disabled={disabled}
              />

              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn-icon btn-icon--danger"
                  onClick={() => removeRow(index)}
                  disabled={disabled}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
        ))}
      </div>

      <div className="payment-selector__footer">
        <button
          type="button"
          className="btn btn--xs btn--outline"
          onClick={addRow}
          disabled={disabled || rows.length >= accounts.length}
        >
          + Add Account
        </button>

        <div className={`payment-selector__balance ${isBalanced ? 'payment-selector__balance--ok' : 'payment-selector__balance--err'}`}>
          Allocated:{' '}
          <strong>{allocated.toFixed(2)}</strong>
          {' / '}
          {totalAmount.toFixed(2)}
          {isBalanced ? ' ✓' : ` (${remaining > 0 ? '-' : '+'}${Math.abs(remaining).toFixed(2)} remaining)`}
        </div>
      </div>
    </div>
  );
}
