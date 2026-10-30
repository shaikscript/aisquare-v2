import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div style={{ padding: '52px 0 32px' }}>
      <div className="container">
        <div className="neu-card" style={{ maxWidth: 920, margin: '0 auto' }}>
          <span className="badge badge-neutral" style={{ marginBottom: 12 }}>
            Website &amp; Portal Governance
          </span>
          <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Terms &amp; Conditions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 28 }}>
            AI Square IT Solutions &bull; Applicable to public visitors, applicants, and authorized portal users
          </p>

          <div style={{ display: 'grid', gap: 22, color: 'var(--text-body)', fontSize: '0.95rem' }}>
            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>1. Acceptable Website Use</h2>
              <p style={{ margin: 0 }}>
                Visitors may browse public pages, submit genuine business enquiries, and apply for
                employment opportunities with AI Square IT Solutions. Users must not submit false or
                malicious content, upload harmful files, attempt unauthorized access to restricted
                endpoints, or interfere with platform availability.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>2. Employee &amp; Admin Portal Access Rules</h2>
              <p style={{ margin: 0 }}>
                Access to the Employee Portal and Admin Portal is restricted strictly to accounts
                provisioned and authorized by AI Square IT Solutions management. Public self-registration
                is not permitted. Unauthorized attempts to access protected routes, impersonate
                another user, or bypass role permissions are prohibited.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>3. Account Security Responsibilities</h2>
              <p style={{ margin: 0 }}>
                Authorized users are responsible for maintaining the confidentiality of their login
                credentials, updating temporary passwords promptly, and signing out when using
                shared devices. Suspected unauthorized access must be reported immediately to an
                administrator.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>4. Internal Assessment Rules</h2>
              <p style={{ margin: 0 }}>
                Internal assessments measure individual comprehension and practical evaluation
                judgment. Employees must complete assessments independently, follow assessment-specific
                instructions and time limits, and refrain from sharing assessment questions, rubric
                keys, or answers. Results remain subject to administrative review prior to release,
                and retakes require explicit administrator authorization.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>5. Confidentiality &amp; Company Information</h2>
              <p style={{ margin: 0 }}>
                Project guidelines, evaluation rubrics, internal announcements, and training
                materials accessible inside the Employee Portal are confidential operational
                resources. They must not be copied, republished, or distributed outside authorized
                AI Square IT Solutions workflows.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>6. Intellectual Property</h2>
              <p style={{ margin: 0 }}>
                All site branding, portal structure, internal guidelines, and original company
                materials belong to AI Square IT Solutions or their respective authorized owners and
                may not be reproduced commercially without permission.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>7. Limitations &amp; Review Notice</h2>
              <p style={{ margin: 0 }}>
                Information on public pages is provided for general informational purposes and does
                not constitute a binding service contract or employment offer. These Terms &amp;
                Conditions are prepared to match platform functionality and remain subject to formal
                company legal review prior to commercial publication. Questions may be submitted via
                our <Link to="/contact">Contact Us</Link> page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
