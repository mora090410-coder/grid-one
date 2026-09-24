import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { BoardData, EntryMeta, GameState } from '../../types';

vi.mock('../../services/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } } })) },
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })), delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
  },
}));

vi.mock('../../src/features/organizer/workspace/entryMetaService', () => ({
  saveEntryMeta: vi.fn(async () => undefined),
  saveEntryMetaBatch: vi.fn(async () => undefined),
  savePaymentStatuses: vi.fn(async () => []),
  clearEntryMeta: vi.fn(async () => undefined),
}));

vi.mock('../../services/boardImportService', () => ({
  parseBoardImage: vi.fn(async () => ({ topAxis: Array(10).fill(null), leftAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []) })),
}));

vi.mock('../../utils/boardImage', () => ({
  renderBoardPng: vi.fn(async () => new Blob(['x'])),
  shareBoardPng: vi.fn(async () => 'downloaded'),
  boardImageFilename: vi.fn(() => 'board.png'),
}));

vi.mock('../../src/features/organizer/services/game-day/manualScoreService', () => ({
  enableManualScoringOnServer: vi.fn(async () => ({})),
  saveManualScoreToServer: vi.fn(async () => ({ score: null })),
  returnAutomaticScoringOnServer: vi.fn(async () => ({})),
}));

vi.mock('../../src/features/organizer/services/corrections/milestoneCorrectionService', () => ({
  publishMilestoneCorrectionToServer: vi.fn(async () => ({ winnerHistory: [] })),
}));

vi.mock('../../components/ScheduledGamePicker', () => ({
  default: ({ onChange }: { onChange: (game: any) => void }) => (
    <button
      type="button"
      onClick={() => onChange({
        id: '401000001',
        kickoffAt: '2026-09-10T00:20:00.000Z',
        state: 'pre',
        season: 2026,
        week: 1,
        awayTeam: { abbr: 'DAL', name: 'Dallas Cowboys' },
        homeTeam: { abbr: 'WAS', name: 'Washington Commanders' },
      })}
    >
      Select test game
    </button>
  ),
}));

vi.mock('../../src/features/organizer/workspace/renamePublishedSquare', () => ({
  renamePublishedSquare: vi.fn(async () => undefined),
}));

import OrganizerWorkspace from '../../src/features/organizer/workspace/OrganizerWorkspace';
import { saveEntryMeta, saveEntryMetaBatch } from '../../src/features/organizer/workspace/entryMetaService';
import { enableManualScoringOnServer } from '../../src/features/organizer/services/game-day/manualScoreService';
import { publishMilestoneCorrectionToServer } from '../../src/features/organizer/services/corrections/milestoneCorrectionService';
import { renamePublishedSquare } from '../../src/features/organizer/workspace/renamePublishedSquare';

const NAMES = ['Ann R.', 'Bo T.', 'Cy L.'];

const game: GameState = {
  title: 'Lincoln Boosters Board',
  meta: '',
  gameExternalId: 'evt-1',
  kickoffAt: '2026-09-13T17:00:00.000Z',
  leftAbbr: 'KC',
  leftName: 'Kansas City',
  topAbbr: 'PHI',
  topName: 'Philadelphia',
  dates: 'Sep 13, 1:00 PM ET',
  lockTitle: false,
  lockMeta: false,
  payoutDescriptions: {},
};

const participants = NAMES.map((name, index) => ({ id: `p${index}`, displayName: name, publicLabel: name }));

const emptyBoard = (): BoardData => ({
  topAxis: Array(10).fill(null),
  leftAxis: Array(10).fill(null),
  squares: Array.from({ length: 100 }, () => [] as string[]),
  participants,
});

const boardWithAssignments = (count: number): BoardData => ({
  ...emptyBoard(),
  squares: Array.from({ length: 100 }, (_, index) => (index < count ? [NAMES[index % NAMES.length]] : [])),
});

const drawnBoard = (count: number): BoardData => ({
  ...boardWithAssignments(count),
  topAxis: [3, 1, 4, 0, 5, 9, 2, 6, 8, 7],
  leftAxis: [7, 8, 6, 2, 9, 5, 0, 4, 1, 3],
  allowOpenSquares: true,
});

const paidMeta = (index: number): EntryMeta => ({
  cell_index: index,
  paid_status: 'paid',
  notify_opt_in: false,
  contact_type: null,
  contact_value: null,
  seller_label: 'Coach Lee',
});

type Overrides = Partial<React.ComponentProps<typeof OrganizerWorkspace>>;

function renderWorkspace(overrides: Overrides = {}) {
  const onApply = vi.fn();
  const onPublish = vi.fn(async () => 'pool-1');
  const onEntryMetaChange = vi.fn();
  const onReload = vi.fn(async () => undefined);
  const props = {
    game,
    board: emptyBoard(),
    activePoolId: 'pool-1',
    liveData: null,
    winnerHistory: [],
    notificationDeliveryIssues: [],
    revision: 2,
    entryMeta: {} as Record<number, EntryMeta>,
    onEntryMetaChange,
    onApply,
    onPublish,
    onSavePayoutDescriptions: vi.fn(async (d: any) => d),
    onAssignOpenSquares: vi.fn(async () => undefined),
    onReload,
    onOpenViewer: vi.fn(),
    onLogout: vi.fn(),
    isActivated: true,
    isPublished: false,
    shareCode: null,
    ...overrides,
  } as React.ComponentProps<typeof OrganizerWorkspace>;
  const utils = render(<OrganizerWorkspace {...props} />);
  return { ...utils, props, onApply, onPublish, onEntryMetaChange, onReload };
}

const expandIsland = () => fireEvent.click(screen.getByRole('button', { name: /organizer status/i }));
const lastBoard = (onApply: ReturnType<typeof vi.fn>): BoardData => onApply.mock.calls.at(-1)![1];

const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  // These fixtures exercise pre-kickoff editing, independent of the wall clock.
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-13T16:00:00Z'));
  global.fetch = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('OrganizerWorkspace island', () => {
  it('offers seller links, asking to share first while the board is private', () => {
    const sellerBoard = { ...boardWithAssignments(3), allocationLabels: Array.from({ length: 100 }, (_, index) => (index < 3 ? 'Mora family' : null)) };
    const { unmount } = renderWorkspace({ board: sellerBoard, isShared: false, shareCode: null });
    const privateCard = screen.getByRole('region', { name: 'Send seller links' });
    expect(within(privateCard).getByText('Share your board first. Then every seller gets their own link.')).toBeInTheDocument();
    expect(screen.queryByText('Guest claim links (optional)')).not.toBeInTheDocument();
    unmount();

    renderWorkspace({ board: sellerBoard, isShared: true, shareCode: 'shared-board' });
    expect(within(screen.getByRole('region', { name: 'Send seller links' })).getByRole('button', { name: 'Get seller links' })).toBeInTheDocument();
  });

  it('pulls in names from seller links on a shared board without a manual reload', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const shared = renderWorkspace({ isShared: true, shareCode: 'shared-board' });
      await act(async () => { vi.advanceTimersByTime(20_000); });
      expect(shared.onReload).toHaveBeenCalledTimes(1);
      expect(shared.onReload).toHaveBeenCalledWith({ background: true });
      shared.unmount();

      for (const overrides of [{ isShared: false }, { isShared: true, isPublished: true }]) {
        const other = renderWorkspace({ ...overrides, shareCode: 'shared-board' });
        await act(async () => { vi.advanceTimersByTime(60_000); });
        expect(other.onReload).not.toHaveBeenCalled();
        other.unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a persistent Payments action and keeps not-asked squares distinct from unpaid', () => {
    renderWorkspace({ board: boardWithAssignments(3), entryMeta: { 0: paidMeta(0), 1: { ...paidMeta(1), paid_status: 'unpaid' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
    expect(screen.getByRole('dialog', { name: 'Payments' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Payments' })).getByRole('button', { name: 'Not asked yet · 1 squares' })).toBeInTheDocument();
  });

  it('surfaces Preview as the next island action after drawing', () => {
    renderWorkspace({ board: drawnBoard(100) });
    expandIsland();
    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Preview and publish' })).toBeEnabled();
  });

  it('renders readable assignment and separate payment counts', () => {
    renderWorkspace({
      board: boardWithAssignments(3),
      entryMeta: { 0: paidMeta(0), 1: paidMeta(1) },
    });

    const island = within(screen.getByRole('region', { name: 'Organizer status' }));
    expect(island.getByRole('button', { name: 'Organizer status' })).toHaveTextContent('3 of 100 assigned');
    expandIsland();
    fireEvent.click(island.getByRole('button', { name: 'Payments' }));
    expect(island.getByText('2 paid')).toBeInTheDocument();
    expect(island.getByText('1 not asked yet')).toBeInTheDocument();
  });

  it('offers Fill the board while nothing is assigned', () => {
    renderWorkspace();
    expandIsland();
    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Fill the board' })).toBeInTheDocument();
  });

  it('offers Draw numbers once a square is assigned', () => {
    renderWorkspace({ board: boardWithAssignments(1) });
    expandIsland();
    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' })).toBeEnabled();
  });

  it('offers Preview once the numbers are committed', () => {
    renderWorkspace({ board: drawnBoard(100) });
    expandIsland();
    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Preview and publish' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByText('Numbers drawn')).toBeInTheDocument();
  });
});


describe('OrganizerWorkspace game change', () => {
  it('folds the picked game into the draft and autosaves the new matchup', async () => {
    vi.useFakeTimers();
    try {
      const onPublish = vi.fn(async (_data: { game: GameState; board: BoardData }) => 'pool-1');
      renderWorkspace({ board: boardWithAssignments(3), onPublish: onPublish as any });

      fireEvent.click(screen.getByRole('button', { name: 'Change game' }));
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Select test game' }));
      });

      expect(screen.getByText('DAL at WAS', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });

      expect(onPublish).toHaveBeenCalledTimes(1);
      expect(onPublish.mock.calls[0]![0].game).toMatchObject({
        leftAbbr: 'DAL',
        topAbbr: 'WAS',
        gameExternalId: '401000001',
        kickoffAt: '2026-09-10T00:20:00.000Z',
        dates: '2026-09-10',
        useManualScores: false,
        scoreSnapshot: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('OrganizerWorkspace draw flow', () => {
  it('asks about open squares, records the opt-in, and previews digits', async () => {
    const { onApply } = renderWorkspace({ board: boardWithAssignments(1) });
    expandIsland();

    fireEvent.click(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' }));
    expect(screen.getByRole('group', { name: '99 squares are open. Draw anyway?' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw with 99 OPEN' }));
    });

    expect(lastBoard(onApply).allowOpenSquares).toBe(true);
    expect(screen.getByText('Draft draw')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use numbers and continue' })).toBeInTheDocument();
  });

  it('commits exact 0-9 permutations for both axes and turns off changing numbers', async () => {
    const { onApply } = renderWorkspace({ board: boardWithAssignments(1) });
    expandIsland();

    fireEvent.click(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw with 99 OPEN' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use numbers and continue' }));
    });

    const board = lastBoard(onApply);
    expect([...board.topAxis].sort((a, b) => Number(a) - Number(b))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...board.leftAxis].sort((a, b) => Number(a) - Number(b))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(board.isDynamic).toBe(false);
    expect(board.leftAxisByQuarter).toBeUndefined();
    expect(board.topAxisByQuarter).toBeUndefined();
    expect(screen.queryByText('Draft draw')).not.toBeInTheDocument();
  });

  it('skips the open-square question when the board is already full', async () => {
    renderWorkspace({ board: boardWithAssignments(100) });
    expandIsland();

    await act(async () => {
      fireEvent.click(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' }));
    });

    expect(screen.queryByRole('group', { name: /squares are open/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use numbers and continue' })).toBeInTheDocument();
  });
});

describe('OrganizerWorkspace square assignment', () => {
  it('writes the name, saves the private note, and reports it back', async () => {
    const { onApply, onEntryMetaChange } = renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Square 1, unassigned' }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Paid' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(lastBoard(onApply).squares[0]).toEqual(['Dana P.']);
    expect(saveEntryMeta).toHaveBeenCalledWith('pool-1', expect.objectContaining({
      cell_index: 0,
      paid_status: 'paid',
      seller_label: null,
    }));
    expect(onEntryMetaChange).toHaveBeenCalledWith(expect.objectContaining({ cell_index: 0 }));
  });

  it('moves to the next open square on Save and next', async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Square 1, unassigned' }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save and next' }));
    });

    expect(await screen.findByRole('heading', { name: 'Square 2' })).toBeInTheDocument();
  });


});

describe('OrganizerWorkspace publish', () => {
  const openPublishSheet = async () => {
    expandIsland();
    await act(async () => {
      fireEvent.click(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Preview and publish' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    });
  };

  it('blocks publishing while the latest draft has not saved cleanly', async () => {
    const onPublish = vi.fn(async () => {
      throw new Error('The board could not be saved.');
    });
    renderWorkspace({ board: drawnBoard(100), onPublish: onPublish as any });

    fireEvent.click(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await openPublishSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish viewer link' }));
    });

    expect(await screen.findByText('Publish blocked. Reload or save the latest clean draft before publishing.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('publishes and shows the shareable link', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 4, tier: 'gameday', used: 2, allowance: 5 }),
    });
    const { onReload } = renderWorkspace({ board: drawnBoard(100) });

    await openPublishSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish viewer link' }));
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-1/publish', expect.objectContaining({ method: 'POST' }));
    expect(await screen.findByRole('heading', { name: 'Published' })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/b/abc123`)).toBeInTheDocument();
    // The reload is deferred until the organizer leaves the published sheet, so the
    // success surface cannot be torn out from under them by a re-render.
    expect(onReload).not.toHaveBeenCalled();
  });

  it('opens the plan sheet when the account is out of published boards', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ upgradeTo: 'gameday', error: 'Free plan allows one published board.' }),
    });
    renderWorkspace({ board: drawnBoard(100) });

    await openPublishSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish viewer link' }));
    });

    expect(await screen.findByRole('heading', { name: 'Choose a plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to \$9\.99 checkout/ })).toBeInTheDocument();
  });

  it('keeps the published sheet on screen through a reload that flips isPublished', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 4, tier: 'gameday', used: 2, allowance: 5 }),
    });
    const onReload = vi.fn(async () => {});
    const view = renderWorkspace({ board: drawnBoard(100), onReload });
    onReload.mockImplementation(async () => {
      view.rerender(<OrganizerWorkspace {...view.props} isPublished />);
    });

    await openPublishSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish viewer link' }));
    });

    expect(await screen.findByRole('heading', { name: 'Published' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy link' }).length).toBeGreaterThan(0);
    expect(onReload).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Manage board' }));
    });

    expect(onReload).toHaveBeenCalled();
    expect(await screen.findByText('Score authority')).toBeInTheDocument();
  });

  it('publishes once the flush started by the click settles clean', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ published: true, shareCode: 'abc123', viewerUrl: '/b/abc123', revision: 4, tier: 'gameday', used: 2, allowance: 5 }),
    });
    let releaseSave: (() => void) | null = null;
    const onPublish = vi.fn(() => new Promise<string>((resolve) => { releaseSave = () => resolve('pool-1'); }));
    renderWorkspace({ board: drawnBoard(100), onPublish: onPublish as any });

    await openPublishSheet();
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Renamed Board' } });
    fireEvent.blur(screen.getByLabelText('Board name'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish viewer link' }));
    });
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => { releaseSave?.(); });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/pools/pool-1/publish', expect.objectContaining({ method: 'POST' })));
    expect(screen.queryByText('Publish blocked. Reload or save the latest clean draft before publishing.')).not.toBeInTheDocument();
  });

  it('disables the publish button while a non-save hard blocker remains', async () => {
    renderWorkspace({
      board: drawnBoard(100),
      game: { ...game, gameExternalId: undefined, kickoffAt: undefined },
    });

    await openPublishSheet();

    expect(screen.getByRole('button', { name: 'Publish viewer link' })).toBeDisabled();
  });
});

describe('OrganizerWorkspace acknowledgement gate', () => {
  it('routes Replace draft draw through the open-square acknowledgement', async () => {
    const board: BoardData = {
      ...boardWithAssignments(40),
      topAxis: [3, 1, 4, 0, 5, 9, 2, 6, 8, 7],
      leftAxis: [7, 8, 6, 2, 9, 5, 0, 4, 1, 3],
    };
    const { onApply } = renderWorkspace({ board });

    fireEvent.click(screen.getByRole('button', { name: 'Replace draft draw' }));
    expect(screen.getByRole('group', { name: '60 squares are open. Draw anyway?' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw with 60 OPEN' }));
    });

    expect(lastBoard(onApply).allowOpenSquares).toBe(true);
    expect(screen.getByRole('button', { name: 'Use numbers and continue' })).toBeInTheDocument();
  });

  it('records the acknowledgement on the board when the draw is committed with open squares', async () => {
    const { onApply } = renderWorkspace({ board: boardWithAssignments(40) });

    expandIsland();
    fireEvent.click(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Draw with 60 OPEN' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use numbers and continue' }));
    });

    const board = lastBoard(onApply);
    expect(board.allowOpenSquares).toBe(true);
    expect(board.topAxis.every((digit) => typeof digit === 'number')).toBe(true);
  });

  it('acknowledges a square blanked after the draw without staging a new draw', async () => {
    const board: BoardData = {
      ...boardWithAssignments(40),
      topAxis: [3, 1, 4, 0, 5, 9, 2, 6, 8, 7],
      leftAxis: [7, 8, 6, 2, 9, 5, 0, 4, 1, 3],
    };
    const { onApply } = renderWorkspace({ board });

    expect(screen.getByRole('group', { name: '60 squares are open. Publish with them open?' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep 60 OPEN' }));
    });

    expect(lastBoard(onApply).allowOpenSquares).toBe(true);
    expect(screen.queryByRole('button', { name: 'Use numbers and continue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Replace draft draw' })).toBeInTheDocument();
  });
});

describe('OrganizerWorkspace error alerts', () => {
  it('keeps the new name on the board and reports the failed detail save', async () => {
    (saveEntryMeta as any).mockRejectedValueOnce(new Error('network down'));
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Square 1, unassigned' }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(screen.getByRole('button', { name: 'Square 1, assigned to Dana P., allocated to Dana P.' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Square details were not saved');
  });
});

describe('OrganizerWorkspace draft participant identities', () => {
  const withoutParticipants = (squares: string[][]): BoardData => ({
    topAxis: Array(10).fill(null),
    leftAxis: Array(10).fill(null),
    squares,
  });

  it('treats unique names on a board with no participants array as unambiguous', () => {
    renderWorkspace({
      board: withoutParticipants(Array.from({ length: 100 }, (_, index) => (index < 3 ? [NAMES[index]] : []))),
    });
    expandIsland();

    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' })).toBeEnabled();
    expect(screen.queryByText(/Make each public name unique/)).not.toBeInTheDocument();
  });

  it('reports two labels that normalize to the same identity as ambiguous', () => {
    renderWorkspace({
      board: withoutParticipants(Array.from({ length: 100 }, (_, index) => {
        if (index === 0) return ['Jose'];
        if (index === 1) return ['Jos\u00e9'];
        return [] as string[];
      })),
    });
    expandIsland();

    expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Prepare to publish' })).toBeDisabled();
    expect(screen.getAllByText(/Make each public name unique/).length).toBeGreaterThan(0);
  });
});

describe('OrganizerWorkspace published boards', () => {
  const renderPublished = (overrides: Overrides = {}) => renderWorkspace({
    board: drawnBoard(100),
    isPublished: true,
    shareCode: 'abc123',
    ...overrides,
  });

  it('marks the board published and drops the draft save pill', () => {
    renderPublished();

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Paste names')).not.toBeInTheDocument();
  });

  it('copies the viewer link from the island Share quick view', async () => {
    renderPublished();
    expandIsland();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]);
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/b/abc123`);
    expect(await screen.findByText('Viewer link copied.')).toBeInTheDocument();
  });

  it('sends a late fill through onAssignOpenSquares, which reloads for itself', async () => {
    const onAssignOpenSquares = vi.fn(async (_squares: string[][]) => undefined);
    const { onReload } = renderPublished({ board: drawnBoard(99), onAssignOpenSquares });

    fireEvent.click(screen.getByRole('button', { name: 'Square 100, unassigned' }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(onAssignOpenSquares).toHaveBeenCalledTimes(1);
    const squares = onAssignOpenSquares.mock.calls[0][0];
    expect(squares[99]).toEqual(['Dana P.']);
    // The callback reloads the board itself; a second reload here would only
    // turn a reload failure into a false "nothing changed".
    expect(onReload).not.toHaveBeenCalled();
  });

  it('refuses to clear a published assignment and never routes it through the late-fill callback', async () => {
    const onAssignOpenSquares = vi.fn(async (_squares: string[][]) => undefined);
    renderPublished({ board: drawnBoard(99), onAssignOpenSquares });

    fireEvent.click(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: '  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Published assignments cannot be changed. Select OPEN squares only.');
    expect(onAssignOpenSquares).not.toHaveBeenCalled();
    expect(renamePublishedSquare).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` })).toBeInTheDocument();
  });

  it('renames a published square through the audited RPC', async () => {
    renderPublished({ board: drawnBoard(99) });

    fireEvent.click(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana Prince' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(renamePublishedSquare).toHaveBeenCalledWith('pool-1', 0, 'Dana Prince');
    expect(screen.getByRole('button', { name: 'Square 1, assigned to Dana Prince' })).toBeInTheDocument();
    expect(await screen.findByText(`Square 1 changed from ${NAMES[0]} to Dana Prince. The change is in the board history.`)).toBeInTheDocument();
  });

  it('restores the previous name when the rename fails', async () => {
    (renamePublishedSquare as any).mockRejectedValueOnce(new Error('rpc down'));
    renderPublished({ board: drawnBoard(99) });

    fireEvent.click(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` }));
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(screen.getByRole('button', { name: `Square 1, assigned to ${NAMES[0]}` })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('rpc down');
  });

  it('switches score authority to manual through the service', async () => {
    renderPublished();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    });

    expect(enableManualScoringOnServer).toHaveBeenCalledWith('pool-1');
    expect(await screen.findByText('Manual scoring is on. Enter the score, then publish it.')).toBeInTheDocument();
  });

  it('keeps the quarters seeded from the snapshot and does not reload them away', async () => {
    const scoreSnapshot = {
      leftScore: 14,
      topScore: 3,
      quarterScores: { Q1: { left: 7, top: 3 }, Q2: { left: 7, top: 0 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
      clock: '12:00',
      period: 3,
      state: 'in' as const,
      detail: '',
      isOvertime: false,
    };
    const { onReload } = renderPublished({ game: { ...game, scoreSnapshot } as GameState });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
    });

    const panel = screen.getByText(/Enter each quarter's points/).parentElement!;
    const quarters = within(panel).getAllByRole('spinbutton').map((input) => (input as HTMLInputElement).value);
    expect(quarters).toEqual(['7', '3', '7', '0', '0', '0', '0', '0', '0', '0']);
    expect(onReload).not.toHaveBeenCalled();
  });

  it('publishes a milestone correction from the side rail', async () => {
    const winnerHistory = [{
      milestone: 'Q1' as const,
      sideScore: 7,
      topScore: 3,
      sideDigit: 7,
      topDigit: 3,
      participantName: NAMES[0],
      cellIndex: 0,
      resolvedAt: '2026-09-13T18:00:00.000Z',
      resolutionVersion: 1,
    }];
    renderPublished({ winnerHistory });

    fireEvent.change(screen.getByLabelText('Result to correct'), { target: { value: 'Q1' } });
    fireEvent.change(screen.getByLabelText('Why this changed (shown publicly)'), { target: { value: 'Scoreboard error' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish correction and email both people' }));
    });

    expect(publishMilestoneCorrectionToServer).toHaveBeenCalledWith('pool-1', expect.objectContaining({ milestone: 'Q1', reason: 'Scoreboard error' }));
  });

  it('reuses only current title and rules from the final organizer action', () => {
    const onRunAnotherBoard = vi.fn();
    renderPublished({
      game: { ...game, payoutDescriptions: { FINAL: '$200' } },
      liveData: { state: 'post', leftScore: 21, topScore: 17, isManual: false } as any,
      onRunAnotherBoard,
    });
    fireEvent.click(screen.getByRole('link', { name: 'Create another board' }));
    expect(onRunAnotherBoard).toHaveBeenCalledWith({ title: game.title, payoutDescriptions: { FINAL: '$200' } });
  });

  it('locks the board as the final record once the game is over', () => {
    renderPublished({ liveData: { state: 'post', leftScore: 21, topScore: 17, isManual: false } as any });

    expect(screen.getByText('This board is locked as the Final record.')).toBeInTheDocument();
    expandIsland();
    expect(screen.getAllByRole('link', { name: 'Create another board' }).length).toBeGreaterThan(0);
  });
});

describe('OrganizerWorkspace range assignment', () => {
  const enterSelectMode = () => fireEvent.click(screen.getByRole('button', { name: 'Select squares' }));
  const selectCell = (n: number) => fireEvent.click(screen.getByRole('button', { name: `Square ${n}, unassigned` }));
  const typeName = (value: string) => fireEvent.change(screen.getByLabelText('Name for these squares'), { target: { value } });

  it('writes one name across the block and batches the private notes as not asked yet', async () => {
    const { onApply, onEntryMetaChange } = renderWorkspace();

    enterSelectMode();
    selectCell(1);
    fireEvent.click(screen.getByRole('button', { name: 'Square 12, unassigned' }), { shiftKey: true });
    expect(screen.getByText('4 selected')).toBeInTheDocument();

    typeName('Dana P.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 4' }));
    });

    const board = lastBoard(onApply);
    expect(board.squares[0]).toEqual(['Dana P.']);
    expect(board.squares[1]).toEqual(['Dana P.']);
    expect(board.squares[10]).toEqual(['Dana P.']);
    expect(board.squares[11]).toEqual(['Dana P.']);

    expect(saveEntryMetaBatch).toHaveBeenCalledTimes(1);
    const [poolId, metas] = (saveEntryMetaBatch as any).mock.calls[0];
    expect(poolId).toBe('pool-1');
    expect(metas.map((meta: EntryMeta) => meta.cell_index)).toEqual([0, 1, 10, 11]);
    for (const meta of metas) {
      expect(meta.paid_status).toBe('unknown');
      expect(meta.seller_label).toBeNull();
    }
    expect(onEntryMetaChange).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done selecting' })).toBeInTheDocument();
  });

  it('records the chosen payment state for every square in the block', async () => {
    renderWorkspace();

    enterSelectMode();
    selectCell(1);
    selectCell(2);
    fireEvent.click(screen.getByRole('radio', { name: 'Unpaid' }));
    typeName('Dana P.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));
    });

    const [, metas] = (saveEntryMetaBatch as any).mock.calls[0];
    expect(metas.map((meta: EntryMeta) => meta.paid_status)).toEqual(['unpaid', 'unpaid']);
  });

  it('retains assigned names and responsibility when payment notes fail', async () => {
    (saveEntryMetaBatch as any).mockRejectedValueOnce(new Error('network down'));
    renderWorkspace();

    enterSelectMode();
    selectCell(1);
    typeName('Dana P.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 1' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Squares assigned. Payment notes were not saved.');
    expect(screen.getByRole('button', { name: 'Square 1, assigned to Dana P., allocated to Dana P.' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Assign selected squares' })).toBeInTheDocument();
  });

  it('keeps an existing payment record when the payment radio is left untouched', async () => {
    renderWorkspace({ entryMeta: { 0: paidMeta(0), 1: paidMeta(1) } });

    enterSelectMode();
    selectCell(1);
    selectCell(2);
    typeName('Dana P.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));
    });

    const [, metas] = (saveEntryMetaBatch as any).mock.calls[0];
    expect(metas.map((meta: EntryMeta) => meta.paid_status)).toEqual(['paid', 'paid']);
    expect(metas.map((meta: EntryMeta) => meta.seller_label)).toEqual(['Coach Lee', 'Coach Lee']);
  });

  it('warns before replacing names and says how many it replaced, in the status region', async () => {
    renderWorkspace({ board: boardWithAssignments(2) });

    enterSelectMode();
    fireEvent.click(screen.getByRole('button', { name: 'Square 1, assigned to Ann R.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Square 3, unassigned' }));
    expect(screen.getByText('1 of these already have a name. Apply replaces them.')).toBeInTheDocument();

    typeName('Dana Prince');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));
    });

    const status = await screen.findByText('Assigned 2 squares to Dana Prince. Replaced 1 existing names.');
    expect(status).toHaveAttribute('role', 'status');
  });

  it('published: says the names landed when only the notes fail, and drops the selection', async () => {
    (saveEntryMetaBatch as any).mockRejectedValueOnce(new Error('network down'));
    const onAssignOpenSquares = vi.fn(async (_squares: string[][]) => undefined);
    renderWorkspace({ board: drawnBoard(99), isPublished: true, shareCode: 'abc123', onAssignOpenSquares });

    enterSelectMode();
    selectCell(100);
    typeName('Dana Prince');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 1' }));
    });

    expect(onAssignOpenSquares).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('Squares assigned. Payment notes were not saved.');
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
  });

  it('drops the selection when select mode is left', () => {
    renderWorkspace();

    enterSelectMode();
    selectCell(1);
    expect(screen.getByRole('group', { name: 'Assign selected squares' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done selecting' }));
    expect(screen.queryByRole('group', { name: 'Assign selected squares' })).not.toBeInTheDocument();
  });

  it('published: assigns the OPEN squares through the late-fill callback, which reloads for itself', async () => {
    const onAssignOpenSquares = vi.fn(async (_squares: string[][]) => undefined);
    const { onReload } = renderWorkspace({
      board: drawnBoard(98),
      isPublished: true,
      shareCode: 'abc123',
      onAssignOpenSquares,
    });

    enterSelectMode();
    selectCell(99);
    selectCell(100);
    typeName('Dana Prince');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));
    });

    expect(onAssignOpenSquares).toHaveBeenCalledTimes(1);
    const squares = onAssignOpenSquares.mock.calls[0][0];
    expect(squares[98]).toEqual(['Dana Prince']);
    expect(squares[99]).toEqual(['Dana Prince']);
    expect(onReload).not.toHaveBeenCalled();
    expect(saveEntryMetaBatch).toHaveBeenCalledTimes(1);
    // The published branch keeps confirmations in the flow rather than the island.
    expect(await screen.findByText('Assigned 2 squares to Dana Prince.')).toBeInTheDocument();
  });

  it('published: a block that reaches over sold squares selects only the OPEN ones', async () => {
    const onAssignOpenSquares = vi.fn(async (_squares: string[][]) => undefined);
    const board = drawnBoard(100);
    board.squares[90] = [];
    board.squares[99] = [];
    renderWorkspace({ board, isPublished: true, shareCode: 'abc123', onAssignOpenSquares });

    enterSelectMode();
    selectCell(91);
    fireEvent.click(screen.getByRole('button', { name: 'Square 100, unassigned' }), { shiftKey: true });
    // The eight sold squares between them are never armed, so the organizer
    // sees the apply that will actually happen rather than one that is refused.
    expect(screen.getByRole('button', { name: /^Square 92, assigned to / })).not.toHaveAttribute('aria-pressed', 'true');
    typeName('Dana P.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));
    });

    expect(onAssignOpenSquares).toHaveBeenCalledTimes(1);
    const squares = onAssignOpenSquares.mock.calls[0][0];
    expect(squares[90]).toEqual(['Dana P.']);
    expect(squares[99]).toEqual(['Dana P.']);
    expect(squares[91]).toEqual(board.squares[91]);
    expect(saveEntryMetaBatch).toHaveBeenCalledTimes(1);
  });
});

describe('SquareSheet payment states', () => {
  it('offers Not asked yet first and saves it as the unknown state', async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Square 1, unassigned' }));
    expect(screen.getByRole('radio', { name: 'Not asked yet' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByLabelText('Name on the board'), { target: { value: 'Dana P.' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(saveEntryMeta).toHaveBeenCalledWith('pool-1', expect.objectContaining({ cell_index: 0, paid_status: 'unknown' }));
  });
});


describe('pregame selling', () => {
  it('shares before the draw with a public visibility confirmation and keeps management available', async () => {
    const onShareBoard = vi.fn(async () => undefined);
    renderWorkspace({ onShareBoard });
    expect(screen.getByRole('link', { name: 'My boards' })).toHaveAttribute('href', '/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Share while selling' }));
    expect(screen.getByText(/Everyone with the link can see buyer names and assigned families/)).toBeInTheDocument();
    expect(onShareBoard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enable shared board' }));
    await waitFor(() => expect(onShareBoard).toHaveBeenCalledOnce());
  });

});


it('blocks sharing while a failed draft save needs recovery', async () => {
  const onShareBoard = vi.fn(async () => undefined);
  renderWorkspace({ onShareBoard, onPublish: vi.fn(async () => { throw new Error('offline'); }) });
  const title = screen.getByRole('textbox', { name: 'Board name' });
  fireEvent.change(title, { target: { value: 'New name' } });
  fireEvent.blur(title);
  expect(screen.getByRole('button', { name: 'Share while selling' })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Share while selling' })).toBeDisabled();
  expect(onShareBoard).not.toHaveBeenCalled();
});

it('shows sharing errors in the dialog and allows retry without leaving the workspace', async () => {
  const onShareBoard = vi.fn().mockRejectedValueOnce(new Error('Connection lost. Try again.')).mockResolvedValueOnce(undefined);
  renderWorkspace({ onShareBoard });
  fireEvent.click(screen.getByRole('button', { name: 'Share while selling' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enable shared board' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection lost. Try again.'));
  fireEvent.click(screen.getByRole('button', { name: 'Enable shared board' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('link', {name: 'My boards'})).toBeInTheDocument();
});

it('clears buyers while retaining family allocations', async () => {
  const allocations = Array.from({length: 100}, (_, index) => index === 11 ? 'Mora family' : null);
  const {onApply} = renderWorkspace({board: {...boardWithAssignments(12), allocationLabels: allocations}});
  fireEvent.click(screen.getByRole('button', {name: 'Clear all names'}));
  fireEvent.click(screen.getByRole('button', {name: 'Confirm clear'}));
  await waitFor(() => {
    expect(lastBoard(onApply).squares.every(names => names.length === 0)).toBe(true);
    expect(lastBoard(onApply).allocationLabels).toEqual(allocations);
  });
});

it('focuses Cancel before enabling public sharing and cancels without sharing', () => {
  const onShareBoard = vi.fn(async () => undefined);
  renderWorkspace({onShareBoard});
  fireEvent.click(screen.getByRole('button', {name: 'Share while selling'}));
  const cancel = screen.getByRole('button', {name: 'Cancel'});
  expect(cancel).toHaveFocus();
  fireEvent.click(cancel);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onShareBoard).not.toHaveBeenCalled();
});

it('can reload after an uncertain share response even when the draft is clean', async () => {
  const onReload = vi.fn(async () => undefined);
  renderWorkspace({ onReload, onShareBoard: vi.fn(async () => {throw new Error('Response lost');}) });
  fireEvent.click(screen.getByRole('button', {name: 'Share while selling'}));
  fireEvent.click(screen.getByRole('button', {name: 'Enable shared board'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Response lost'));
  fireEvent.click(screen.getByRole('button', {name: 'Reload board'}));
  await waitFor(() => expect(onReload).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('allocates a block and preserves its original responsibility when display names change', async () => {
  const { onApply } = renderWorkspace();
  expect(screen.queryByRole('textbox', { name: 'Paste names' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Select squares'}));
  fireEvent.click(screen.getByRole('button', {name: 'Square 1, unassigned'}));
  fireEvent.click(screen.getByRole('button', {name: 'Square 2, unassigned'}));
  fireEvent.change(screen.getByLabelText('Name for these squares'), {target: {value: 'Mora family'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Apply to 2'})); });
  await waitFor(() => expect(lastBoard(onApply).allocationLabels?.[0]).toBe('Mora family'));
  expect(lastBoard(onApply).squares[0]).toEqual(['Mora family']);
  fireEvent.click(screen.getByRole('button', {name: 'Square 1, assigned to Mora family, allocated to Mora family'}));
  fireEvent.change(screen.getByLabelText('Name for these squares'), {target: {value: 'Mike M'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Apply to 1'})); });
  await waitFor(() => expect(lastBoard(onApply).squares[0]).toEqual(['Mike M']));
  expect(lastBoard(onApply).allocationLabels?.[0]).toBe('Mora family');
  expect(lastBoard(onApply).squares[1]).toEqual(['Mora family']);
});


describe('payout persistence ownership', () => {
  it('saves payout rules through their endpoint without starting a second draft save', async () => {
    vi.useFakeTimers();
    try {
      const { onPublish, props } = renderWorkspace();
      fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(900); });
      expect(onPublish).not.toHaveBeenCalled();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' })); });
      expect(props.onSavePayoutDescriptions).toHaveBeenCalledWith({ Q1: '$100' });
      await act(async () => { await vi.advanceTimersByTimeAsync(900); });
      expect(onPublish).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});


it('queues board edits made during payout saving behind that revision update', async () => {
  vi.useFakeTimers();
  try {
    let finish!: (value: any) => void;
    const patch = vi.fn(() => new Promise<any>((resolve) => { finish = resolve; }));
    const { onPublish } = renderWorkspace({ onSavePayoutDescriptions: patch });
    fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' })); });
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'New title' } });
    fireEvent.blur(screen.getByLabelText('Board name'));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(onPublish).not.toHaveBeenCalled();
    await act(async () => { finish({ Q1: '$100' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect((onPublish.mock.calls as any)[0]?.[0]).toMatchObject({ game: { title: 'New title', payoutDescriptions: { Q1: '$100' } } });
  } finally { vi.useRealTimers(); }
});


it('retains payout input after an endpoint failure and retries without a draft PUT', async () => {
  const patch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ Q1: '$100' });
  const { onPublish } = renderWorkspace({ onSavePayoutDescriptions: patch });
  fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' }));
  await screen.findByText('Save failed. Try again.');
  expect(screen.getByLabelText('Q1')).toHaveValue('$100');
  fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' }));
  await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText('Save failed. Try again.')).not.toBeInTheDocument());
  expect(onPublish).not.toHaveBeenCalled();
});

it('keeps published payout edits on the canonical payout endpoint', async () => {
  const patch = vi.fn(async () => ({ Q1: '$100' }));
  const { onPublish } = renderWorkspace({ isPublished: true, board: drawnBoard(100), onSavePayoutDescriptions: patch });
  fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith({ Q1: '$100' }));
  await waitFor(() => expect(screen.getByLabelText('Q1')).toBeEnabled());
  expect(onPublish).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Q1')).toHaveValue('$100');
});

it('saves unsaved payout rules before preview and blocks preview when that save fails', async () => {
  const patch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ Q1: '$100' });
  renderWorkspace({ board: drawnBoard(100), onSavePayoutDescriptions: patch });
  fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
  expect(screen.getByText('Unsaved payout rules')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview and publish' }));
  await screen.findByText('Save failed. Try again.');
  expect(screen.queryByRole('dialog', { name: 'Private preview — sharing is off' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview and publish' }));
  await screen.findByRole('dialog', { name: 'Private preview — sharing is off' });
  expect(patch).toHaveBeenCalledTimes(2);
});


it('warns before leaving unsaved payout input and clears the warning after save', async () => {
  renderWorkspace();
  fireEvent.change(screen.getByLabelText('Q1'), { target: { value: '$100' } });
  const unsaved = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unsaved);
  expect(unsaved.defaultPrevented).toBe(true);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save payout rules' })); });
  const saved = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
});

it('keeps family changes disabled after board autosave until the private-note write finishes', async () => {
  let finish!: () => void;
  vi.mocked(saveEntryMeta).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const board = emptyBoard(); board.squares[0] = ['Anthony']; board.allocationLabels = Array.from({length:100}, (_, index) => index === 0 ? 'Anthony' : null);
  const {onPublish} = renderWorkspace({board});
  fireEvent.click(screen.getByRole('button', {name:/^Square 1,/}));
  fireEvent.click(screen.getByRole('radio', {name:'Paid'}));
  fireEvent.click(screen.getByRole('button', {name:'Save'}));
  fireEvent.click(screen.getByText('Send families their squares'));
  fireEvent.change(screen.getByLabelText('Responsible family'), {target:{value:'Anthony'}});
  await waitFor(() => expect(onPublish).toHaveBeenCalled(), {timeout:2000});
  await act(async () => {});
  expect(screen.getByRole('button', {name:'Create private family link'})).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole('button', {name:'Create private family link'})).toBeEnabled();
});


it('offers delivery follow-up directly from the game-day island', () => {
  renderWorkspace({ isPublished: true, board: drawnBoard(100), shareCode: 'SHARE', notificationDeliveryIssues: [{ id: 'issue', milestone: 'Q1', notificationKind: 'winner', attemptCount: 3, terminalAt: '2026-09-10T20:00:00Z' }] });
  expandIsland();
  expect(within(screen.getByRole('region', { name: 'Organizer status' })).getByRole('button', { name: 'Review delivery issue' })).toBeEnabled();
});


it('continues directly from the accepted draw into private preview', async () => {
  const { onPublish } = renderWorkspace({ board: boardWithAssignments(100) });
  fireEvent.click(screen.getByRole('button', { name: 'Prepare to publish' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Use numbers and continue' })); });
  expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ board: expect.objectContaining({ topAxis: expect.any(Array) }) }));
  expect(screen.getByRole('dialog', { name: 'Private preview — sharing is off' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review and publish' })).toBeEnabled();
});

it('returns the island to board progress after closing Payments', () => {
  renderWorkspace({ board: drawnBoard(100) });
  fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Payments' })).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'Organizer status' })).toHaveTextContent('Numbers drawn');
});

it('updates selected availability without changing names, allocations or private payments', async () => {
  const board = { ...boardWithAssignments(3), allocationLabels: Array(100).fill('Mora family') };
  const { onApply } = renderWorkspace({ board, entryMeta: { 0: paidMeta(0) } });
  fireEvent.click(screen.getByRole('button', { name: 'Offer squares as available' }));
  fireEvent.click(screen.getByRole('button', { name: /Square 1, assigned/ }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Offer 1 selected square as available' })); });
  const updated = lastBoard(onApply);
  expect(updated.availability?.[0]).toBe('available');
  expect(updated.availability?.[1]).toBe('unspecified');
  expect(updated.squares).toEqual(board.squares);
  expect(updated.allocationLabels).toEqual(board.allocationLabels);
  expect(saveEntryMeta).not.toHaveBeenCalled();
});
