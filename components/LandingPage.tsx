import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Briefcase, Trophy, Users, Tv, Upload, Link2, Radio } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PageMetadata } from './seo/PageMetadata';
import { getLenis } from '../lib/scrollRuntime';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onCreate: () => void;
  onLogin: () => void;
}

const display = { fontFamily: "'Archivo', system-ui, sans-serif" } as const;
const mono = { fontFamily: "'Space Mono', ui-monospace, monospace" } as const;
const hand = { fontFamily: "'Caveat', cursive" } as const;

// Motion tuning: displacement controls wrinkle intensity, toss x/y sets the
// landing corner, and pinScreens controls how much scroll drives the sequence.
const HERO_MOTION = {
  pinScreens: 2.2,
  narrowBreakpoint: 480,
  beats: { hold: 0, crumple: 0.4, toss: 0.7, winner: 0.9, end: 1 },
  labels: ['01 — The old paper way', '02 — Crumple the paper', '03 — We have a winner'],
  crumple: { displacement: 34, frequencyStart: 0.012, frequencyEnd: 0.018 },
  toss: { x: '42vw', y: '-30vh', rotation: -160, scale: 0.12 },
  winnerStagger: 0.08,
} as const;

const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Motion + cinematic layer (Material 3 Expressive / Neural Expressive): spring
// easing, shape morphs, an ambient halo, and a scroll-scrubbed hero where a paper
// board crumples away and the GridOne board builds itself. GPU transforms/opacity.
const NE_CSS = `
.ne-progress{position:fixed;top:0;left:0;height:2px;width:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#8F1D2C,#FFC72C);z-index:70;box-shadow:0 0 12px rgba(255,199,44,.5);will-change:transform}
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
.paper{transform-origin:50% 45%;will-change:transform,opacity}
.paper-crease{mix-blend-mode:multiply}
.clean{transform-origin:50% 55%;will-change:transform,opacity,filter}
.clean-halo{will-change:opacity}
.paper-ball{position:absolute;right:calc(-42vw + 50%);top:calc(-30vh + 50%);width:32px;height:30px;clip-path:polygon(13% 18%,38% 3%,63% 9%,91% 28%,96% 58%,75% 91%,43% 96%,14% 79%,2% 47%);background:linear-gradient(142deg,#fff9e8 0 19%,#cec3a9 20% 34%,#f0e8d3 35% 57%,#b7aa8f 58% 68%,#ddd2b9 69% 100%);box-shadow:0 8px 22px rgba(0,0,0,.38);opacity:0;visibility:hidden;transform:scale(.35) rotate(-24deg);will-change:transform,opacity}
.paper-ball::before,.paper-ball::after{content:"";position:absolute;inset:5px 4px;border-top:1px solid rgba(76,66,47,.4);border-bottom:1px solid rgba(255,255,255,.5);transform:rotate(35deg)}
.paper-ball::after{inset:7px 6px;transform:rotate(-42deg)}
.ne-halo{animation:ne-drift 15s ease-in-out infinite alternate}
@keyframes ne-drift{0%{transform:translate(-4%,-2%) scale(1)}100%{transform:translate(4%,3%) scale(1.09)}}
@media (prefers-reduced-motion: reduce){
 .ne-reveal{opacity:1!important;transform:none!important;transition:none}
 .ne-halo{animation:none}
 .ne-progress{display:none}
 .paper{opacity:0}
 .clean{opacity:1;transform:none}
 .paper-ball{display:none}
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
    <div className="paper absolute inset-0" data-hero-paper style={{ filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))' }}>
      <svg viewBox="0 0 380 430" className="h-full w-full">
        <defs>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
          </filter>
          <filter id="crumple" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              data-crumple-noise
              type="fractalNoise"
              baseFrequency={HERO_MOTION.crumple.frequencyStart}
              numOctaves="3"
              seed="11"
              result="crumpleNoise"
            />
            <feDisplacementMap
              data-crumple-displacement
              in="SourceGraphic"
              in2="crumpleNoise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <radialGradient id="pg" cx="30%" cy="18%" r="90%">
            <stop offset="0%" stopColor="#fbf6e7" />
            <stop offset="100%" stopColor="#e4d9bd" />
          </radialGradient>
        </defs>
        <g data-paper-crumple-group filter="none">
          {/* paper */}
          <rect x="6" y="6" width="368" height="418" rx="10" fill="#efe7d2" />
          <rect x="6" y="6" width="368" height="418" rx="10" fill="url(#pg)" opacity="0.5" />
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
        </g>
      </svg>
    </div>
  );
};

// ── The GridOne board that builds itself as you scroll ─────────────────────────
const CleanBoard: React.FC = () => (
  <div className="clean absolute inset-0" data-hero-clean>
    <div
      className="clean-halo pointer-events-none absolute -inset-6 -z-10 rounded-[40px] blur-3xl"
      data-clean-halo
      style={{ background: 'radial-gradient(60% 60% at 55% 45%, rgba(255,199,44,0.28), rgba(143,29,44,0.18) 60%, transparent)' }}
    />
    <div className="flex h-full flex-col rounded-[24px] border border-[#EDEAE0]/12 bg-[#121317] p-4 shadow-2xl shadow-black/60 sm:p-5">
      {/* Scoreboard */}
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-live" style={mono}>
          <span className="h-1.5 w-1.5 rounded-full bg-live" /> FINAL
        </span>
        <div className="cb-live-score flex items-center gap-3 text-sm font-bold text-[#EDEAE0]" data-hero-live-score style={mono}>
          <span>KC <span className="text-gold">24</span></span>
          <span className="text-[#EDEAE0]/25">·</span>
          <span>PHI <span className="text-gold">20</span></span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-[3px]" style={{ gridTemplateColumns: 'clamp(1rem,3.4vw,1.5rem) repeat(10, 1fr)', gridTemplateRows: 'repeat(11, minmax(0, 1fr))' }}>
        <div />
        {COL_AXIS.map((n, c) => (
          <div key={`c${c}`} className={`cb-axis flex items-center justify-center text-[9px] font-bold sm:text-[11px] ${c === WIN_COL ? 'text-gold' : 'text-[#EDEAE0]/45'}`} style={{ ...mono, ...csv('--t', ((c / 20) * 0.55).toFixed(3)) }}>{n}</div>
        ))}
        {ROW_AXIS.map((rn, r) => (
          <React.Fragment key={`r${r}`}>
            <div className={`cb-axis flex items-center justify-center text-[9px] font-bold sm:text-[11px] ${r === WIN_ROW ? 'text-gold' : 'text-[#EDEAE0]/45'}`} style={{ ...mono, ...csv('--t', (((r + 10) / 20) * 0.55).toFixed(3)) }}>{rn}</div>
            {COL_AXIS.map((_, c) => {
              const idx = r * 10 + c;
              const isWinner = r === WIN_ROW && c === WIN_COL;
              const inLane = r === WIN_ROW || c === WIN_COL;
              return (
                <div
                  key={idx}
                  className={`relative flex min-h-0 items-center justify-center overflow-hidden rounded-[3px] border ${inLane ? 'border-gold/20 bg-gold/[0.05]' : 'border-[#EDEAE0]/[0.06] bg-[#EDEAE0]/[0.02]'}`}
                >
                  <span className={`cb-name text-[7px] font-semibold sm:text-[9px] ${isWinner ? 'text-[#EDEAE0]/40' : inLane ? 'text-[#EDEAE0]/40' : 'text-[#EDEAE0]/25'}`} style={{ ...mono, ...csv('--t', ((idx / 100) * 0.82).toFixed(3)) }}>{cellInitials(idx)}</span>
                  {isWinner && (
                    <span className="cb-winfill absolute inset-0 flex items-center justify-center bg-gold text-[7px] font-bold text-black shadow-[0_0_18px_rgba(255,199,44,0.6)] sm:text-[9px]" data-hero-winner style={mono}>{cellInitials(idx)}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#EDEAE0]/10 bg-black/30 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#EDEAE0]">One link, everyone watching</div>
          <div className="truncate text-[11px] text-[#EDEAE0]/50" style={mono}>getgridone.com/?board=FRIDAY</div>
        </div>
        <span className="shrink-0 rounded-full bg-[#EDEAE0]/10 px-3 py-1 text-[11px] font-semibold text-[#EDEAE0]">Copy</span>
      </div>
    </div>
  </div>
);

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
  const heroRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    const progressBar = progressRef.current;
    if (!hero || !stage || !progressBar) return;

    window.__ready = false;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduced: '(prefers-reduced-motion: reduce)',
          desktop: `(min-width: ${HERO_MOTION.narrowBreakpoint}px) and (prefers-reduced-motion: no-preference)`,
          narrow: `(max-width: ${HERO_MOTION.narrowBreakpoint - 1}px) and (prefers-reduced-motion: no-preference)`,
        },
        (mediaContext) => {
          const conditions = mediaContext.conditions as { reduced?: boolean; desktop?: boolean; narrow?: boolean };
          const q = gsap.utils.selector(hero);
          const paper = q<HTMLElement>('[data-hero-paper]')[0];
          const paperArt = q<SVGGElement>('[data-paper-crumple-group]')[0];
          const turbulence = q<SVGFETurbulenceElement>('[data-crumple-noise]')[0];
          const displacement = q<SVGFEDisplacementMapElement>('[data-crumple-displacement]')[0];
          const crease = q<SVGGElement>('.paper-crease')[0];
          const clean = q<HTMLElement>('[data-hero-clean]')[0];
          const halo = q<HTMLElement>('[data-clean-halo]')[0];
          const winner = q<HTMLElement>('[data-hero-winner]')[0];
          const liveScore = q<HTMLElement>('[data-hero-live-score]')[0];
          const cta = q<HTMLElement>('.cb-cta')[0];
          const narration = q<HTMLElement>('[data-hero-narr]')[0];
          const narrationDot = q<HTMLElement>('[data-hero-narr-dot]')[0];
          const paperBall = q<HTMLElement>('[data-paper-ball]')[0];

          const setNarration = (progress: number) => {
            const label = progress < HERO_MOTION.beats.crumple
              ? HERO_MOTION.labels[0]
              : progress < HERO_MOTION.beats.winner
                ? HERO_MOTION.labels[1]
                : HERO_MOTION.labels[2];
            if (narration.textContent !== label) narration.textContent = label;
            const winnerPhase = progress >= HERO_MOTION.beats.winner;
            narrationDot.classList.toggle('bg-gold', winnerPhase);
            narrationDot.classList.toggle('bg-live', !winnerPhase);
            narrationDot.classList.toggle('animate-pulse', !winnerPhase);
          };

          paperArt.setAttribute('filter', 'none');

          if (conditions.reduced) {
            gsap.set(paper, { autoAlpha: 0 });
            gsap.set(clean, { autoAlpha: 1, x: 0, y: 0, scale: 1, filter: 'none' });
            gsap.set([winner, liveScore, halo], { autoAlpha: 1, x: 0, y: 0, scale: 1 });
            gsap.set(cta, { autoAlpha: 1, x: 0, y: 0 });
            gsap.set(paperBall, { autoAlpha: 0 });
            gsap.set(progressBar, { scaleX: 1 });
            setNarration(1);
            hero.dataset.heroProgress = '1.0000';
            window.__heroProgress = 1;
            delete window.__heroScrollTo;
            requestAnimationFrame(() => { window.__ready = true; });
            return;
          }

          const useDisplacement = !!conditions.desktop;
          let filterActive = false;
          const timeline = gsap.timeline({ paused: true });

          gsap.set(paper, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: -2, force3D: true });
          gsap.set(clean, { autoAlpha: 0, y: 18, scale: 0.94, filter: 'blur(6px)', force3D: true });
          gsap.set([winner, liveScore], { autoAlpha: 0, scale: 0.72, transformOrigin: '50% 50%' });
          gsap.set(cta, { autoAlpha: 1, y: 0 });
          gsap.set(halo, { autoAlpha: 0 });
          gsap.set(crease, { opacity: 0.35 });
          gsap.set(paperBall, { autoAlpha: 0, scale: 0.35, rotation: -24 });
          gsap.set(displacement, { attr: { scale: 0 } });
          gsap.set(turbulence, { attr: { baseFrequency: HERO_MOTION.crumple.frequencyStart } });

          timeline
            .to(paper, { scale: 0.45, rotation: -28, duration: 3, ease: 'power2.in' }, 4)
            .to(crease, { opacity: 1, duration: 3, ease: 'power2.in' }, 4)
            .to(paper, { x: -8, y: -14, rotation: -34, duration: 0.25, ease: 'power2.out' }, 7)
            .to(paper, {
              x: HERO_MOTION.toss.x,
              y: HERO_MOTION.toss.y,
              rotation: HERO_MOTION.toss.rotation,
              scale: HERO_MOTION.toss.scale,
              autoAlpha: 0,
              duration: 1.75,
              ease: 'power3.in',
            }, 7.25)
            .to(clean, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.75, ease: 'power2.out' }, 7.25)
            .to([winner, liveScore], {
              autoAlpha: 1,
              scale: 1,
              duration: 0.65,
              stagger: HERO_MOTION.winnerStagger,
              ease: 'back.out(1.4)',
            }, 9)
            .to(halo, { autoAlpha: 0.75, duration: 0.65, ease: 'power2.out' }, 9.35);

          if (useDisplacement) {
            timeline
              .to(displacement, { attr: { scale: HERO_MOTION.crumple.displacement }, duration: 3, ease: 'power2.in' }, 4)
              .to(turbulence, { attr: { baseFrequency: HERO_MOTION.crumple.frequencyEnd }, duration: 3, ease: 'power2.in' }, 4)
              .to(paperBall, { autoAlpha: 1, scale: 1, rotation: 8, duration: 0.07, ease: 'back.out(1.4)' }, 8.85)
              .to(paperBall, { autoAlpha: 0, scale: 0.72, duration: 0.08, ease: 'power2.in' }, 8.92);
          }

          const updatePresentation = () => {
            const progress = timeline.progress();
            const shouldFilter = useDisplacement
              && progress >= HERO_MOTION.beats.crumple
              && progress < HERO_MOTION.beats.toss;
            if (shouldFilter !== filterActive) {
              filterActive = shouldFilter;
              paperArt.setAttribute('filter', filterActive ? 'url(#crumple)' : 'none');
            }
            setNarration(progress);
            gsap.set(progressBar, { scaleX: progress });
            hero.dataset.heroProgress = progress.toFixed(4);
            window.__heroProgress = progress;
          };
          timeline.eventCallback('onUpdate', updatePresentation);
          updatePresentation();

          const trigger = ScrollTrigger.create({
            id: 'gridone-hero',
            trigger: stage,
            animation: timeline,
            start: 'top top',
            end: () => `+=${window.innerHeight * HERO_MOTION.pinScreens}`,
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          });

          const seekHero = (requestedProgress: number) => {
            const progress = gsap.utils.clamp(0, 1, requestedProgress);
            const scrollY = trigger.start + (trigger.end - trigger.start) * progress;
            const lenis = getLenis();
            if (lenis) lenis.scrollTo(scrollY, { immediate: true });
            else window.scrollTo({ top: scrollY, behavior: 'auto' });
            ScrollTrigger.update();
            trigger.getTween()?.progress(1);
            timeline.progress(progress);
            updatePresentation();
          };
          window.__heroScrollTo = seekHero;

          // Measure the pin spacer before Lenis calculates its scroll limit.
          ScrollTrigger.refresh();
          getLenis()?.resize();

          const jump = new URLSearchParams(window.location.search).get('jump');
          if (jump) {
            const scrollY = Number.parseFloat(jump);
            const lenis = getLenis();
            if (lenis) lenis.scrollTo(scrollY, { immediate: true });
            else window.scrollTo({ top: scrollY, behavior: 'auto' });
            ScrollTrigger.update();
            trigger.getTween()?.progress(1);
          }
          requestAnimationFrame(() => { window.__ready = true; });

          return () => {
            if (window.__heroScrollTo === seekHero) delete window.__heroScrollTo;
            paperArt.setAttribute('filter', 'none');
          };
        },
      );
    }, hero);

    return () => {
      ctx.revert();
      delete window.__heroScrollTo;
      delete window.__heroProgress;
    };
  }, []);

  const smoothTo = (sel: string) => (e: React.MouseEvent) => {
    const lenis = getLenis();
    if (lenis) { e.preventDefault(); lenis.scrollTo(sel, { offset: -16 }); }
  };

  return (
    <div className="min-h-screen bg-background text-[#EDEAE0] font-sans selection:bg-gold/30 flex flex-col overflow-x-clip">
      <style>{NE_CSS}</style>
      <div ref={progressRef} className="ne-progress" data-hero-progress aria-hidden="true" />
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
        <div ref={stageRef} className="stage" data-hero-stage>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#EDEAE0]/50" style={mono}>
            <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse" data-hero-narr-dot />
            <span className="narr" data-hero-narr>{HERO_MOTION.labels[0]}</span>
          </div>

          <h1 className="text-center text-[2.5rem] font-extrabold uppercase leading-[0.9] tracking-tight text-[#EDEAE0] sm:text-6xl" style={display}>
            Squares that <span className="text-gold">keep score.</span>
          </h1>

          <div className="relative aspect-[380/430] w-[min(86vw,400px)]" aria-hidden="true">
            <PaperBoard />
            <CleanBoard />
            <span className="paper-ball" data-paper-ball />
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
