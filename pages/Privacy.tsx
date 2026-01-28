import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Privacy: React.FC = () => {
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

        <h1 className="text-3xl font-semibold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/50 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. What We Collect</h2>
            <p>
              GridOne collects minimal information needed to provide our football squares tracking service:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Account info:</strong> Email address for authentication (via Supabase Auth).</li>
              <li><strong>Board data:</strong> Contest names, player names, square assignments, and game scores you enter.</li>
              <li><strong>Uploaded images:</strong> When you upload a board image for AI scanning, we process it to extract grid data (player names and positions). Images are processed temporarily and not stored long-term.</li>
              <li><strong>Usage data:</strong> Basic analytics like page views to improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. AI Image Scanning</h2>
            <p>
              Our AI scanning feature uses Google's Gemini API to read uploaded board images and extract player names and positions. When you use this feature:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your image is sent to Google's Gemini API for processing.</li>
              <li>The extracted text data is returned to populate your editable grid.</li>
              <li>We do not permanently store the uploaded images after processing.</li>
              <li>Google's use of this data is governed by their privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To display your football squares boards and calculate winners.</li>
              <li>To allow you to share viewer links with participants.</li>
              <li>To improve the service and fix bugs.</li>
              <li>We do not sell your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
            <p>
              When you share a board link, viewers can see:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Contest name and team matchup.</li>
              <li>Player names on the grid.</li>
              <li>Current scores and winning squares.</li>
            </ul>
            <p className="mt-3">
              Only you (the organizer) can edit board data. We use Supabase for data storage and Stripe for payments—both follow industry-standard security practices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Your Rights</h2>
            <p>
              You can delete your account and all associated board data at any time by contacting us. You can also delete individual contests from your dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Contact</h2>
            <p>
              Questions? Email us at <a href="mailto:support@gridone.app" className="text-[#FFC72C] hover:underline">support@gridone.app</a>.
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

export default Privacy;
