import React from 'react';

export default function Button({ variant = 'primary', children, className = '', loading = false, title, ...rest }){
  const base = 'btn';
  const typeCls = variant === 'primary' ? 'btn--primary' : variant === 'secondary' ? 'btn--secondary' : 'btn--ghost';
  const cls = [base, typeCls, className].filter(Boolean).join(' ');

  return (
    <button
      className={cls}
      disabled={rest.disabled || loading}
      {...rest}
      aria-busy={loading}
      aria-disabled={rest.disabled || loading}
      title={title}
    >
      {loading ? (
        <span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',marginRight:8}}>
          <svg className="spinner" width="16" height="16" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
            <circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
            <path d="M45 25a20 20 0 0 0-20-20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </span>
      ) : null}
      {children}
    </button>
  );
}
