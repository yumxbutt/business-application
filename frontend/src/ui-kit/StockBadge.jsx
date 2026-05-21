// Stock Availability Badge
import React from 'react';
import { theme } from './theme';

export function StockBadge({ qty }) {
  let color = `bg-[${theme.colors.accent}]/20 text-[#17806D]`;
  let label = 'In Stock';
  if (qty === 0) {
    color = `bg-[${theme.colors.danger}]/20 text-[#B91C1C]`;
    label = 'Out of Stock';
  } else if (qty < 10) {
    color = `bg-[${theme.colors.warning}]/20 text-[#B45309]`;
    label = 'Low Stock';
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
      {label}: {qty}
    </span>
  );
}
