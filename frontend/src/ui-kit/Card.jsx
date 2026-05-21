import React from 'react';

export default function Card({ title, actions, children, className = '' }){
  return (
    <section className={`page-card ${className}`}>
      <header className="page-card__header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          {title ? <h3 style={{margin:0}}>{title}</h3> : null}
        </div>
        {actions ? <div className="page-card__actions">{actions}</div> : null}
      </header>
      <div className="page-card__body">{children}</div>
    </section>
  );
}
