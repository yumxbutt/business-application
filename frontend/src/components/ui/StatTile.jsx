export default function StatTile({ label, value, meta, tone = 'default' }) {
  return (
    <article className={`stat-tile stat-tile--${tone}`}>
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      {meta ? <span className="stat-meta">{meta}</span> : null}
    </article>
  );
}
