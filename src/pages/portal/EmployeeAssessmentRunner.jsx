import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

function formatSeconds(sec) {
  if (sec === null || sec === undefined) return '';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function EmployeeAssessmentRunner() {
  const { attemptId } = useParams();
  const { syncPortalStatus } = useOutletContext() || {};

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [savingState, setSavingState] = useState('saved');
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completionNotice, setCompletionNotice] = useState(null);
  const [error, setError] = useState('');

  const offlineSinceRef = useRef(null);
  const answersRef = useRef({});
  answersRef.current = answers;

  const localBackupKey = `aisquare_attempt_${attemptId}`;

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/portal/attempts/${attemptId}`);
      setAttempt(res.attempt);
      setQuestions(res.questions || []);
      setRemainingSeconds(res.attempt.remainingSeconds);

      const map = {};
      for (const sa of res.savedAnswers || []) {
        map[sa.attemptQuestionId] = {
          answerValue: sa.answerValue ?? '',
          reasoningText: sa.reasoningText ?? '',
        };
      }
      // Merge any unsynced local backup from temporary connection loss
      try {
        const localRaw = localStorage.getItem(localBackupKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          Object.assign(map, parsed);
        }
      } catch {
        // Ignore storage read error
      }
      setAnswers(map);

      if (res.attempt.status !== 'in_progress') {
        setCompletionNotice({
          status: res.attempt.status,
          statusDetail: res.attempt.statusDetail,
          message:
            res.attempt.status === 'expired'
              ? 'This attempt has ended because the time limit expired (Not Attempted — Time Expired).'
              : 'This assessment attempt has been submitted and recorded.',
        });
        if (syncPortalStatus) syncPortalStatus();
      }
    } catch (err) {
      setError(err.message || 'Unable to load assessment attempt.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, localBackupKey, syncPortalStatus]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  const flushAnswersToServer = useCallback(
    async (customMap = null) => {
      if (!attempt || attempt.status !== 'in_progress' || completionNotice) return;
      const source = customMap || answersRef.current;
      const payload = Object.entries(source).map(([qid, obj]) => ({
        attemptQuestionId: Number(qid),
        answerValue: obj.answerValue ?? '',
        reasoningText: obj.reasoningText ?? '',
      }));
      if (payload.length === 0) return;

      setSavingState('saving');
      try {
        const res = await apiRequest(`/api/portal/attempts/${attemptId}/answers`, {
          method: 'PUT',
          body: { answers: payload },
        });
        localStorage.removeItem(localBackupKey);
        setSavingState('saved');
        if (res.remainingSeconds !== null && res.remainingSeconds !== undefined) {
          setRemainingSeconds(res.remainingSeconds);
        }
      } catch (err) {
        if (err.status === 409) {
          await loadAttempt();
        } else {
          setSavingState('offline_cached');
        }
      }
    },
    [attempt, attemptId, completionNotice, loadAttempt, localBackupKey]
  );

  // Handle temporary connection loss & seamless reconnection without creating duplicate attempts (Section 6.6)
  useEffect(() => {
    const onOffline = () => {
      setIsOffline(true);
      offlineSinceRef.current = Date.now();
    };

    const onOnline = async () => {
      setIsOffline(false);
      const offlineSecs = offlineSinceRef.current
        ? Math.round((Date.now() - offlineSinceRef.current) / 1000)
        : 0;
      offlineSinceRef.current = null;

      try {
        const intRes = await apiRequest(`/api/portal/attempts/${attemptId}/interruption`, {
          method: 'POST',
          body: { eventType: 'RECONNECTED', offlineSeconds: offlineSecs },
        });
        if (intRes.remainingSeconds !== null && intRes.remainingSeconds !== undefined) {
          setRemainingSeconds(intRes.remainingSeconds);
        }
        await flushAnswersToServer();
      } catch {
        // Retry on next save
      }
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [attemptId, flushAnswersToServer]);

  const handleFinalSubmit = useCallback(
    async (expiredByTimer = false) => {
      if (submitting || completionNotice) return;
      setSubmitting(true);
      setConfirmSubmitOpen(false);
      try {
        const payload = Object.entries(answersRef.current).map(([qid, obj]) => ({
          attemptQuestionId: Number(qid),
          answerValue: obj.answerValue ?? '',
          reasoningText: obj.reasoningText ?? '',
        }));
        const res = await apiRequest(`/api/portal/attempts/${attemptId}/submit`, {
          method: 'POST',
          body: {
            answers: payload,
            expiredByTimer,
          },
        });
        localStorage.removeItem(localBackupKey);
        setCompletionNotice({
          status: res.status,
          statusDetail: res.statusDetail,
          message: res.message,
        });
        if (syncPortalStatus) await syncPortalStatus();
      } catch (err) {
        setError(err.message || 'Unable to submit attempt. Check your connection and try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, completionNotice, localBackupKey, submitting, syncPortalStatus]
  );

  // Live countdown timer (pauses during detected offline disconnection when policy is enabled)
  useEffect(() => {
    if (!attempt || !attempt.isTimed || completionNotice || remainingSeconds === null) {
      return undefined;
    }
    if (isOffline && attempt.pauseOnDisconnect) {
      return undefined;
    }
    if (remainingSeconds <= 0) {
      handleFinalSubmit(true);
      return undefined;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt, completionNotice, handleFinalSubmit, isOffline, remainingSeconds]);

  const updateAnswerField = (questionId, field, value) => {
    if (completionNotice) return;
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: {
          answerValue: prev[questionId]?.answerValue ?? '',
          reasoningText: prev[questionId]?.reasoningText ?? '',
          [field]: value,
        },
      };
      try {
        localStorage.setItem(localBackupKey, JSON.stringify(updated));
      } catch {
        // Ignore quota issue
      }
      return updated;
    });
    setSavingState('unsaved');
  };

  // Debounced auto-save as employee progresses
  useEffect(() => {
    if (savingState !== 'unsaved' || isOffline) return undefined;
    const t = setTimeout(() => {
      flushAnswersToServer();
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, savingState, isOffline, flushAnswersToServer]);

  if (loading) {
    return <div className="neu-card">Loading assessment questions...</div>;
  }

  if (completionNotice) {
    return (
      <div className="neu-card" style={{ maxWidth: 680, margin: '24px auto' }}>
        <div
          className={`alert ${completionNotice.status === 'expired' ? 'alert-warn' : 'alert-success'}`}
          role="status"
        >
          {completionNotice.status === 'expired' ? (
            <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: 2 }} />
          ) : (
            <CheckCircle2 size={22} style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <strong>{completionNotice.statusDetail}</strong>
            <div style={{ marginTop: 6 }}>{completionNotice.message}</div>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: 20 }}>
          Normal portal navigation has been restored. Scores, percentages, and pass/fail status
          remain hidden until an authorized administrator reviews and releases the result.
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/portal/results" className="btn btn-primary">
            View Submission History
          </Link>
          <Link to="/portal" className="btn btn-secondary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (!a) return false;
    if (q.questionType === 'practical_scenario') {
      return Boolean(String(a.answerValue || '').trim() && String(a.reasoningText || '').trim());
    }
    return Boolean(String(a.answerValue || '').trim());
  }).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div>
      {isOffline && (
        <div className="alert alert-warn" role="alert">
          <WifiOff size={18} />
          <div>
            <strong>Temporary Connection Interruption Detected:</strong> Your answers are preserved
            locally in this tab
            {attempt?.pauseOnDisconnect ? ' and your assessment timer is paused' : ''}. When your
            connection returns, your attempt will sync automatically without creating a duplicate.
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Top Assessment Header Bar */}
      <div className="neu-card-compact" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{attempt?.assessmentTitle}</h1>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Attempt #{attempt?.attemptNumber} &bull; Progress: <strong>{answeredCount}</strong> of{' '}
            <strong>{questions.length}</strong> answered
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Save size={14} />
            {savingState === 'saving'
              ? 'Saving...'
              : savingState === 'offline_cached'
              ? 'Saved Locally (Offline)'
              : 'Progress Saved'}
          </span>

          {attempt?.isTimed && (
            <span
              className={`badge ${remainingSeconds !== null && remainingSeconds < 120 ? 'badge-danger' : 'badge-info'}`}
              style={{ fontSize: '0.96rem', padding: '7px 14px' }}
            >
              <Clock size={16} />
              {formatSeconds(remainingSeconds)}
            </span>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              flushAnswersToServer();
              setConfirmSubmitOpen(true);
            }}
          >
            <Send size={14} />
            Finish &amp; Submit
          </button>
        </div>
      </div>

      {/* Instructions Box */}
      <div className="neu-panel-inset" style={{ marginBottom: 20, padding: '12px 16px', fontSize: '0.88rem' }}>
        <strong>Instructions:</strong> {attempt?.instructions}
      </div>

      {/* Question Navigator Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {questions.map((q, idx) => {
          const a = answers[q.id];
          const done =
            q.questionType === 'practical_scenario'
              ? Boolean(a?.answerValue?.trim() && a?.reasoningText?.trim())
              : Boolean(a?.answerValue?.trim());
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`btn btn-sm ${idx === currentIdx ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                minWidth: 42,
                borderColor: done && idx !== currentIdx ? '#22c55e' : undefined,
              }}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Question Card */}
      {currentQ && (
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="badge badge-info">
              Question {currentIdx + 1} of {questions.length} &bull; {currentQ.questionType.replace('_', ' ').toUpperCase()}
            </span>
            <span className="badge badge-neutral">{currentQ.marks} Marks</span>
          </div>

          {currentQ.scenarioContext && (
            <div className="neu-panel-inset" style={{ marginBottom: 16, padding: 16, whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Scenario / Task Context:</strong>
              {currentQ.scenarioContext}
            </div>
          )}

          <h2 style={{ fontSize: '1.18rem', marginBottom: 18, lineHeight: 1.45 }}>
            {currentQ.prompt}
          </h2>

          {/* Single-Answer MCQ or True/False */}
          {(currentQ.questionType === 'mcq' || currentQ.questionType === 'true_false') && (
            <div style={{ display: 'grid', gap: 10 }}>
              {currentQ.options.map((opt) => {
                const selectedVal = answers[currentQ.id]?.answerValue === opt;
                return (
                  <label
                    key={opt}
                    className={`exam-option-card${selectedVal ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQ.id}`}
                      value={opt}
                      checked={selectedVal}
                      onChange={() => updateAnswerField(currentQ.id, 'answerValue', opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Short Answer */}
          {currentQ.questionType === 'short_answer' && (
            <div className="form-group">
              <label className="form-label" htmlFor={`sa-${currentQ.id}`}>Your Concise Response</label>
              <input
                id={`sa-${currentQ.id}`}
                type="text"
                className="neu-input"
                placeholder="Type your short answer..."
                value={answers[currentQ.id]?.answerValue || ''}
                onChange={(e) => updateAnswerField(currentQ.id, 'answerValue', e.target.value)}
              />
            </div>
          )}

          {/* Practical Scenario: Rating + Reasoning */}
          {currentQ.questionType === 'practical_scenario' && (
            <div>
              <div className="form-group">
                <label className="form-label">1. Select Evaluation Rating *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {currentQ.options.map((ratingOpt) => {
                    const chosen = answers[currentQ.id]?.answerValue === ratingOpt;
                    return (
                      <button
                        key={ratingOpt}
                        type="button"
                        onClick={() => updateAnswerField(currentQ.id, 'answerValue', ratingOpt)}
                        className={`btn btn-sm ${chosen ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {ratingOpt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label" htmlFor={`pr-${currentQ.id}`}>
                  2. Explain Your Reasoning Based on Guidelines *
                </label>
                <textarea
                  id={`pr-${currentQ.id}`}
                  className="neu-textarea"
                  placeholder="Write clear, rubric-grounded reasoning justifying your rating..."
                  value={answers[currentQ.id]?.reasoningText || ''}
                  onChange={(e) => updateAnswerField(currentQ.id, 'reasoningText', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Prev / Next Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(148, 163, 184, 0.18)' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {currentIdx < questions.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              >
                Next Question
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  flushAnswersToServer();
                  setConfirmSubmitOpen(true);
                }}
              >
                Review &amp; Submit Attempt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Final Submission */}
      {confirmSubmitOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2 style={{ fontSize: '1.3rem', marginBottom: 10 }}>Confirm Final Submission</h2>
            <p style={{ color: 'var(--text-body)', fontSize: '0.93rem' }}>
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong>{' '}
              questions.
            </p>
            {unansweredCount > 0 && (
              <div className="alert alert-warn">
                <AlertTriangle size={18} />
                <span>
                  You still have <strong>{unansweredCount}</strong> unanswered question(s). Unanswered
                  questions receive zero marks upon submission.
                </span>
              </div>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 20 }}>
              Once submitted, you cannot edit answers for this attempt.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmSubmitOpen(false)}
              >
                Return to Questions
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => handleFinalSubmit(false)}
              >
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
