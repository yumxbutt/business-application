export default function PageCard({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`page-card ${className}`.trim()}>
      <header className="page-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-card__actions">{actions}</div> : null}
      </header>
      <div className={`page-card__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
