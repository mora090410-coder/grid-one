import React from 'react';

interface LandingPageProps {
  onCreate: () => void;
  onScan: () => void;
  onLogin: () => void;
  onDemo: () => void;
}


const LandingPage: React.FC<LandingPageProps> = ({ onCreate, onScan, onLogin, onDemo }) => {
  return (
    <div className="min-h-screen bg-[#060607] text-white font-sans selection:bg-[#FFC72C]/30 flex flex-col overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Colorful Orbs */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#8F1D2C]/25 blur-[120px]" />
        <div className="absolute -bottom-48 left-1/3 h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-[#FFC72C]/14 blur-[140px]" />

        {/* Radial sheen */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_55%)]" />

        {/* Fade to black at bottom */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,6,7,0.3),rgba(6,6,7,1))]" />

        {/* Speckle Texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-50 mx-auto w-full max-w-6xl px-5 pt-6">
        <nav className="flex items-center justify-between">
          {/* Logo Area */}
          <div className="flex items-center gap-3">
            <img src="/icons/gridone-icon-256.png" alt="GridOne Logo" className="h-9 w-9 rounded-xl shadow-lg shadow-[#8F1D2C]/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">GridOne</div>
              <div className="text-[11px] text-white/60">Squares</div>
            </div>
          </div>

          {/* Desktop Links */}
          <div className="hidden items-center gap-2 md:flex">
            <a
              href="#how"
              className="rounded-full px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="rounded-full px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="rounded-full px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              FAQ
            </a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all font-medium"
            >
              Sign in
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-14 md:pt-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">

          {/* Hero Copy (Left) */}
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10 backdrop-blur-sm mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFC72C] animate-pulse" />
              AI-Powered Board Scanner
            </div>

            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl text-white">
              Scan your board. <br />
              <span className="bg-gradient-to-r from-[#FFC72C] to-[#FFC72C]/70 bg-clip-text text-transparent">
                Go live instantly.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              Turn a photo of your paper squares into a trackable, shareable link in seconds. No account needed to start.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Primary: Magic Scan */}
              <button
                onClick={onScan}
                className="group relative inline-flex items-center justify-center gap-3 rounded-full bg-[#FFC72C] px-8 py-4 text-base font-bold text-black shadow-[0_0_20px_rgba(255,199,44,0.3)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(255,199,44,0.5)] hover:scale-[1.02] transition-all active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rounded-full"></div>
                <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="relative z-10">Scan Paper Board</span>
              </button>

              {/* Secondary: Build New */}
              <button
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 px-6 py-4 text-base font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 transition-all active:scale-95"
              >
                Start Fresh
                <span className="text-white/50">Build Grid</span>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-white/50">
              <div className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                No sign-up required
              </div>
              <div className="h-3 w-px bg-white/10 hidden sm:block" />
              <div className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Private by default
              </div>
            </div>
          </div>

          {/* Hero Preview (Right Column) */}
          <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
            <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl shadow-black/50">

              {/* Top Bar for Mock */}
              <div className="flex items-center justify-between rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#8F1D2C]/90 ring-1 ring-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">FF</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Friday Fundraiser</div>
                    <div className="text-xs text-white/55">Away vs Home • Live</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                  Updating
                </div>
              </div>

              {/* Current Winners */}
              <div className="mt-4 rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/55 font-medium uppercase tracking-wider">Current winners</div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {["Q1", "Half", "Q3", "Final"].map((label) => (
                    <div
                      key={label}
                      className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 flex flex-col items-center"
                    >
                      <div className="text-[10px] text-white/55">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-white">—</div>
                      <div className="mt-1 text-[10px] text-white/45">$—</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenarios */}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {["If Away scores next…", "If Home scores next…"].map((t) => (
                  <div
                    key={t}
                    className="rounded-2xl bg-black/40 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-white/80">{t}</div>
                      <div className="text-[10px] text-white/45 cursor-pointer hover:text-white transition-colors">View all</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { k: "FG (+3)", v: "Winner: Alex" },
                        { k: "TD (+7)", v: "Winner: Sam" },
                        { k: "Safety (+2)", v: "Winner: Jordan" },
                      ].map((r) => (
                        <div
                          key={r.k}
                          className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
                        >
                          <div className="text-[11px] text-white/60">{r.k}</div>
                          <div className="text-[11px] text-white/80 font-medium">{r.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Share Bottom Bar */}
              <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#8F1D2C]/25 via-white/5 to-[#FFC72C]/20 p-4 ring-1 ring-white/10 transition-all hover:ring-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">One link for everyone</div>
                    <div className="mt-1 text-[11px] text-white/60">
                      Share to GroupMe / TeamSnap — updates instantly.
                    </div>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] ring-1 ring-white/10 font-medium text-white hover:bg-white/20 cursor-pointer transition-colors">
                    Copy link
                  </div>
                </div>
              </div>
            </div>

            {/* Ambient Glow Behind Mock */}
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-[#8F1D2C]/20 to-[#FFC72C]/10 blur-3xl opacity-60" />
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="mt-32">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "1) Create",
                desc: "Name your board and pick the matchup. Start clean or upload an image to parse into an editable grid.",
              },
              {
                title: "2) Share",
                desc: "Activate and get one viewer link. Send it anywhere—everyone sees the same source of truth.",
              },
              {
                title: "3) Enjoy",
                desc: "Live winners, quarter milestones, and “what-if” scenarios update automatically as the score changes.",
              },
            ].map((x) => (
              <div
                key={x.title}
                className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur hover:bg-white/[0.07] transition-colors"
              >
                <div className="text-sm font-semibold text-white">{x.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-white/70">{x.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mt-32">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Simple pricing</h2>
              <p className="mt-2 text-sm text-white/70">
                Build for free. Pay only when you’re ready to share the live link.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {/* Board Activation */}
            <div className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 hover:ring-white/20 transition-all">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Activate this board</div>
                <div className="text-lg font-semibold text-white">$14.99</div>
              </div>
              <div className="mt-1 text-sm text-white/65">Perfect for a one-off event.</div>

              <div className="mt-6 space-y-3 text-sm text-white/70">
                <Feature>Shareable viewer link</Feature>
                <Feature>Live winners + scenarios</Feature>
                <Feature>Organizer edit controls</Feature>
              </div>

              <button
                onClick={onCreate}
                className="mt-8 w-full rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 transition-all"
              >
                Create and activate
              </button>
            </div>

            {/* Founding Pass */}
            <div className="relative rounded-3xl bg-white/5 p-8 ring-1 ring-[#FFC72C]/30 hover:ring-[#FFC72C]/50 transition-all shadow-lg shadow-[#FFC72C]/5">
              <div className="absolute right-5 top-5 rounded-full bg-[#FFC72C] px-3 py-1 text-[11px] font-bold text-black uppercase tracking-wide">
                Best value
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Founding Pass</div>
                <div className="text-lg font-semibold text-white">$29.99</div>
              </div>
              <div className="mt-1 text-sm text-white/65">
                For early adopters—locks in the best price.
              </div>

              <div className="mt-6 space-y-3 text-sm text-white/70">
                <Feature>Includes this Super Bowl board</Feature>
                <Feature>
                  <span className="text-white font-medium">Unlimited boards next season</span>
                </Feature>
                <Feature>Early access to new formats</Feature>
              </div>

              {/* Comparison row */}
              <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3 text-[12px] text-white/75">
                  <div />
                  <div className="text-white/50 font-medium">Board</div>
                  <div className="text-white/50 font-medium">Pass</div>

                  <Row label="Includes Super Bowl board" a="✓" b="✓" />
                  <Row label="Shareable viewer link" a="✓" b="✓" />
                  <Row label="Unlimited boards next season" a="—" b="✓" />
                  <Row label="Early access to new formats" a="—" b="✓" />
                </div>
              </div>

              <button
                onClick={onCreate}
                className="mt-8 w-full rounded-full bg-[#FFC72C] px-5 py-3 text-sm font-semibold text-black hover:brightness-110 shadow-lg shadow-[#FFC72C]/20 transition-all"
              >
                Get Founding Pass
              </button>
            </div>
          </div>

          <p className="mt-6 text-xs text-white/50">
            GridOne is a tracking tool for organizers. It does not take payments or run betting.
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-32">
          <h2 className="text-2xl font-semibold tracking-tight text-white">FAQ</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Faq
              q="Do players need an account?"
              a="No. Players open the viewer link. Only organizers need an account to create and manage boards."
            />
            <Faq
              q="Can I upload a handwritten board?"
              a="Yes. You can upload an image and parse it into an editable grid, then correct anything quickly."
            />
            <Faq
              q="Does it work on mobile?"
              a="Yes. The viewer link is designed for phones first; organizers can manage from mobile or desktop."
            />
            <Faq
              q="Can I run multiple boards?"
              a="Yes. Organizers can create and manage multiple boards; viewers use a link per board."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-32 border-t border-white/10 pt-8 text-xs text-white/55">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>© {new Date().getFullYear()} GridOne.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

// Internal Helper Components for Clean Layout
function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[10px] text-white ring-1 ring-white/10">
        ✓
      </span>
      <span>{children}</span>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <>
      <div className="text-white/70">{label}</div>
      <div className="text-center text-white/70">{a}</div>
      <div className="text-center text-white/90 font-medium">{b}</div>
    </>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="text-sm font-semibold text-white">{q}</div>
      <div className="mt-2 text-sm leading-relaxed text-white/70">{a}</div>
    </div>
  );
}

export default LandingPage;