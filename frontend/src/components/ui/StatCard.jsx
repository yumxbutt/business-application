import React from 'react';
import './StatCard.css';

/**
 * StatCard — KPI metric tile for dashboards
 *
 * label:   string  — metric name
 * value:   string | number — primary value
 * meta:    string — secondary info (e.g. "+12% vs last month")
 * icon:    ReactNode — small icon
 * tone:    'default' | 'success' | 'danger' | 'warning' | 'info'
 * loading: boolean
 */
export default function StatCard({ label, value, meta, icon, tone = 'default', loading = false }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        {icon && <span className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">{icon}</span>}
      </div>
      {loading ? (
        <div className="stat-card__skeleton" aria-busy="true" />
      ) : (
        <strong className="stat-card__value">{value ?? '—'}</strong>
      )}
      {meta && !loading && <span className="stat-card__meta">{meta}</span>}
    </article>
  );
}
