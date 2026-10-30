import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Clock, Play, RotateCcw, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function EmployeeAssessments() {
  const navigate = useNavigate();
  const { syncPortalStatus } = useOutletContext() || {};
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiRequest('/api/portal/assessments')
      .then((res) => setAssessments(res.assessments || []))
      .catch((err) => setError(err.message || 'Unable to load assessments.'))
      .finally(() => setLoading(false));
  }, []);

  const handleStartOrResume = async (assessment) => {
    if (assessment.inProgressAttemptId) {
      navigate(`/portal/assessments/take/${assessment.inProgressAttemptId}`);
      return;
    }
    setError('');
    setStartingId(assessment.id);
    try {
      const res = await apiRequest(`/api/portal/assessments/${assessment.id}/start`, {
        method: 'POST',
      });
      if (syncPortalStatus) await syncPortalStatus();
      navigate(`/portal/assessments/take/${res.attemptId}`);
    } catch (err) {
      setError(err.message || 'Unable to start assessment.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Available Assessments</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Complete authorized project assessments. During an active attempt, normal portal navigation is restricted until submission.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="neu-card">Loading available assessments...</div>
      ) : assessments.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No assessments are currently open for taking. You will receive an in-portal notification when new assessments become available.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {assessments.map((a) => (
            <div key={a.id} className="neu-card">
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge-info">{a.projectName}</span>
                    <span className="badge badge-neutral">
                      <Clock size={13} />
                      {a.isTimed ? `Timed: ${a.timeLimitMinutes} Minutes` : 'Untimed'}
                    </span>
                    <span className="badge badge-neutral">{a.questionCount} Questions</span>
                  </div>
                  <h2 style={{ fontSize: '1.3rem', margin: 0 }}>{a.title}</h2>
                </div>

                <div>
                  {a.actionState === 'resume' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartOrResume(a)}
                    >
                      <Play size={16} />
                      Resume In-Progress Attempt
                    </button>
                  )}

                  {a.actionState === 'start' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={startingId === a.id}
                      onClick={() => handleStartOrResume(a)}
                    >
                      <Play size={16} />
                      {startingId === a.id ? 'Starting...' : 'Start Assessment'}
                    </button>
                  )}

                  {a.actionState === 'retake_authorized' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={startingId === a.id}
                      onClick={() => handleStartOrResume(a)}
                    >
                      <RotateCcw size={16} />
                      {startingId === a.id ? 'Starting Retake...' : 'Start Authorized Retake'}
                    </button>
                  )}

                  {a.actionState === 'completed_locked' && (
                    <span className="badge badge-neutral" style={{ padding: '8px 14px' }}>
                      <Lock size={14} />
                      Attempt Recorded (Retake Requires Admin Approval)
                    </span>
                  )}
                </div>
              </div>

              <div className="neu-panel-inset" style={{ padding: 14, fontSize: '0.92rem', whiteSpace: 'pre-line' }}>
                <strong>Instructions:</strong> {a.instructions}
              </div>

              {a.retakeConditions && (
                <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                  <CheckCircle2 size={18} />
                  <span>
                    <strong>Authorized Retake Conditions:</strong> {a.retakeConditions}
                  </span>
                </div>
              )}

              {a.latestAttemptSummary && (
                <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Latest Attempt (#{a.latestAttemptSummary.attemptNumber}):{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {a.latestAttemptSummary.statusDetail}
                  </strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
