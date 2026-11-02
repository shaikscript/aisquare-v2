import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Clock,
  Play,
  RotateCcw,
  Lock,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Award,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function EmployeeAssessments() {
  const navigate = useNavigate();
  const location = useLocation();
  const isCandidatePortal = location.pathname.startsWith('/exam-portal');
  const runnerPrefix = isCandidatePortal ? '/exam-portal/take' : '/portal/assessments/take';
  const resultsPath = isCandidatePortal ? '/exam-portal/results' : '/portal/results';

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
      navigate(`${runnerPrefix}/${assessment.inProgressAttemptId}`);
      return;
    }
    setError('');
    setStartingId(assessment.id);
    try {
      const res = await apiRequest(`/api/portal/assessments/${assessment.id}/start`, {
        method: 'POST',
      });
      if (syncPortalStatus) await syncPortalStatus();
      navigate(`${runnerPrefix}/${res.attemptId}`);
    } catch (err) {
      setError(err.message || 'Unable to start exam.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.7rem', marginBottom: 4 }}>
            {isCandidatePortal ? 'Assigned Exams' : 'Qualification Assessments'}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            {isCandidatePortal
              ? 'Complete the screening or aptitude exam(s) assigned to your candidate login by an administrator.'
              : 'Complete published project qualification and calibration assessments.'}
          </p>
        </div>

        <Link to={resultsPath} className="btn btn-secondary btn-sm">
          <Award size={15} />
          View Released Results
        </Link>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="neu-card">Loading assigned exams...</div>
      ) : assessments.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', padding: '44px 28px' }}>
          <ClipboardCheck
            size={30}
            style={{ color: 'var(--text-muted)', marginBottom: 10 }}
          />
          <h2 style={{ fontSize: '1.15rem', marginBottom: 6 }}>No Active Exam Assigned Yet</h2>
          <p style={{ margin: '0 auto', maxWidth: 480, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Once an administrator assigns an aptitude or AI evaluation exam to your candidate account, it will appear here ready to begin.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {assessments.map((a) => (
            <div key={a.id} className="neu-card">
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge-neutral">
                      <Clock size={13} />
                      {a.isTimed ? `${a.timeLimitMinutes} Min Timed Exam` : 'Untimed Exam'}
                    </span>
                    <span className="badge badge-neutral">{a.questionCount} Questions</span>
                    {a.availableUntil && (
                      <span className="badge badge-warn">
                        Closes: {a.availableUntil.replace('T', ' ')}
                      </span>
                    )}
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
                      Resume In-Progress Exam
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
                      {startingId === a.id ? 'Starting Exam...' : 'Start Exam'}
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
                      Submitted &bull; Locked by Admin
                    </span>
                  )}
                </div>
              </div>

              <div
                className="neu-panel-inset"
                style={{ padding: 14, fontSize: '0.9rem', whiteSpace: 'pre-line', lineHeight: 1.6 }}
              >
                <strong>Exam Instructions:</strong> {a.instructions}
              </div>

              {a.retakeConditions && (
                <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                  <CheckCircle2 size={18} />
                  <span>
                    <strong>Admin Retake Note:</strong> {a.retakeConditions}
                  </span>
                </div>
              )}

              {a.latestAttemptSummary && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    Attempt #{a.latestAttemptSummary.attemptNumber}:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {a.latestAttemptSummary.statusDetail}
                    </strong>
                  </span>
                  <Link
                    to={resultsPath}
                    style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}
                  >
                    Check Results &rarr;
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
