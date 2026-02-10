import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../utils/retry';

describe('withRetry', () => {
  it('returns immediately on first success', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const value = await withRetry(operation);
    expect(value).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures and eventually succeeds', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('ok');

    const value = await withRetry(operation, {
      retries: 3,
      jitter: false,
      sleepFn,
      shouldRetry: () => true,
    });

    expect(value).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 300);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 600);
  });

  it('throws immediately when shouldRetry is false', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('HTTP 400'));
    await expect(
      withRetry(operation, {
        retries: 3,
        shouldRetry: () => false,
      })
    ).rejects.toThrow('HTTP 400');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
