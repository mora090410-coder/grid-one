import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findVisiblePublicBoard,
  PUBLIC_BOARD_NOT_FOUND,
  PUBLIC_BOARD_STATUSES,
} from '../functions/_lib/publicBoardVisibility';
import { onRequestGet as getBoard } from '../functions/api/pools/[id]';
import { onRequestGet as getScore } from '../functions/api/pools/[id]/score';
import { onRequestPost as subscribe } from '../functions/api/boards/[shareCode]/subscribe';

const mocks = vi.hoisted(() => {
  const clients: any[] = [];
  const createClient = vi.fn(() => {
    const client = clients.shift();
    if (!client) throw new Error('No scripted Supabase client remains.');
    return client;
  });
  return { clients, createClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  EMAIL_PROVIDER_API_KEY: 'email-key',
  EMAIL_FROM: 'GridOne <updates@getgridone.com>',
  NOTIFICATION_TOKEN_SECRET: 'notification-secret',
  PUBLIC_SITE_URL: 'https://www.getgridone.com',
};

const visibleAdmin = (
  status: string,
  withdrawn = false,
  snapshot: Record<string, unknown> = {},
) => {
  const operations: Array<{ method: string; args: unknown[] }> = [];
  const tables: string[] = [];
  const chain: any = {
    select: vi.fn((...args: unknown[]) => {
      operations.push({ method: 'select', args });
      return chain;
    }),
    eq: vi.fn((...args: unknown[]) => {
      operations.push({ method: 'eq', args });
      return chain;
    }),
    is: vi.fn((...args: unknown[]) => {
      operations.push({ method: 'is', args });
      return chain;
    }),
    in: vi.fn((...args: unknown[]) => {
      operations.push({ method: 'in', args });
      return chain;
    }),
    maybeSingle: vi.fn(async () => ({
      data: !withdrawn && PUBLIC_BOARD_STATUSES.includes(status as any)
        ? {
            contest_id: 'contest-1',
            board_title: 'Week One',
            ...snapshot,
            contest: {
              id: 'contest-1',
              status,
              board_activations: [{ id: 'activation-1' }],
            },
          }
        : null,
      error: null,
    })),
  };
  return {
    from: vi.fn((table: string) => {
      tables.push(table);
      return chain;
    }),
    operations,
    tables,
  };
};

beforeEach(() => {
  mocks.clients.length = 0;
  vi.clearAllMocks();
});

describe('shared public board visibility', () => {
  it.each(PUBLIC_BOARD_STATUSES)('accepts an unwithdrawn %s board', async (status) => {
    const admin = visibleAdmin(status);
    const result = await findVisiblePublicBoard(admin, 'abcdefgh', {
      snapshot: 'contest_id, board_title',
      contest: 'id, status',
    });

    expect(result).toMatchObject({
      snapshot: { contest_id: 'contest-1', board_title: 'Week One' },
      contest: { id: 'contest-1', status },
    });
    expect(admin.tables).toEqual(['public_board_snapshots']);
    expect(admin.operations).toContainEqual({
      method: 'is',
      args: ['withdrawn_at', null],
    });
    expect(admin.operations).toContainEqual({
      method: 'in',
      args: ['contest.status', [...PUBLIC_BOARD_STATUSES]],
    });
  });

  it.each(['draft', 'reconciling', 'ready'])('rejects an unwithdrawn %s board', async (status) => {
    const result = await findVisiblePublicBoard(visibleAdmin(status), 'ABCDEFGH', {
      snapshot: 'contest_id',
      contest: 'id, status',
    });
    expect(result).toBeNull();
  });

  it.each(PUBLIC_BOARD_STATUSES)('rejects a withdrawn %s board', async (status) => {
    const result = await findVisiblePublicBoard(visibleAdmin(status, true), 'ABCDEFGH', {
      snapshot: 'contest_id',
      contest: 'id, status',
    });
    expect(result).toBeNull();
  });

  it('returns byte-identical 404 bodies from board, score, and subscribe', async () => {
    const boardAdmin = visibleAdmin('published', true);
    const scoreAdmin = visibleAdmin('published', true);
    const subscribeAdmin = visibleAdmin('published', true);
    mocks.clients.push(boardAdmin, scoreAdmin, subscribeAdmin);

    const responses = await Promise.all([
      getBoard({
        request: new Request('https://example.test/api/pools/ABCDEFGH'),
        env,
        params: { id: 'ABCDEFGH' },
      }),
      getScore({
        request: new Request('https://example.test/api/pools/ABCDEFGH/score'),
        env,
        params: { id: 'ABCDEFGH' },
      }),
      subscribe({
        request: new Request('https://example.test/api/boards/ABCDEFGH/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.10',
          },
          body: JSON.stringify({
            participantId: '11111111-1111-4111-8111-111111111111',
            email: 'parent@example.com',
          }),
        }),
        env,
        params: { shareCode: 'ABCDEFGH' },
      }),
    ]);

    expect(responses.map(response => response.status)).toEqual([404, 404, 404]);
    expect(await Promise.all(responses.map(response => response.text()))).toEqual([
      JSON.stringify(PUBLIC_BOARD_NOT_FOUND),
      JSON.stringify(PUBLIC_BOARD_NOT_FOUND),
      JSON.stringify(PUBLIC_BOARD_NOT_FOUND),
    ]);
    expect(boardAdmin.tables).toEqual(['public_board_snapshots']);
    expect(scoreAdmin.tables).toEqual(['public_board_snapshots']);
    expect(subscribeAdmin.tables).toEqual(['public_board_snapshots']);
  });
});

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });

describe('public board visibility architecture', () => {
  it('requires every share-code API route to use the shared visibility helper', () => {
    const apiRoot = resolve(process.cwd(), 'functions/api');
    const candidates = sourceFiles(apiRoot)
      .map(path => ({ path, source: readFileSync(path, 'utf8') }))
      .filter(({ path, source }) => path.includes('[shareCode]') || source.includes('sharePattern'));
    const candidatePaths = candidates.map(({ path }) => relative(process.cwd(), path));

    expect(candidatePaths).toEqual(expect.arrayContaining([
      'functions/api/boards/[shareCode]/subscribe.ts',
      'functions/api/pools/[id].ts',
      'functions/api/pools/[id]/score.ts',
    ]));
    for (const { path, source } of candidates) {
      expect(source, relative(process.cwd(), path)).toContain('findVisiblePublicBoard');
      expect(source, relative(process.cwd(), path)).not.toMatch(/\.is\(\s*['"]withdrawn_at['"]/);
      expect(source, relative(process.cwd(), path)).not.toMatch(/\.in\(\s*['"]status['"]/);
    }
  });
});
