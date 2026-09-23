import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARED_BOARD_REFRESH_MS, useSharedBoardRefresh } from '../../src/features/organizer/workspace/useSharedBoardRefresh';

const setVisibility = (state: 'visible' | 'hidden') => Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });

describe('useSharedBoardRefresh', () => {
  beforeEach(() => { vi.useFakeTimers(); setVisibility('visible'); });
  afterEach(() => { vi.useRealTimers(); setVisibility('visible'); });

  it('pulls new seller-link claims on a steady interval while the board is shared and nothing is unsaved', async () => {
    const refresh = vi.fn(async () => {});
    renderHook(() => useSharedBoardRefresh({ enabled: true, canRefresh: () => true, refresh }));
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes right away when the organizer comes back to the tab', async () => {
    const refresh = vi.fn(async () => {});
    renderHook(() => useSharedBoardRefresh({ enabled: true, canRefresh: () => true, refresh }));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never refreshes over unsaved work, in a hidden tab, or when turned off', async () => {
    const refresh = vi.fn(async () => {});
    let ready = false;
    const { rerender } = renderHook(({ enabled }) => useSharedBoardRefresh({ enabled, canRefresh: () => ready, refresh }), { initialProps: { enabled: true } });
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS * 2); });
    expect(refresh).not.toHaveBeenCalled();
    ready = true; setVisibility('hidden');
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS * 2); });
    expect(refresh).not.toHaveBeenCalled();
    setVisibility('visible'); rerender({ enabled: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS * 2); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not stack a second refresh while one is still running, and survives a failed one', async () => {
    let finish: () => void = () => {};
    const refresh = vi.fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    renderHook(() => useSharedBoardRefresh({ enabled: true, canRefresh: () => true, refresh }));
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_BOARD_REFRESH_MS); });
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
