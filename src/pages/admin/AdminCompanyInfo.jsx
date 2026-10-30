import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Mail,
  Phone,
  Globe,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Save,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { resolveCompanyMap } from '../../utils/mapHelper.js';

export default function AdminCompanyInfo() {
  const [form, setForm] = useState({
    contactEmail: '',
    contactPhone: '',
    officeAddress: '',
    mapLink: '',
    mapLat: null,
    mapLng: null,
    privacyContactNote: '',
    mission: '',
    vision: '',
    valuesText: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/admin/company-settings');
      setForm({
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        officeAddress: data.officeAddress || '',
        mapLink: data.mapLink || '',
        mapLat: data.mapLat ?? null,
        mapLng: data.mapLng ?? null,
        privacyContactNote: data.privacyContactNote || '',
        mission: data.mission || '',
        vision: data.vision || '',
        valuesText: data.valuesText || '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load company contact and map settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiRequest('/api/admin/company-settings', {
        method: 'PUT',
        body: {
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          officeAddress: form.officeAddress,
          mapLink: form.mapLink,
          privacyContactNote: form.privacyContactNote,
          mission: form.mission,
          vision: form.vision,
          valuesText: form.valuesText,
        },
      });
      setForm((prev) => ({
        ...prev,
        mapLat: res.mapLat ?? null,
        mapLng: res.mapLng ?? null,
      }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('aisquare:company-info-updated'));
      }
      setSuccessMsg(
        'Saved! Public Website Contact Us page, Interactive Map Pin, Footer, and About page have been updated immediately.'
      );
    } catch (err) {
      setError(err.message || 'Failed to save company contact settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearMap = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const nextForm = { ...form, officeAddress: '', mapLink: '', mapLat: null, mapLng: null };
      await apiRequest('/api/admin/company-settings', {
        method: 'PUT',
        body: {
          contactEmail: nextForm.contactEmail,
          contactPhone: nextForm.contactPhone,
          officeAddress: '',
          mapLink: '',
          privacyContactNote: nextForm.privacyContactNote,
          mission: nextForm.mission,
          vision: nextForm.vision,
          valuesText: nextForm.valuesText,
        },
      });
      setForm(nextForm);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('aisquare:company-info-updated'));
      }
      setSuccessMsg('Cleared office address and reset map pin.');
    } catch (err) {
      setError(err.message || 'Failed to clear map location.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="neu-card">Loading Company &amp; Contact settings...</div>;
  }

  const previewMap = resolveCompanyMap(
    form.officeAddress,
    form.mapLink,
    form.mapLat,
    form.mapLng,
    { fallbackInteractiveCanvas: true }
  );

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Company, Contact &amp; Map Settings</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Manage your official Email/Gmail, Phone Number, Office Address, Interactive Map Pin, and About Us profile displayed across the public website and footer.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/contact" className="btn btn-secondary btn-sm">
            <Globe size={15} />
            View Live Contact Page
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={handleSave}
          >
            <Save size={15} />
            {saving ? 'Saving & Geocoding...' : 'Save & Publish to Website'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 18 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" role="status" style={{ marginBottom: 18 }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gap: 24 }}>
        {/* 1. Direct Contact Channels */}
        <div className="neu-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Mail size={19} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
              1. Direct Contact Details (Email / Gmail &amp; Phone Number)
            </h2>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Displayed on the <strong>Contact Us</strong> page, <strong>Website Footer</strong>, and <strong>Privacy Policy</strong> page. Leave any field blank if you prefer visitors to use only the Contact Form.
          </p>

          <div className="grid-2" style={{ gap: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ci-email">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} /> Official Public Email / Gmail
                </span>
              </label>
              <input
                id="ci-email"
                type="email"
                className="neu-input"
                placeholder="e.g., aisquareitsolutions@gmail.com or contact@aisquare.in"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ci-phone">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} /> Official Phone / Business Number
                </span>
              </label>
              <input
                id="ci-phone"
                type="text"
                className="neu-input"
                placeholder="e.g., +91 98765 43210"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
            <label className="form-label" htmlFor="ci-privacy">
              Privacy &amp; Compliance Contact Note (Optional — shown on Privacy Policy)
            </label>
            <input
              id="ci-privacy"
              type="text"
              className="neu-input"
              placeholder="e.g., For data privacy requests, reach out to our team via our official email or contact form."
              value={form.privacyContactNote}
              onChange={(e) => setForm({ ...form, privacyContactNote: e.target.value })}
            />
          </div>
        </div>

        {/* 2. Office Address & Interactive Map Pin */}
        <div className="neu-card">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={19} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                2. Office Address &amp; Interactive Map Location
              </h2>
            </div>

            {(form.officeAddress || form.mapLink) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={saving}
                onClick={handleClearMap}
              >
                <RotateCcw size={14} />
                Clear Location Pin
              </button>
            )}
          </div>

          <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Enter your street/area address and click <strong>Save &amp; Publish to Website</strong> — the server automatically geocodes your address to drop the exact red map marker pin on <strong>Contact Us</strong> and links it in the <strong>Website Footer</strong>.
          </p>

          <div className="grid-2" style={{ gap: 22, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ci-address">
                  Office Address (Displayed on Contact Us &amp; Footer)
                </label>
                <textarea
                  id="ci-address"
                  rows={3}
                  className="neu-textarea"
                  placeholder="e.g., HITEC City, Madhapur, Hyderabad, Telangana 500081, India"
                  value={form.officeAddress}
                  onChange={(e) => setForm({ ...form, officeAddress: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ci-maplink">
                  Google Maps Share Link, Exact Coordinates (<code>lat, lng</code>), or Embed URL (Optional)
                </label>
                <input
                  id="ci-maplink"
                  type="text"
                  className="neu-input"
                  placeholder="e.g., 17.4435, 78.3772 or https://maps.app.goo.gl/..."
                  value={form.mapLink}
                  onChange={(e) => setForm({ ...form, mapLink: e.target.value })}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {form.mapLat !== null && form.mapLng !== null ? (
                    <span>
                      Active Map Pin Coordinates: <code>{form.mapLat.toFixed(5)}, {form.mapLng.toFixed(5)}</code>
                    </span>
                  ) : (
                    <span>
                      Tip: For building-level precision, right-click your building on Google Maps, copy the <code>lat, lng</code> numbers, and paste them here.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <MapPin size={16} />
                  {saving ? 'Saving & Pinning Location...' : 'Save Contact & Update Map Pin'}
                </button>
              </div>
            </div>

            {/* Live Map Preview */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {previewMap?.isConfigured ? 'Live Pinned Map Preview' : 'Interactive Map Preview (Unpinned)'}
                </span>
                {previewMap?.externalUrl && (
                  <a
                    href={previewMap.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Open in Google Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {previewMap && (
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid var(--border-strong)',
                  height: 255,
                  background: '#111114',
                }}
              >
                <iframe
                  key={previewMap.embedSrc}
                  title="Admin Live Office Map Preview"
                  src={previewMap.embedSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Corporate Mission, Vision & Core Values */}
        <div className="neu-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Building2 size={19} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
              3. About Us — Mission, Vision &amp; Core Values (Optional)
            </h2>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Published on the public <strong>About AI Square</strong> page when provided.
          </p>

          <div className="grid-2" style={{ gap: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ci-mission">Mission Statement</label>
              <textarea
                id="ci-mission"
                rows={3}
                className="neu-textarea"
                placeholder="Our corporate mission statement..."
                value={form.mission}
                onChange={(e) => setForm({ ...form, mission: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ci-vision">Vision Statement</label>
              <textarea
                id="ci-vision"
                rows={3}
                className="neu-textarea"
                placeholder="Our long-term vision..."
                value={form.vision}
                onChange={(e) => setForm({ ...form, vision: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16, marginBottom: 18 }}>
            <label className="form-label" htmlFor="ci-values">
              Core Values (One per line)
            </label>
            <textarea
              id="ci-values"
              rows={3}
              className="neu-textarea"
              placeholder={'Rubric Fidelity\nZero-Hallucination Quality\nData Confidentiality'}
              value={form.valuesText}
              onChange={(e) => setForm({ ...form, valuesText: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving All Changes...' : 'Save & Publish All Company Details'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
