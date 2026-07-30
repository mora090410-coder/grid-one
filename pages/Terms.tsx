import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageMetadata } from '../components/seo/PageMetadata';

const Terms: React.FC = () => {
  return (
    <div className="oa-root min-h-screen bg-broadcast-white text-ink">
      <PageMetadata
        title="Terms of Service | GridOne"
        description="Terms for using GridOne to create, share, and track football squares boards."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-ink/50 mb-8">Last updated: July 28, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-ink/75 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">1. What GridOne Is</h2>
            <p>
              GridOne is a tracking and visualization tool for football squares boards. We help organizers manage square assignments, share read-only results, and calculate score scenarios in one viewer link.
            </p>
            <p className="mt-3 p-4 bg-newsprint border border-newsprint">
              <strong className="text-cardinal">Important:</strong> GridOne is not a gambling or betting platform. We do not collect square money, process wagers, or pay participants. We are a visualization and organizational tool.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to create an account and use GridOne as an organizer. There are no age restrictions for viewing shared board links.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">3. Your Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for the legality of any football squares activity you organize using our tool.</li>
              <li>You must ensure your use complies with applicable local, state, and federal laws.</li>
              <li>You agree not to use GridOne for any unlawful purpose.</li>
              <li>You are responsible for the accuracy of purchaser names and board data you enter.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">4. AI Image Scanning</h2>
            <p>
              GridOne offers an optional beta feature to scan uploaded board images and extract purchaser labels. By using this feature:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>You confirm you have the right to upload the image.</li>
              <li>You understand results may require manual correction—AI is not perfect.</li>
              <li>You accept that images are processed via Google's Gemini API.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">5. Payments</h2>
            <p>
              GridOne includes one published board per account per season at no charge. For the 2026 season, the Game Day plan is a one-time $9.99 payment for up to 5 published boards, and the Organization plan is $79 per season for up to 50 published boards and the organization features described at checkout. Payments are processed securely via Stripe.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>All sales are final once a paid plan has been used to publish a board.</li>
              <li>Viewer access is read-only; organizer edit controls remain tied to the organizer account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">6. Intellectual Property</h2>
            <p>
              GridOne and its original content, features, and functionality are owned by GridOne and are protected by copyright and trademark laws. You retain ownership of the purchaser labels and board details you input.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">7. Disclaimers</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>GridOne is provided "as is" without warranties of any kind.</li>
              <li>We do not guarantee uninterrupted or error-free service.</li>
              <li>We are not responsible for any disputes between organizers and participants.</li>
              <li>AI scanning results are provided as-is and may contain errors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, GridOne shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">9. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of GridOne after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-3">10. Contact</h2>
            <p>
              Questions about these terms? Email us at <a href="mailto:support@getgridone.com" className="text-cardinal hover:underline">support@getgridone.com</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-newsprint text-xs text-ink/50">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>© {new Date().getFullYear()} GridOne.</div>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-ink transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Terms;
