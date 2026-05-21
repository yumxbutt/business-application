import React from 'react';
import './PageHeader.css';

/**
 * PageHeader — page title row with optional subtitle + action area
 *
 * title:    string
 * subtitle: string
 * actions:  ReactNode — buttons / controls rendered on the right
 * back:     ReactNode — back link/button on the far left
 */
export default function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="page-header">
      <div className="page-header__left">
        {back && <div className="page-header__back">{back}</div>}
        <div className="page-header__copy">
          <h1 className="page-header__title">{title}</h1>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="page-header__actions">{actions}</div>
      )}
    </header>
  );
}
