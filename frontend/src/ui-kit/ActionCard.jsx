// Modern Action Card
import React from 'react';
import { theme } from './theme';

export function ActionCard({ title, value, icon, actions = [] }) {
  return (
    <div className={`bg-[${theme.colors.surface}] rounded-[${theme.borderRadius.card}] shadow-lg p-6 flex flex-col gap-2 min-w-[220px]`} style={{ boxShadow: theme.shadow }}>
      <div className="flex items-center gap-3">
        <span className={`bg-[${theme.colors.accent}]/10 p-2 rounded-lg`}>{icon}</span>
        <span className="text-lg font-semibold text-[${theme.colors.primary}]">{title}</span>
      </div>
      <div className="text-3xl font-bold text-[${theme.colors.primary}]">{value}</div>
      <div className="flex gap-2 mt-2">
        {actions.map(({ icon, onClick, key, color }) => (
          <button key={key} className={`hover:bg-[${color}]/20 p-2 rounded`} onClick={onClick}>{icon}</button>
        ))}
      </div>
    </div>
  );
}
