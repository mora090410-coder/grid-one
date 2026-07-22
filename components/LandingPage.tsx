import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Briefcase, Trophy, Users, Tv, Upload, Link2, Radio } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PageMetadata } from './seo/PageMetadata';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onCreate: () => void;
  onLogin: () => void;
}

const display = { fontFamily: "'Archivo', system-ui, sans-serif" } as const;
const mono = { fontFamily: "'Space Mono', ui-monospace, monospace" } as const;
const hand = { fontFamily: "'Caveat', cursive" } as const;

const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

// Motion + cinematic layer (Material 3 Expressive / Neural Expressive): spring
// easing, shape morphs, an ambient halo, and a scroll-scrubbed hero where a paper
// board crumples away and the GridOne board builds itself. GPU transforms/opacity.
const NE_CSS = `
.ne-progress{position:fixed;top:0;left:0;height:2px;width:100%;transform-origin:0 50%;transform:scaleX(var(--sp,0));background:linear-gradient(90deg,#8F1D2C,#FFC72C);z-index:70;box-shadow:0 0 12px rgba(255,199,44,.5)}
.ne-reveal{opacity:0;transform:translateY(30px) scale(.985);transition:opacity .7s cubic-bezier(.34,1.56,.64,1),transform .7s cubic-bezier(.34,1.56,.64,1);will-change:opacity,transform}
.ne-reveal.is-in{opacity:1;transform:none}
.ne-press{transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .35s ease,filter .2s ease}
.ne-press:active{transform:scale(.94)}
.ne-chip{transition:border-radius .45s cubic-bezier(.34,1.56,.64,1),border-color .3s,box-shadow .3s,transform .35s cubic-bezier(.34,1.56,.64,1),background .3s}
.ne-chip:hover{border-radius:12px;transform:translateY(-3px);border-color:rgba(255,199,44,.55);box-shadow:0 10px 30px rgba(255,199,44,.14)}
.ne-chip:hover .ne-chip-ico{color:#FFC72C}
.ne-faq{transition:border-radius .5s cubic-bezier(.34,1.56,.64,1),border-color .3s,box-shadow .4s,transform .4s cubic-bezier(.34,1.56,.64,1)}
.ne-faq:hover{border-radius:6px;border-color:rgba(255,199,44,.32);box-shadow:0 12px 32px rgba(0,0,0,.4);transform:translateY(-3px)}

/* Cinematic hero */
.stage{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(1rem,3vh,2rem);padding:5rem 1.25rem 2rem}
.paper{transform-origin:50% 45%;transform:rotate(calc(-2deg + var(--pp,0)*42deg)) translate(calc(var(--pp,0)*160px),calc(var(--pp,0)*-140px)) scale(calc(1 - var(--pp,0)*0.82));opacity:calc(1 - var(--pp,0)*1.15);filter:blur(calc(var(--pp,0)*1.6px));will-change:transform,opacity}
.paper-crease{opacity:calc(var(--pp,0)*0.85);mix-blend-mode:multiply}
.clean{opacity:var(--bp,0);transform:scale(calc(.9 + var(--bp,0)*.1));will-change:transform,opacity}
.clean-halo{opacity:calc(var(--wp,0)*.75);transition:opacity .5s ease}
.cb-axis{opacity:calc((var(--np,0) - var(--t,0))*4)}
.cb-name{opacity:calc((var(--mp,0) - var(--t,0))*4)}
.cb-winfill{opacity:var(--wp,0)}
.cb-score{opacity:var(--wp,0)}
.cb-cta{opacity:var(--bp,0);transform:translateY(calc((1 - var(--bp,0))*18px));transition:none}
.ne-halo{animation:ne-drift 15s ease-in-out infinite alternate}
@keyframes ne-drift{0%{transform:translate(-4%,-2%) scale(1)}100%{transform:translate(4%,3%) scale(1.09)}}
@media (prefers-reduced-motion: reduce){
 .ne-reveal{opacity:1!important;transform:none!important;transition:none}
 .ne-halo{animation:none}
 .ne-progress{display:none}
 .paper{opacity:0}
 .clean{opacity:1;transform:none}
 .cb-cta{opacity:1;transform:none}
}
`;

const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number }> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (prefersReduced()) { setInView(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ne-reveal ${inView ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

// The board's real axis assignments (0-9 shuffled): the winning square is where
// the row team's last digit meets the column team's.
const ROW_AXIS = [3, 7, 0, 4, 9, 1, 6, 2, 8, 5]; // KC (down the left)
const COL_AXIS = [9, 4, 7, 1, 2, 0, 5, 8, 3, 6]; // PHI (across the top)
const WIN_ROW = ROW_AXIS.indexOf(4); // KC 24 -> 4
const WIN_COL = COL_AXIS.indexOf(0); // PHI 20 -> 0

const INITIALS = [
  'JM', 'AL', 'KO', 'RW', 'DP', 'SB', 'TN', 'MC', 'GR', 'JD',
  'LE', 'BU', 'ZA', 'MO', 'RE', 'CJ', 'PK', 'NV', 'HS', 'WT',
];
const cellInitials = (i: number) => (i % 9 === 4 ? '' : INITIALS[(i * 7 + 3) % INITIALS.length]);

const csv = (k: string, v: string | number): React.CSSProperties => ({ [k]: v } as React.CSSProperties);

// ── The messy handwritten paper board (the "old way") ──────────────────────────
const PaperBoard: React.FC = () => {
  const G0 = 46; // grid start x
  const GT = 84; // grid start y
  const CELL = 31;
  const scribbleNames = [
    [0, 1, 'Sam'], [1, 3, 'Mia'], [2, 0, 'Deb'], [0, 5, 'Al'], [3, 6, 'Jo'],
    [4, 2, 'Ken'], [1, 7, 'Ray'], [5, 4, 'Pat'], [6, 8, 'Lee'], [2, 9, 'Bo'],
    [7, 1, 'Cam'], [8, 5, 'Van'], [4, 8, 'Tim'], [6, 3, 'Nate'], [8, 9, 'Wes'],
    [3, 0, 'Gus'], [5, 7, 'Ivy'],
  ] as const;
  return (
    <div className="paper absolute inset-0" style={{ filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))' }}>
      <svg viewBox="0 0 380 430" className="h-full w-full">
        <defs>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
          </filter>
        </defs>
        {/* paper */}
        <rect x="6" y="6" width="368" height="418" rx="10" fill="#efe7d2" />
        <rect x="6" y="6" width="368" height="418" rx="10" fill="url(#pg)" opacity="0.5" />
        <radialGradient id="pg" cx="30%" cy="18%" r="90%">
          <stop offset="0%" stopColor="#fbf6e7" />
          <stop offset="100%" stopColor="#e4d9bd" />
        </radialGradient>
        {/* title */}
        <text x="26" y="42" style={hand} fontSize="30" fill="#243a6b" fontWeight={700}>Friday Squares</text>
        <text x="286" y="40" style={hand} fontSize="17" fill="#8a2b2b" transform="rotate(-6 286 40)">$5 ea!</text>
        {/* grid lines (hand-drawn) */}
        <g filter="url(#rough)" stroke="#33507e" strokeWidth="1.4" opacity="0.85">
          {Array.from({ length: 11 }, (_, k) => (
            <line key={`v${k}`} x1={G0 + k * CELL} y1={GT} x2={G0 + k * CELL} y2={GT + 10 * CELL} />
          ))}
          {Array.from({ length: 11 }, (_, k) => (
            <line key={`h${k}`} x1={G0} y1={GT + k * CELL} x2={G0 + 10 * CELL} y2={GT + k * CELL} />
          ))}
        </g>
        {/* axis numbers */}
        <g style={hand} fill="#2b2b2b" fontSize="17">
          {COL_AXIS.map((n, c) => (
            <text key={`ct${c}`} x={G0 + c * CELL + CELL / 2 - 4} y={GT - 6} transform={`rotate(${((c * 7) % 5) - 2} ${G0 + c * CELL + 12} ${GT - 6})`}>{n}</text>
          ))}
          {ROW_AXIS.map((n, r) => (
            <text key={`rt${r}`} x={G0 - 16} y={GT + r * CELL + CELL / 2 + 5} transform={`rotate(${((r * 5) % 5) - 2} ${G0 - 12} ${GT + r * CELL + 15})`}>{n}</text>
          ))}
        </g>
        {/* handwritten names in cells */}
        <g style={hand} fill="#1f1f1f" fontSize="15">
          {scribbleNames.map(([r, c, txt], i) => (
            <text
              key={i}
              x={G0 + (c as number) * CELL + 4}
              y={GT + (r as number) * CELL + CELL / 2 + 5}
              transform={`rotate(${((i * 11) % 9) - 4} ${G0 + (c as number) * CELL + 12} ${GT + (r as number) * CELL + 15})`}
            >
              {txt}
            </text>
          ))}
          {/* a crossed-out name */}
          <text x={G0 + 2 * CELL + 3} y={GT + 3 * CELL + 20} fill="#555">Deb</text>
          <line x1={G0 + 2 * CELL} y1={GT + 3 * CELL + 15} x2={G0 + 3 * CELL - 4} y2={GT + 3 * CELL + 15} stroke="#8a2b2b" strokeWidth="1.6" />
        </g>
        {/* coffee ring for character */}
        <circle cx="322" cy="360" r="26" fill="none" stroke="#7a5230" strokeWidth="5" opacity="0.18" />
        {/* crease shading that intensifies as it crumples */}
        <g className="paper-crease">
          <polygon points="40,120 200,60 180,240 60,300" fill="#000" opacity="0.06" />
          <polygon points="200,60 360,140 300,320 180,240" fill="#000" opacity="0.05" />
          <polygon points="60,300 180,240 300,320 150,400" fill="#000" opacity="0.07" />
        </g>
      </svg>
    </div>
  );
};

// ── The GridOne board that builds itself as you scroll ─────────────────────────
const CleanBoard: React.FC = () => (
  <div className="clean absolute inset-0">
    <div
      className="clean-halo pointer-events-none absolute -inset-6 -z-10 rounded-[40px] blur-3xl"
      style={{ background: 'radial-gradient(60% 60% at 55% 45%, rgba(255,199,44,0.28), rgba(143,29,44,0.18) 60%, transparent)' }}
    />
    <div className="flex h-full flex-col rounded-[24px] border border-[#EDEAE0]/12 bg-[#121317] p-4 shadow-2xl shadow-black/60 sm:p-5">
      {/* Scoreboard */}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-live" style={mono}>
          <span className="h-1.5 w-1.5 rounded-full bg-live" /> FINAL
        </span>
        <div className="cb-score flex items-center gap-3 text-sm font-bold text-[#EDEAE0]" style={mono}>
          <span>KC <span className="text-gold">24</span></span>
          <span className="text-[#EDEAE0]/25">·</span>
          <span>PHI <span className="text-gold">20</span></span>
        </div>
      </div>

      <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'clamp(1rem,3.4vw,1.5rem) repeat(10, 1fr)' }}>
        <div />
        {COL_AXIS.map((n, c) => (
          <div key={`c${c}`} className={`cb-axis flex aspect-square items-center justify-center text-[9px] font-bold sm:text-[11px] ${c === WIN_COL ? 'text-gold' : 'text-[#EDEAE0]/45'}`} style={{ ...mono, ...csv('--t', ((c / 20) * 0.55).toFixed(3)) }}>{n}</div>
        ))}
        {ROW_AXIS.map((rn, r) => (
          <React.Fragment key={`r${r}`}>
            <div className={`cb-axis flex aspect-square items-center justify-center text-[9px] font-bold sm:text-[11px] ${r === WIN_ROW ? 'text-gold' : 'text-[#EDEAE0]/45'}`} style={{ ...mono, ...csv('--t', (((r + 10) / 20) * 0.55).toFixed(3)) }}>{rn}</div>
            {COL_AXIS.map((_, c) => {
              const idx = r * 10 + c;
              const isWinner = r === WIN_ROW && c === WIN_COL;
              const inLane = r === WIN_ROW || c === WIN_COL;
              return (
                <div
                  key={idx}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-[3px] border ${inLane ? 'border-gold/20 bg-gold/[0.05]' : 'border-[#EDEAE0]/[0.06] bg-[#EDEAE0]/[0.02]'}`}
                >
                  <span className={`cb-name text-[7px] font-semibold sm:text-[9px] ${isWinner ? 'text-[#EDEAE0]/40' : inLane ? 'text-[#EDEAE0]/40' : 'text-[#EDEAE0]/25'}`} style={{ ...mono, ...csv('--t', ((idx / 100) * 0.82).toFixed(3)) }}>{cellInitials(idx)}</span>
                  {isWinner && (
                    <span className="cb-winfill absolute inset-0 flex items-center justify-center bg-gold text-[7px] font-bold text-black shadow-[0_0_18px_rgba(255,199,44,0.6)] sm:text-[9px]" style={mono}>{cellInitials(idx)}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="cb-score mt-3 flex items-center justify-between rounded-2xl border border-[#EDEAE0]/10 bg-black/30 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#EDEAE0]">One link, everyone watching</div>
          <div className="truncate text-[11px] text-[#EDEAE0]/50" style={mono}>getgridone.com/?board=FRIDAY</div>
        </div>
        <span className="shrink-0 rounded-full bg-[#EDEAE0]/10 px-3 py-1 text-[11px] font-semibold text-[#EDEAE0]">Copy</span>
      </div>
    </div>
  </div>
);

const NARRATION = ['The old paper way', 'Drawing the grid', 'Adding the players', 'We have a winner'];

const FEATURED_USES = [
  { label: 'Booster clubs', Icon: Megaphone },
  { label: 'Office pools', Icon: Briefcase },
  { label: 'Super Bowl parties', Icon: Trophy },
  { label: 'Youth sports', Icon: Users },
  { label: 'Watch parties', Icon: Tv },
];

const STEPS = [
  { k: 'Build the board', d: 'Upload a photo or start blank, then clean up names in seconds.', Icon: Upload },
  { k: 'Share one link', d: 'No logins for viewers. It opens clean on every phone.', Icon: Link2 },
  { k: 'Watch it live', d: 'Scores update, winners light up, and the arguments stop.', Icon: Radio },
];

const FAQ_ITEMS = [
  { q: 'How does pricing work?', a: 'Creating and editing boards is free. For this season, $14.99 unlocks up to 20 boards. Build everything first, then pay when your boards are ready to share.' },
  { q: 'Who needs an account?', a: 'Only the organizer needs an account. Viewers open the share link and see the board, live score state, and winner scenarios in read-only mode.' },
  { q: 'Can I upload a handwritten board?', a: 'Yes. Upload a board image, let GridOne scan it, then fix any names or squares before you unlock sharing.' },
  { q: 'What exactly unlocks after I pay?', a: 'Before payment you can build, edit, preview, and test your boards. After payment, this season\'s $14.99 unlock gives you up to 20 boards you can publish with live viewer links so everyone can follow along without edit access.' },
  { q: 'Do viewers get edit access?', a: 'No. Organizers can edit the board. Viewers are read-only and can follow the board, scoreboard, and live winner scenarios.' },
  { q: 'Is GridOne good for fundraisers or team groups?', a: 'Yes. GridOne is built for organizers running football squares for youth sports teams, booster clubs, office pools, watch parties, and local community fundraisers that need one simple live board link.' },
];

const LandingPage: React.FC<LandingPageProps> = ({ onCreate, onLogin }) => {
  const title = 'Football Squares App for Super Bowl Squares, Fundraisers, and Group Pools | GridOne';
  const description = 'Run football squares and Super Bowl squares online with GridOne. Built for fundraisers, office pools, watch parties, and community groups that want one clean live board link.';
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    if (!hero || !stage) return;
    if (prefersReduced()) {
      // Show the finished board; skip the scrub and smooth scroll.
      (['--pp', '--bp', '--np', '--mp', '--wp'] as const).forEach((k) => hero.style.setProperty(k, '1'));
      setPhase(3);
      (window as { __ready?: boolean }).__ready = true;
      return;
    }

    const root = document.documentElement;
    const lenis = new Lenis({ duration: 1.1 });
    lenisRef.current = lenis;

    // Lenis drives ScrollTrigger; velocity feeds the ambient "thinking" glow.
    lenis.on('scroll', ScrollTrigger.update);
    lenis.on('scroll', (e: { scroll: number; limit: number; velocity: number }) => {
      root.style.setProperty('--sp', (e.limit > 0 ? e.scroll / e.limit : 0).toFixed(4));
      root.style.setProperty('--ne-glow', (0.4 + Math.min(Math.abs(e.velocity) / 40, 1) * 0.6).toFixed(3));
    });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    let lastPhase = -1;
    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: () => '+=' + window.innerHeight * 2.2,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        hero.style.setProperty('--pp', smooth((p - 0.06) / 0.20).toFixed(4)); // paper crumples
        hero.style.setProperty('--bp', smooth((p - 0.24) / 0.14).toFixed(4)); // clean board in
        hero.style.setProperty('--np', smooth((p - 0.40) / 0.16).toFixed(4)); // numbers
        hero.style.setProperty('--mp', smooth((p - 0.56) / 0.22).toFixed(4)); // names
        hero.style.setProperty('--wp', smooth((p - 0.80) / 0.15).toFixed(4)); // winner
        const ph = p < 0.24 ? 0 : p < 0.56 ? 1 : p < 0.80 ? 2 : 3;
        if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }
      },
    });

    // Settle layout so the pin spacer height is known before any jump.
    ScrollTrigger.refresh();
    lenis.resize();

    // Dev/verify contract: ?jump=<px> lands pre-scrolled, __ready fires when settled.
    (window as { __lenis?: Lenis }).__lenis = lenis;
    const jump = new URLSearchParams(window.location.search).get('jump');
    if (jump) { lenis.scrollTo(parseFloat(jump), { immediate: true }); ScrollTrigger.update(); }
    requestAnimationFrame(() => { (window as { __ready?: boolean }).__ready = true; });

    return () => {
      st.kill();
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const smoothTo = (sel: string) => (e: React.MouseEvent) => {
    const lenis = lenisRef.current;
    if (lenis) { e.preventDefault(); lenis.scrollTo(sel, { offset: -16 }); }
  };

  return (
    <div className="min-h-screen bg-background text-[#EDEAE0] font-sans selection:bg-gold/30 flex flex-col overflow-x-clip">
      <style>{NE_CSS}</style>
      <div className="ne-progress" aria-hidden="true" />
      <PageMetadata
        title={title}
        description={description}
        path="/"
        type="website"
        schema={[
          { '@type': 'WebSite', name: 'GridOne', url: 'https://www.getgridone.com/' },
          { '@type': 'SoftwareApplication', name: 'GridOne', applicationCategory: 'SportsApplication', operatingSystem: 'Any', description, offers: { '@type': 'Offer', price: '14.99', priceCurrency: 'USD' } },
          { '@type': 'FAQPage', mainEntity: FAQ_ITEMS.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) },
        ]}
      />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ne-halo absolute left-1/2 top-[-12%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-cardinal/16 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.05),transparent_55%)]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[#EDEAE0]/[0.06] bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <img src="/icons/gridone-icon-256.png" alt="GridOne" className="h-9 w-9 rounded-xl ring-1 ring-gold/50" />
            <span className="text-base font-extrabold uppercase tracking-tight sm:text-lg" style={display}>GridOne</span>
          </div>
          <div className="hidden items-center gap-1 md:flex" style={mono}>
            <a href="#how" onClick={smoothTo('#how')} className="rounded-full px-3 py-2 text-[13px] text-[#EDEAE0]/60 transition-colors hover:text-[#EDEAE0]">How it works</a>
            <a href="#faq" onClick={smoothTo('#faq')} className="rounded-full px-3 py-2 text-[13px] text-[#EDEAE0]/60 transition-colors hover:text-[#EDEAE0]">FAQ</a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={onLogin} className="ne-press hidden whitespace-nowrap rounded-full px-4 py-2 text-sm text-[#EDEAE0]/80 ring-1 ring-[#EDEAE0]/12 transition-all hover:bg-[#EDEAE0]/5 hover:text-[#EDEAE0] sm:inline-flex">Sign in</button>
            <button onClick={onCreate} className="ne-press whitespace-nowrap rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-black shadow-lg shadow-gold/20 hover:brightness-95 sm:text-sm">Create board</button>
          </div>
        </nav>
      </header>

      {/* ── Cinematic scroll hero (GSAP ScrollTrigger pin + Lenis smooth scroll) ── */}
      <section ref={heroRef} className="relative z-10">
        <div ref={stageRef} className="stage">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#EDEAE0]/50" style={mono}>
            <span className={`h-1.5 w-1.5 rounded-full ${phase === 3 ? 'bg-gold' : 'bg-live animate-pulse'}`} />
            <span className="narr">{String(phase + 1).padStart(2, '0')} — {NARRATION[phase]}</span>
          </div>

          <h1 className="text-center text-[2.5rem] font-extrabold uppercase leading-[0.9] tracking-tight text-[#EDEAE0] sm:text-6xl" style={display}>
            Squares that <span className="text-gold">keep score.</span>
          </h1>

          <div className="relative aspect-[380/430] w-[min(86vw,400px)]" aria-hidden="true">
            <PaperBoard />
            <CleanBoard />
          </div>

          <div className="cb-cta flex flex-col items-center gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={onCreate} className="ne-press inline-flex items-center justify-center gap-2 rounded-full bg-cardinal px-7 py-3.5 text-sm font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:brightness-110 hover:shadow-lg hover:shadow-cardinal/25">
                Build a board <span aria-hidden>→</span>
              </button>
              <Link to="/demo" className="ne-press inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-[#EDEAE0]/80 ring-1 ring-[#EDEAE0]/12 transition-colors hover:bg-[#EDEAE0]/5 hover:text-[#EDEAE0]">See a live board</Link>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[#EDEAE0]/55" style={mono}>
              <span className="font-bold text-gold">Free to build.</span>
              <span>$14.99 unlocks up to 20 boards.</span>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24">
        {/* Subhead / keyword coverage */}
        <Reveal>
          <p className="mx-auto max-w-2xl text-center text-[15px] leading-relaxed text-[#EDEAE0]/70 md:text-lg">
            Run football squares and Super Bowl squares on one live board — winners light up every quarter, and your whole group follows from their phones.
          </p>
        </Reveal>

        {/* Made-for row: richer chips with icons */}
        <Reveal className="mt-12">
          <section className="flex flex-wrap items-center justify-center gap-3" aria-label="Made for">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#EDEAE0]/40" style={mono}>Made for</span>
            {FEATURED_USES.map(({ label, Icon }) => (
              <span key={label} className="ne-chip inline-flex items-center gap-2 rounded-full border border-[#EDEAE0]/10 bg-gradient-to-b from-[#EDEAE0]/[0.06] to-transparent px-4 py-2 text-[13px] font-medium text-[#EDEAE0]/80">
                <Icon className="ne-chip-ico h-4 w-4 text-[#EDEAE0]/45 transition-colors" strokeWidth={2} />
                {label}
              </span>
            ))}
          </section>
        </Reveal>

        {/* How it works */}
        <section id="how" className="mt-28 scroll-mt-24">
          <Reveal><h2 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[#EDEAE0]/40" style={mono}>How it works</h2></Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.k} delay={i * 90}>
                <div className="ne-faq relative h-full overflow-hidden rounded-2xl border border-[#EDEAE0]/10 bg-[#121317] p-7">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/20">
                      <s.Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="text-3xl font-extrabold text-[#EDEAE0]/12" style={mono}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#EDEAE0]" style={display}>{s.k}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#EDEAE0]/65">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-28 scroll-mt-24" itemScope itemType="https://schema.org/FAQPage">
          <Reveal><h2 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[#EDEAE0]/40" style={mono}>FAQ</h2></Reveal>
          <div className="grid gap-3 md:grid-cols-2">
            {FAQ_ITEMS.map((item, i) => (
              <Reveal key={item.q} delay={(i % 2) * 70}>
                <details className="ne-faq group h-full rounded-2xl border border-[#EDEAE0]/10 bg-[#121317] px-5 open:bg-[#16171c]" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-[#EDEAE0] marker:hidden">
                    <span itemProp="name">{item.q}</span>
                    <span className="shrink-0 text-[#EDEAE0]/40 transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <div className="pb-4 text-sm leading-relaxed text-[#EDEAE0]/65" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <span itemProp="text">{item.a}</span>
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing */}
        <Reveal className="mt-28">
          <section className="overflow-hidden rounded-3xl border border-[#EDEAE0]/10 bg-gradient-to-br from-cardinal/20 via-[#121317] to-gold/10 p-8 sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#EDEAE0] sm:text-3xl" style={display}>Kickoff is closer than you think</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#EDEAE0]/65">Build your board now, or read the playbook on running football squares.</p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <button onClick={onCreate} className="ne-press rounded-full bg-cardinal px-6 py-3 text-sm font-bold text-white hover:brightness-110">Build a board</button>
                <Link to="/articles" className="ne-press rounded-full px-6 py-3 text-center text-sm font-semibold text-[#EDEAE0] ring-1 ring-[#EDEAE0]/15 transition-colors hover:bg-[#EDEAE0]/5">Read the guides</Link>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="mt-24">
          <footer className="border-t border-[#EDEAE0]/10 pt-8 text-xs text-[#EDEAE0]/50">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <img src="/icons/gridone-icon-256.png" alt="" className="h-6 w-6 rounded-lg ring-1 ring-gold/40" />
                  <span className="font-extrabold uppercase tracking-tight text-[#EDEAE0]" style={display}>GridOne</span>
                </div>
                <div>© {new Date().getFullYear()} GridOne. Not a betting site.</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="mb-1 font-bold uppercase tracking-wider text-[#EDEAE0]/70" style={mono}>Guides</div>
                <Link to="/articles/how-to-run-super-bowl-squares" className="transition-colors hover:text-[#EDEAE0]">How to Run Super Bowl Squares</Link>
                <Link to="/articles/football-squares-fundraiser" className="transition-colors hover:text-[#EDEAE0]">Football Squares Fundraiser Ideas</Link>
                <Link to="/articles/run-your-pool-alternative" className="transition-colors hover:text-[#EDEAE0]">RunYourPool Alternative</Link>
                <Link to="/articles" className="transition-colors hover:text-[#EDEAE0]">All Guides</Link>
              </div>
              <div className="flex gap-6">
                <Link to="/privacy" className="transition-colors hover:text-[#EDEAE0]">Privacy</Link>
                <Link to="/terms" className="transition-colors hover:text-[#EDEAE0]">Terms</Link>
                <a href="mailto:support@getgridone.com" className="transition-colors hover:text-[#EDEAE0]">Support</a>
              </div>
            </div>
          </footer>
        </Reveal>
      </main>
    </div>
  );
};

export default LandingPage;
