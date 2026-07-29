import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { fetchLiveScore } from '../services/scoreService';
import type { GameState, LiveGameData } from '../types';

vi.mock('../services/scoreService', () => ({
  fetchLiveScore: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const manualSnapshot: LiveGameData = {
  leftScore: 17,
  topScore: 14,
  quarterScores: {
    Q1: { left: 7, top: 0 },
    Q2: { left: 3, top: 7 },
    Q3: { left: 0, top: 0 },
    Q4: { left: 7, top: 7 },
    OT: { left: 0, top: 0 },
  },
  clock: '',
  period: 4,
  state: 'post',
  detail: 'Organizer-entered score',
  isOvertime: false,
  isManual: true,
  sourceName: 'Organizer',
  retrievedAt: '2026-09-13T20:00:00.000Z',
  staleAfter: '2027-09-13T20:00:00.000Z',
  freshness: 'fresh',
};

const legacyGame: GameState = {
  title: 'Legacy board',
  meta: '',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  dates: '2025-09-28',
  lockTitle: false,
  lockMeta: false,
  scoreSnapshot: manualSnapshot,
};

describe('legacy manual live scoring', () => {
  it('does not request or expose score services for an unactivated board', async () => {
    const winnerHistory: [] = [];
    const { result, unmount } = renderHook(() =>
      useLiveScoring(legacyGame, true, false, 'board-id', winnerHistory, false));

    await waitFor(() => expect(result.current.liveStatus).toBe('UNLOCK LIVE SCORING'));
    expect(result.current.liveData).toBeNull();
    expect(fetchLiveScore).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps a persisted legacy manual snapshot visible without requesting ESPN', async () => {
    const winnerHistory: [] = [];
    const { result, unmount } = renderHook(() =>
      useLiveScoring(legacyGame, true, false, 'ABCDEFGH', winnerHistory));

    await waitFor(() => expect(result.current.liveStatus).toBe('FINAL'));
    expect(result.current.liveData).toEqual(manualSnapshot);
    expect(result.current.isSynced).toBe(true);
    unmount();
  });

  it('refreshes the canonical provider after a final manual override is disabled', async () => {
    const providerSnapshot: LiveGameData = {
      ...manualSnapshot,
      isManual: false,
      sourceName: 'ESPN',
      sourceUrl: 'https://www.espn.com/nfl/game/_/gameId/401772988',
      detail: 'Final',
    };
    vi.mocked(fetchLiveScore).mockResolvedValueOnce({
      score: providerSnapshot,
      winnerHistory: [],
    });

    const manualGame: GameState = {
      ...legacyGame,
      gameExternalId: '401772988',
      useManualScores: true,
    };
    const winnerHistory: [] = [];
    const { result, rerender, unmount } = renderHook(
      ({ game }) => useLiveScoring(game, true, false, 'board-id', winnerHistory),
      { initialProps: { game: manualGame } },
    );

    await waitFor(() => expect(result.current.liveData?.isManual).toBe(true));

    rerender({
      game: {
        ...manualGame,
        useManualScores: false,
        // The server preserves the manual score as the last valid fallback until
        // ESPN replaces it, so Auto must refresh even though this snapshot is Final.
        scoreSnapshot: manualSnapshot,
      },
    });

    await waitFor(() => expect(fetchLiveScore).toHaveBeenCalledWith('board-id'));
    await waitFor(() => expect(result.current.liveData).toEqual(providerSnapshot));
    expect(result.current.liveStatus).toBe('FINAL');
    unmount();
  });

  it('does not restart polling across forty unrelated organizer edits', async () => {
    const providerSnapshot: LiveGameData = {
      ...manualSnapshot,
      state: 'in',
      period: 2,
      isManual: false,
      sourceName: 'ESPN',
    };
    vi.mocked(fetchLiveScore).mockResolvedValue({
      score: providerSnapshot,
      winnerHistory: [],
      pendingMilestones: [],
    });
    const initialGame: GameState = {
      ...legacyGame,
      gameExternalId: '401772988',
      scoreSnapshot: providerSnapshot,
    };
    const { rerender, unmount } = renderHook(
      ({ game }) => useLiveScoring(game, true, false, 'board-id', []),
      { initialProps: { game: initialGame } },
    );

    await waitFor(() => expect(fetchLiveScore).toHaveBeenCalledTimes(1));
    for (let index = 0; index < 40; index += 1) {
      rerender({
        game: {
          ...initialGame,
          title: `Unrelated edit ${index}`,
          payouts: { Q1: index, Q2: 25, Q3: 25, Final: 50 },
        },
      });
    }

    await new Promise(resolveWait => setTimeout(resolveWait, 25));
    expect(fetchLiveScore).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('accepts inline empty history arrays without entering a render loop', async () => {
    const providerSnapshot: LiveGameData = {
      ...manualSnapshot,
      state: 'in',
      period: 2,
      isManual: false,
    };
    vi.mocked(fetchLiveScore).mockResolvedValue({
      score: providerSnapshot,
      winnerHistory: [],
      pendingMilestones: [],
    });
    const game = {
      ...legacyGame,
      gameExternalId: '401772988',
      scoreSnapshot: providerSnapshot,
    };
    const { result, unmount } = renderHook(() =>
      useLiveScoring(game, true, false, 'board-id', [], true, []));

    await waitFor(() => expect(result.current.liveStatus).toBe('LIVE'));
    expect(fetchLiveScore).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('pauses while hidden, resumes once on visibility, and stops permanently at Final', async () => {
    vi.useFakeTimers();
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    const liveSnapshot: LiveGameData = {
      ...manualSnapshot,
      state: 'in',
      period: 4,
      isManual: false,
    };
    const finalSnapshot: LiveGameData = {
      ...liveSnapshot,
      state: 'post',
    };
    vi.mocked(fetchLiveScore)
      .mockResolvedValueOnce({ score: liveSnapshot })
      .mockResolvedValueOnce({ score: liveSnapshot })
      .mockResolvedValueOnce({ score: finalSnapshot });
    const game = {
      ...legacyGame,
      gameExternalId: '401772988',
      scoreSnapshot: liveSnapshot,
    };
    const { unmount } = renderHook(() =>
      useLiveScoring(game, true, false, 'board-id'));

    await act(async () => {
      await vi.waitFor(() => expect(fetchLiveScore).toHaveBeenCalledTimes(1));
    });
    hidden = true;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchLiveScore).toHaveBeenCalledTimes(1);

    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      await vi.waitFor(() => expect(fetchLiveScore).toHaveBeenCalledTimes(2));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await act(async () => {
      await vi.waitFor(() => expect(fetchLiveScore).toHaveBeenCalledTimes(3));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(fetchLiveScore).toHaveBeenCalledTimes(3);

    unmount();
    vi.useRealTimers();
  });
});
