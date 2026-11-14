/**
 * Pure model for the cinematic homepage: the sample board, its sample game,
 * the six chapters and the scroll math. No DOM, no three.js, so it tests in Node.
 * Everything here is illustration only and never touches a real board.
 */

export const TOP_AXIS = [1, 8, 0, 6, 4, 3, 9, 2, 7, 5] as const; // PHI across
export const LEFT_AXIS = [2, 5, 0, 7, 9, 1, 6, 3, 8, 4] as const; // KC down

const POOL = ['Taylor M.', 'K. Ibrahim', 'M. Chen', 'Maya T.', 'J. Rivera', 'A. Nguyen', 'Ava R.', 'D. Okafor', 'Sam P.', 'L. Haddad', 'Chris B.', 'N. Patel', 'Jo W.', 'R. Silva', 'Grandpa Lou', 'E. Kim', 'Coach D.', 'B. Foster', 'Tia G.', 'H. Novak', 'Uncle Ray', 'S. Mendez', 'Kara L.', 'P. Duarte', 'Ben & Liz', 'O. Adeyemi', 'Wes H.', 'Gina F.', 'Marco V.', 'Z. Brooks'];
const OPEN_SQUARES = [5, 12, 27, 41, 51, 59, 66, 77, 81, 88, 92, 97];

/** Deterministic pseudo-random sequence so every visitor sees the same board. */
export function seededRandom(seed = 7) {
  let value = seed;
  return () => (value = (value * 9301 + 49297) % 233280) / 233280;
}

/** Index of the square whose row and column match the last digits of a score. */
export const squareFor = (kc: number, phi: number) => LEFT_AXIS.indexOf((kc % 10) as typeof LEFT_AXIS[number]) * 10 + TOP_AXIS.indexOf((phi % 10) as typeof TOP_AXIS[number]);

/** Sample quarter results: 3–7, 10–7, 17–14 and a Final of 20–24. */
export const RESULTS = { Q1: squareFor(3, 7), Q2: squareFor(10, 7), Q3: squareFor(17, 14), Final: squareFor(20, 24) } as const;
export const LIVE_SCORE = { kc: 17, phi: 14, quarter: 'Q3' } as const;
export const NOW_SQUARE = RESULTS.Q3;

export const SQUARES: readonly string[] = (() => {
  const rnd = seededRandom();
  const names = Array.from({ length: 100 }, () => POOL[Math.floor(rnd() * POOL.length)]);
  OPEN_SQUARES.forEach(index => { names[index] = ''; });
  names[RESULTS.Q1] = 'J. Rivera';
  names[RESULTS.Q2] = 'Maya T.';
  names[RESULTS.Q3] = 'Taylor M.';
  names[RESULTS.Final] = 'Priya S.';
  return Object.freeze(names);
})();

export const NAMED_COUNT = SQUARES.filter(Boolean).length;

export const initials = (name: string) => name.replace(/[^A-Za-z& ]/g, '').split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();

export type Team = 'KC' | 'PHI';
export interface Scenario { team: Team; points: number; label: string; kc: number; phi: number }

const PLAYS: [number, string][] = [[2, 'safety'], [3, 'field goal'], [6, 'touchdown'], [7, 'touchdown and kick'], [8, 'touchdown and 2-pt']];

/** Squares one score away, keyed by square index. Plain arithmetic, never odds. */
export function nextScoreSquares(kc: number, phi: number): Map<number, Scenario[]> {
  const map = new Map<number, Scenario[]>();
  const current = squareFor(kc, phi);
  for (const team of ['KC', 'PHI'] as const) for (const [points, label] of PLAYS) {
    const next = { kc: kc + (team === 'KC' ? points : 0), phi: phi + (team === 'PHI' ? points : 0) };
    const index = squareFor(next.kc, next.phi);
    if (index === current) continue;
    map.set(index, [...(map.get(index) ?? []), { team, points, label, ...next }]);
  }
  return map;
}

export const CANDIDATES = nextScoreSquares(LIVE_SCORE.kc, LIVE_SCORE.phi);

const teamName = (team: Team) => (team === 'KC' ? 'Kansas City' : 'Philadelphia');

export interface PickAnswer { square: number; name: string; coordinate: string; matchesNow: boolean; answer: string }

/** What the hero card says when a visitor taps a square. */
export function pickAnswer(index: number): PickAnswer {
  const row = Math.floor(index / 10), column = index % 10;
  const name = SQUARES[index] || 'Open square';
  const coordinate = `KC ${LEFT_AXIS[row]} × PHI ${TOP_AXIS[column]}`;
  const matchesNow = index === NOW_SQUARE;
  const scenarios = CANDIDATES.get(index);
  let answer: string;
  if (matchesNow) answer = `Matching right now. ${LIVE_SCORE.kc} and ${LIVE_SCORE.phi} end in ${LIVE_SCORE.kc % 10} and ${LIVE_SCORE.phi % 10}.`;
  else if (scenarios) answer = `${scenarios.map(s => `${teamName(s.team)} ${s.label} (+${s.points}) makes it ${s.kc}–${s.phi}.`).join(' ')} This square matches.`;
  else answer = `Needs KC ending in ${LEFT_AXIS[row]} and PHI ending in ${TOP_AXIS[column]}. No single next score gets there from ${LIVE_SCORE.kc}–${LIVE_SCORE.phi}.`;
  return { square: index + 1, name, coordinate, matchesNow, answer };
}

/* ---------- Chapters ---------- */

export interface Chapter { id: string; rail: string; title: string; body: string; fine: string; sceneProgress: number }

/** Three user-directed beats use the same dimensional board, without a long scroll runway. */
export const CHAPTERS: readonly Chapter[] = [
  { id: 'build', rail: 'Build', title: 'Fill the board, not a spreadsheet.', body: 'Pick an NFL game, add names and track who paid. Payment notes stay private.', fine: 'Already have a paper board? Upload a photo to import it (Beta). Sign in, then review every square before publishing.', sceneProgress: 1.35 },
  { id: 'share', rail: 'Share', title: 'The right link for each person.', body: 'Public viewer link: viewing only. A seller link lets buyers claim that seller’s unsold squares by name until the numbers lock.', fine: 'No account needed to view or claim. Private family editing links are separate; payment notes stay private.', sceneProgress: 2.1 },
  { id: 'gameday', rail: 'Game day', title: 'Know what to root for.', body: 'KC 17 · PHI 14 · Q3. Taylor M. matches 7 × 4 right now. Use the square controls to explore what wins next.', fine: 'Simulated score, not a live feed. Plain math, never odds or predictions. No confirmed quarter results in this illustration.', sceneProgress: 4.2 },
];

/* ---------- Scroll math ---------- */

export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 → 1 as s passes a, 1 → 0 as s passes b. */
export const windowed = (s: number, a: number, b: number, w = 0.25) => smooth(clamp((s - a) / w)) * (1 - smooth(clamp((s - b) / w)));

export interface ScrollLayout { stageTop: number; filmTop: number; filmEnd: number }

/** 0–1 through the hero, 1–6 through the six chapters, held at 6 after. */
export function progressFromScroll(y: number, { stageTop, filmTop, filmEnd }: ScrollLayout): number {
  if (y <= filmTop) return clamp((y - stageTop) / Math.max(1, filmTop - stageTop));
  if (y <= filmEnd) return 1 + 5 * (y - filmTop) / Math.max(1, filmEnd - filmTop);
  return 6;
}

/** Card k (1–6) is fully shown within ±0.28 of its chapter and gone by ±0.45. */
export function cardVisibility(s: number, k: number) {
  const distance = s - k;
  return { opacity: clamp(1 - (Math.abs(distance) - 0.28) / 0.17), offset: -distance };
}

export const railIndex = (s: number) => Math.round(s) - 1;

export interface Keyframe {
  az: number; el: number;
  /** Board framing: [centerX, centerY, widthShare, heightShare] of the viewport. */
  desktop: [number, number, number, number];
  phone: [number, number, number, number];
  bg: [string, string]; beam: number; bands: number; env: number; hemi: number; key: number; flood: number; rim: number;
}

/** Hero, then one camera move per chapter. */
export const KEYFRAMES: readonly Keyframe[] = [
  { az: -24, el: 38, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#05090D', '#13212E'], beam: 0.25, bands: 0.6, env: 0.6, hemi: 0.5, key: 0.65, flood: 0.25, rim: 0.85 },
  { az: 0, el: 60, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#070B14', '#15212B'], beam: 0, bands: 0.5, env: 0.55, hemi: 0.62, key: 0.5, flood: 0, rim: 0 },
  { az: 14, el: 28, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#070B14', '#15212B'], beam: 0, bands: 0.5, env: 0.55, hemi: 0.62, key: 0.5, flood: 0, rim: 0 },
  { az: -30, el: 26, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#13212E', '#4A5670'], beam: 0, bands: 0.5, env: 0.6, hemi: 0.5, key: 0.6, flood: 0.1, rim: 0.5 },
  { az: 0, el: 56, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#04070A', '#0E1823'], beam: 0.8, bands: 0.7, env: 0.6, hemi: 0.42, key: 0.55, flood: 0.55, rim: 0.9 },
  { az: 22, el: 40, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#04070A', '#111D29'], beam: 0.55, bands: 0.6, env: 0.6, hemi: 0.45, key: 0.6, flood: 0.4, rim: 0.85 },
  { az: -14, el: 46, desktop: [0.5, 0.52, 0.84, 0.8], phone: [0.5, 0.52, 0.88, 0.82], bg: ['#05090D', '#13212E'], beam: 0.3, bands: 0.55, env: 0.6, hemi: 0.5, key: 0.65, flood: 0.25, rim: 0.8 },
];

export type BoardMode = 'live' | 'setup' | 'sweat' | 'final';

/** What the board shows at progress s. Gold appears only on matching or result squares. */
export function boardMode(s: number): BoardMode {
  if (s < 0.55) return 'live';
  if (s < 3.5) return 'setup';
  if (s < 4.5) return 'live';
  if (s < 5.5) return 'sweat';
  return 'final';
}

/** Squares shown in gold for a mode. */
export function goldSquares(mode: BoardMode): number[] {
  if (mode === 'final') return [RESULTS.Q1, RESULTS.Q2, RESULTS.Q3, RESULTS.Final];
  if (mode === 'setup') return [];
  return [NOW_SQUARE];
}

export const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
