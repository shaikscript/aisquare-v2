import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function EmployeeAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/portal/announcements')
      .then((res) => setAnnouncements(res.announcements || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Company Announcements</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Official company-wide updates, project notices, and guideline or assessment communications.
        </p>
      </div>

      {loading ? (
        <div className="neu-card">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No company announcements have been published yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {announcements.map((ann) => (
            <div key={ann.id} className="neu-card">
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="badge badge-info">
                  <Megaphone size={13} />
                  {ann.category}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Published {ann.publishedAt || ann.createdAt} UTC &bull; {ann.authorIdentity}
                </span>
              </div>
              <h2 style={{ fontSize: '1.3rem', marginBottom: 10 }}>{ann.title}</h2>
              <div className="neu-panel-inset" style={{ padding: 16, whiteSpace: 'pre-wrap', fontSize: '0.94rem' }}>
                {ann.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
