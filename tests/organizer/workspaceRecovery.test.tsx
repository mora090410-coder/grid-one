import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceDraft } from '../../src/features/organizer/workspace/useWorkspaceDraft';
import type { BoardData, GameState } from '../../types';

const game: GameState = { title: 'Server board', meta: '', leftAbbr: 'KC', leftName: 'Kansas City', topAbbr: 'PHI', topName: 'Philadelphia', dates: '', lockTitle: false, lockMeta: false };
const board: BoardData = { topAxis: Array(10).fill(null), leftAxis: Array(10).fill(null), squares: Array.from({ length: 100 }, () => []) };
const recoveryKey = 'gridone:draft-recovery:owner-a:board-a';

beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('tab-local recovery of queued organizer edits', () => {
  const seed = () => sessionStorage.setItem(recoveryKey, JSON.stringify({ version: 1, expiresAt: Date.now() + 60_000, game: { ...game, title: 'Unsaved local draft' }, board }));

  it('never shows one owner or board recovery copy under another identity', () => {
    seed();
    const other = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave: vi.fn(), recoveryKey: 'gridone:draft-recovery:owner-b:board-a' }));
    expect(other.result.current.game.title).toBe('Server board');
    expect(other.result.current.saveState.status).toBe('clean');
    expect(sessionStorage.getItem(recoveryKey)).not.toBeNull();
  });

  it('does not apply recovery data to a published board', () => {
    seed();
    const view = renderHook(() => useWorkspaceDraft({ game, board, revision: 2, isPublished: true, onSave: vi.fn(), recoveryKey }));
    expect(view.result.current.game.title).toBe('Server board');
    expect(view.result.current.saveState.status).toBe('clean');
  });

  it('rejects expired and malformed copies without replacing the server board', () => {
    sessionStorage.setItem(recoveryKey, JSON.stringify({ version: 1, expiresAt: Date.now() - 1, game: { ...game, title: 'Expired' }, board }));
    const expired = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave: vi.fn(), recoveryKey }));
    expect(expired.result.current.game.title).toBe('Server board');
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    expired.unmount();
    sessionStorage.setItem(recoveryKey, 'not-json');
    const malformed = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave: vi.fn(), recoveryKey }));
    expect(malformed.result.current.game.title).toBe('Server board');
  });

  it('reports unavailable recovery when tab storage rejects the edit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const view = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave: vi.fn(), recoveryKey }));
    act(() => view.result.current.setGame((g) => ({ ...g, title: 'Still unsaved' })));
    expect(view.result.current.recoveryUnavailable).toBe(true);
    expect(view.result.current.saveState.status).toBe('dirty');
  });

  it('does not autosave edits to a recovered copy until explicit confirmation', async () => {
    seed();
    const onSave = vi.fn(async () => undefined);
    const view = renderHook(() => useWorkspaceDraft({ game, board, revision: 8, isPublished: false, onSave, recoveryKey, debounceMs: 0 }));
    act(() => view.result.current.setGame((g) => ({ ...g, title: 'Reviewed local copy' })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); await view.result.current.flush(); });
    expect(view.result.current.saveState.status).toBe('recovered');
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.retry(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(view.result.current.saveState.status).toBe('clean');
  });

  it('keeps a newer snapshot when an older in-flight save is acknowledged', async () => {
    let release!: () => void;
    const onSave = vi.fn(() => new Promise<void>(() => {}));
    onSave.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const view = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave, recoveryKey }));
    act(() => view.result.current.setGame((g) => ({ ...g, title: 'Older edit' })));
    act(() => { void view.result.current.flush(); });
    act(() => view.result.current.setGame((g) => ({ ...g, title: 'Latest unacknowledged edit' })));
    await act(async () => { release(); });
    expect(JSON.parse(sessionStorage.getItem(recoveryKey)!).game.title).toBe('Latest unacknowledged edit');
  });

  it('recovers successful external fields together with the newer local edit after teardown', async () => {
    const startingGame = { ...game, payoutDescriptions: { Q1: 'Old payout' } };
    let resolveExternal!: (fields: Partial<GameState>) => void;
    const first = renderHook(() => useWorkspaceDraft({ game: startingGame, board, revision: 1, isPublished: false, onSave: vi.fn(), recoveryKey }));
    let pending!: Promise<void>;
    await act(async () => { pending = first.result.current.saveExternalGame(() => new Promise((resolve) => { resolveExternal = resolve; })); });
    act(() => first.result.current.setGame((g) => ({ ...g, title: 'Local name edited during payout save' })));
    await act(async () => { resolveExternal({ payoutDescriptions: { Q1: 'Confirmed new payout' } }); await pending; });
    first.unmount(); // Queued draft save has not run.
    const onSave = vi.fn();
    const second = renderHook(() => useWorkspaceDraft({ game: { ...startingGame, payoutDescriptions: { Q1: 'Confirmed new payout' } }, board, revision: 2, isPublished: false, onSave, recoveryKey }));
    expect(second.result.current.game.title).toBe('Local name edited during payout save');
    expect(second.result.current.game.payoutDescriptions).toEqual({ Q1: 'Confirmed new payout' });
    expect(second.result.current.saveState.status).toBe('recovered');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('retains the latest edit through a destroyed page without waiting for the in-flight request', async () => {
    const blockedSave = vi.fn(() => new Promise<void>(() => {}));
    const first = renderHook(() => useWorkspaceDraft({ game, board, revision: 1, isPublished: false, onSave: blockedSave, recoveryKey }));
    act(() => first.result.current.setGame((g) => ({ ...g, title: 'First edit' })));
    act(() => { void first.result.current.flush(); });
    act(() => first.result.current.setGame((g) => ({ ...g, title: 'Last edit before leaving' })));
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(blockedSave).toHaveBeenCalledTimes(1);
    first.unmount(); // No request settles; no queued continuation gets a chance to run.

    const recoveredSave = vi.fn(async () => undefined);
    const second = renderHook(() => useWorkspaceDraft({ game, board, revision: 2, isPublished: false, onSave: recoveredSave, recoveryKey }));
    expect(second.result.current.game.title).toBe('Last edit before leaving');
    expect(second.result.current.saveState.status).toBe('recovered');
    expect(second.result.current.saveState.canPublish).toBe(false);
    await act(async () => { await second.result.current.flush(); });
    expect(recoveredSave).not.toHaveBeenCalled(); // No silent overwrite of the newer server revision.
    await act(async () => { await second.result.current.retry(); }); // Explicit reviewed recovery.
    expect(recoveredSave).toHaveBeenCalledTimes(1);
    expect(second.result.current.saveState.status).toBe('clean');
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
  });
});
