import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#060607] text-white font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-white/50 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. What GridOne Is</h2>
            <p>
              GridOne is a tracking and visualization tool for football squares contests. We help organizers manage their boards, share live results, and calculate "what-if" scenarios—all in one shareable link.
            </p>
            <p className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10">
              <strong className="text-[#FFC72C]">Important:</strong> GridOne is NOT a gambling or betting platform. We do not collect money on behalf of players, process wagers, or facilitate any form of gambling. We are purely a visualization and organizational tool.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to create an account and use GridOne as an organizer. There are no age restrictions for viewing shared board links.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Your Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for the legality of any squares pool you organize using our tool.</li>
              <li>You must ensure your use complies with applicable local, state, and federal laws.</li>
              <li>You agree not to use GridOne for any unlawful purpose.</li>
              <li>You are responsible for the accuracy of player names and data you enter.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. AI Image Scanning</h2>
            <p>
              GridOne offers an optional AI-powered feature to scan uploaded board images and extract player names. By using this feature:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>You confirm you have the right to upload the image.</li>
              <li>You understand results may require manual correction—AI is not perfect.</li>
              <li>You accept that images are processed via Google's Gemini API.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Payments</h2>
            <p>
              GridOne charges a one-time fee to activate boards for sharing (currently $9.99 per board or $29.99 for a Founding Pass). Payments are processed securely via Stripe.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>All sales are final—no refunds once a board is activated.</li>
              <li>Founding Pass pricing and benefits are subject to change for future purchasers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Intellectual Property</h2>
            <p>
              GridOne and its original content, features, and functionality are owned by GridOne and are protected by copyright and trademark laws. You retain ownership of data you input (player names, contest details, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Disclaimers</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>GridOne is provided "as is" without warranties of any kind.</li>
              <li>We do not guarantee uninterrupted or error-free service.</li>
              <li>We are not responsible for any disputes between organizers and participants.</li>
              <li>AI scanning results are provided as-is and may contain errors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, GridOne shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of GridOne after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>
              Questions about these terms? Email us at <a href="mailto:support@gridone.app" className="text-[#FFC72C] hover:underline">support@gridone.app</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-xs text-white/50">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>© {new Date().getFullYear()} GridOne.</div>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Terms;
