import React from 'react';

interface LandingPageProps {
  onCreate: () => void;
  onLogin: () => void;
  onJoin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onCreate, onLogin, onJoin }) => {
  return (
    <div className="min-h-screen w-full bg-[#060607] text-white font-sans selection:bg-[#FFC72C]/30 flex flex-col overflow-x-hidden">
      {/* Background - Refined: Subtle Burgundy & Gold Glows, Faint Grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Faint Grid Texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Subtle Glows */}
        <div className="absolute top-[-10%] left-1/2 w-[800px] h-[600px] -translate-x-1/2 rounded-full bg-[#8F1D2C]/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FFC72C]/5 blur-[120px]" />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,#060607_100%)]" />
      </div>

      {/* Nav */}
      <header className="relative z-50 w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3 select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8F1D2C] to-[#5a121c] flex items-center justify-center shadow-lg shadow-[#8F1D2C]/10 border border-white/5 ring-1 ring-white/5">
            <span className="text-[12px] font-bold text-white tracking-tight">S</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-white">Slate</span>
            <span className="text-[10px] font-medium text-white/40 tracking-wide uppercase">Squares</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onLogin}
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Log In
          </button>
          <button
            onClick={onCreate}
            className="hidden md:block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:shadow-white/10"
          >
            Create League
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <div className="grid gap-16 md:grid-cols-2 md:items-center">

          {/* Hero Content */}
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-white">
              Squares, <br />
              <span className="text-white/50">made effortless.</span>
            </h1>

            <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70">
              Upload a board (or start clean). Share one link. Everyone sees live winners and what-if outcomes—no group texts.
            </p>

            <p className="mt-3 text-sm font-medium text-white/40">
              Works for any NFL game.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8F1D2C] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#8F1D2C]/20 hover:brightness-110 transition-all active:scale-[0.98]"
              >
                Create a League
              </button>

              <button
                onClick={onJoin}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 px-8 py-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Join League
              </button>
            </div>

            <div className="mt-4 md:hidden">
              <button
                onClick={onLogin}
                className="text-sm text-white/40 hover:text-white transition-colors"
              >
                Manager Login
              </button>
            </div>

          </div>

          {/* Hero Mock Visual - Premium Slate Viewer Card */}
          <div className="relative mt-8 md:mt-0 animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <div className="relative rounded-[32px] bg-[#0A0A0B] border border-white/10 p-2 shadow-2xl shadow-black">
              {/* Inner Content Container */}
              <div className="rounded-[24px] overflow-hidden bg-[#060607] border border-white/5 relative">

                {/* Mock Status Bar */}
                <div className="h-10 border-b border-white/5 flex items-center justify-between px-5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                    <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Live</span>
                  </div>
                </div>

                {/* Mock Viewer UI */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-white font-semibold text-lg tracking-tight">Super Bowl LIX</div>
                      <div className="text-white/40 text-xs mt-1">Chiefs vs. 49ers</div>
                    </div>
                  </div>

                  {/* Abstract Grid */}
                  <div className="grid grid-cols-5 gap-1.5 mb-6 opacity-80">
                    {[...Array(15)].map((_, i) => (
                      <div key={i} className={`aspect-square rounded-[4px] ${(i === 7) ? 'bg-[#FFC72C] shadow-[0_0_15px_rgba(255,199,44,0.3)]' : 'bg-white/5'} border border-white/5`}></div>
                    ))}
                  </div>

                  {/* Mock Winner Toast */}
                  <div className="bg-[#1A1A1C] border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-lg">
                    <div className="w-8 h-8 rounded-full bg-[#FFC72C] flex items-center justify-center text-black font-bold text-xs">
                      JD
                    </div>
                    <div>
                      <div className="text-white text-xs font-medium">Quarter 1 Winner</div>
                      <div className="text-[#FFC72C] text-[10px] font-bold">$250 Payout</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Soft Ambient Shadow behind card */}
            <div className="absolute -inset-1 z-[-1] bg-gradient-to-br from-[#8F1D2C]/20 to-[#FFC72C]/10 blur-2xl rounded-[40px] opacity-60"></div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="mt-32">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Smart Logic",
                desc: "Real-time play-by-play data powers automated scoring and win probability.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                )
              },
              {
                title: "Live Hub",
                desc: "Instant updates on any device. Everyone sees the same source of truth.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                )
              },
              {
                title: "Commissioner Tools",
                desc: "Effortless setup, custom branding, and automated payout tracking.",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                )
              }
            ].map((f, i) => (
              <div
                key={i}
                className="group rounded-2xl bg-white/[0.02] p-8 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-6 text-white/80 group-hover:text-white group-hover:bg-white/10 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {f.icon}
                  </svg>
                </div>
                <div className="text-base font-semibold text-white tracking-tight">{f.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-white/50">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-32 border-t border-white/5 pt-12 pb-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">S</span>
              </div>
              <span className="text-sm font-semibold text-white/90">Slate</span>
            </div>

            <div className="flex gap-8 text-xs font-medium text-white/40">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
          <div className="mt-8 text-center md:text-left">
            <p className="text-[10px] text-white/20">
              Slate is a tracking tool for organizers. It does not take payments or facilitate betting.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;