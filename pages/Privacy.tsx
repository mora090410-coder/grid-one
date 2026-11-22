import React from 'react';
import { ArticleShell } from '../src/features/site';

const Privacy: React.FC = () => {
  return (
    <ArticleShell
      tag="Legal"
      title="Privacy Policy | GridOne"
      heading="Privacy Policy"
      type="website"
      description="How GridOne handles organizer accounts, football squares board data, optional winner emails, and beta image scanning."
      path="/privacy"
      lede={
        <>
          <span className="mb-3 block font-mono text-[13px] text-fg-3">Last updated: November 22, 2026</span>
          GridOne is built around organizer-controlled boards and read-only viewer links. We collect what is needed to run the board, authenticate organizers, deliver verified emails, and protect the service.
        </>
      }
    >
      <section>
        <h2>1. What We Collect</h2>
        <p>
          GridOne collects minimal information needed to provide our football squares tracking service:
        </p>
        <ul>
          <li><strong>Account info:</strong> Email address for authentication (via Supabase Auth).</li>
          <li><strong>Optional winner email:</strong> A viewer may verify an email address for the purchaser identity they select. The organizer does not receive that address through the public board.</li>
          <li><strong>Abuse-prevention data:</strong> We temporarily log the requesting IP address and a one-way keyed hash of the submitted email address to limit verification-email abuse. We retain these logs only as long as needed for security and operations.</li>
          <li><strong>Board data:</strong> Board names, purchaser labels, square assignments, and game scores you enter.</li>
          <li><strong>Uploaded images:</strong> When you upload a board image for beta scanning, we process it to extract purchaser labels and positions. Images are processed temporarily and are not stored as board records.</li>
          <li><strong>Usage data:</strong> Basic analytics like page views to improve the service.</li>
          <li><strong>Past software purchases:</strong> If you previously purchased a GridOne software plan, we may retain transaction records for accounting, support, or payment disputes. No payment is required to use GridOne now.</li>
        </ul>
      </section>

      <section>
        <h2>2. AI Image Scanning</h2>
        <p>
          Our beta scanning feature uses Google's Gemini API to read uploaded board images and extract purchaser labels and positions. When you use this feature:
        </p>
        <ul>
          <li>Your image is sent to Google's Gemini API for processing.</li>
          <li>The extracted text data is returned to populate your editable grid.</li>
          <li>We do not permanently store the uploaded images after processing.</li>
          <li>Google's use of this data is governed by their privacy policy.</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Data</h2>
        <ul>
          <li>To display your football squares boards and calculate winners.</li>
          <li>To allow you to share viewer links with participants.</li>
          <li>To improve the service and fix bugs.</li>
          <li>We do not sell your personal data to third parties.</li>
          <li>To send verified winner emails through our email delivery provider and honor unsubscribe requests.</li>
          <li>To protect viewers and our sending domain from automated verification-email abuse.</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Sharing</h2>
        <p>
          When you share a board link, viewers can see:
        </p>
        <ul>
          <li>Board name and team matchup.</li>
          <li>Purchaser labels on the grid.</li>
          <li>Current scores and winning squares.</li>
        </ul>
        <p>
          The organizer controls the board. A family or seller link only allows the actions and squares assigned to that link. Public viewer links do not grant edit access. We use Supabase for data storage and authentication.
        </p>
      </section>

      <section>
        <h2>5. Your Rights</h2>
        <p>
          Contact us to request deletion of your account and associated data. You can delete eligible unpublished drafts from your dashboard.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          Questions? Email us at <a href="mailto:support@getgridone.com">support@getgridone.com</a>.
        </p>
      </section>
    </ArticleShell>
  );
};

export default Privacy;
