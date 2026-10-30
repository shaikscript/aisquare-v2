import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

function formatDuration(sec) {
  if (sec === null || sec === undefined) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export default function EmployeeResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiRequest('/api/portal/results')
      .then((res) => setResults(res.results || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Assessment Results &amp; History</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Scores, pass/fail status, incorrect answers, and explanations appear strictly after an administrator reviews and releases the result. All historical attempts are preserved.
        </p>
      </div>

      {loading ? (
        <div className="neu-card">Loading attempt history...</div>
      ) : results.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No completed assessment attempts on record yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {results.map((r) => {
            const isOpen = expandedId === r.id;
            return (
              <div key={r.id} className="neu-card">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                      <span className="badge badge-info">{r.projectName}</span>
                      <span className="badge badge-neutral">Attempt #{r.attemptNumber}</span>
                      <span className="badge badge-neutral">
                        <Clock size={12} /> Duration: {formatDuration(r.durationSeconds)}
                      </span>
                    </div>
                    <h2 style={{ fontSize: '1.22rem', margin: 0 }}>{r.assessmentTitle}</h2>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Submitted: {r.submittedAt || r.startedAt} UTC
                    </div>
                  </div>

                  {/* Unreleased vs Released Gate */}
                  {!r.isReleased ? (
                    <span className="badge badge-warn" style={{ padding: '7px 13px' }}>
                      <Lock size={13} />
                      {r.statusDetail}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                          {r.finalScore} / {r.totalPossibleMarks} ({r.percentage}%)
                        </div>
                        <div>
                          {r.status === 'expired' ? (
                            <span className="badge badge-danger">Not Attempted — Time Expired</span>
                          ) : r.passed ? (
                            <span className="badge badge-success">Passed</span>
                          ) : (
                            <span className="badge badge-warn">Did Not Pass</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpandedId(isOpen ? null : r.id)}
                      >
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        {isOpen ? 'Hide Review' : 'Review Answers'}
                      </button>
                    </div>
                  )}
                </div>

                {r.isReleased && isOpen && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    {r.reviewerOverallComment && (
                      <div className="alert alert-info">
                        <span>
                          <strong>Administrator Review Note:</strong> {r.reviewerOverallComment}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 12 }}>
                      {r.questions.map((q) => (
                        <div
                          key={q.id}
                          className="neu-panel-inset"
                          style={{
                            padding: 16,
                            borderLeft: q.isCorrect
                              ? '4px solid #22c55e'
                              : '4px solid #ef4444',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>
                              Q{q.sortOrder}. {q.prompt}
                            </strong>
                            <span style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.85rem' }}>
                              {q.isCorrect ? (
                                <span style={{ color: 'var(--text-success-strong)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle2 size={15} /> {q.awardedMarks}/{q.marks}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-danger-strong)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <XCircle size={15} /> {q.awardedMarks}/{q.marks}
                                </span>
                              )}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.88rem', marginTop: 6 }}>
                            <strong>Your Response:</strong>{' '}
                            {q.employeeAnswer || <em>Unanswered (0 marks)</em>}
                          </div>

                          {q.employeeReasoning && (
                            <div style={{ fontSize: '0.86rem', marginTop: 4, color: 'var(--text-body)' }}>
                              <strong>Your Reasoning:</strong> {q.employeeReasoning}
                            </div>
                          )}

                          {!q.isCorrect && q.correctAnswer && (
                            <div style={{ fontSize: '0.88rem', marginTop: 6, color: 'var(--text-success-strong)' }}>
                              <strong>Correct Answer:</strong> {q.correctAnswer}
                            </div>
                          )}

                          {q.reviewerComment && (
                            <div style={{ fontSize: '0.86rem', marginTop: 6, color: 'var(--accent-primary)' }}>
                              <strong>Reviewer Feedback:</strong> {q.reviewerComment}
                            </div>
                          )}

                          {q.explanation && (
                            <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>
                              <strong>Explanation:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
