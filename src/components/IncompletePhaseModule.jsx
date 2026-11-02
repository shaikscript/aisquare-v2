import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * Transparent module status view for Phase 4–7 routes.
 * Per Section 9: "Do not use fabricated client-side data as if it were securely saved production data.
 * If a feature is not yet connected to persistent storage, clearly identify it as incomplete."
 */
export default function IncompletePhaseModule({
  title,
  phase,
  areaLabel,
  summary,
  plannedCapabilities = [],
  backPath,
  backLabel,
}) {
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <span className="badge badge-warn" style={{ marginBottom: 10 }}>
          <Clock size={13} />
          Incomplete — Scheduled for {phase}
        </span>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 740 }}>{summary}</p>
      </div>

      <div className="alert alert-info" role="status">
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Status Transparency Notice ({areaLabel}):</strong> This route and role-based permission
          boundary are active and verified in Phase 3, while persistent database tables and workflows for{' '}
          <strong>{title}</strong> are scheduled for <strong>{phase}</strong>. No fabricated or placeholder
          records are displayed.
        </div>
      </div>

      <div className="neu-card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: 14 }}>
          Planned {phase} Capabilities for This Section
        </h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, color: 'var(--text-body)' }}>
          {plannedCapabilities.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #d5e0ee' }}>
          <Link to={backPath} className="btn btn-secondary">
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
