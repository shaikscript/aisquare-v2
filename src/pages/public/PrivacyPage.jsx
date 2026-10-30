import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api.js';

export default function PrivacyPage() {
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    apiRequest('/api/public/info')
      .then((data) => setCompanyInfo(data))
      .catch(() => setCompanyInfo(null));
  }, []);

  return (
    <div style={{ padding: '52px 0 32px' }}>
      <div className="container">
        <div className="neu-card" style={{ maxWidth: 920, margin: '0 auto' }}>
          <span className="badge badge-neutral" style={{ marginBottom: 12 }}>
            Platform Privacy Notice
          </span>
          <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 28 }}>
            AI Square IT Solutions &bull; Reflects platform implementation and internal governance practices
          </p>

          <div style={{ display: 'grid', gap: 22, color: 'var(--text-body)', fontSize: '0.95rem' }}>
            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>1. Overview</h2>
              <p style={{ margin: 0 }}>
                AI Square IT Solutions operates this public website, employee portal, and internal
                administration portal to present company operations, receive business enquiries and
                job applications, and manage internal evaluator preparation and readiness workflows.
                This policy describes the categories of information collected by the platform and how
                they are accessed and managed.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>2. Information Collected</h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
                <li>
                  <strong>Contact Enquiries:</strong> Name, email address, subject, message content,
                  and submission timestamps submitted through the Contact Us form.
                </li>
                <li>
                  <strong>Career Applications &amp; Uploaded Resumes:</strong> Candidate full name,
                  email address, phone number, position applied for, education and experience notes,
                  optional cover letter, uploaded resume/CV files, and internal review statuses.
                </li>
                <li>
                  <strong>Employee Account Information:</strong> Administrator-created full name,
                  assigned employee code, email address, username, salted cryptographic password
                  hashes (plain-text passwords are never stored), role, and account status.
                </li>
                <li>
                  <strong>Guideline Access &amp; Portal Activity Records:</strong> Sign-in/sign-out
                  timestamps, active session timestamps, in-portal navigation events, and guideline
                  access timestamps recorded within the authenticated portal. Portal activity logs
                  do not monitor activity outside this application or across external browser tabs.
                </li>
                <li>
                  <strong>Assessment Attempts, Scores, &amp; Project Readiness:</strong> Assessment
                  responses, timing and connection-interruption events, automated or administrator-reviewed
                  scores, released result history, and project-specific readiness records.
                </li>
                <li>
                  <strong>Employee Feedback Submissions:</strong> Identified (non-anonymous)
                  feedback submitted by employees regarding guidelines, assessments, or portal
                  usability so administrators can follow up constructively.
                </li>
                <li>
                  <strong>Administrative Audit Logs:</strong> Records of administrative management
                  actions, including the acting administrator identity, timestamp, affected record,
                  and relevant before-and-after values.
                </li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>3. Purposes of Collection</h2>
              <p style={{ margin: 0 }}>
                Information is collected strictly to respond to business enquiries, evaluate job
                candidates, authenticate authorized employees and administrators, support evaluator
                preparation and internal assessment administration, track per-project readiness,
                improve internal documentation, and maintain operational accountability.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>4. Access Controls &amp; Data Protection</h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
                <li>
                  Account passwords are hashed on the server using salted cryptographic key
                  derivation (<code>scrypt</code>) prior to database storage.
                </li>
                <li>
                  Authenticated sessions use HTTP-only cookies verified on the server on every
                  protected request; deactivating an employee account immediately revokes active
                  sessions.
                </li>
                <li>
                  Uploaded candidate resumes are stored outside public static web directories and
                  can be accessed only through authenticated administrator endpoints, with access
                  events logged in the administrative audit history.
                </li>
                <li>
                  Employees can view only their own authorized portal records and cannot access
                  other employees&rsquo; records or administrative endpoints.
                </li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>5. Retention &amp; Deletion Practices</h2>
              <p style={{ margin: 0 }}>
                Records are retained in the platform database until reviewed, archived, or removed by
                authorized administrators in accordance with company operational and legal
                obligations. The platform does not perform automatic timed deletion of records unless
                explicitly configured in a future policy update. When an employee account is deleted
                by an administrator, sign-in access is permanently disabled while required historical
                assessment and administrative audit records are preserved for operational integrity.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>6. Privacy Questions &amp; Requests</h2>
              <p style={{ margin: 0 }}>
                {companyInfo?.privacyContactNote ? (
                  companyInfo.privacyContactNote
                ) : companyInfo?.contactEmail ? (
                  <>
                    For questions regarding this Privacy Policy or records submitted to AI Square IT
                    Solutions, contact us at{' '}
                    <a href={`mailto:${companyInfo.contactEmail}`}>{companyInfo.contactEmail}</a> or
                    via our <Link to="/contact">Contact Us</Link> form.
                  </>
                ) : (
                  <>
                    For questions or requests regarding personal information submitted to AI Square
                    IT Solutions, please submit a request with the subject{' '}
                    <strong>&ldquo;Privacy Enquiry&rdquo;</strong> via our{' '}
                    <Link to="/contact">Contact Us</Link> page so authorized management can assist.
                  </>
                )}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
