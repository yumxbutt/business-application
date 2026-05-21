import { Link, useNavigate } from 'react-router-dom';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="unauth-page">
      <div className="unauth-card">
        {/* Brand mark */}
        <div className="unauth-brand">
          <div className="unauth-brand__mark">BMS</div>
          <span>Business Management System</span>
        </div>

        {/* Icon */}
        <div className="unauth-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            <line x1="12" y1="15" x2="12" y2="17" />
            <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <div className="unauth-code">403</div>
        <h1 className="unauth-title">Access Denied</h1>
        <p className="unauth-desc">
          You don&rsquo;t have permission to view this page. Please contact your administrator
          if you believe this is a mistake, or return to a page you have access to.
        </p>

        <div className="unauth-actions">
          <button type="button" className="unauth-btn unauth-btn--secondary" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 10H5M10 5l-5 5 5 5" />
            </svg>
            Go Back
          </button>
          <Link to="/" className="unauth-btn unauth-btn--primary">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l7-7 7 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
              <path d="M8 20V13h4v7" />
            </svg>
            Dashboard
          </Link>
        </div>

        <footer className="unauth-footer">&copy; 2026 GWD DESIGNS. All rights reserved.</footer>
      </div>
    </div>
  );
}

