import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Search, FileText, ExternalLink, ArrowLeft } from 'lucide-react';
import { apiRequest, withSessionQuery } from '../../utils/api.js';

export default function EmployeeGuidelines() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameQuery, setNameQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');

  const [selected, setSelected] = useState(null);
  const [accessLogId, setAccessLogId] = useState(null);
  const [opening, setOpening] = useState(false);

  const loadGuidelines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nameQuery.trim()) params.set('q', nameQuery.trim());
      if (projectQuery.trim()) params.set('project', projectQuery.trim());
      const res = await apiRequest(`/api/portal/guidelines?${params.toString()}`);
      setGuidelines(res.guidelines || []);
    } catch {
      setGuidelines([]);
    } finally {
      setLoading(false);
    }
  }, [nameQuery, projectQuery]);

  useEffect(() => {
    loadGuidelines();
  }, [loadGuidelines]);

  // Operational study-session duration ping while a guideline is open (Section 6.3 / 7.16)
  useEffect(() => {
    if (!accessLogId) return undefined;
    const timer = setInterval(() => {
      apiRequest(`/api/portal/guidelines/access/${accessLogId}/ping`, {
        method: 'POST',
        body: { seconds: 15 },
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [accessLogId]);

  const handleOpenGuideline = async (gid) => {
    setOpening(true);
    try {
      const res = await apiRequest(`/api/portal/guidelines/${gid}`);
      setSelected(res.guideline);
      setAccessLogId(res.accessLogId);
    } finally {
      setOpening(false);
    }
  };

  if (selected) {
    return (
      <div>
        <div style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelected(null);
              setAccessLogId(null);
            }}
          >
            <ArrowLeft size={15} />
            Back to Guideline Library
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-info">{selected.clientProjectTask}</span>
            <span className="badge badge-neutral">Version v{selected.currentVersion}</span>
          </div>
        </div>

        <div className="neu-card">
          <h1 style={{ fontSize: '1.65rem', marginBottom: 6 }}>{selected.title}</h1>
          {selected.summary && (
            <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>{selected.summary}</p>
          )}

          {selected.guidelineType === 'pdf' ? (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  PDF Document: <strong>{selected.pdfOriginalName}</strong>
                </span>
                <a
                  href={withSessionQuery(`/api/portal/guidelines/${selected.id}/pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <ExternalLink size={14} />
                  Open PDF in New Tab
                </a>
              </div>
              <iframe
                title={selected.title}
                src={withSessionQuery(`/api/portal/guidelines/${selected.id}/pdf`)}
                style={{
                  width: '100%',
                  height: '72vh',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 12,
                  background: '#ffffff',
                }}
              />
            </div>
          ) : (
            <div
              className="neu-panel-inset"
              style={{
                padding: 24,
                whiteSpace: 'pre-wrap',
                fontSize: '0.96rem',
                lineHeight: 1.7,
              }}
            >
              {selected.contentBody}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Central Guideline Library</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Optional reference library open to all employees for preparation and revision. No mandatory completion gates apply, and reading a guideline never automatically starts an assessment.
        </p>
      </div>

      {/* Dual Search: Guideline Name + Client/Project/Task */}
      <div className="neu-card-compact" style={{ marginBottom: 22 }}>
        <div className="grid-2" style={{ gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              className="neu-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by guideline name..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              aria-label="Search by guideline name"
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="search"
              className="neu-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by client, project, or task..."
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
              aria-label="Search by client, project, or task"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="neu-card">Loading guidelines...</div>
      ) : guidelines.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No published guidelines match your search criteria.
        </div>
      ) : (
        <div className="grid-2">
          {guidelines.map((g) => (
            <div key={g.id} className="neu-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="badge badge-info">{g.clientProjectTask}</span>
                  <span className="badge badge-neutral">
                    {g.guidelineType === 'pdf' ? 'PDF Document' : 'Online Guideline'} &bull; v{g.currentVersion}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>{g.title}</h2>
                {g.summary && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                    {g.summary}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(148, 163, 184, 0.18)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Updated {g.updatedAt} UTC
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={opening}
                  onClick={() => handleOpenGuideline(g.id)}
                >
                  {g.guidelineType === 'pdf' ? <FileText size={15} /> : <BookOpen size={15} />}
                  Read Guideline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
