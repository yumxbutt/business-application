import { useEffect, useRef, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { settingsService } from '../services/settingsService';

const emptyForm = () => ({
  companyName: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  logoUrl: '',
  footerNote: '',
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
      await settingsService.saveCompanySettings(form);
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
      <PageCard title="Company Settings" subtitle="Branding information used on printed vouchers and reports">
        {loading ? (
          <p className="view-note">Loading settings…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
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

            {/* Logo preview */}
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
