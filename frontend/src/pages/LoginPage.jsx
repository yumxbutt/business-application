import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(formData);
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setFormData({ username: 'mainadmin', password: 'Admin@123' });
  };

  return (
    <div className="lp-page">
      {/* ── Left Panel ── */}
      <aside className="lp-left">
        <div className="lp-mesh" aria-hidden="true" />
        <div className="lp-orb lp-orb--1" aria-hidden="true" />
        <div className="lp-orb lp-orb--2" aria-hidden="true" />
        <div className="lp-orb lp-orb--3" aria-hidden="true" />

        {/* Brand */}
        <div className="lp-brand">
          <div className="lp-brand__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <path d="M14 17.5h7M17.5 14v7" />
            </svg>
          </div>
          <div>
            <div className="lp-brand__name">GWD DESIGNS</div>
            <div className="lp-brand__tagline">Business Management System</div>
          </div>
        </div>

        {/* Hero */}
        <div className="lp-hero">
          <div className="lp-hero__badge">
            <span className="lp-hero__badge-dot" aria-hidden="true" />
            All systems operational
          </div>
          <h1 className="lp-hero__title">
            Run your entire business from <span>one dashboard</span>
          </h1>
          <p className="lp-hero__desc">
            Sales, purchases, inventory, ledger, and multi-branch operations —
            unified in a single, powerful platform built for growing businesses.
          </p>
          <ul className="lp-features">
            <li className="lp-feature">
              <div className="lp-feature__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="lp-feature__text">
                <strong>Multi-Branch Support</strong>
                <span>Manage all your branches, stock, and staff from a single account.</span>
              </div>
            </li>
            <li className="lp-feature">
              <div className="lp-feature__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div className="lp-feature__text">
                <strong>Real-time Financial Tracking</strong>
                <span>Live ledger, payables, receivables, and cash book updates.</span>
              </div>
            </li>
            <li className="lp-feature">
              <div className="lp-feature__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div className="lp-feature__text">
                <strong>FIFO Inventory Engine</strong>
                <span>Accurate cost tracking with automatic batch assignment.</span>
              </div>
            </li>
          </ul>
        </div>

        {/* Stats */}
        <div className="lp-stats">
          <div className="lp-stat">
            <div className="lp-stat__number">12+</div>
            <div className="lp-stat__label">Core modules</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat__number">100%</div>
            <div className="lp-stat__label">Role-based access</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat__number">∞</div>
            <div className="lp-stat__label">Branches supported</div>
          </div>
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main className="lp-right">
        <div className="lp-box">
          <header className="lp-box__header">
            <div className="lp-box__eyebrow">Secure Login</div>
            <h2 className="lp-box__title">Welcome back</h2>
            <p className="lp-box__subtitle">
              Sign in to your account to access the dashboard and all business tools.
            </p>
          </header>

          <form className="lp-form" onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div className="lp-field">
              <label className="lp-field__label" htmlFor="username">
                Username <span aria-hidden="true">*</span>
              </label>
              <div className="lp-field__wrap">
                <span className="lp-field__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  className="lp-field__input"
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-field__label" htmlFor="password">
                Password <span aria-hidden="true">*</span>
              </label>
              <div className="lp-field__wrap">
                <span className="lp-field__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
                <input
                  className="lp-field__input"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="lp-field__pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error ? (
              <div className="lp-error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>{error}</p>
              </div>
            ) : null}

            {/* Submit */}
            <button className="lp-submit" type="submit" disabled={submitting}>
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              {submitting ? (
                <span className="lp-spinner" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="lp-divider">Demo Access</div>

            {/* Demo card */}
            <div className="lp-demo">
              <div className="lp-demo__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Click to auto-fill credentials
              </div>
              <div className="lp-demo__creds">
                <div className="lp-demo__item">
                  <span className="lp-demo__item-label">Username</span>
                  <button type="button" className="lp-demo__item-value" onClick={fillDemo}>
                    mainadmin
                  </button>
                </div>
                <div className="lp-demo__item">
                  <span className="lp-demo__item-label">Password</span>
                  <button type="button" className="lp-demo__item-value" onClick={fillDemo}>
                    Admin@123
                  </button>
                </div>
              </div>
            </div>
          </form>

          <footer className="lp-footer">
            <div className="lp-trust">
              <div className="lp-trust__badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                SSL Secured
              </div>
              <span className="lp-trust__sep" aria-hidden="true" />
              <div className="lp-trust__badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                JWT Auth
              </div>
              <span className="lp-trust__sep" aria-hidden="true" />
              <div className="lp-trust__badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                Role-based Access
              </div>
            </div>
            <p className="lp-copyright">&copy; 2026 GWD DESIGNS. All rights reserved.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
