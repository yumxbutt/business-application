// Modern Data Table
import React from 'react';

export function ModernDataTable({ columns, data, actions = [] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.title}</th>
            ))}
            {actions.length > 0 && <th></th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              {actions.length > 0 && (
                <td>
                  <div className="inline-actions">
                    {actions.map(({ icon, onClick, key, color }) => (
                      <button
                        key={key}
                        className="table-action-button"
                        onClick={() => onClick(row)}
                        type="button"
                        aria-label={key}
                        style={color ? { color } : undefined}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
