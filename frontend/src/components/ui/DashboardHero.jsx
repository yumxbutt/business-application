export default function DashboardHero({ title, subtitle, chip, actions }) {
  return (
    <section className="dashboard-hero">
      <div className="dashboard-head">
        <div className="dashboard-title-wrap">
          {chip ? <span className="dashboard-chip">{chip}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="dashboard-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="dashboard-actions">{actions}</div> : null}
      </div>
    </section>
  );
}
