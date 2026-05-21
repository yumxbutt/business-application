import React from 'react';
import './FilterBar.css';

/**
 * FilterBar — standardized filter / search row above list pages
 *
 * search:        { value, onChange, placeholder } — search input config
 * filters:       ReactNode — additional selects / date pickers etc.
 * actions:       ReactNode — right-side buttons (export, add, etc.)
 * compact:       boolean — reduce padding
 */
export default function FilterBar({ search, filters, actions, compact = false }) {
  return (
    <div className={`filter-bar${compact ? ' filter-bar--compact' : ''}`}>
      <div className="filter-bar__left">
        {search && (
          <div className="filter-bar__search">
            <svg className="filter-bar__search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13.5 13.5L17 17M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12Z"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="search"
              className="filter-bar__search-input"
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder ?? 'Search…'}
              aria-label={search.placeholder ?? 'Search'}
            />
          </div>
        )}
        {filters && <div className="filter-bar__filters">{filters}</div>}
      </div>
      {actions && <div className="filter-bar__actions">{actions}</div>}
    </div>
  );
}
