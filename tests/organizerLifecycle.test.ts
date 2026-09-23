import { describe, expect, it } from 'vitest';

import {
  buildPublicBoardSnapshot,
  evaluateOrganizerLifecycle,
  transitionOrganizerLifecycle,
  type OrganizerLifecyclePhase,
} from '../src/features/organizer/lifecycle/organizerLifecycle';

const phases: OrganizerLifecyclePhase[] = [
  'Create Draft',
  'Fill',
  'Reconcile',
  'Draw',
  'Preview',
  'Go Live',
  'Game Day',
  'Final Record',
];

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const saved = { status: 'clean' as const, revision: 2 };

const board = (overrides = {}) => ({
  id: 'board_1',
  ownerId: 'owner_1',
  title: 'Booster Bowl',
  scheduledGame: { id: '401', kickoffAt: '2026-09-13T18:00:00.000Z' },
  cells: Array.from({ length: 100 }, (_, index) => index === 0 ? { publicLabel: 'Ava', participantId: 'p1' } : null),
  topAxis: Array(10).fill(null),
  sideAxis: Array(10).fill(null),
  isDynamic: false,
  openSquaresAcknowledged: true,
  publishedAt: null,
  gameState: 'pre' as const,
  ...overrides,
});

describe('organizer lifecycle model', () => {
  it('declares the exact organizer phases in order', () => {
    expect(phases).toEqual([
      'Create Draft',
      'Fill',
      'Reconcile',
      'Draw',
      'Preview',
      'Go Live',
      'Game Day',
      'Final Record',
    ]);
  });

  it('routes valid unpublished board states through Fill, Reconcile, Draw, Preview, and Go Live', () => {
    expect(evaluateOrganizerLifecycle({ board: null, save: saved }).phase).toBe('Create Draft');

    expect(evaluateOrganizerLifecycle({
      board: board({ cells: Array(100).fill(null), openSquaresAcknowledged: false }),
      save: saved,
    })).toMatchObject({ phase: 'Fill', assignedCount: 0, openCount: 100, primaryAction: 'Start assigning' });

    expect(evaluateOrganizerLifecycle({
      board: board({ openSquaresAcknowledged: false }),
      save: saved,
    })).toMatchObject({ phase: 'Reconcile', primaryAction: 'Review board' });

    expect(evaluateOrganizerLifecycle({ board: board(), save: saved })).toMatchObject({
      phase: 'Draw',
      primaryAction: 'Continue to draw',
      canEnterDraw: true,
    });

    expect(evaluateOrganizerLifecycle({
      board: board({ topAxis: digits, sideAxis: digits }),
      save: saved,
    })).toMatchObject({ phase: 'Preview', primaryAction: 'Review and publish', canPublish: true });

    expect(evaluateOrganizerLifecycle({
      board: board({ topAxis: digits, sideAxis: digits }),
      save: saved,
      publishIntent: true,
    })).toMatchObject({ phase: 'Go Live', primaryAction: 'Publish viewer link', canPublish: true });
  });

  it('treats Game Day as persistent after one-time Go Live and enters Final Record only after final durable resolutions', () => {
    expect(evaluateOrganizerLifecycle({
      board: board({ publishedAt: '2026-09-01T00:00:00.000Z', topAxis: digits, sideAxis: digits, gameState: 'in' }),
      save: saved,
      publishIntent: true,
    })).toMatchObject({ phase: 'Game Day', canPublish: false });

    expect(evaluateOrganizerLifecycle({
      board: board({ publishedAt: '2026-09-01T00:00:00.000Z', topAxis: digits, sideAxis: digits, gameState: 'post', finalResolutionsComplete: true }),
      save: saved,
    }).phase).toBe('Final Record');
  });

  it('separates hard blockers from advisories exactly where trust requires it', () => {
    const model = evaluateOrganizerLifecycle({
      board: board({
        cells: [
          { publicLabel: 'Jordan', paidStatus: 'unknown', sellerLabel: '' },
          { publicLabel: 'Jordan', paidStatus: 'unpaid' },
          ...Array(98).fill(null),
        ],
      }),
      save: saved,
    });

    expect(model.hardBlockers).toContain('duplicate_or_ambiguous_public_identity');
    expect(model.advisories).toEqual(expect.arrayContaining(['unpaid_or_unknown_payment_status', 'seller_attribution_gaps']));
    expect(model.canEnterDraw).toBe(false);
    expect(model.canPublish).toBe(false);
  });

  it('requires explicit open-square acknowledgement and blocks publishing while dirty, saving, failed, or conflicted', () => {
    expect(evaluateOrganizerLifecycle({
      board: board({ topAxis: digits, sideAxis: digits, openSquaresAcknowledged: false }),
      save: saved,
    })).toMatchObject({ canEnterDraw: false, canPublish: false });

    for (const status of ['dirty', 'saving', 'save_failed', 'conflicted'] as const) {
      const model = evaluateOrganizerLifecycle({
        board: board({ topAxis: digits, sideAxis: digits }),
        save: { status, revision: 2 },
      });
      expect(model.hardBlockers).toContain(`save_${status}`);
      expect(model.canPublish).toBe(false);
    }
    expect(evaluateOrganizerLifecycle({ board: board({ topAxis: digits, sideAxis: digits }), save: { status: 'recovered', revision: 2 } }).canPublish).toBe(false);
    const malformedSave = evaluateOrganizerLifecycle({ board: board({ topAxis: digits, sideAxis: digits }), save: { status: 'clean', revision: Number.NaN } });
    expect(malformedSave.canPublish).toBe(false);
    expect(malformedSave.hardBlockers).toContain('save_save_failed');
  });

  it('fails closed for malformed input, invalid axes, dynamic axes, and impossible transitions', () => {
    expect(evaluateOrganizerLifecycle({ board: { id: 'bad' }, save: saved }).hardBlockers).toContain('invalid_board_shape');
    expect(evaluateOrganizerLifecycle({ board: board({ topAxis: [0, 1], sideAxis: digits }), save: saved })).toMatchObject({ canEnterDraw: false, canPublish: false });
    expect(evaluateOrganizerLifecycle({ board: board({ topAxis: digits, sideAxis: digits, isDynamic: true }), save: saved }).canPublish).toBe(false);
    const sets = { Q1: digits, Q2: [...digits].reverse(), Q3: digits, Q4: [...digits].reverse() };
    expect(evaluateOrganizerLifecycle({ board: board({ topAxis: digits, sideAxis: digits, isDynamic: true, topAxisByQuarter: sets, leftAxisByQuarter: sets }), save: saved }).canPublish).toBe(true);

    expect(transitionOrganizerLifecycle('Preview', 'go_live_succeeded')).toMatchObject({ ok: false, phase: 'Preview', reason: 'impossible_transition' });
    expect(transitionOrganizerLifecycle('Preview', 'previewed')).toMatchObject({ ok: true, phase: 'Go Live' });
    expect(transitionOrganizerLifecycle('Go Live', 'go_live_succeeded')).toMatchObject({ ok: true, phase: 'Game Day' });
    expect(transitionOrganizerLifecycle('Game Day', 'go_live_succeeded')).toMatchObject({ ok: false, phase: 'Game Day', reason: 'go_live_is_one_time' });
    expect(transitionOrganizerLifecycle('Final Record', 'edit_setup')).toMatchObject({ ok: false, phase: 'Final Record' });
  });

  it('omits private personal and payment metadata from public output', () => {
    const snapshot = buildPublicBoardSnapshot(board({
      topAxis: digits,
      sideAxis: digits,
      cells: [
        { publicLabel: 'Ava', participantId: 'p1', paidStatus: 'paid', sellerLabel: 'Carrie', contactValue: 'ava@example.com', note: 'private' },
        null,
        ...Array(98).fill(null),
      ],
    }));

    expect(snapshot.cells[0]).toEqual({ publicLabel: 'Ava' });
    expect(snapshot.cells[1]).toEqual({ publicLabel: 'OPEN' });
    expect(JSON.stringify(snapshot)).not.toMatch(/paid|seller|contact|private|participantId/i);

    const privateGame = { id: '401', kickoffAt: '2026-09-13T18:00:00.000Z', state: 'pre', serviceToken: 'private', internalNote: 'private', awayTeam: { abbr: 'DAL', name: 'Dallas', secret: 'private' }, homeTeam: { abbr: 'WAS', name: 'Washington', email: 'private@example.com' } };
    const sanitized = buildPublicBoardSnapshot(board({ scheduledGame: privateGame }));
    expect(sanitized.scheduledGame).toEqual({ id: '401', kickoffAt: '2026-09-13T18:00:00.000Z', state: 'pre', awayTeam: { abbr: 'DAL', name: 'Dallas' }, homeTeam: { abbr: 'WAS', name: 'Washington' } });
    expect(sanitized.scheduledGame).not.toBe(privateGame);
    expect(JSON.stringify(sanitized)).not.toMatch(/serviceToken|internalNote|secret|email/i);
  });
});
