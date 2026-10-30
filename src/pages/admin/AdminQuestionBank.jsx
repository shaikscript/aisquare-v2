import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Search,
  Edit3,
  Archive,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

const SAMPLE_CSV = `project_tag,question_type,prompt,scenario_context,options,correct_answer,marks,scoring_rubric,explanation
PRJ-101,mcq,"Which response better satisfies user intent for a factual query?","","Response A (Verified facts)|Response B (Hallucinated citation)|Response C (Off-topic)","Response A (Verified facts)",2,"","Factual accuracy is primary."
PRJ-101,true_false,"Evaluator reasoning should cite specific guideline clauses whenever downgrading a response.","","True|False","True",1,"","Guideline-grounded justification is mandatory."
PRJ-101,short_answer,"Name the status label assigned when a timed assessment reaches zero before submission.","","","Not Attempted — Time Expired",2,"","Exact timeout status rule."
PRJ-101,practical_scenario,"Evaluate the assistant reply for safety and helpfulness.","User asks for troubleshooting steps on a locked router; assistant gives standard factory-reset instructions.","Fully Meets|Partially Meets|Fails to Meet","",5,"Award up to 3 marks for selecting Fully Meets and up to 2 marks for clear rubric justification.","Standard manufacturer reset guidance is safe and helpful."`;

export default function AdminQuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Question Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [form, setForm] = useState({
    projectTag: '',
    questionType: 'mcq',
    prompt: '',
    scenarioContext: '',
    optionsText: 'Option A\nOption B\nOption C\nOption D',
    correctAnswer: 'Option A',
    marks: 1,
    scoringRubric: '',
    explanation: '',
  });

  // Bulk Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState('csv');
  const [importPayload, setImportPayload] = useState(SAMPLE_CSV);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (typeFilter !== 'all') params.set('questionType', typeFilter);
      if (tagFilter.trim()) params.set('projectTag', tagFilter.trim());
      const res = await apiRequest(`/api/admin/question-bank?${params.toString()}`);
      setQuestions(res.questions || []);
    } catch (err) {
      setError(err.message || 'Unable to load question bank.');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, tagFilter]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const openCreate = () => {
    setEditingQ(null);
    setForm({
      projectTag: '',
      questionType: 'mcq',
      prompt: '',
      scenarioContext: '',
      optionsText: 'Option A\nOption B\nOption C\nOption D',
      correctAnswer: 'Option A',
      marks: 1,
      scoringRubric: '',
      explanation: '',
    });
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditingQ(q);
    setForm({
      projectTag: q.projectTag || '',
      questionType: q.questionType,
      prompt: q.prompt,
      scenarioContext: q.scenarioContext || '',
      optionsText: (q.options || []).join('\n'),
      correctAnswer: q.correctAnswer || '',
      marks: q.marks,
      scoringRubric: q.scoringRubric || '',
      explanation: q.explanation || '',
    });
    setModalOpen(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const options =
      form.questionType === 'true_false'
        ? ['True', 'False']
        : form.optionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

    try {
      const body = {
        projectTag: form.projectTag,
        questionType: form.questionType,
        prompt: form.prompt,
        scenarioContext: form.scenarioContext,
        options,
        correctAnswer: form.correctAnswer,
        marks: Number(form.marks),
        scoringRubric: form.scoringRubric,
        explanation: form.explanation,
      };
      if (editingQ) {
        const res = await apiRequest(`/api/admin/question-bank/${editingQ.id}`, {
          method: 'PUT',
          body,
        });
        setNotice(`Question #${editingQ.id} updated to v${res.version} (existing attempts remain unchanged).`);
      } else {
        await apiRequest('/api/admin/question-bank', { method: 'POST', body });
        setNotice('Question added to reusable Question Bank.');
      }
      setModalOpen(false);
      loadQuestions();
    } catch (err) {
      setError(err.message || 'Unable to save question.');
    }
  };

  const archiveQuestion = async (q) => {
    setError('');
    try {
      await apiRequest(`/api/admin/question-bank/${q.id}`, {
        method: 'PUT',
        body: { status: q.status === 'active' ? 'archived' : 'active' },
      });
      loadQuestions();
    } catch (err) {
      setError(err.message || 'Unable to update question status.');
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    setImporting(true);
    setImportErrors([]);
    setError('');
    try {
      const res = await apiRequest('/api/admin/question-bank/bulk-import', {
        method: 'POST',
        body: { format: importFormat, payload: importPayload },
      });
      setNotice(`Successfully validated and imported ${res.importedCount} questions into the Question Bank.`);
      setImportOpen(false);
      loadQuestions();
    } catch (err) {
      setImportErrors(err.payload?.rowErrors || [err.message || 'Import validation failed.']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Reusable Question Bank</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Author MCQ, True/False, Short Answer, and Practical Scenario (rating + reasoning) questions or run validated CSV/JSON bulk imports.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setImportErrors([]); setImportOpen(true); }}>
            <Upload size={16} />
            Bulk Import (CSV / JSON)
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Create Question
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {/* Filters */}
      <div className="neu-card-compact" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 220px', position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            className="neu-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search prompt text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          type="search"
          className="neu-input"
          style={{ width: 200 }}
          placeholder="Filter project tag..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        />
        <select
          className="neu-select"
          style={{ width: 200 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Question Types</option>
          <option value="mcq">Single-Answer MCQ</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
          <option value="practical_scenario">Practical Scenario</option>
        </select>
      </div>

      {/* Table */}
      <div className="neu-table-surface">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID / Ver</th>
                <th>Tag</th>
                <th>Type</th>
                <th>Prompt</th>
                <th>Marks</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading question bank...</td></tr>
              ) : questions.length === 0 ? (
                <tr><td colSpan={7}>No reusable questions found. Create one or run Bulk Import.</td></tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>#{q.id} (v{q.version})</td>
                    <td>{q.projectTag ? <span className="badge badge-info">{q.projectTag}</span> : '—'}</td>
                    <td><span className="badge badge-neutral">{q.questionType}</span></td>
                    <td style={{ maxWidth: 420 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{q.prompt}</div>
                      {q.correctAnswer && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Answer: {q.correctAnswer}
                        </div>
                      )}
                    </td>
                    <td><strong>{q.marks}</strong></td>
                    <td>
                      <span className={`badge ${q.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(q)}>
                          <Edit3 size={14} /> Edit
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => archiveQuestion(q)}>
                          <Archive size={14} /> {q.status === 'active' ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Question Modal */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                {editingQ ? `Edit Question #${editingQ.id}` : 'Add Reusable Question'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion}>
              <div className="grid-3" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Question Type *</label>
                  <select
                    className="neu-select"
                    value={form.questionType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setForm({
                        ...form,
                        questionType: nextType,
                        correctAnswer: nextType === 'true_false' ? 'True' : form.correctAnswer,
                        optionsText:
                          nextType === 'practical_scenario'
                            ? 'Fully Meets\nPartially Meets\nFails to Meet'
                            : form.optionsText,
                      });
                    }}
                  >
                    <option value="mcq">Single-Answer MCQ</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="practical_scenario">Practical Scenario (Rating + Reasoning)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Project / Pool Tag</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., PRJ-101"
                    value={form.projectTag}
                    onChange={(e) => setForm({ ...form, projectTag: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Marks *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="neu-input"
                    value={form.marks}
                    onChange={(e) => setForm({ ...form, marks: e.target.value })}
                    required
                  />
                </div>
              </div>

              {form.questionType === 'practical_scenario' && (
                <div className="form-group">
                  <label className="form-label">Scenario / Prompt &amp; Response Context *</label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 90 }}
                    value={form.scenarioContext}
                    onChange={(e) => setForm({ ...form, scenarioContext: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Question Prompt *</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 80 }}
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  required
                />
              </div>

              {(form.questionType === 'mcq' || form.questionType === 'practical_scenario') && (
                <div className="form-group">
                  <label className="form-label">
                    {form.questionType === 'mcq' ? 'Answer Options (one per line) *' : 'Rating Scale Options (one per line) *'}
                  </label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 90 }}
                    value={form.optionsText}
                    onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                    required
                  />
                </div>
              )}

              {form.questionType === 'true_false' && (
                <div className="form-group">
                  <label className="form-label">Correct Answer *</label>
                  <select
                    className="neu-select"
                    value={form.correctAnswer}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                  >
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                </div>
              )}

              {(form.questionType === 'mcq' || form.questionType === 'short_answer') && (
                <div className="form-group">
                  <label className="form-label">
                    {form.questionType === 'mcq'
                      ? 'Exact Correct Option *'
                      : 'Expected Exact Answer (leave blank to require manual admin grading)'}
                  </label>
                  <input
                    type="text"
                    className="neu-input"
                    value={form.correctAnswer}
                    onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                    required={form.questionType === 'mcq'}
                  />
                </div>
              )}

              {form.questionType === 'practical_scenario' && (
                <div className="form-group">
                  <label className="form-label">Reviewer Scoring Rubric *</label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 75 }}
                    placeholder="Criteria for grading rating selection and written justification..."
                    value={form.scoringRubric}
                    onChange={(e) => setForm({ ...form, scoringRubric: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Post-Release Explanation (shown to employee after result release)</label>
                <input
                  type="text"
                  className="neu-input"
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Question</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validated Bulk Import Modal */}
      {importOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 740 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Bulk Question Import (Validated CSV or JSON)</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImportOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 0 }}>
              Every row is validated before insertion. Malformed rows or invalid question types/options reject the import cleanly with row-level diagnostics.
            </p>

            {importErrors.length > 0 && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Validation Errors Detected (No rows imported):</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {importErrors.map((errStr, i) => (
                      <li key={i}>{errStr}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <form onSubmit={handleBulkImport}>
              <div className="form-group">
                <label className="form-label">Format</label>
                <select
                  className="neu-select"
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value)}
                >
                  <option value="csv">CSV (pipe-delimited options)</option>
                  <option value="json">JSON Array</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paste CSV or JSON Content *</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={importPayload}
                  onChange={(e) => setImportPayload(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setImportFormat('csv');
                    setImportPayload(SAMPLE_CSV);
                  }}
                >
                  Load Sample CSV Template
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={importing}>
                    {importing ? 'Validating & Importing...' : 'Validate & Import'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
