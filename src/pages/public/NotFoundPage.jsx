import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '72px 0' }}>
      <div className="container">
        <div className="neu-card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Compass size={28} />
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.08em' }}>
            ERROR 404
          </div>
          <h1 style={{ fontSize: '1.8rem', margin: '8px 0 12px' }}>Page Not Found</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            The route you requested does not exist on the AI Square IT Solutions platform. Use one of
            the verified links below to continue.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <Link to="/" className="btn btn-primary">
              <Home size={16} />
              Return to Homepage
            </Link>
            {user && (
              <Link
                to={user.role === 'admin' ? '/admin' : '/portal'}
                className="btn btn-secondary"
              >
                <ArrowLeft size={16} />
                {user.role === 'admin' ? 'Go to Admin Portal' : 'Go to Employee Portal'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
