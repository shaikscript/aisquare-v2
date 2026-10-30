import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Settings,
  Briefcase,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { resolveCompanyMap } from '../../utils/mapHelper.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CANDIDATE_TOPICS = [
  'Evaluator Careers Question',
  'Application Status Follow-Up',
  'iOS & Android Role Eligibility',
  'Employee Portal Access Help',
  'General Question',
];

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [companyInfo, setCompanyInfo] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(initialTopic ? `${initialTopic}` : '');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const [editingLocation, setEditingLocation] = useState(false);
  const [draftAddress, setDraftAddress] = useState('');
  const [draftMapLink, setDraftMapLink] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');

  useEffect(() => {
    if (initialTopic) {
      setSubject(initialTopic);
    }
  }, [initialTopic]);

  const loadPublicInfo = useCallback(async () => {
    try {
      const data = await apiRequest('/api/public/info');
      setCompanyInfo(data);
      setDraftAddress(data?.officeAddress || '');
      setDraftMapLink(data?.mapLink || '');
    } catch {
      setCompanyInfo(null);
    }
  }, []);

  useEffect(() => {
    loadPublicInfo();
  }, [loadPublicInfo]);

  const hasPublishedContactDetails = Boolean(
    companyInfo?.contactEmail || companyInfo?.contactPhone || companyInfo?.officeAddress
  );

  const resolvedMap = resolveCompanyMap(
    companyInfo?.officeAddress,
    companyInfo?.mapLink,
    companyInfo?.mapLat,
    companyInfo?.mapLng,
    { fallbackInteractiveCanvas: true }
  );

  const handleSaveLocationQuick = async (e) => {
    e.preventDefault();
    setSavingLocation(true);
    setLocationNotice('');
    try {
      await apiRequest('/api/admin/company-settings', {
        method: 'PUT',
        body: {
          officeAddress: draftAddress.trim(),
          mapLink: draftMapLink.trim(),
        },
      });
      await loadPublicInfo();
      setEditingLocation(false);
      setLocationNotice('Office location & interactive map pin updated.');
      window.dispatchEvent(new CustomEvent('aisquare:company-info-updated'));
    } catch (err) {
      setLocationNotice(err.message || 'Unable to save location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/public/contact', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        },
      });
      setSuccess(res);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err.message || 'Unable to send your message right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '44px 0 64px' }}>
      <div className="container">
        <div style={{ marginBottom: 30, maxWidth: 680 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.75rem',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#9a9a9a',
              marginBottom: 10,
            }}
          >
            Location &amp; Support
          </span>
          <h1
            style={{
              fontSize: 'clamp(1.95rem, 3.4vw, 2.75rem)',
              fontWeight: 500,
              letterSpacing: '-0.04em',
              marginBottom: 10,
            }}
          >
            Connect With{' '}
            <em
              style={{
                fontFamily: "'Instrument Serif', 'Times New Roman', serif",
                fontStyle: 'italic',
                fontWeight: 400,
                color: '#9a9a9a',
                fontSize: '1.08em',
              }}
            >
              AI Square
            </em>
          </h1>
          <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.96rem', lineHeight: 1.6 }}>
            Have a question about our iOS &amp; Android AI Evaluator roles, application process, or
            office location? Reach our team directly below.
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: 'start', gap: 24 }}>
          {/* Message Form */}
          <div className="neu-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: 18 }}>
              Send a Message
            </h2>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success" role="status">
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Message Sent (Ref #{success.enquiryId})</strong>
                  <div style={{ marginTop: 4 }}>{success.message}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="cnt-name">Your Name *</label>
                <input
                  id="cnt-name"
                  type="text"
                  className="neu-input"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cnt-email">Email Address *</label>
                <input
                  id="cnt-email"
                  type="email"
                  className="neu-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cnt-subject">Topic / Subject *</label>
                <input
                  id="cnt-subject"
                  type="text"
                  className="neu-input"
                  placeholder="e.g., Evaluator Careers Question"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cnt-message">Message *</label>
                <textarea
                  id="cnt-message"
                  className="neu-textarea"
                  placeholder="How can our team assist you?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="vesper-btn vesper-btn-solid"
                style={{ height: 46, padding: '0 22px' }}
                disabled={submitting}
              >
                <Send size={15} style={{ marginRight: 8 }} />
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Right Column: Quick Topics + Official Contact + Careers Shortcut */}
          <div style={{ display: 'grid', gap: 18 }}>
            <div className="neu-card-compact">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 500, marginBottom: 12 }}>
                Quick Topic Selection
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CANDIDATE_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    className="vesper-nav-pill"
                    style={{ cursor: 'pointer', height: 34, fontSize: '0.8rem', padding: '0 13px' }}
                    onClick={() => setSubject(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {hasPublishedContactDetails && (
              <div className="neu-card-compact">
                <h2 style={{ fontSize: '1.05rem', fontWeight: 500, marginBottom: 14 }}>
                  Official Contact Details
                </h2>
                <div style={{ display: 'grid', gap: 12, fontSize: '0.92rem' }}>
                  {companyInfo.contactEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Mail size={16} color="#ffffff" />
                      <a href={`mailto:${companyInfo.contactEmail}`} style={{ color: '#d8d8d8' }}>
                        {companyInfo.contactEmail}
                      </a>
                    </div>
                  )}
                  {companyInfo.contactPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#d8d8d8' }}>
                      <Phone size={16} color="#ffffff" />
                      <span>{companyInfo.contactPhone}</span>
                    </div>
                  )}
                  {companyInfo.officeAddress && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#d8d8d8' }}>
                      <MapPin size={16} color="#ffffff" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'pre-line' }}>{companyInfo.officeAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="neu-card-compact">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <Briefcase size={17} color="#ffffff" />
                <strong style={{ color: '#ffffff', fontWeight: 500, fontSize: '0.96rem' }}>
                  Ready to Apply with Your Resume?
                </strong>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#9a9a9a', lineHeight: 1.55 }}>
                Submit your resume directly for iOS &amp; Android AI Evaluator openings on our
                Careers page.
              </p>
              <Link to="/careers" className="vesper-btn vesper-btn-ghost">
                Go to Evaluator Careers &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Interactive Location Map Section */}
        {resolvedMap && (
          <div className="neu-card" style={{ marginTop: 26 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a9a9a' }}>
                  Office Location
                </span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 500, margin: '4px 0 6px' }}>
                  Interactive Location Map
                </h2>
                {resolvedMap.displayAddress ? (
                  <p style={{ margin: 0, color: '#d8d8d8', fontSize: '0.92rem', whiteSpace: 'pre-line' }}>
                    {resolvedMap.displayAddress}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.88rem' }}>
                    {isAdmin
                      ? 'Admin Tip: Click "Set Exact Office Pin" (or open Admin → Contact, Map & Info) to pin your exact office address.'
                      : 'Explore our interactive map below or send us a message above.'}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {isAdmin && (
                  <button
                    type="button"
                    className="vesper-btn vesper-btn-ghost"
                    onClick={() => setEditingLocation((v) => !v)}
                  >
                    <Settings size={14} style={{ marginRight: 6 }} />
                    {editingLocation
                      ? 'Close Pin Editor'
                      : resolvedMap.isConfigured
                      ? 'Edit Office Pin'
                      : 'Set Exact Office Pin'}
                  </button>
                )}

                {resolvedMap.directionsUrl && (
                  <a
                    href={resolvedMap.directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="vesper-btn vesper-btn-solid"
                  >
                    <MapPin size={14} style={{ marginRight: 6 }} />
                    Open in Google Maps
                    <ExternalLink size={13} style={{ marginLeft: 6 }} />
                  </a>
                )}
              </div>
            </div>

            {locationNotice && (
              <div className="alert alert-success" role="status" style={{ marginBottom: 16 }}>
                <CheckCircle2 size={18} />
                <span>{locationNotice}</span>
              </div>
            )}

            {isAdmin && editingLocation && (
              <form
                onSubmit={handleSaveLocationQuick}
                className="neu-panel-inset"
                style={{ padding: 16, marginBottom: 18 }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff', marginBottom: 10 }}>
                  Configure Public Office Address &amp; Map Pin (Admin Only)
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Confirmed Office Address</label>
                    <input
                      type="text"
                      className="neu-input"
                      placeholder="e.g., HITEC City, Hyderabad, Telangana 500081"
                      value={draftAddress}
                      onChange={(e) => setDraftAddress(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Google Maps Link or Coordinates (Optional)</label>
                    <input
                      type="text"
                      className="neu-input"
                      placeholder="Paste Google Maps share URL or lat, lng"
                      value={draftMapLink}
                      onChange={(e) => setDraftMapLink(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditingLocation(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingLocation}>
                    {savingLocation ? 'Pinning...' : 'Save & Pin on Map'}
                  </button>
                </div>
              </form>
            )}

            {resolvedMap.embedSrc && (
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                }}
              >
                <iframe
                  title="AI Square IT Solutions Office Location Map"
                  src={resolvedMap.embedSrc}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 360,
                    border: 'none',
                    background: '#0d0d10',
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
