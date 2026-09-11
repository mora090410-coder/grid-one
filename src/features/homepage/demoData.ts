import type { BoardData, GameState, LiveGameData } from '../../../types';

type DemoLiveGameData = LiveGameData & { retrievedAt: string };

export const demoGame: GameState = {
  title: 'Lincoln Softball Booster Board',
  meta: 'Chiefs at Eagles · Jan 18, 2026',
  organizationDisplayName: 'Lincoln Softball Boosters',
  leftAbbr: 'KC',
  leftName: 'Kansas City',
  topAbbr: 'PHI',
  topName: 'Philadelphia',
  dates: 'Jan 18, 2026',
  lockTitle: true,
  lockMeta: true,
};

export const demoLive: DemoLiveGameData = {
  leftScore: 17,
  topScore: 14,
  quarterScores: {
    Q1: { left: 7, top: 0 },
    Q2: { left: 3, top: 7 },
    Q3: { left: 7, top: 7 },
    Q4: { left: 0, top: 0 },
    OT: { left: 0, top: 0 },
  },
  clock: '6:42',
  period: 3,
  state: 'in',
  detail: '3rd quarter',
  isOvertime: false,
  sourceName: 'Sample score',
  retrievedAt: '2026-01-18T21:18:00.000Z',
  staleAfter: '2026-01-18T21:19:00.000Z',
  freshness: 'fresh',
};

/** Rotation of realistic short names filling every non-reserved, non-open square on the demo board. */
const NAME_ROTATION = [
  'J. Rivera', 'M. Chen', 'Dana P.', 'S. Okafor', 'Lena K.', 'R. Patel', 'Chris B.', 'A. Nguyen', 'Maya T.', 'D. Walsh',
  'Priya S.', 'T. Brooks', 'E. Castillo', 'Sam L.', 'K. Ibrahim', 'Jo H.', 'N. Foster', 'Bea O.', 'L. Moreau', 'G. Sato',
];

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Exactly 17 open squares, including 1, 11, 22, and 33 (so the hero's 4x4 slice at rows 0-3 / cols 0-3
 * shows OPEN cells) and 9 and 71 (from the original data), spread across the rest of the board.
 */
const OPEN_INDEXES = new Set([1, 5, 9, 11, 18, 22, 29, 33, 38, 50, 57, 63, 71, 76, 84, 91, 97]);


export const demoBoard: BoardData = {
  topAxis: [4, 1, 8, 6, 2, 9, 0, 5, 7, 3],
  leftAxis: [7, 2, 5, 0, 9, 4, 1, 8, 3, 6],
  allowOpenSquares: true,
  isDynamic: false,
  participants: [
    { id: 'taylor-m', displayName: 'Taylor M.', publicLabel: 'Taylor M.' },
    { id: 'ava-r', displayName: 'Ava R.', publicLabel: 'Ava R.' },
    { id: 'open', displayName: 'OPEN', publicLabel: 'OPEN' },
    ...NAME_ROTATION.map((name) => ({ id: slugify(name), displayName: name, publicLabel: name })),
  ],
  squares: Array.from({ length: 100 }, (_, index) => {
    if ([0, 27, 64].includes(index)) return ['Taylor M.'];
    if ([12, 45, 88].includes(index)) return ['Ava R.'];
    if (OPEN_INDEXES.has(index)) return ['OPEN'];
    const name = NAME_ROTATION[(index * 7) % NAME_ROTATION.length]!;
    return [name];
  }),
};

export const DEMO_LABEL = 'Sample board — not a live game';

export const demoWinnerNow = 'Taylor M.';

/** Taylor M.'s squares as (left digit, top digit) pairs, derived so copy can never drift from the board. */
export const demoWinnerSquares: Array<{ left: number; top: number }> = demoBoard.squares
  .map((names, index) => ({ names, index }))
  .filter(({ names }) => names[0] === demoWinnerNow)
  .map(({ index }) => ({ left: demoBoard.leftAxis[Math.floor(index / 10)]!, top: demoBoard.topAxis[index % 10]! }));
