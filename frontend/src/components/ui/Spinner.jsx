import React from 'react';
import './Spinner.css';

/**
 * Spinner — loading indicator
 *
 * size: 'sm' | 'md' | 'lg'
 * center: boolean — wrap in a centering container
 */
export default function Spinner({ size = 'md', center = false, label = 'Loading…' }) {
  const spinner = (
    <span className={`spinner spinner--${size}`} role="status" aria-label={label}>
      <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeOpacity="0.18" />
        <path d="M45 25a20 20 0 0 0-20-20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );

  if (center) {
    return <div className="spinner-center">{spinner}</div>;
  }

  return spinner;
}
