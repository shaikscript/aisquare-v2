import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  FileDown,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Mail,
  Settings,
  Users,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { apiRequest, withSessionQuery } from '../../utils/api.js';
import { resolveCompanyMap } from '../../utils/mapHelper.js';

const APP_STATUSES = ['New', 'Under Review', 'Shortlisted', 'Selected', 'Rejected'];

export default function AdminApplications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'applications';

  const [banner, setBanner] = useState(null);

  // Applications state
  const [applications, setApplications] = useState([]);
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [appNotes, setAppNotes] = useState('');
  const [appStatusEdit, setAppStatusEdit] = useState('New');

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    employmentType: '',
    locationNote: '',
    description: '',
    responsibilities: '',
    qualifications: '',
    skills: '',
    applicationInstructions: '',
    status: 'draft',
  });

  // Contact messages state
  const [messages, setMessages] = useState([]);

  // Company public settings state
  const [companySettings, setCompanySettings] = useState({
    mission: '',
    vision: '',
    valuesText: '',
    contactEmail: '',
    contactPhone: '',
    officeAddress: '',
    mapLink: '',
    mapLat: null,
    mapLng: null,
    privacyContactNote: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [appsRes, jobsRes, msgsRes, settingsRes] = await Promise.all([
        apiRequest(`/api/admin/applications?status=${encodeURIComponent(appStatusFilter)}`),
        apiRequest('/api/admin/jobs'),
        apiRequest('/api/admin/contact-messages'),
        apiRequest('/api/admin/company-settings'),
      ]);
      setApplications(appsRes.applications || []);
      setJobs(jobsRes.jobs || []);
      setMessages(msgsRes.messages || []);
      setCompanySettings(settingsRes);
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to load careers & enquiries data.' });
    }
  }, [appStatusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const switchTab = (tab) => {
    setSearchParams({ tab });
  };

  /* Application handlers */
  const handleSaveApplication = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      await apiRequest(`/api/admin/applications/${selectedApp.id}`, {
        method: 'PATCH',
        body: { status: appStatusEdit, adminNotes: appNotes },
      });
      setBanner({
        type: 'success',
        text: `Updated application #${selectedApp.id} to "${appStatusEdit}" (internal status only — candidate is not automatically emailed).`,
      });
      setSelectedApp(null);
      loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Failed to update application.' });
    }
  };

  /* Job handlers */
  const openCreateJob = () => {
    setEditingJob(null);
    setJobForm({
      title: '',
      employmentType: 'Full-Time',
      locationNote: '',
      description: '',
      responsibilities: '',
      qualifications: '',
      skills: '',
      applicationInstructions: '',
      status: 'published',
    });
    setJobModalOpen(true);
  };

  const openEditJob = (job) => {
    setEditingJob(job);
    setJobForm({
      title: job.title || '',
      employmentType: job.employmentType || '',
      locationNote: job.locationNote || '',
      description: job.description || '',
      responsibilities: job.responsibilities || '',
      qualifications: job.qualifications || '',
      skills: job.skills || '',
      applicationInstructions: job.applicationInstructions || '',
      status: job.status || 'draft',
    });
    setJobModalOpen(true);
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    try {
      if (editingJob) {
        await apiRequest(`/api/admin/jobs/${editingJob.id}`, {
          method: 'PATCH',
          body: jobForm,
        });
        setBanner({ type: 'success', text: `Updated vacancy "${jobForm.title}".` });
      } else {
        await apiRequest('/api/admin/jobs', {
          method: 'POST',
          body: jobForm,
        });
        setBanner({ type: 'success', text: `Created vacancy "${jobForm.title}".` });
      }
      setJobModalOpen(false);
      loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to save job opening.' });
    }
  };

  const handleDeleteJob = async (job) => {
    try {
      await apiRequest(`/api/admin/jobs/${job.id}`, { method: 'DELETE' });
      setBanner({
        type: 'success',
        text: `Deleted vacancy "${job.title}". Any received candidate applications remain preserved.`,
      });
      loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to delete vacancy.' });
    }
  };

  /* Contact message handler */
  const handleMarkMessage = async (msgId, status) => {
    try {
      await apiRequest(`/api/admin/contact-messages/${msgId}`, {
        method: 'PATCH',
        body: { status },
      });
      loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to update message status.' });
    }
  };

  /* Public settings handler */
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/api/admin/company-settings', {
        method: 'PUT',
        body: companySettings,
      });
      setBanner({
        type: 'success',
        text: 'Saved approved company public profile & contact settings.',
      });
      loadAll();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to save settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>
          Careers, Candidate Applications &amp; Public Enquiries
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Manage open job listings, securely review private candidate resumes, handle Contact Us enquiries, and configure approved company details.
        </p>
      </div>

      {banner && (
        <div className={`alert ${banner.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status">
          {banner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{banner.text}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'applications' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => switchTab('applications')}
        >
          <Users size={15} />
          Applications ({applications.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'jobs' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => switchTab('jobs')}
        >
          <Briefcase size={15} />
          Job Openings ({jobs.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'enquiries' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => switchTab('enquiries')}
        >
          <Mail size={15} />
          Contact Enquiries ({messages.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'company' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => switchTab('company')}
        >
          <Settings size={15} />
          Approved Public Company Info
        </button>
      </div>

      {/* TAB 1: CANDIDATE APPLICATIONS */}
      {activeTab === 'applications' && (
        <div>
          <div className="neu-card-compact" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Status changes are internal only and never send automatic emails to candidates.
            </div>
            <div style={{ minWidth: 210 }}>
              <select
                className="neu-select"
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                aria-label="Filter applications by status"
              >
                <option value="all">All Statuses</option>
                {APP_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="neu-table-surface">
            {applications.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                No candidate applications found for the selected filter.
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Received (UTC)</th>
                      <th>Candidate</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Private Resume</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app.id}>
                        <td style={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>{app.createdAt}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{app.fullName}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {app.email} &bull; {app.phone}
                          </div>
                        </td>
                        <td>
                          <div>{app.positionTitle}</div>
                          {app.isGeneralApplication && (
                            <span className="badge badge-neutral" style={{ marginTop: 4 }}>General Pool</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-info">{app.status}</span>
                        </td>
                        <td>
                          <a
                            href={withSessionQuery(`/api/admin/applications/${app.id}/resume`)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            <FileDown size={14} />
                            Open CV
                          </a>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setAppStatusEdit(app.status);
                              setAppNotes(app.adminNotes || '');
                            }}
                          >
                            Review &amp; Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JOB OPENINGS */}
      {activeTab === 'jobs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Only openings marked <strong>published</strong> appear on the public Careers page.
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateJob}>
              <Plus size={15} />
              New Job Opening
            </button>
          </div>

          <div className="neu-table-surface">
            {jobs.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                No job openings created yet. Click <strong>New Job Opening</strong> to publish a role.
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Position Title</th>
                      <th>Employment Type</th>
                      <th>Visibility Status</th>
                      <th>Applications</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{job.title}</td>
                        <td>{job.employmentType || '—'}</td>
                        <td>
                          {job.status === 'published' && <span className="badge badge-success">Published (Open)</span>}
                          {job.status === 'draft' && <span className="badge badge-neutral">Draft</span>}
                          {job.status === 'closed' && <span className="badge badge-warn">Closed</span>}
                        </td>
                        <td>{job.applicationCount}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditJob(job)}
                            >
                              <Edit3 size={14} />
                              Edit / Status
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteJob(job)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONTACT ENQUIRIES */}
      {activeTab === 'enquiries' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {messages.length === 0 ? (
            <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No business or general enquiries received yet.
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="neu-card-compact">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {msg.subject}
                    </strong>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      From: <strong>{msg.name}</strong> ({msg.email}) &bull; {msg.createdAt} UTC
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${msg.status === 'unread' ? 'badge-warn' : 'badge-neutral'}`}>
                      {msg.status}
                    </span>
                    {msg.status !== 'read' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleMarkMessage(msg.id, 'read')}
                      >
                        Mark Read
                      </button>
                    )}
                    {msg.status !== 'archived' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleMarkMessage(msg.id, 'archived')}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <div className="neu-panel-inset" style={{ padding: 14, whiteSpace: 'pre-line', fontSize: '0.92rem' }}>
                  {msg.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: APPROVED PUBLIC COMPANY INFO */}
      {activeTab === 'company' && (
        <div className="neu-card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: 6 }}>Approved Public Company Profile</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
            Leave any field blank if not yet confirmed by management; blank fields are cleanly omitted on public pages rather than replaced with invented placeholders.
          </p>

          <form onSubmit={handleSaveSettings}>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Approved Mission Statement</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 90 }}
                  value={companySettings.mission}
                  onChange={(e) => setCompanySettings({ ...companySettings, mission: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Approved Vision Statement</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 90 }}
                  value={companySettings.vision}
                  onChange={(e) => setCompanySettings({ ...companySettings, vision: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Approved Company Values (One per line)</label>
              <textarea
                className="neu-textarea"
                style={{ minHeight: 90 }}
                placeholder="Enter confirmed company values, one per line..."
                value={companySettings.valuesText}
                onChange={(e) => setCompanySettings({ ...companySettings, valuesText: e.target.value })}
              />
            </div>

            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Official Public Contact Email</label>
                <input
                  type="email"
                  className="neu-input"
                  value={companySettings.contactEmail}
                  onChange={(e) => setCompanySettings({ ...companySettings, contactEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Official Public Telephone</label>
                <input
                  type="text"
                  className="neu-input"
                  value={companySettings.contactPhone}
                  onChange={(e) => setCompanySettings({ ...companySettings, contactPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmed Office Address (Displayed on Contact Page &amp; Footer)</label>
              <textarea
                className="neu-textarea"
                style={{ minHeight: 75 }}
                placeholder="e.g., Building / Street, Area, City, State, PIN"
                value={companySettings.officeAddress || ''}
                onChange={(e) => setCompanySettings({ ...companySettings, officeAddress: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Google Maps Link, Coordinates, or Embed Code (Optional — Interactive Public Map)
              </label>
              <input
                type="text"
                className="neu-input"
                placeholder="Paste a Google Maps URL, coordinates (e.g. 17.4435, 78.3772), or <iframe> embed snippet"
                value={companySettings.mapLink || ''}
                onChange={(e) => setCompanySettings({ ...companySettings, mapLink: e.target.value })}
              />
              <span className="form-hint">
                Entering your Confirmed Office Address above automatically generates an interactive map on <code>/contact</code> and a location pin in the website footer. Paste a Google Maps link or coordinates here for exact pin placement.
              </span>
            </div>

            {(() => {
              const mapPreview = resolveCompanyMap(
                companySettings.officeAddress,
                companySettings.mapLink,
                companySettings.mapLat,
                companySettings.mapLng
              );
              if (!mapPreview) return null;
              return (
                <div className="neu-panel-inset" style={{ padding: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                      <MapPin size={16} color="var(--accent-primary)" />
                      Live Public Map Preview
                    </span>
                    {mapPreview.directionsUrl && (
                      <a
                        href={mapPreview.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={13} />
                        Test Google Maps Link
                      </a>
                    )}
                  </div>
                  {mapPreview.embedSrc ? (
                    <iframe
                      title="Office Location Map Preview"
                      src={mapPreview.embedSrc}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{
                        width: '100%',
                        height: 240,
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: 12,
                        background: '#0f172a',
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Click <strong>Save Approved Public Settings</strong> below to geocode your address and display the exact street marker pin!
                    </div>
                  )}
                </div>
              );
            })()}

            <button type="submit" className="btn btn-primary" disabled={savingSettings}>
              {savingSettings ? 'Saving Settings...' : 'Save Approved Public Settings'}
            </button>
          </form>
        </div>
      )}

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                Application #{selectedApp.id} &mdash; {selectedApp.fullName}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedApp(null)}>
                <X size={16} />
              </button>
            </div>

            {banner?.type === 'error' && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{banner.text}</span>
              </div>
            )}

            <div className="neu-panel-inset" style={{ padding: 14, marginBottom: 16, fontSize: '0.9rem' }}>
              <div><strong>Position:</strong> {selectedApp.positionTitle}</div>
              <div><strong>Email:</strong> {selectedApp.email} &bull; <strong>Phone:</strong> {selectedApp.phone}</div>
              <div style={{ marginTop: 10 }}>
                <strong>Education &amp; Experience:</strong>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{selectedApp.educationExperience}</p>
              </div>
              {selectedApp.coverLetter && (
                <div style={{ marginTop: 10 }}>
                  <strong>Cover Letter / Notes:</strong>
                  <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{selectedApp.coverLetter}</p>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <a
                  href={withSessionQuery(`/api/admin/applications/${selectedApp.id}/resume`)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <FileDown size={14} />
                  Open Private Resume ({selectedApp.resumeOriginalName})
                </a>
              </div>
            </div>

            <form onSubmit={handleSaveApplication}>
              <div className="form-group">
                <label className="form-label">Application Status</label>
                <select
                  className="neu-select"
                  value={appStatusEdit}
                  onChange={(e) => setAppStatusEdit(e.target.value)}
                >
                  {APP_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Internal Hiring Notes</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 80 }}
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedApp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Review Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job Create/Edit Modal */}
      {jobModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                {editingJob ? 'Edit Job Opening' : 'Create Job Opening'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setJobModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {banner?.type === 'error' && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{banner.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveJob}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Position Title *</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select
                    className="neu-select"
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Open on Careers Page)</option>
                    <option value="closed">Closed (Applications Disabled)</option>
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., Full-Time / Contract"
                    value={jobForm.employmentType}
                    onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Arrangement / Location Note</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="Optional confirmed work arrangement"
                    value={jobForm.locationNote}
                    onChange={(e) => setJobForm({ ...jobForm, locationNote: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Job Description *</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 85 }}
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Responsibilities</label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 80 }}
                    value={jobForm.responsibilities}
                    onChange={(e) => setJobForm({ ...jobForm, responsibilities: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Required Qualifications</label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 80 }}
                    value={jobForm.qualifications}
                    onChange={(e) => setJobForm({ ...jobForm, qualifications: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Relevant Skills</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={jobForm.skills}
                    onChange={(e) => setJobForm({ ...jobForm, skills: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Application Instructions</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={jobForm.applicationInstructions}
                    onChange={(e) => setJobForm({ ...jobForm, applicationInstructions: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setJobModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Vacancy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
