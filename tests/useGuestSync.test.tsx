import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGuestSync, type GuestInvalidationSubscriber } from '../src/features/guest/useGuestSync';

afterEach(() => vi.useRealTimers());

it('treats events only as invalidations and polls every 15 seconds while disconnected', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn().mockResolvedValue(undefined);
  let invalidate!: () => void;
  let status!: (connected: boolean) => void;
  const subscribe: GuestInvalidationSubscriber = (_boardId, onInvalidate, onConnection) => {
    invalidate = onInvalidate; status = onConnection; return () => undefined;
  };
  const { result } = renderHook(() => useGuestSync({ boardId: 'board-1', enabled: true, refresh, subscribe }));
  await act(async () => { status(false); });
  expect(result.current.connection).toBe('reconnecting');
  await act(async () => { invalidate(); await vi.advanceTimersByTimeAsync(100); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('keeps one subscription when the refresh closure changes after a render', async () => {
  vi.useFakeTimers();
  const first = vi.fn().mockResolvedValue(undefined);
  const second = vi.fn().mockResolvedValue(undefined);
  let invalidate!: () => void;
  const subscribe = vi.fn<GuestInvalidationSubscriber>((_boardId, onInvalidate) => {
    invalidate = onInvalidate;
    return () => undefined;
  });
  const { rerender } = renderHook(({ refresh }) => useGuestSync({ boardId: 'board-1', enabled: true, refresh, subscribe }), {
    initialProps: { refresh: first },
  });
  rerender({ refresh: second });
  await act(async () => { invalidate(); invalidate(); invalidate(); await vi.advanceTimersByTimeAsync(75); });
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('bounds refresh starts during an invalidation flood and still converges after the final event', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useGuestSync({ boardId: 'board-1', enabled: true, refresh }));
  await act(async () => {
    for (let index = 0; index < 20; index += 1) {
      result.current.invalidate();
      await vi.advanceTimersByTimeAsync(100);
    }
  });
  expect(refresh.mock.calls.length).toBeLessThanOrEqual(4);
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  expect(refresh).toHaveBeenCalledTimes(5);
});
