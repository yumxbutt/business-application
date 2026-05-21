import React from 'react';
import './Badge.css';

/**
 * Badge — status / label pill
 *
 * tone: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'
 * size: 'sm' | 'md'
 */
export default function Badge({ children, tone = 'default', size = 'md', dot = false, className = '' }) {
  return (
    <span className={`badge badge--${tone} badge--${size} ${className}`.trim()}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
