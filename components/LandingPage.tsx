import React from 'react';
import { getContrastYIQ } from '../utils/theme';

interface LandingPageProps {
  onCreate: () => void;
  onLogin: () => void;
  onJoin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onCreate, onLogin, onJoin }) => {
  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col font-sans text-white bg-[#050101]">
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        {/* Stadium Ambience */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1562688028-1512ba3d4107?q=80&w=2070&auto=format&fit=crop')" }}
        ></div>

        {/* Deep Mesh Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-[#0a0203]/80 to-black"></div>

        {/* Floating USC Light Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#9D2235] rounded-full blur-[150px] opacity-20 animate-pulse duration-[4000ms]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#FFC72C] rounded-full blur-[120px] opacity-10 animate-pulse duration-[5000ms] delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-8 md:px-12 w-full max-w-7xl mx-auto" aria-label="Main navigation">
        <div className="text-2xl md:text-3xl font-black tracking-tighter italic text-white drop-shadow-2xl" role="banner">
          SBX<span className="text-[#FFC72C]">PRO</span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 mt-8 md:mt-0">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 max-w-5xl drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/60">
            The Super Bowl <br /> Squares Revolution.
          </h1>
          <p className="text-lg md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed tracking-tight">
            Intelligent software for professional game boards. <br className="hidden md:block" />
            <span className="text-white">Real-time NFL data.</span> Built for Commissioners. Loved by Players.
          </p>

          <div className="flex flex-col items-center justify-center gap-4">
            <button
              onClick={onCreate}
              aria-label="Create a new squares league"
              className="w-full md:w-auto group relative px-10 py-5 bg-[#9D2235] rounded-full overflow-hidden transition-all hover:scale-105 shadow-[0_0_40px_rgba(157,34,53,0.4)] border border-white/10 hover:border-[#FFC72C]/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" aria-hidden="true"></div>

              <span className="relative flex items-center justify-center gap-3 font-black uppercase tracking-widest text-sm md:text-base"
                style={{ color: getContrastYIQ('#9D2235') }}>
                Create Your League
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </button>

            <div className="flex flex-col md:flex-row items-center gap-6 mt-4">
              <button
                onClick={onJoin}
                className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
              >
                Have a code? <span className="underline">Join League</span>
              </button>
              <div className="hidden md:block w-1 h-1 bg-gray-800 rounded-full"></div>
              <button
                onClick={onLogin}
                aria-label="Login as commissioner to manage existing league"
                className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-[#FFC72C] transition-colors"
              >
                Already have a league? <span className="underline">Manager Login</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Showcase Grid */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24 md:py-32" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-6" role="list">
          {[
            {
              title: "AI Game Logic",
              desc: "Automated scoring and live win probability based on real-time NFL play-by-play data.",
              icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            },
            {
              title: "Live Mobile Hub",
              desc: "Dynamic scoreboards and 'What If' scenarios that update instantly on any connected device.",
              icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            },
            {
              title: "Commissioner Command",
              desc: "Effortless setup, custom branding, and automated payout tracking structure.",
              icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            }
          ].map((f, i) => (
            <div key={i} className="group relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-8 hover:bg-[#9D2235]/10 hover:border-[#9D2235]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-6 text-white group-hover:text-[#FFC72C] group-hover:scale-110 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#FFC72C] transition-colors">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm font-medium group-hover:text-gray-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Minimalist Testimonial */}
      <section className="relative z-10 text-center px-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
        <blockquote className="text-2xl md:text-3xl font-medium text-white/90 italic max-w-4xl mx-auto leading-relaxed tracking-tight">
          "SBXPRO turned my squares pool into a professional-grade experience. It’s a game-changer."
        </blockquote>
        <cite className="block mt-6 text-xs font-black text-[#FFC72C] uppercase tracking-[0.2em] not-italic">
          — John D., Commissioner
        </cite>
      </section>

      {/* Clean Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black/40 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} SBXPRO.</span>
            <span className="text-gray-700">|</span>
            <span>Designed in California.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;