import React from 'react';

export default function DataTable({ columns = [], rows = [], className = '', renderRow, ariaLabel = 'Data table' }){
  return (
    <div className={`table-wrap ${className}`} role="region" aria-label={ariaLabel}>
      <table className="data-table" role="table">
        <thead>
          <tr role="row">
            {columns.map((c) => <th role="columnheader" key={c.key}>{c.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="empty-state-cell">No records found.</td></tr>
          ) : rows.map((r, i) => (
            renderRow ? renderRow(r, i) : (
              <tr role="row" key={r.id || i}>
                {columns.map((c) => <td role="cell" key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
