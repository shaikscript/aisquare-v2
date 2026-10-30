import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function EmployeeNotifications() {
  const { syncPortalStatus } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/portal/notifications');
      setNotifications(res.notifications || []);
      if (syncPortalStatus) syncPortalStatus();
    } finally {
      setLoading(false);
    }
  }, [syncPortalStatus]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      await apiRequest(`/api/portal/notifications/${id}/read`, { method: 'POST' });
      loadNotifications();
    } catch {
      // Ignore transient mark-read failure
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/portal/notifications/read-all', { method: 'POST' });
      loadNotifications();
    } catch {
      // Ignore transient mark-read failure
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Notifications Center</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            In-portal alerts for newly available assessments, released results, readiness updates, and announcements.
          </p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAllRead}>
            <CheckCheck size={15} />
            Mark All as Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="neu-card">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={26} style={{ marginBottom: 8, opacity: 0.6 }} />
          <div>Your notifications center is clear.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="neu-card-compact"
              style={{
                borderLeft: n.isRead ? '3px solid transparent' : '4px solid var(--accent-primary)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ flex: '1 1 420px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span className={`badge ${n.isRead ? 'badge-neutral' : 'badge-info'}`}>
                    {n.type}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.createdAt} UTC</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-body)', marginTop: 2 }}>
                  {n.message}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {n.linkPath && (
                  <Link
                    to={n.linkPath}
                    onClick={() => !n.isRead && markRead(n.id)}
                    className="btn btn-primary btn-sm"
                  >
                    Open
                    <ArrowRight size={14} />
                  </Link>
                )}
                {!n.isRead && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => markRead(n.id)}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
