const team = (homeAway: 'home' | 'away', abbreviation: string, displayName: string, score: string, linescores: any[]) => ({
  homeAway,
  team: { abbreviation, displayName },
  score,
  linescores,
});

export const regulationEspnSummary = {
  header: {
    id: '401000001',
    season: { year: 2025 },
    week: 4,
    competitions: [{
      id: '401000001',
      date: '2025-09-28T20:25:00Z',
      status: {
        period: 4,
        displayClock: '0:00',
        type: { state: 'post', detail: 'Final' },
      },
      competitors: [
        team('home', 'WSH', 'Washington Commanders', '27', [
          { displayValue: '7' },
          { displayValue: '3' },
          { displayValue: '10' },
          { displayValue: '7' },
        ]),
        team('away', 'DAL', 'Dallas Cowboys', '24', [
          { displayValue: '3' },
          { displayValue: '7' },
          { displayValue: '7' },
          { displayValue: '7' },
        ]),
      ],
    }],
  },
};

export const overtimeEspnSummary = {
  header: {
    id: '401000002',
    season: { year: 2025 },
    week: { number: 7 },
    competitions: [{
      id: '401000002',
      date: '2025-10-19T17:00:00Z',
      status: {
        period: 6,
        displayClock: '0:00',
        type: { state: 'post', detail: 'Final/2OT' },
      },
      competitors: [
        team('home', 'JAC', 'Jacksonville Jaguars', '26', [
          { period: 1, value: 3 },
          { period: 2, value: 7 },
          { period: 3, value: 3 },
          { period: 4, value: 7 },
          { period: 5, value: 0 },
          { period: 6, value: 6 },
        ]),
        team('away', 'LA', 'Los Angeles Rams', '20', [
          { period: 1, value: 0 },
          { period: 2, value: 10 },
          { period: 3, value: 3 },
          { period: 4, value: 7 },
          { period: 5, value: 0 },
          { period: 6, value: 0 },
        ]),
      ],
    }],
  },
};

export const scheduledEspnEvent = {
  id: '401000003',
  date: '2026-09-10T00:20:00Z',
  season: { year: 2026 },
  week: { number: 1 },
  status: { type: { state: 'pre' } },
  competitions: [{
    id: '401000003',
    date: '2026-09-10T00:20:00Z',
    status: { type: { state: 'pre' } },
    competitors: [
      team('home', 'WSH', 'Washington Commanders', '0', []),
      team('away', 'JAC', 'Jacksonville Jaguars', '0', []),
    ],
  }],
};

const quarterFlipSummary = (homeQ1: number) => ({
  header: {
    id: '401000010',
    season: { year: 2026 },
    week: { number: 1 },
    competitions: [{
      id: '401000010',
      date: '2026-09-13T17:00:00Z',
      status: {
        period: 2,
        displayClock: '15:00',
        type: { state: 'in', detail: 'Start of 2nd Quarter' },
      },
      competitors: [
        team('home', 'GB', 'Green Bay Packers', String(homeQ1), [
          { period: 1, value: homeQ1 },
          { period: 2, value: 0 },
        ]),
        team('away', 'CHI', 'Chicago Bears', '7', [
          { period: 1, value: 7 },
          { period: 2, value: 0 },
        ]),
      ],
    }],
  },
});

/** Recorded-shape provider sequence for a late extra-point correction. */
export const milestoneCorrectionEspnSequence = [
  {
    observedAt: '2026-09-13T18:00:00Z',
    summary: quarterFlipSummary(13),
  },
  {
    observedAt: '2026-09-13T18:00:25Z',
    summary: quarterFlipSummary(14),
  },
  {
    observedAt: '2026-09-13T18:01:10Z',
    summary: quarterFlipSummary(14),
  },
] as const;
