import { describe, expect, it, vi } from 'vitest';
import { reloadForStaleChunk } from '../utils/staleChunkReload';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

describe('stale code file after a deploy', () => {
  it('reloads once, then leaves a repeat failure to the error screen', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    let time = 1_000_000;
    expect(reloadForStaleChunk({ now: () => time, storage, reload })).toBe(true);
    time += 2_000;
    expect(reloadForStaleChunk({ now: () => time, storage, reload })).toBe(false);
    time += 20_000;
    expect(reloadForStaleChunk({ now: () => time, storage, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('still reloads once when storage is blocked', () => {
    const reload = vi.fn();
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(reloadForStaleChunk({ now: () => 5_000_000, storage: blocked, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
