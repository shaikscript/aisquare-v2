import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Edit3,
  Copy,
  Eye,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Assign Candidates Modal
  const [assignExamTarget, setAssignExamTarget] = useState(null);
  const [assignedUserIds, setAssignedUserIds] = useState([]);
  const [assignModeEdit, setAssignModeEdit] = useState('assigned_only');
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    projectId: '',
    projectTaskRef: '',
    instructions: 'Read all scenario prompts and rules carefully before selecting your answer.',
    isTimed: true,
    timeLimitMinutes: 30,
    pauseOnDisconnect: true,
    passingPercentage: 80,
    selectionMode: 'fixed',
    randomSampleCount: 5,
    randomPoolTag: '',
    availableFrom: '',
    availableUntil: '',
    status: 'published',
    assignmentMode: 'assigned_only',
  });
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [inlineDraft, setInlineDraft] = useState({
    questionType: 'mcq',
    prompt: '',
    optionsText: 'Option A\nOption B\nOption C',
    correctAnswer: 'Option A',
    marks: 1,
    scoringRubric: '',
    explanation: '',
  });
  const [showInlineAdder, setShowInlineAdder] = useState(false);

  // Preview Modal
  const [previewData, setPreviewData] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assRes, projRes, bankRes, empRes] = await Promise.all([
        apiRequest('/api/admin/assessments'),
        apiRequest('/api/admin/projects'),
        apiRequest('/api/admin/question-bank?status=active'),
        apiRequest('/api/admin/employees?status=active&accountType=all'),
      ]);
      setAssessments(assRes.assessments || []);
      setProjects(projRes.projects || []);
      setBankQuestions(bankRes.questions || []);
      setCandidates(empRes.employees || []);
    } catch (err) {
      setError(err.message || 'Unable to load assessments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: '',
      projectId: '',
      projectTaskRef: '',
      instructions: 'Read each item carefully. Unanswered items receive zero marks.',
      isTimed: true,
      timeLimitMinutes: 30,
      pauseOnDisconnect: true,
      passingPercentage: 80,
      selectionMode: 'fixed',
      randomSampleCount: 5,
      randomPoolTag: '',
      availableFrom: '',
      availableUntil: '',
      status: 'published',
      assignmentMode: 'assigned_only',
    });
    setSelectedQuestions([]);
    setShowInlineAdder(false);
    setEditorOpen(true);
  };

  const openAssignCandidates = async (exam) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/assessments/${exam.id}`);
      setAssignExamTarget(res.assessment);
      setAssignedUserIds(res.assignedUserIds || []);
      setAssignModeEdit(res.assessment.assignmentMode || 'assigned_only');
    } catch (err) {
      setError(err.message || 'Unable to load candidate assignments.');
    }
  };

  const handleSaveExamAssignments = async (e) => {
    e.preventDefault();
    if (!assignExamTarget) return;
    setSavingAssignments(true);
    try {
      await apiRequest(`/api/admin/assessments/${assignExamTarget.id}/assignments`, {
        method: 'PUT',
        body: {
          userIds: assignedUserIds,
          assignmentMode: assignModeEdit,
        },
      });
      setNotice(`Saved candidate assignments for "${assignExamTarget.title}".`);
      setAssignExamTarget(null);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to save assignments.');
    } finally {
      setSavingAssignments(false);
    }
  };

  const openEdit = async (id) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/assessments/${id}`);
      const a = res.assessment;
      setEditingId(a.id);
      setForm({
        title: a.title,
        projectId: a.projectId ? String(a.projectId) : '',
        projectTaskRef: a.projectTaskRef || '',
        instructions: a.instructions,
        isTimed: Boolean(a.isTimed),
        timeLimitMinutes: a.timeLimitMinutes || 30,
        pauseOnDisconnect: Boolean(a.pauseOnDisconnect),
        passingPercentage: a.passingPercentage,
        selectionMode: a.selectionMode || 'fixed',
        randomSampleCount: a.randomSampleCount || 5,
        randomPoolTag: a.randomPoolTag || '',
        availableFrom: a.availableFrom ? a.availableFrom.slice(0, 16) : '',
        availableUntil: a.availableUntil ? a.availableUntil.slice(0, 16) : '',
        status: a.status,
        assignmentMode: a.assignmentMode || 'assigned_only',
      });
      setSelectedQuestions(
        (res.questions || []).map((q) => ({
          questionId: q.questionId,
          prompt: q.prompt,
          questionType: q.questionType,
          marksOverride: q.marksOverride ?? q.defaultMarks,
        }))
      );
      setShowInlineAdder(false);
      setEditorOpen(true);
    } catch (err) {
      setError(err.message || 'Unable to load assessment details.');
    }
  };

  const toggleBankQuestion = (bq) => {
    setSelectedQuestions((prev) => {
      const exists = prev.some((x) => x.questionId === bq.id);
      if (exists) return prev.filter((x) => x.questionId !== bq.id);
      return [
        ...prev,
        {
          questionId: bq.id,
          prompt: bq.prompt,
          questionType: bq.questionType,
          marksOverride: bq.marks,
        },
      ];
    });
  };

  const appendInlineQuestion = () => {
    if (!inlineDraft.prompt.trim()) return;
    const options =
      inlineDraft.questionType === 'true_false'
        ? ['True', 'False']
        : inlineDraft.optionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    setSelectedQuestions((prev) => [
      ...prev,
      {
        prompt: inlineDraft.prompt.trim(),
        questionType: inlineDraft.questionType,
        marksOverride: Number(inlineDraft.marks) || 1,
        inlineQuestion: {
          questionType: inlineDraft.questionType,
          prompt: inlineDraft.prompt.trim(),
          options,
          correctAnswer: inlineDraft.correctAnswer,
          marks: Number(inlineDraft.marks) || 1,
          scoringRubric: inlineDraft.scoringRubric,
          explanation: inlineDraft.explanation,
          saveToBank: false,
        },
      },
    ]);
    setInlineDraft({
      questionType: 'mcq',
      prompt: '',
      optionsText: 'Option A\nOption B\nOption C',
      correctAnswer: 'Option A',
      marks: 1,
      scoringRubric: '',
      explanation: '',
    });
    setShowInlineAdder(false);
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        projectId: form.projectId ? Number(form.projectId) : null,
        availableFrom: form.availableFrom ? form.availableFrom.replace('T', ' ') + ':00' : null,
        availableUntil: form.availableUntil ? form.availableUntil.replace('T', ' ') + ':00' : null,
        questions: selectedQuestions.map((sq) =>
          sq.inlineQuestion
            ? { inlineQuestion: sq.inlineQuestion, marksOverride: Number(sq.marksOverride) }
            : { questionId: sq.questionId, marksOverride: Number(sq.marksOverride) }
        ),
      };
      if (editingId) {
        await apiRequest(`/api/admin/assessments/${editingId}`, { method: 'PUT', body: payload });
        setNotice('Assessment updated cleanly.');
      } else {
        await apiRequest('/api/admin/assessments', { method: 'POST', body: payload });
        setNotice('Assessment created.');
      }
      setEditorOpen(false);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to save assessment.');
    }
  };

  const handleDuplicate = async (id) => {
    setError('');
    try {
      await apiRequest(`/api/admin/assessments/${id}/duplicate`, { method: 'POST' });
      setNotice('Assessment duplicated as a new draft.');
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to duplicate assessment.');
    }
  };

  const handleQuickStatus = async (a, nextStatus) => {
    setError('');
    try {
      await apiRequest(`/api/admin/assessments/${a.id}/status`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      setNotice(`Assessment "${a.title}" set to ${nextStatus}.`);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to change status.');
    }
  };

  const openPreview = async (id) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/assessments/${id}`);
      setPreviewData(res);
    } catch (err) {
      setError(err.message || 'Unable to load assessment preview.');
    }
  };

  const handleSeedExamTemplates = async () => {
    setError('');
    setNotice('');
    try {
      const res = await apiRequest('/api/admin/assessments/seed-templates', { method: 'POST' });
      if (res.createdExams > 0) {
        setNotice(
          `Loaded ${res.createdExams} Real AI Evaluation & Aptitude Exam(s) (${res.createdQuestions} questions added to Question Bank). Ready to assign to candidates!`
        );
      } else {
        setNotice('All 3 AI Evaluation & Aptitude template exams are already loaded.');
      }
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to load exam templates.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Exams &amp; Candidate Assignments</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Create timed or untimed aptitude &amp; AI evaluation exams, configure pass marks, and control which candidates are assigned each exam.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={handleSeedExamTemplates}>
            <Sparkles size={15} />
            Load AI Evaluation &amp; Aptitude Pack
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Create Exam
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      <div className="neu-table-surface">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam Title</th>
                <th>Access / Assigned</th>
                <th>Timing</th>
                <th>Questions</th>
                <th>Pass %</th>
                <th>Attempts</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}>Loading exams...</td></tr>
              ) : assessments.length === 0 ? (
                <tr><td colSpan={8}>No exams configured yet.</td></tr>
              ) : (
                assessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                        {a.projectName || a.projectTaskRef || 'Aptitude / Screening'}
                      </div>
                    </td>
                    <td>
                      {a.assignmentMode === 'assigned_only' ? (
                        <span className="badge badge-info">
                          {a.assignedCandidatesCount || 0} Assigned
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          Open ({a.assignedCandidatesCount || 0} Direct)
                        </span>
                      )}
                    </td>
                    <td>{a.isTimed ? `${a.timeLimitMinutes}m Timed` : 'Untimed'}</td>
                    <td>
                      {a.selectionMode === 'random_pool'
                        ? `Random (${a.randomSampleCount})`
                        : `Fixed (${a.linkedQuestionsCount ?? a.linkedQuestionCount ?? 0})`}
                    </td>
                    <td>{a.passingPercentage}%</td>
                    <td>{a.attemptsCount ?? a.attemptCount ?? 0}</td>
                    <td>
                      <span
                        className={`badge ${
                          a.status === 'published'
                            ? 'badge-success'
                            : a.status === 'archived'
                            ? 'badge-neutral'
                            : 'badge-warn'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openAssignCandidates(a)}>
                          <Users size={14} /> Assign ({a.assignedCandidatesCount || 0})
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openPreview(a.id)}>
                          <Eye size={14} /> Preview
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(a.id)}>
                          <Edit3 size={14} /> Edit
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDuplicate(a.id)}>
                          <Copy size={14} /> Duplicate
                        </button>
                        {a.status !== 'published' && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleQuickStatus(a, 'published')}>
                            Publish
                          </button>
                        )}
                        {a.status === 'published' && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleQuickStatus(a, 'archived')}>
                            Archive
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

      {/* Create / Edit Assessment Modal */}
      {editorOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 840 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
                {editingId ? 'Edit Assessment' : 'Create New Assessment'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveAssessment}>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Assessment Title *</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Link to Client Project</label>
                  <select
                    className="neu-select"
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  >
                    <option value="">— Optional Project Link —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-3" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Project / Task Label</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., Search Eval Readiness"
                    value={form.projectTaskRef}
                    onChange={(e) => setForm({ ...form, projectTaskRef: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Passing Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="neu-input"
                    value={form.passingPercentage}
                    onChange={(e) => setForm({ ...form, passingPercentage: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="neu-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Candidate Access Control</label>
                  <select
                    className="neu-select"
                    value={form.assignmentMode}
                    onChange={(e) => setForm({ ...form, assignmentMode: e.target.value })}
                  >
                    <option value="assigned_only">Assigned Candidates Only (Recommended)</option>
                    <option value="all_active">Open to All Unassigned Candidate Accounts</option>
                  </select>
                </div>
              </div>

              <div className="grid-3" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Timing Mode</label>
                  <select
                    className="neu-select"
                    value={form.isTimed ? 'timed' : 'untimed'}
                    onChange={(e) => setForm({ ...form, isTimed: e.target.value === 'timed' })}
                  >
                    <option value="timed">Timed Countdown</option>
                    <option value="untimed">Untimed</option>
                  </select>
                </div>
                {form.isTimed && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Time Limit (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        className="neu-input"
                        value={form.timeLimitMinutes}
                        onChange={(e) => setForm({ ...form, timeLimitMinutes: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Disconnect Policy</label>
                      <select
                        className="neu-select"
                        value={form.pauseOnDisconnect ? 'pause' : 'continue'}
                        onChange={(e) => setForm({ ...form, pauseOnDisconnect: e.target.value === 'pause' })}
                      >
                        <option value="pause">Pause Timer on Connection Loss</option>
                        <option value="continue">Keep Wall-Clock Timer Running</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Available From (UTC, Optional)</label>
                  <input
                    type="datetime-local"
                    className="neu-input"
                    value={form.availableFrom}
                    onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Available Until (UTC, Optional)</label>
                  <input
                    type="datetime-local"
                    className="neu-input"
                    value={form.availableUntil}
                    onChange={(e) => setForm({ ...form, availableUntil: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Employee Instructions *</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 75 }}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  required
                />
              </div>

              {/* Question Selection Policy */}
              <div className="neu-panel-inset" style={{ padding: 16, marginBottom: 16 }}>
                <div className="grid-3" style={{ gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Question Selection Mode</label>
                    <select
                      className="neu-select"
                      value={form.selectionMode}
                      onChange={(e) => setForm({ ...form, selectionMode: e.target.value })}
                    >
                      <option value="fixed">Fixed Question Order</option>
                      <option value="random_pool">Random Pool Sampling</option>
                    </select>
                  </div>
                  {form.selectionMode === 'random_pool' && (
                    <>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">Questions Sampled per Attempt</label>
                        <input
                          type="number"
                          min="1"
                          className="neu-input"
                          value={form.randomSampleCount}
                          onChange={(e) => setForm({ ...form, randomSampleCount: Number(e.target.value) })}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">Bank Pool Tag (or select below)</label>
                        <input
                          type="text"
                          className="neu-input"
                          placeholder="e.g., PRJ-101"
                          value={form.randomPoolTag}
                          onChange={(e) => setForm({ ...form, randomPoolTag: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Selected Questions List */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.9rem' }}>
                    Selected Assessment Questions ({selectedQuestions.length})
                  </strong>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowInlineAdder((v) => !v)}
                  >
                    <Plus size={14} /> Add Inline Question Directly
                  </button>
                </div>

                {showInlineAdder && (
                  <div className="neu-card-compact" style={{ marginBottom: 12 }}>
                    <div className="grid-3" style={{ gap: 10 }}>
                      <select
                        className="neu-select"
                        value={inlineDraft.questionType}
                        onChange={(e) => setInlineDraft({ ...inlineDraft, questionType: e.target.value })}
                      >
                        <option value="mcq">MCQ</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="practical_scenario">Practical Scenario</option>
                      </select>
                      <input
                        type="number"
                        className="neu-input"
                        placeholder="Marks"
                        value={inlineDraft.marks}
                        onChange={(e) => setInlineDraft({ ...inlineDraft, marks: e.target.value })}
                      />
                      <input
                        type="text"
                        className="neu-input"
                        placeholder="Correct Answer (if objective)"
                        value={inlineDraft.correctAnswer}
                        onChange={(e) => setInlineDraft({ ...inlineDraft, correctAnswer: e.target.value })}
                      />
                    </div>
                    <input
                      type="text"
                      className="neu-input"
                      style={{ marginTop: 8 }}
                      placeholder="Question prompt..."
                      value={inlineDraft.prompt}
                      onChange={(e) => setInlineDraft({ ...inlineDraft, prompt: e.target.value })}
                    />
                    {(inlineDraft.questionType === 'mcq' || inlineDraft.questionType === 'practical_scenario') && (
                      <textarea
                        className="neu-textarea"
                        style={{ minHeight: 65, marginTop: 8 }}
                        placeholder="Options (one per line)"
                        value={inlineDraft.optionsText}
                        onChange={(e) => setInlineDraft({ ...inlineDraft, optionsText: e.target.value })}
                      />
                    )}
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={appendInlineQuestion}>
                        Attach Inline Question
                      </button>
                    </div>
                  </div>
                )}

                {selectedQuestions.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                    {selectedQuestions.map((sq, idx) => (
                      <div key={idx} className="neu-panel-inset" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: '0.84rem' }}>
                        <span>
                          <strong>#{idx + 1}</strong> [{sq.questionType}] {sq.prompt}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            className="neu-input"
                            style={{ width: 72, padding: '4px 8px' }}
                            value={sq.marksOverride}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedQuestions((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, marksOverride: val } : item))
                              );
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '4px 8px' }}
                            onClick={() => setSelectedQuestions((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: 6 }}>
                  Pick from Reusable Question Bank:
                </strong>
                <div style={{ maxHeight: 170, overflowY: 'auto', display: 'grid', gap: 6 }}>
                  {bankQuestions.map((bq) => {
                    const checked = selectedQuestions.some((x) => x.questionId === bq.id);
                    return (
                      <label key={bq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBankQuestion(bq)}
                        />
                        <span>
                          [{bq.questionType}] {bq.projectTag ? `(${bq.projectTag}) ` : ''}{bq.prompt} ({bq.marks}m)
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assessment Preview Modal */}
      {previewData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 740 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Preview: {previewData.assessment.title}</h2>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {previewData.assessment.isTimed
                    ? `Timed (${previewData.assessment.timeLimitMinutes} min)`
                    : 'Untimed'}{' '}
                  &bull; Passing Threshold: {previewData.assessment.passingPercentage}%
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewData(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="neu-panel-inset" style={{ padding: 12, marginBottom: 14, fontSize: '0.88rem' }}>
              <strong>Instructions:</strong> {previewData.assessment.instructions}
            </div>

            <div style={{ display: 'grid', gap: 12, maxHeight: '55vh', overflowY: 'auto' }}>
              {(previewData.questions || []).map((q, idx) => (
                <div key={q.linkId} className="neu-panel-inset" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong>Q{idx + 1}. [{q.questionType}]</strong>
                    <span className="badge badge-neutral">{q.marksOverride ?? q.defaultMarks} Marks</span>
                  </div>
                  {q.scenarioContext && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                      Context: {q.scenarioContext}
                    </div>
                  )}
                  <div style={{ fontWeight: 600 }}>{q.prompt}</div>
                  {q.options?.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.88rem' }}>
                      {q.options.map((o) => <li key={o}>{o}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Candidates to Exam Modal */}
      {assignExamTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.22rem', margin: 0 }}>
                  Assign Candidates — {assignExamTarget.title}
                </h2>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Choose who can view and take this exam in the Candidate Portal.
                </span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssignExamTarget(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExamAssignments}>
              <div className="form-group">
                <label className="form-label">Access Policy</label>
                <select
                  className="neu-select"
                  value={assignModeEdit}
                  onChange={(e) => setAssignModeEdit(e.target.value)}
                >
                  <option value="assigned_only">Strictly Assigned Candidates Only</option>
                  <option value="all_active">Open to All Active Candidate Logins</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Candidate Accounts ({assignedUserIds.length} selected)
                  </label>
                  {candidates.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setAssignedUserIds(
                          assignedUserIds.length === candidates.length ? [] : candidates.map((c) => c.id)
                        )
                      }
                    >
                      {assignedUserIds.length === candidates.length ? 'Clear All' : 'Select All'}
                    </button>
                  )}
                </div>

                {candidates.length === 0 ? (
                  <div className="neu-panel-inset" style={{ padding: 14, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                    No active candidate accounts yet. Issue a login from <strong>Job Applications</strong> or create one under <strong>Candidates &amp; Logins</strong>.
                  </div>
                ) : (
                  <div className="neu-panel-inset" style={{ padding: 10, maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 6 }}>
                    {candidates.map((cand) => {
                      const checked = assignedUserIds.includes(cand.id);
                      return (
                        <label
                          key={cand.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAssignedUserIds((prev) =>
                                  prev.includes(cand.id)
                                    ? prev.filter((id) => id !== cand.id)
                                    : [...prev, cand.id]
                                )
                              }
                            />
                            <span>
                              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{cand.fullName}</strong>
                              <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {cand.employeeCode} &bull; {cand.email}
                              </span>
                            </span>
                          </span>
                          <span className={`badge ${cand.accountType === 'candidate' ? 'badge-info' : 'badge-neutral'}`}>
                            {cand.accountType === 'candidate' ? 'Candidate' : 'Employee'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAssignExamTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAssignments}>
                  {savingAssignments ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
