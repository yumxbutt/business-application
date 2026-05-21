import React from 'react';
import './EmptyState.css';

/**
 * EmptyState — shown when a list / table has no records
 *
 * icon: ReactNode (SVG or emoji)
 * title: string
 * description: string
 * action: ReactNode (e.g. a Button)
 */
export default function EmptyState({ icon, title = 'No records found', description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
