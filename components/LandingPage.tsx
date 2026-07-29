/**
 * THESIS: GridOne proves it replaces paper by letting one board travel through the whole game-day horizon—not by stacking feature cards.
 * OWN-WORLD: Broadcast-white setup light falls into ink live fields; cardinal carries identity, gold carries commitment and resolved outcomes.
 * STORY: See the board fill, lock its draw, run live, and settle; then create a board or open the demonstration.
 * FIRST VIEWPORT: A Split Stage product artifact dominates beside one concise promise and one create action; the horizon connects both.
 * FORM: Game-Day Horizon, Composition C Split Stage, chosen staging from stagecraft cyclorama; seed 356916de.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PageMetadata } from './seo/PageMetadata';
import { startScrollRuntime } from '../lib/scrollRuntime';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onCreate: () => void;
  onLogin: () => void;
}

/* ── Demonstration data. SYNTHETIC — not real boards, users, or results.
      Quarter winners are derived from the last digit of each score, the
      way a real squares board resolves. ── */
const DEMO_NAMES = [
  'RIVERA', 'OKAFOR', 'NGUYEN', 'GARCIA', 'WHITMORE',
  'PATEL', 'BRENNAN', 'ADEYEMI', 'CHEN', 'JOHNSON',
  'LEE', 'DAVIS', 'HAYES', 'KIM', 'WILSON',
  'MARTINEZ', 'NOVAK', 'HALVORSEN', 'MBEKI', 'TANAKA',
  'FONTAINE', 'ABBOTT', 'SANTOS', 'KRAMER', 'ESPOSITO',
  'DIALLO', 'PETROV', 'HOLLAND', 'BAUER', 'MORALES',
];

const QUARTERS = [
  { label: 'Q1', home: 7, away: 3, clock: 'END 1ST' },
  { label: 'Q2', home: 14, away: 10, clock: 'HALF' },
  { label: 'Q3', home: 21, away: 10, clock: 'END 3RD' },
  { label: 'Q4', home: 24, away: 17, clock: 'FINAL' },
] as const;

const winnerCell = (q: (typeof QUARTERS)[number]) => ({ row: q.home % 10, col: q.away % 10 });

const FEATURED_USES = ['Booster clubs', 'Office pools', 'Super Bowl parties', 'Youth sports', 'Watch parties'];

const STEPS = [
  { k: 'Build the board', d: 'Start with a native 10×10 board. If you already used paper, the optional beta scan gives you an editable first pass.' },
  { k: 'Share one link', d: 'No logins for viewers. Anyone with the private board link gets the same read-only game-day view.' },
  { k: 'Watch it settle', d: 'Automatic beta score checks update the board; the organizer can take over instantly if the source is late or wrong.' },
];

const FAQ_ITEMS = [
  { q: 'How does pricing work?', a: 'Creating and editing boards is free. The introductory 2026 season pass is $4.99 once and unlocks up to 20 boards. Build everything first, then pay when your boards are ready to share.' },
  { q: 'Who needs an account?', a: 'Only the organizer needs an account. Viewers open the share link and see the board, live score state, and winner scenarios in read-only mode.' },
  { q: 'Can I upload a handwritten board?', a: 'Yes. Upload a board image, let GridOne scan it, then fix any names or squares before you unlock sharing.' },
  { q: 'What exactly unlocks after I pay?', a: 'Before payment you can build, edit, preview, and test your boards. The $4.99 introductory 2026 season pass lets you publish up to 20 boards with read-only viewer links.' },
  { q: 'Do viewers get edit access?', a: 'No. Organizers can edit the board. Viewers are read-only and can follow the board, scoreboard, and live winner scenarios.' },
  { q: 'Is GridOne good for fundraisers or team groups?', a: 'Yes. GridOne is built for organizers running football squares for youth sports teams, booster clubs, office pools, watch parties, and local community fundraisers that need one simple live board link.' },
];

const TICKER = [
  'DEMONSTRATION BOARD — SYNTHETIC DATA',
  'BUILDING AND EDITING IS FREE',
  '$4.99 UNLOCKS UP TO 20 BOARDS IN 2026',
  'READ-ONLY VIEWER LINK',
  'VIEWERS NEED NO ACCOUNT',
  'NOT A BETTING SITE',
  'AUTOMATIC SCORE CHECKS · MANUAL FALLBACK',
];

/* ── Digit roll. Each column is a 0-9 strip translated to its value. ── */
const Roll: React.FC<{ value: number }> = ({ value }) => (
  <span className="oa-roll" aria-hidden>
    {String(value).split('').map((d, i) => (
      <span key={i} className="oa-roll-col">
        <span className="oa-roll-strip" style={{ transform: `translateY(-${Number(d)}em)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <span key={n} className="oa-roll-d">{n}</span>
          ))}
        </span>
      </span>
    ))}
  </span>
);

/* One orchestrated entrance for the whole page: wipe from the leading edge.
   Elements are visible by default and only hidden once JS confirms it can
   reveal them, so a failed script never costs content. */
const useWipe = () => {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-wipe]'));
    targets.forEach((el) => el.classList.add('oa-wipe'));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }),
      { rootMargin: '0px 0px -12% 0px' },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
};

/* ── Score bug: the system's anchor. Opaque, fixed height, never fades. ── */
const ScoreBug: React.FC<{ q: number }> = ({ q }) => {
  const live = q > 0 && q < 4;
  const state = q === 0 ? { home: 0, away: 0, clock: 'PREGAME' } : QUARTERS[q - 1];
  return (
    <div className="flex h-14 w-full items-stretch md:w-auto" role="status" aria-live="polite">
      <div className="flex items-center gap-3 bg-cardinal px-4 text-broadcast-white">
        <span className="oa-slab">HOME</span>
        <span className="oa-data text-xl"><Roll value={state.home} /><span className="sr-only">{state.home}</span></span>
      </div>
      <div className="flex items-center gap-3 bg-chyron px-4 text-broadcast-white">
        <span className="oa-slab">AWAY</span>
        <span className="oa-data text-xl"><Roll value={state.away} /><span className="sr-only">{state.away}</span></span>
      </div>
      <div className="oa-shear flex items-center gap-2 bg-ink pl-4 pr-7 text-broadcast-white">
        {live && <span className="h-2 w-2 shrink-0 bg-live" aria-hidden />}
        <span className="oa-data text-sm whitespace-nowrap">{'clock' in state ? state.clock : ''}</span>
      </div>
    </div>
  );
};

/* ── The board, as an on-air graphic. Cells never round. ── */
const Board: React.FC<{ q: number; compact?: boolean }> = ({ q, compact }) => {
  const resolved = QUARTERS.slice(0, q).map(winnerCell);
  /* A real board is mostly sold by kickoff. Fill ~76 of 100 squares
     deterministically so the pattern reads as a genuine board, not a demo stub. */
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if ((r * 37 + c * 53 + 11) % 100 < 76) {
          m.set(`${r}-${c}`, DEMO_NAMES[(r * 7 + c * 3) % DEMO_NAMES.length]);
        }
      }
    }
    return m;
  }, []);

  return (
    <div className="overflow-x-auto border-y-[3px] border-ink" tabIndex={0} role="group" aria-label="Squares board, scrolls horizontally on small screens">
    <table className="w-full min-w-[30rem] table-fixed border-collapse" aria-label="Demonstration squares board (synthetic data)">
      <caption className="sr-only">
        A 10 by 10 football squares board using synthetic demonstration data. Winning squares fill as each quarter ends.
      </caption>
      <thead>
        <tr>
          <th className="w-[7%] bg-transparent" />
          {Array.from({ length: 10 }, (_, c) => (
            <th key={c} scope="col" className="oa-board-axis bg-cardinal-deep py-1 text-broadcast-white">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }, (_, r) => (
          <tr key={r}>
            <th scope="row" className="oa-board-axis bg-cardinal-deep px-1 text-broadcast-white">
              {r}
            </th>
            {Array.from({ length: 10 }, (_, c) => {
              const idx = resolved.findIndex((w) => w.row === r && w.col === c);
              const won = idx >= 0;
              const name = names.get(`${r}-${c}`);
              return (
                <td
                  key={c}
                  className={[
                    'oa-q border border-cardinal-deep text-center align-middle',
                    compact ? 'h-6' : 'h-[clamp(1.9rem,3.6vw,3.1rem)]',
                    won ? 'oa-cell-won bg-gold text-ink' : name ? 'bg-broadcast-white text-ink' : 'bg-newsprint text-ink',
                  ].join(' ')}
                >
                  {won ? (
                    <span className="block leading-tight">
                      <span className="oa-board-flag block">{QUARTERS[idx].label}</span>
                      <span className="oa-board-name block truncate px-0.5 font-bold">{name ?? '—'}</span>
                      <span className="sr-only">Winner, square {r}&ndash;{c}: {name ?? 'open square'}</span>
                    </span>
                  ) : (
                    <span className="oa-board-name block truncate px-0.5">
                      {name ?? ''}
                      {!name && <span className="sr-only">Open square {r}&ndash;{c}</span>}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onCreate, onLogin }) => {
  const title = 'GridOne — Live Football Squares Boards With Automatic Score Tracking';
  const description =
    'Run football squares and Super Bowl squares on one live board with automatic beta score tracking, a clear manual fallback, and no viewer accounts.';

  const [q, setQ] = useState(0);
  const arcRef = useRef<HTMLElement>(null);
  const wipeRef = useWipe() as React.RefObject<HTMLDivElement>;

  useEffect(() => {
    const runtime = startScrollRuntime();
    return () => runtime.destroy();
  }, []);

  /* Scroll drives the game. Without JS or with reduced motion the page is
     complete and every quarter is already shown. */
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !arcRef.current) {
      setQ(4);
      return;
    }
    const st = ScrollTrigger.create({
      trigger: arcRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => setQ(Math.min(4, Math.floor(self.progress * 4.999))),
    });
    return () => st.kill();
  }, []);

  return (
    <div ref={wipeRef} className="oa-root flex min-h-screen flex-col overflow-x-clip bg-broadcast-white text-ink">
      <PageMetadata
        title={title}
        description={description}
        path="/"
        type="website"
        schema={[
          { '@type': 'WebSite', name: 'GridOne', url: 'https://www.getgridone.com/' },
          {
            '@type': 'SoftwareApplication',
            name: 'GridOne',
            applicationCategory: 'SportsApplication',
            operatingSystem: 'Any',
            description,
            offers: { '@type': 'Offer', price: '4.99', priceCurrency: 'USD', description: '$4.99 introductory 2026 season pass for up to 20 boards' },
          },
          { '@type': 'FAQPage', mainEntity: FAQ_ITEMS.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) },
        ]}
      />

      {/* ── Top chrome: the bug is pinned with the nav so it stays readable
             at all times without ever occluding body copy. ── */}
      <header className="sticky top-0 z-50 border-b-[3px] border-ink bg-broadcast-white">
        <div className="flex flex-wrap items-stretch justify-between">
          <ScoreBug q={q} />
        </div>
        <nav className="flex items-center justify-between gap-3 border-t border-newsprint px-4 py-3 sm:gap-8 sm:px-5">
          <div className="flex shrink-0 items-center gap-2.5">
            <img src="/icons/gridone-icon-256.png" alt="" className="h-7 w-7" />
            <span className="oa-slab text-base">GridOne</span>
          </div>
          <div className="flex min-w-0 shrink items-center gap-1 whitespace-nowrap">
            <a href="#how" className="oa-slab hidden px-3 py-2 hover:bg-newsprint md:inline-flex">How it works</a>
            <a href="#faq" className="oa-slab hidden px-3 py-2 hover:bg-newsprint md:inline-flex">FAQ</a>
            <button onClick={onLogin} className="oa-slab px-2 py-2 hover:bg-newsprint sm:px-3">Sign in</button>
            <button onClick={onCreate} className="oa-btn oa-btn-primary !px-4 !py-3 sm:!px-5">Create board</button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ── BAND 1 — thesis + the board ── */}
        <section className="grid border-b-[3px] border-ink md:grid-cols-2">
          <div className="flex min-w-0 flex-col justify-center gap-7 px-5 py-14 md:px-10 md:py-20">
            <h1 className="oa-chyron text-ink">
              The board<br />watches<br />the game
            </h1>
            <p className="oa-body max-w-md text-ink/80">
              Football squares for booster clubs, teams, and church halls. Share one link and let
              automatic beta scoring do the routine work, with a clear organizer fallback whenever it needs help.
            </p>
            <div className="oa-data flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink/70">
              <span>FREE TO BUILD</span><span aria-hidden>/</span>
              <span>$4.99 UNLOCKS UP TO 20 BOARDS IN 2026</span><span aria-hidden>/</span>
              <span>VIEWERS NEED NO ACCOUNT</span><span aria-hidden>/</span>
              <span>AUTO BETA + MANUAL FALLBACK</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={onCreate} className="oa-btn oa-btn-primary">Build your board</button>
              <Link to="/demo" className="oa-btn oa-btn-ghost">See a live board</Link>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center bg-cardinal">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 pb-2 pt-3">
              <span className="oa-slab text-broadcast-white">Live board</span>
              <span className="oa-board-axis text-broadcast-white/70">SYNTHETIC DEMONSTRATION DATA</span>
            </div>
            <Board q={q} />
          </div>
        </section>

        {/* ── BAND 2 — the game arc. The proof.
               The board is sticky INSIDE this band so it is on screen at the
               exact moment each quarter settles. ── */}
        <section ref={arcRef} className="border-b-[3px] border-ink bg-ink px-5 py-16 md:min-h-[150vh] md:px-10 md:py-24">
          <div className="mb-4 h-[3px] w-full bg-gold" aria-hidden data-wipe />
          <h2 className="oa-chyron mb-5 text-broadcast-white" data-wipe>Automatic first.<br />Manual when needed.</h2>
          <p className="oa-body mb-12 max-w-xl text-broadcast-white/70">
            GridOne checks a grounded game source and fills completed-quarter winners. Every score shows its source and freshness, and the organizer can take over when needed.
            Scroll to watch a synthetic game settle.
          </p>

          <div className="grid gap-10 md:min-h-[100vh] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-12">
            <div className="min-w-0 self-start bg-cardinal md:sticky md:top-[7.5rem]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 pb-2 pt-3">
                <span className="oa-slab text-broadcast-white">
                  {q === 0 ? 'Board · pregame' : q === 4 ? 'Board · final' : `Board · through ${QUARTERS[q - 1].label}`}
                </span>
                <span className="oa-board-axis text-broadcast-white/70">SYNTHETIC DEMONSTRATION DATA</span>
              </div>
              <Board q={q} />
            </div>

            <ol className="grid min-w-0 gap-px self-start bg-broadcast-white/20 sm:grid-cols-2 md:grid-cols-1 md:sticky md:top-[7.5rem]">
            {QUARTERS.map((quarter, i) => {
              const active = q > i;
              const cell = winnerCell(quarter);
              return (
                <li key={quarter.label} className={`oa-q flex flex-col gap-3 p-6 ${active ? 'bg-broadcast-white text-ink' : 'bg-ink text-broadcast-white/60'}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="oa-data text-5xl font-bold">{quarter.label}</span>
                    <span className={`oa-data flex items-center gap-1 text-lg ${active ? '' : 'opacity-60'}`}>
                      {active ? (
                        <>
                          <Roll value={quarter.home} />
                          <span aria-hidden>&ndash;</span>
                          <Roll value={quarter.away} />
                          <span className="sr-only">{quarter.home} to {quarter.away}</span>
                        </>
                      ) : (
                        <span aria-hidden>&mdash;</span>
                      )}
                    </span>
                  </div>
                  <div className="oa-slab flex items-center gap-2">
                    {active ? (
                      <>
                        <span className="h-3 w-3 shrink-0 bg-gold" aria-hidden />
                        <span>
                          Square <span className="oa-data font-bold">{cell.row}&ndash;{cell.col}</span> settled
                        </span>
                      </>
                    ) : (
                      <span>Awaiting kickoff</span>
                    )}
                  </div>
                </li>
              );
            })}
            </ol>
          </div>
        </section>

        {/* ── BAND 3 — the strap. One dense chyron line, not a chip grid. ── */}
        <section className="border-b-[3px] border-ink bg-chyron" aria-label="Made for">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 md:px-10">
            <span className="oa-slab shrink-0 bg-gold px-3 py-2 text-ink" data-wipe>Made for</span>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {FEATURED_USES.map((label) => (
                <li key={label} className="oa-slab text-broadcast-white/85">{label}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── BAND 4 — the rundown. Ruled rows, not cards. ── */}
        <section id="how" className="scroll-mt-32 border-b-[3px] border-ink px-5 py-16 md:px-10 md:py-24">
          <h2 className="oa-chyron mb-12" data-wipe>How it works</h2>
          <ol>
            {STEPS.map((s, i) => (
              <li
                key={s.k}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2 border-t border-ink py-8 last:border-b md:grid-cols-[7rem_minmax(0,22rem)_1fr] md:gap-x-10"
                data-wipe
              >
                <span className="oa-data text-5xl text-cardinal md:text-7xl">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="oa-headline !text-2xl md:!text-3xl">{s.k}</h3>
                <p className="oa-body col-span-2 max-w-2xl text-ink/75 md:col-span-1">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── BAND 5 — the ruled list. Same register as the rundown. ── */}
        <section id="faq" className="scroll-mt-32 border-b-[3px] border-ink bg-newsprint px-5 py-16 md:px-10 md:py-24" itemScope itemType="https://schema.org/FAQPage">
          <h2 className="oa-chyron mb-12" data-wipe>Questions</h2>
          <div>
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group border-t border-ink last:border-b"
                itemScope
                itemProp="mainEntity"
                itemType="https://schema.org/Question"
              >
                <summary className="oa-headline !text-xl flex cursor-pointer list-none items-baseline justify-between gap-6 py-6 marker:hidden md:!text-2xl">
                  <span itemProp="name">{item.q}</span>
                  <span className="oa-data shrink-0 text-3xl text-cardinal transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <div className="oa-body max-w-3xl pb-7 text-ink/75" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                  <span itemProp="text">{item.a}</span>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── BAND 6 — close ── */}
        <section className="bg-cardinal px-5 py-16 md:px-10 md:py-20">
          <div className="mb-6 h-[3px] w-full bg-gold" aria-hidden data-wipe />
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="oa-chyron !text-[clamp(2rem,6vw,4.5rem)] text-broadcast-white" data-wipe>Kickoff is closer<br />than you think</h2>
              <p className="oa-body mt-4 max-w-lg text-broadcast-white/80">
                Build the board now. Pay only when you are ready to share it.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <button onClick={onCreate} className="oa-btn oa-btn-primary">Build a board</button>
              <Link to="/articles" className="oa-btn oa-btn-onred">Read the guides</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-chyron px-5 py-12 text-broadcast-white md:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <img src="/icons/gridone-icon-256.png" alt="" className="h-6 w-6" />
              <span className="oa-slab">GridOne</span>
            </div>
            <p className="oa-data text-[11px] text-broadcast-white/55">
              © {new Date().getFullYear()} GRIDONE. NOT A BETTING SITE.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="oa-slab text-broadcast-white/50">Guides</span>
            <Link to="/articles/how-to-run-super-bowl-squares" className="oa-body text-sm hover:text-gold">How to Run Super Bowl Squares</Link>
            <Link to="/articles/football-squares-fundraiser" className="oa-body text-sm hover:text-gold">Football Squares Fundraiser Ideas</Link>
            <Link to="/articles/run-your-pool-alternative" className="oa-body text-sm hover:text-gold">RunYourPool Alternative</Link>
            <Link to="/articles" className="oa-body text-sm hover:text-gold">All Guides</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="oa-slab text-broadcast-white/50">Company</span>
            <Link to="/privacy" className="oa-body text-sm hover:text-gold">Privacy</Link>
            <Link to="/terms" className="oa-body text-sm hover:text-gold">Terms</Link>
            <a href="mailto:support@getgridone.com" className="oa-body text-sm hover:text-gold">Support</a>
          </div>
        </div>
      </footer>

      {/* ── Ticker ── */}
      <div className="oa-ticker sticky bottom-0 z-40 overflow-hidden border-t-[3px] border-gold bg-ink py-2.5">
        <div className="oa-ticker-track" aria-hidden>
          {[0, 1].map((dup) => (
            <span key={dup} className="flex shrink-0">
              {TICKER.map((t) => (
                <span key={t} className="oa-data flex items-center gap-4 px-5 text-[11px] text-broadcast-white/85">
                  {t}
                  <span className="text-gold">/</span>
                </span>
              ))}
            </span>
          ))}
        </div>
        <span className="sr-only">
          Building and editing is free. The $4.99 introductory 2026 season pass unlocks up to 20 boards. Viewers need no account. GridOne does not handle square money or payouts.
        </span>
      </div>
    </div>
  );
};

export default LandingPage;
