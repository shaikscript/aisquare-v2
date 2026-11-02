import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { WORK_DOMAINS } from '../../components/DomainVisuals.jsx';
import { useScrollReveal } from '../../components/MinimalStarfield.jsx';

export default function CareersPage() {
  const rootRef = useRef(null);
  const [searchParams] = useSearchParams();
  const trackParam = searchParams.get('track') || '';

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobSelection, setJobSelection] = useState('general');
  const [preferredTrack, setPreferredTrack] = useState(
    WORK_DOMAINS.some((t) => t.title === trackParam) ? trackParam : WORK_DOMAINS[0].title
  );
  const [educationExperience, setEducationExperience] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(null);

  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  useScrollReveal(rootRef);

  useEffect(() => {
    setLoadingJobs(true);
    apiRequest('/api/public/jobs')
      .then((data) => {
        setJobs(data.jobs || []);
        setJobsError('');
      })
      .catch((err) => {
        setJobsError(err.message || 'Unable to load current job openings.');
      })
      .finally(() => setLoadingJobs(false));
  }, []);

  useEffect(() => {
    if (trackParam && WORK_DOMAINS.some((t) => t.title === trackParam)) {
      setJobSelection('general');
      setPreferredTrack(trackParam);
      const timer = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 140);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [trackParam]);

  const handleSelectPosition = (jobId, trackTitle = '') => {
    setJobSelection(String(jobId));
    if (trackTitle) setPreferredTrack(trackTitle);
    setSubmissionSuccess(null);
    setFormError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFormError('');
    if (!file) {
      setResumeFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      setFormError('Please select a valid PDF, DOC, or DOCX resume file.');
      e.target.value = '';
      setResumeFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Resume file must be 5 MB or smaller.');
      e.target.value = '';
      setResumeFile(null);
      return;
    }
    setResumeFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmissionSuccess(null);

    if (!resumeFile) {
      setFormError('Please attach your Resume/CV (.pdf, .doc, or .docx) before submitting.');
      return;
    }

    const combinedCover =
      jobSelection === 'general' && preferredTrack
        ? `[Preferred Track: ${preferredTrack}]${coverLetter.trim() ? `\n${coverLetter.trim()}` : ''}`
        : coverLetter.trim();

    const formData = new FormData();
    formData.append('fullName', fullName.trim());
    formData.append('email', email.trim());
    formData.append('phone', phone.trim());
    formData.append('jobSelection', jobSelection);
    formData.append('educationExperience', educationExperience.trim());
    formData.append('coverLetter', combinedCover);
    formData.append('resume', resumeFile);

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/public/applications', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });

      setSubmissionSuccess({
        id: res.applicationId,
        positionTitle: res.positionTitle,
        message: res.message,
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setJobSelection('general');
      setEducationExperience('');
      setCoverLetter('');
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setFormError(err.message || 'Unable to submit application. Please verify all fields.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} style={{ padding: '44px 0 68px' }}>
      <div className="container">
        {/* Clean Editorial Careers Hero */}
        <div className="neu-card scroll-reveal" style={{ padding: '42px 36px', marginBottom: 32 }}>
          <div style={{ maxWidth: 720 }}>
            <div className="vesper-eyebrow-pill" style={{ marginBottom: 16 }}>
              <Sparkles size={13} />
              <span>Careers &bull; Human AI Evaluation</span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 3.6vw, 2.95rem)',
                fontWeight: 500,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                marginBottom: 14,
              }}
            >
              Join Our{' '}
              <em
                style={{
                  fontFamily: "'Instrument Serif', 'Times New Roman', serif",
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: '#9a9a9a',
                  fontSize: '1.08em',
                }}
              >
                AI Evaluator
              </em>{' '}
              Team.
            </h1>

            <p style={{ margin: '0 0 24px', color: '#9a9a9a', fontSize: '0.98rem', lineHeight: 1.65 }}>
              We look for sharp, detail-oriented thinkers across Generative Image &amp; Video
              Grading, Search Evaluation, Online Ads Assessment, Media Discovery, Speech
              Transcription, POI Validation, and Local Maps.
            </p>

            <button
              type="button"
              className="vesper-btn vesper-btn-solid"
              onClick={() => handleSelectPosition('general')}
            >
              Jump to Application Form
              <ArrowDown size={15} style={{ marginLeft: 6 }} />
            </button>
          </div>
        </div>

        {/* Quick Track Selector Chips */}
        <div className="scroll-reveal" style={{ marginBottom: 34 }}>
          <div
            style={{
              fontSize: '0.76rem',
              color: '#9a9a9a',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12,
            }}
          >
            Select a Specialization Track to Pre-Fill Your Application
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WORK_DOMAINS.map((track) => (
              <button
                key={track.id}
                type="button"
                className={`vesper-nav-pill${
                  jobSelection === 'general' && preferredTrack === track.title ? ' active' : ''
                }`}
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectPosition('general', track.title)}
              >
                {track.title}
              </button>
            ))}
          </div>
        </div>

        {/* Published Open Positions */}
        <section className="scroll-reveal" style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <h2 style={{ fontSize: '1.35rem', fontWeight: 500, margin: 0 }}>Open Positions</h2>
            <button
              type="button"
              className="vesper-btn vesper-btn-ghost"
              onClick={() => handleSelectPosition('general')}
            >
              Submit General Evaluator Application
              <ArrowDown size={14} style={{ marginLeft: 6 }} />
            </button>
          </div>

          {loadingJobs ? (
            <div className="neu-card-compact">Loading published vacancies...</div>
          ) : jobsError ? (
            <div className="alert alert-error">{jobsError}</div>
          ) : jobs.length === 0 ? (
            <div className="neu-panel-inset" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Briefcase size={18} color="#ffffff" />
                <strong style={{ color: '#ffffff', fontWeight: 500 }}>
                  General Evaluator Intake Open
                </strong>
              </div>
              <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Select your preferred specialization above or below and submit a{' '}
                <strong style={{ color: '#d8d8d8' }}>General Application</strong> with your resume to
                be considered for current and upcoming AI evaluation cohorts.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              {jobs.map((job) => (
                <div key={job.id} className="neu-card">
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 14,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.22rem', fontWeight: 500, marginBottom: 6 }}>
                        {job.title}
                      </h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {job.employmentType && (
                          <span className="badge badge-info">{job.employmentType}</span>
                        )}
                        {job.locationNote && (
                          <span className="badge badge-neutral">{job.locationNote}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="vesper-btn vesper-btn-solid"
                      onClick={() => handleSelectPosition(job.id)}
                    >
                      Apply for This Role
                    </button>
                  </div>

                  <p style={{ color: '#d8d8d8', marginBottom: 14, lineHeight: 1.6 }}>
                    {job.description}
                  </p>

                  <div className="grid-2" style={{ gap: 14 }}>
                    {job.responsibilities && (
                      <div className="neu-panel-inset" style={{ padding: 14 }}>
                        <h4 style={{ fontSize: '0.86rem', color: '#ffffff', marginBottom: 6 }}>
                          Responsibilities
                        </h4>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.86rem',
                            color: '#9a9a9a',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {job.responsibilities}
                        </p>
                      </div>
                    )}
                    {job.qualifications && (
                      <div className="neu-panel-inset" style={{ padding: 14 }}>
                        <h4 style={{ fontSize: '0.86rem', color: '#ffffff', marginBottom: 6 }}>
                          Qualifications
                        </h4>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.86rem',
                            color: '#9a9a9a',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {job.qualifications}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Application Form */}
        <section ref={formRef} className="scroll-reveal">
          <div className="neu-card" style={{ padding: '34px 32px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 500, marginBottom: 6 }}>
              Evaluator Application Form
            </h2>
            <p style={{ color: '#9a9a9a', marginBottom: 24, fontSize: '0.9rem' }}>
              Your profile and uploaded resume are securely reviewed only by authorized AI Square
              recruitment administrators.
            </p>

            {formError && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{formError}</span>
              </div>
            )}

            {submissionSuccess && (
              <div className="alert alert-success" role="status">
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>
                    Application Received (#{submissionSuccess.id} — {submissionSuccess.positionTitle})
                  </strong>
                  <div style={{ marginTop: 4 }}>{submissionSuccess.message}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid-2" style={{ gap: 18 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="app-name">
                    Full Name *
                  </label>
                  <input
                    id="app-name"
                    type="text"
                    className="neu-input"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="app-email">
                    Email Address *
                  </label>
                  <input
                    id="app-email"
                    type="email"
                    className="neu-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 18 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="app-phone">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    id="app-phone"
                    type="tel"
                    className="neu-input"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="app-position">
                    Opening *
                  </label>
                  <select
                    id="app-position"
                    className="neu-select"
                    value={jobSelection}
                    onChange={(e) => setJobSelection(e.target.value)}
                  >
                    <option value="general">General Evaluator Application</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={String(job.id)}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {jobSelection === 'general' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="app-track">
                    Preferred Evaluation Track
                  </label>
                  <select
                    id="app-track"
                    className="neu-select"
                    value={preferredTrack}
                    onChange={(e) => setPreferredTrack(e.target.value)}
                  >
                    {WORK_DOMAINS.map((track) => (
                      <option key={track.id} value={track.title}>
                        {track.title}
                      </option>
                    ))}
                    <option value="Open to Any Evaluation Track">
                      Open to Any Evaluation Track
                    </option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="app-edu">
                  Education, Languages &amp; Relevant Experience *
                </label>
                <textarea
                  id="app-edu"
                  className="neu-textarea"
                  placeholder="Share your education, spoken/written languages, desktop & mobile familiarity, and any analytical or research experience..."
                  value={educationExperience}
                  onChange={(e) => setEducationExperience(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="app-resume">
                  Resume / CV Upload * (.pdf, .doc, .docx — max 5 MB)
                </label>
                <div className="neu-panel-inset" style={{ padding: 16 }}>
                  <input
                    ref={fileInputRef}
                    id="app-resume"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    required
                  />
                  {resumeFile && (
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.85rem',
                        color: '#4ade80',
                      }}
                    >
                      <FileText size={16} />
                      <span>
                        Selected: <strong>{resumeFile.name}</strong> (
                        {(resumeFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="app-cover">
                  Additional Notes / Availability (Optional)
                </label>
                <textarea
                  id="app-cover"
                  className="neu-textarea"
                  style={{ minHeight: 86 }}
                  placeholder="Weekly availability, preferred specialization, or additional context..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="submit"
                  className="vesper-btn vesper-btn-solid"
                  style={{ height: 48, padding: '0 26px', fontSize: '0.94rem' }}
                  disabled={submitting}
                >
                  <Upload size={16} style={{ marginRight: 8 }} />
                  {submitting ? 'Submitting Application...' : 'Submit Evaluator Application'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
