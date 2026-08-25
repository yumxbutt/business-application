import { useEffect, useRef, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { settingsService } from '../services/settingsService';
import {
  BUSINESS_MODE_RETAIL,
  BUSINESS_MODE_WHOLESALE,
  BUSINESS_MODE_RESTAURANT,
  normalizeBusinessMode,
} from '../config/posDefaults';

const emptyForm = () => ({
  companyName: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  logoUrl: '',
  footerNote: '',
  businessMode: BUSINESS_MODE_RETAIL,
  cashTaxRate: '0',
  cardTaxRate: '0',
});

export default function CompanySettingsPage() {
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const successTimer = useRef(null);

  useEffect(() => {
    setLoading(true);
    settingsService.getCompanySettings()
      .then((data) => {
        setForm({
          companyName: data.companyName || '',
          tagline: data.tagline || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          logoUrl: data.logoUrl || '',
          footerNote: data.footerNote || '',
          businessMode: normalizeBusinessMode(data.businessMode),
          cashTaxRate: String(data.cashTaxRate ?? 0),
          cardTaxRate: String(data.cardTaxRate ?? 0),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setSuccess(''); setError('');
    try {
      await settingsService.saveCompanySettings({
        ...form,
        cashTaxRate: Number(form.cashTaxRate || 0),
        cardTaxRate: Number(form.cardTaxRate || 0),
      });
      setSuccess('Company settings saved successfully.');
      successTimer.current = setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { name: 'companyName', label: 'Company Name', placeholder: 'e.g. Acme Trading Co.', type: 'text' },
    { name: 'tagline', label: 'Tagline / Slogan', placeholder: 'e.g. Quality you can trust', type: 'text' },
    { name: 'address', label: 'Address', placeholder: 'Full company address', type: 'textarea' },
    { name: 'phone', label: 'Phone', placeholder: 'e.g. +91 98765 43210', type: 'text' },
    { name: 'email', label: 'Email', placeholder: 'e.g. info@acme.com', type: 'email' },
    { name: 'logoUrl', label: 'Logo URL', placeholder: 'https://... (public image URL)', type: 'text' },
    { name: 'footerNote', label: 'Voucher Footer Note', placeholder: 'e.g. Thank you for your business!', type: 'textarea' },
  ];

  return (
    <div className="dashboard-stack">
      <PageCard title="Company Settings" subtitle="Branding and POS business mode used across the app">
        {loading ? (
          <p className="view-note">Loading settings…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, color: '#374151' }}>
                Business / POS mode
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: form.businessMode === BUSINESS_MODE_RETAIL ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background: form.businessMode === BUSINESS_MODE_RETAIL ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#111827' }}>
                    <input
                      type="radio"
                      name="businessMode"
                      value={BUSINESS_MODE_RETAIL}
                      checked={form.businessMode === BUSINESS_MODE_RETAIL}
                      onChange={handleChange}
                    />
                    Retail / Counter
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', paddingLeft: 22 }}>
                    Walk-in shop POS — tile catalog, full pay by default.
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: form.businessMode === BUSINESS_MODE_RESTAURANT ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background: form.businessMode === BUSINESS_MODE_RESTAURANT ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#111827' }}>
                    <input
                      type="radio"
                      name="businessMode"
                      value={BUSINESS_MODE_RESTAURANT}
                      checked={form.businessMode === BUSINESS_MODE_RESTAURANT}
                      onChange={handleChange}
                    />
                    Restaurant
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', paddingLeft: 22 }}>
                    Table / hold running orders + kitchen token print per product.
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: form.businessMode === BUSINESS_MODE_WHOLESALE ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background: form.businessMode === BUSINESS_MODE_WHOLESALE ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#111827' }}>
                    <input
                      type="radio"
                      name="businessMode"
                      value={BUSINESS_MODE_WHOLESALE}
                      checked={form.businessMode === BUSINESS_MODE_WHOLESALE}
                      onChange={handleChange}
                    />
                    Wholesale / Trade
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', paddingLeft: 22 }}>
                    Dense catalog, editable rates, partial payment / due.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, color: '#374151' }}>
                Tax setup (%)
              </span>
              <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#6b7280' }}>
                Used on sales invoices / POS when Cash Tax or Card Tax is selected. Choose No Tax on the invoice to skip tax.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Cash Tax %</span>
                  <input
                    name="cashTaxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.cashTaxRate}
                    onChange={handleChange}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: '0.875rem',
                      border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Card Tax %</span>
                  <input
                    name="cardTaxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.cardTaxRate}
                    onChange={handleChange}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: '0.875rem',
                      border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                    }}
                  />
                </label>
              </div>
            </div>

            {fields.map((f) => (
              <div key={f.name} style={{ marginBottom: 16 }}>
                <label
                  htmlFor={`cs-${f.name}`}
                  style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4, color: '#374151' }}
                >
                  {f.label}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    id={`cs-${f.name}`}
                    name={f.name}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: '0.875rem',
                      border: '1px solid #d1d5db', borderRadius: 6,
                      resize: 'vertical', fontFamily: 'inherit', color: '#111827',
                    }}
                  />
                ) : (
                  <input
                    id={`cs-${f.name}`}
                    name={f.name}
                    type={f.type}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: '0.875rem',
                      border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                    }}
                  />
                )}
              </div>
            ))}

            {form.logoUrl && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 6 }}>Logo Preview:</p>
                <img
                  src={form.logoUrl}
                  alt="Company logo preview"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 4, padding: 4 }}
                />
              </div>
            )}

            {success && (
              <p style={{ color: '#16a34a', fontWeight: 600, marginBottom: 12, fontSize: '0.875rem' }}>
                &#10003; {success}
              </p>
            )}
            {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

            <div className="inline-actions">
              <button type="submit" className="primary-action-button" disabled={saving}>
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </PageCard>
    </div>
  );
}
