import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceDraft } from '../../src/features/organizer/workspace/useWorkspaceDraft';
import type { BoardData, GameState } from '../../types';

const game: GameState = { title: 'Lincoln Softball', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: '', lockTitle: false, lockMeta: false };
const board: BoardData = { topAxis: Array(10).fill(null), leftAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []) };

describe('useWorkspaceDraft', () => {
  it('marks dirty on edit, saves after the debounce, and returns to clean at the new revision', async () => {
    vi.useFakeTimers();
    let revision = 3;
    const onSave = vi.fn(async (_data: { game: GameState; board: BoardData }) => { revision = 4; });
    const onApply = vi.fn();
    const { result, rerender } = renderHook((props: { revision: number }) => useWorkspaceDraft({ game, board, revision: props.revision, isPublished: false, onSave, onApply, debounceMs: 800 }), { initialProps: { revision } });
    act(() => result.current.setGame((g) => ({ ...g, title: 'Lincoln Softball Boosters' })));
    expect(result.current.saveState.status).toBe('dirty');
    expect(onApply).toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].game.title).toBe('Lincoln Softball Boosters');
    rerender({ revision });
    await act(async () => {});
    expect(result.current.saveState.status).toBe('clean');
    expect(result.current.saveState.revision).toBe(4);
    vi.useRealTimers();
  });

  it('coalesces rapid edits into one save and flushes on demand', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async (_data: { game: GameState; board: BoardData }) => {});
    const { result } = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave }));
    act(() => { result.current.setBoard((b) => ({ ...b, squares: b.squares.map((s, i) => (i === 0 ? ['Ann'] : s)) })); });
    act(() => { result.current.setBoard((b) => ({ ...b, squares: b.squares.map((s, i) => (i === 1 ? ['Bo'] : s)) })); });
    await act(async () => { await result.current.flush(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].board.squares[1]).toEqual(['Bo']);
    vi.useRealTimers();
  });

  it('reports save_failed with retry, and conflicted when the server revision moved', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('The board could not be saved.')).mockResolvedValue(undefined);
    const { result, rerender } = renderHook((props: { revision: number }) => useWorkspaceDraft({ game, board, revision: props.revision, isPublished: false, onSave, debounceMs: 10 }), { initialProps: { revision: 1 } });
    act(() => result.current.setGame((g) => ({ ...g, title: 'x' })));
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(result.current.saveState.status).toBe('save_failed');
    await act(async () => { await result.current.retry(); });
    expect(result.current.saveState.status).toBe('clean');

    onSave.mockRejectedValueOnce(new Error('Unable to save the board.'));
    act(() => result.current.setGame((g) => ({ ...g, title: 'y' })));
    act(() => { vi.advanceTimersByTime(10); });
    rerender({ revision: 7 });
    await act(async () => {});
    expect(result.current.saveState.status).toBe('conflicted');
    vi.useRealTimers();
  });

  it('never autosaves a published board but still applies edits locally', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => {});
    const onApply = vi.fn();
    const { result } = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: true, onSave, onApply }));
    act(() => result.current.setGame((g) => ({ ...g, title: 'z' })));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(onSave).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenCalled();
    expect(result.current.saveState.status).toBe('clean');
    vi.useRealTimers();
  });

  it('runs a pre-flight conflict check against the live revision before calling onSave', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      (props: { revision: number }) => useWorkspaceDraft({ game, board, revision: props.revision, isPublished: false, onSave, debounceMs: 800 }),
      { initialProps: { revision: 1 } },
    );
    act(() => result.current.setGame((g) => ({ ...g, title: 'x' })));
    expect(result.current.saveState.status).toBe('dirty');
    rerender({ revision: 2 });
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveState.status).toBe('conflicted');
    vi.useRealTimers();
  });

  it('never clobbers a failed local draft when props update with an equivalent object', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('nope'));
    const { result, rerender } = renderHook(
      (props: { board: BoardData }) => useWorkspaceDraft({ game, board: props.board, revision: 1, isPublished: false, onSave, debounceMs: 10 }),
      { initialProps: { board } },
    );
    act(() => result.current.setGame((g) => ({ ...g, title: 'edited' })));
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(result.current.saveState.status).toBe('save_failed');
    const equivalentBoard: BoardData = { ...board, squares: board.squares.map((s) => [...s]) };
    rerender({ board: equivalentBoard });
    expect(result.current.saveState.status).toBe('save_failed');
    expect(result.current.game.title).toBe('edited');
    vi.useRealTimers();
  });

  it('flush drains a coalesced edit made during an in-flight save', async () => {
    let resolveFirst: () => void = () => {};
    let calls = 0;
    const onSave = vi.fn((_data: { game: GameState; board: BoardData }) => {
      calls += 1;
      if (calls === 1) return new Promise<void>((resolve) => { resolveFirst = resolve; });
      return Promise.resolve();
    });
    const { result } = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave, debounceMs: 800 }));
    act(() => result.current.setGame((g) => ({ ...g, title: 'first' })));
    let flushPromise!: ReturnType<typeof result.current.flush>;
    act(() => { flushPromise = result.current.flush(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    act(() => result.current.setGame((g) => ({ ...g, title: 'second' })));
    resolveFirst();
    await act(async () => { await flushPromise; });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0].game.title).toBe('second');
    expect(result.current.saveState.status).toBe('clean');
  });

  it('reloadLatest clears a conflicted state back to clean at the new revision', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => {});
    const onReload = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      (props: { revision: number }) => useWorkspaceDraft({ game, board, revision: props.revision, isPublished: false, onSave, onReload, debounceMs: 800 }),
      { initialProps: { revision: 1 } },
    );
    act(() => result.current.setGame((g) => ({ ...g, title: 'x' })));
    rerender({ revision: 2 });
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(result.current.saveState.status).toBe('conflicted');
    await act(async () => { await result.current.reloadLatest(); });
    expect(result.current.saveState.status).toBe('clean');
    expect(result.current.saveState.revision).toBe(2);
    vi.useRealTimers();
  });
  it('flush resolves with the save state that results from the flush', async () => {
    const onSave = vi.fn(async (_data: { game: GameState; board: BoardData }) => {});
    const { result } = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave, debounceMs: 800 }));
    act(() => result.current.setGame((g) => ({ ...g, title: 'flushed' })));
    let settled!: Awaited<ReturnType<typeof result.current.flush>>;
    await act(async () => { settled = await result.current.flush(); });
    expect(settled.status).toBe('clean');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('flush resolves with save_failed when the save is rejected', async () => {
    const onSave = vi.fn(async () => { throw new Error('The board could not be saved.'); });
    const { result } = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave, debounceMs: 800 }));
    act(() => result.current.setGame((g) => ({ ...g, title: 'flushed' })));
    let settled!: Awaited<ReturnType<typeof result.current.flush>>;
    await act(async () => { settled = await result.current.flush(); });
    expect(settled.status).toBe('save_failed');
  });
});

it('accepts its payout revision while preserving edits made during the endpoint request', async () => {
  vi.useFakeTimers();
  try {
    const onSave = vi.fn(async () => undefined);
    let resolve!: (fields: Partial<GameState>) => void;
    const { result, rerender } = renderHook(({ revision }) => useWorkspaceDraft({ game, board, revision, isPublished: false, onSave }), { initialProps: { revision: 2 } });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.saveExternalGame(() => new Promise((done) => { resolve = done; })); });
    act(() => result.current.setGame((current) => ({ ...current, title: 'New title' })));
    rerender({ revision: 3 });
    await act(async () => { resolve({ payoutDescriptions: { Q1: '$100' } }); await pending; });
    expect(result.current.saveState.status).toBe('dirty');
    expect(result.current.saveState.revision).toBe(3);
    expect(result.current.game.title).toBe('New title');
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.saveState.status).toBe('clean');
    expect(result.current.game.payoutDescriptions).toEqual({ Q1: '$100' });
  } finally { vi.useRealTimers(); }
});

it('keeps an external revision conflict blocked before the new revision prop renders', async () => {
  const onSave = vi.fn(async () => undefined);
  const { result, rerender } = renderHook(({ revision }) => useWorkspaceDraft({ game, board, revision, isPublished: false, onSave }), { initialProps: { revision: 2 } });
  await act(async () => {
    await expect(result.current.saveExternalGame(async () => {
      throw Object.assign(new Error('Changed in another session'), { code: 'REVISION_CONFLICT', currentRevision: 3 });
    })).rejects.toThrow('Changed in another session');
  });
  expect(result.current.saveState.status).toBe('conflicted');
  rerender({ revision: 3 });
  expect(result.current.saveState.status).toBe('conflicted');
  const retryPatch = vi.fn(async () => ({}));
  await act(async () => { await expect(result.current.saveExternalGame(retryPatch)).rejects.toThrow(); });
  expect(retryPatch).not.toHaveBeenCalled();
});

it('reload after a conflict adopts the server board even when it lands mid-reload', async () => {
  const onSave = vi.fn(async () => { throw new Error('conflict'); });
  let release!: () => void; let entered!: () => void;
  const enteredReload = new Promise<void>((resolve) => { entered = resolve; });
  const onReload = () => new Promise<void>((resolve) => { release = resolve; entered(); });
  type Props = { game: GameState; board: BoardData; revision: number };
  const { result, rerender } = renderHook((props: Props) => useWorkspaceDraft({ ...props, isPublished: false, onSave, onReload, debounceMs: 1 }), { initialProps: { game: { ...game, title: 'Server v1' }, board, revision: 1 } });
  act(() => result.current.setGame((g) => ({ ...g, title: 'Local edit' })));
  rerender({ game: { ...game, title: 'Server v1' }, board, revision: 2 });
  await act(async () => { await result.current.flush(); });
  expect(result.current.saveState.status).toBe('conflicted');
  let reloading!: Promise<void>;
  act(() => { reloading = result.current.reloadLatest(); });
  await enteredReload;
  // The fresh board renders while the reload's second step (private notes) is still pending.
  rerender({ game: { ...game, title: 'Server v2' }, board: { ...board }, revision: 3 });
  await act(async () => { release(); await reloading; });
  expect([result.current.saveState.status, result.current.game.title, result.current.saveState.revision]).toEqual(['clean', 'Server v2', 3]);
});
