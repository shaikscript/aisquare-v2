import React, { useCallback, useEffect, useState } from 'react';
import {
  FileCheck2,
  Send,
  RotateCcw,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminResults() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Attempt Review & Grading Modal
  const [detail, setDetail] = useState(null);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [overallComment, setOverallComment] = useState('');
  const [scoreAdjustmentNote, setScoreAdjustmentNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Authorize Retake Modal
  const [retakeTarget, setRetakeTarget] = useState(null);
  const [retakeConditions, setRetakeConditions] = useState('');

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?filter=${filter}` : '';
      const res = await apiRequest(`/api/admin/attempts${params}`);
      setAttempts(res.attempts || []);
    } catch (err) {
      setError(err.message || 'Unable to load assessment attempts.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  const openAttemptDetail = async (id) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/attempts/${id}`);
      setDetail(res);
      setOverallComment(res.attempt.reviewerOverallComment || '');
      setScoreAdjustmentNote('');
      const map = {};
      for (const q of res.questions || []) {
        map[q.id] = {
          awardedMarks: q.awardedMarks !== null && q.awardedMarks !== undefined ? q.awardedMarks : 0,
          reviewerComment: q.reviewerComment || '',
        };
      }
      setGradeDrafts(map);
    } catch (err) {
      setError(err.message || 'Unable to inspect attempt.');
    }
  };

  const handleSaveReview = async () => {
    if (!detail) return;
    setSavingReview(true);
    setError('');
    try {
      const questionReviews = Object.entries(gradeDrafts).map(([qid, g]) => ({
        attemptQuestionId: Number(qid),
        awardedMarks: Number(g.awardedMarks),
        reviewerComment: g.reviewerComment,
      }));
      await apiRequest(`/api/admin/attempts/${detail.attempt.id}/review`, {
        method: 'POST',
        body: {
          questionReviews,
          overallComment,
          scoreAdjustmentNote,
        },
      });
      setNotice(`Saved review & recalculated score for Attempt #${detail.attempt.id}.`);
      await openAttemptDetail(detail.attempt.id);
      loadAttempts();
    } catch (err) {
      setError(err.message || 'Unable to save review.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleRelease = async (attemptId) => {
    setError('');
    try {
      await apiRequest(`/api/admin/attempts/${attemptId}/release`, { method: 'POST' });
      setNotice(`Result for Attempt #${attemptId} released to the employee portal.`);
      if (detail && detail.attempt.id === attemptId) {
        await openAttemptDetail(attemptId);
      }
      loadAttempts();
    } catch (err) {
      setError(err.message || 'Unable to release result.');
    }
  };

  const handleAuthorizeRetake = async (e) => {
    e.preventDefault();
    if (!retakeTarget) return;
    try {
      await apiRequest('/api/admin/retakes', {
        method: 'POST',
        body: {
          userId: retakeTarget.userId,
          assessmentId: retakeTarget.assessmentId,
          conditionsNote: retakeConditions,
        },
      });
      setNotice(`Authorized retake for ${retakeTarget.fullName} on "${retakeTarget.assessmentTitle}".`);
      setRetakeTarget(null);
      setRetakeConditions('');
    } catch (err) {
      setError(err.message || 'Unable to authorize retake.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Results, Manual Review &amp; Retakes</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Grade subjective responses against scoring rubrics, adjust marks with audit logging, control result release to employees, and authorize retakes while preserving full attempt history.
        </p>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {/* Filter Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'all', label: 'All Attempts' },
          { key: 'pending_review', label: 'Pending Manual Review' },
          { key: 'pending_release', label: 'Pending Release' },
          { key: 'released', label: 'Released' },
          { key: 'failed', label: 'Did Not Pass' },
          { key: 'expired', label: 'Time Expired' },
          { key: 'interrupted', label: 'Connection Interrupted' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Attempts Table */}
      <div className="neu-table-surface">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Assessment</th>
                <th>Attempt</th>
                <th>Status</th>
                <th>Score</th>
                <th>Release State</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading attempts...</td></tr>
              ) : attempts.length === 0 ? (
                <tr><td colSpan={7}>No attempts match the selected filter.</td></tr>
              ) : (
                attempts.map((att) => (
                  <tr key={att.id}>
                    <td>
                      <strong>{att.fullName}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{att.employeeCode}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{att.assessmentTitle}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{att.projectName || 'General'}</div>
                    </td>
                    <td>
                      #{att.attemptNumber}
                      {att.interruptionCount > 0 && (
                        <span className="badge badge-warn" style={{ marginLeft: 6 }} title="Connection interruption logged">
                          <WifiOff size={11} /> {att.interruptionCount}
                        </span>
                      )}
                    </td>
                    <td>
                      {att.status === 'expired' ? (
                        <span className="badge badge-danger">Not Attempted — Time Expired</span>
                      ) : att.status === 'in_progress' ? (
                        <span className="badge badge-info">In Progress</span>
                      ) : att.reviewStatus === 'pending' && att.requiresManualReview ? (
                        <span className="badge badge-warn">Needs Manual Grading</span>
                      ) : (
                        <span className="badge badge-neutral">Reviewed / Scored</span>
                      )}
                    </td>
                    <td>
                      {att.finalScore !== null && att.finalScore !== undefined ? (
                        <span>
                          <strong>{att.finalScore}/{att.totalPossibleMarks}</strong> ({att.percentage}%)
                        </span>
                      ) : (
                        'Pending'
                      )}
                    </td>
                    <td>
                      {att.isReleased ? (
                        <span className="badge badge-success">Released</span>
                      ) : (
                        <span className="badge badge-neutral">Hidden from Employee</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAttemptDetail(att.id)}>
                          <Eye size={14} /> Inspect / Grade
                        </button>
                        {att.status !== 'in_progress' && !att.isReleased && !(att.requiresManualReview && att.reviewStatus === 'pending') && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRelease(att.id)}>
                            <Send size={13} /> Release
                          </button>
                        )}
                        {att.status !== 'in_progress' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setRetakeTarget(att);
                              setRetakeConditions('');
                            }}
                          >
                            <RotateCcw size={13} /> Authorize Retake
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attempt Review & Grading Modal */}
      {detail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 880 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
                  {detail.attempt.assessmentTitle} &mdash; Attempt #{detail.attempt.attemptNumber}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Employee: <strong>{detail.attempt.fullName} ({detail.attempt.employeeCode})</strong> &bull; Status:{' '}
                  <strong>{detail.attempt.statusDetail}</strong> &bull; Interruptions: {detail.attempt.interruptionCount}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {detail.priorAttempts?.length > 0 && (
              <div className="neu-panel-inset" style={{ padding: 10, marginBottom: 14, fontSize: '0.84rem' }}>
                <strong>Other Preserved Attempts by Employee:</strong>{' '}
                {detail.priorAttempts.map((pa) => (
                  <span key={pa.id} style={{ marginRight: 12 }}>
                    #{pa.attemptNumber}: {pa.finalScore ?? '—'} ({pa.percentage ?? '—'}%) [{pa.status}]
                  </span>
                ))}
              </div>
            )}

            {/* Question-by-Question Review */}
            <div style={{ display: 'grid', gap: 12, maxHeight: '46vh', overflowY: 'auto', marginBottom: 16 }}>
              {detail.questions.map((q) => (
                <div key={q.id} className="neu-panel-inset" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong>Q{q.sortOrder}. [{q.questionType}] {q.prompt}</strong>
                    <span className="badge badge-neutral">Max {q.marks} Marks</span>
                  </div>

                  {q.scenarioContext && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                      Scenario: {q.scenarioContext}
                    </div>
                  )}

                  <div style={{ fontSize: '0.88rem', marginBottom: 4 }}>
                    <strong>Employee Answer:</strong> {q.employeeAnswer || <em>Unanswered</em>}
                  </div>
                  {q.employeeReasoning && (
                    <div style={{ fontSize: '0.88rem', marginBottom: 4 }}>
                      <strong>Employee Reasoning:</strong> {q.employeeReasoning}
                    </div>
                  )}
                  {q.correctAnswer && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-success-strong)', marginBottom: 4 }}>
                      <strong>Expected Answer:</strong> {q.correctAnswer}
                    </div>
                  )}
                  {q.scoringRubric && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--accent-primary)', marginBottom: 8 }}>
                      <strong>Scoring Rubric:</strong> {q.scoringRubric}
                    </div>
                  )}

                  <div className="grid-2" style={{ gap: 10, marginTop: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Awarded Marks (0 – {q.marks})</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={q.marks}
                        className="neu-input"
                        value={gradeDrafts[q.id]?.awardedMarks ?? 0}
                        onChange={(e) =>
                          setGradeDrafts((prev) => ({
                            ...prev,
                            [q.id]: { ...prev[q.id], awardedMarks: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Reviewer Comment for Employee</label>
                      <input
                        type="text"
                        className="neu-input"
                        placeholder="Optional feedback note..."
                        value={gradeDrafts[q.id]?.reviewerComment ?? ''}
                        onChange={(e) =>
                          setGradeDrafts((prev) => ({
                            ...prev,
                            [q.id]: { ...prev[q.id], reviewerComment: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Overall Reviewer Feedback (visible after release)</label>
                <input
                  type="text"
                  className="neu-input"
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Internal Audit Note (if adjusting scores)</label>
                <input
                  type="text"
                  className="neu-input"
                  placeholder="Reason for manual grading or score adjustment..."
                  value={scoreAdjustmentNote}
                  onChange={(e) => setScoreAdjustmentNote(e.target.value)}
                />
              </div>
            </div>

            {detail.events?.length > 0 && (
              <details style={{ marginBottom: 14, fontSize: '0.82rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                  Attempt &amp; Connection Event Log ({detail.events.length})
                </summary>
                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {detail.events.map((ev) => (
                    <div key={ev.id}>
                      <code>{ev.createdAt}</code> &bull; <strong>{ev.eventType}</strong> &mdash; {ev.detail}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {detail.attempt.isReleased ? (
                  <span className="badge badge-success">Result Already Released</span>
                ) : (
                  <span className="badge badge-warn">Result Hidden from Employee</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingReview || detail.attempt.status === 'in_progress'}
                  onClick={handleSaveReview}
                >
                  <FileCheck2 size={15} />
                  {savingReview ? 'Saving Grades...' : 'Save Review & Recalculate'}
                </button>
                {!detail.attempt.isReleased && detail.attempt.status !== 'in_progress' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleRelease(detail.attempt.id)}
                  >
                    <Send size={15} />
                    Release Result to Employee
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retake Authorization Modal */}
      {retakeTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 10 }}>Authorize Assessment Retake</h2>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <p style={{ fontSize: '0.9rem', color: 'var(--text-body)' }}>
              Grant <strong>{retakeTarget.fullName}</strong> one new attempt on{' '}
              <strong>{retakeTarget.assessmentTitle}</strong>. All prior attempt records remain permanently preserved.
            </p>
            <form onSubmit={handleAuthorizeRetake}>
              <div className="form-group">
                <label className="form-label">Retake Conditions / Preparation Note (Optional)</label>
                <textarea
                  className="neu-textarea"
                  placeholder="e.g., Review Guideline v2 Section 3 before starting your retake."
                  value={retakeConditions}
                  onChange={(e) => setRetakeConditions(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRetakeTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Authorize Retake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
