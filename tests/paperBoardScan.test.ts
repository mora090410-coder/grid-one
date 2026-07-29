import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoardImage } from '../services/geminiService';
import { onRequestPost as scanBoard } from '../functions/api/boards/scan';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const env = {
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
  GEMINI_API_KEY: 'gemini-key',
  OCR_MODEL: 'gemini-test',
};

const axis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const squaresGrid = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 10 }, (_, column) => row === 0 && column === 0 ? '  Parent One  ' : ''),
);
const normalizedBoard = {
  bearsAxis: axis,
  oppAxis: [...axis].reverse(),
  squares: [['Parent One'], ...Array.from({ length: 99 }, () => [])],
  isDynamic: false,
};

const scanRequest = (
  image: string,
  token = 'access-token',
) => new Request('https://example.test/api/boards/scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ image }),
});

const validImage = 'data:image/png;base64,QUJDRA==';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: 'client-token' } },
  });
  mocks.createClient.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    },
  });
});

describe('paper-board scan client', () => {
  it('returns the normalized board and sends the authenticated image request', async () => {
    const fetchMock = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({
      board: normalizedBoard,
      warning: 'Review every imported square before publishing.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(parseBoardImage(validImage)).resolves.toEqual(normalizedBoard);
    expect(fetchMock).toHaveBeenCalledWith('/api/boards/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer client-token',
      },
      body: JSON.stringify({ image: validImage }),
    });
  });

  it('normalizes non-JSON provider failures into a safe client error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (..._args: any[]) =>
      new Response('<html>upstream failure</html>', { status: 502 })
    ));

    await expect(parseBoardImage(validImage)).rejects.toThrow(
      'The board scan could not be completed.',
    );
  });

  it('preserves the server-safe error without exposing a raw provider body', async () => {
    vi.stubGlobal('fetch', vi.fn(async (..._args: any[]) =>
      new Response(JSON.stringify({ error: 'The scan provider returned no board data.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    ));

    await expect(parseBoardImage(validImage)).rejects.toThrow(
      'The scan provider returned no board data.',
    );
  });
});

describe('paper-board scan endpoint', () => {
  it('requires authentication before processing the image', async () => {
    const response = await scanBoard({
      request: scanRequest(validImage, ''),
      env,
    });
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('fails safely when paper import is not configured', async () => {
    const response = await scanBoard({
      request: scanRequest(validImage),
      env: { ...env, GEMINI_API_KEY: undefined },
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Paper-board import is not configured.',
    });
  });

  it('rejects an encoded image larger than the six-megabyte boundary', async () => {
    const oversizedImage = `data:image/jpeg;base64,${'A'.repeat(8_000_001)}`;
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);

    const response = await scanBoard({
      request: scanRequest(oversizedImage),
      env,
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('under 6 MB');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('normalizes provider output into a 100-cell board', async () => {
    const providerFetch = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              bearsAxis: axis,
              oppAxis: [...axis].reverse(),
              squaresGrid,
            }),
          }],
        },
      }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', providerFetch);

    const response = await scanBoard({
      request: scanRequest(validImage),
      env,
    });
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.board).toEqual(normalizedBoard);
    expect(result.warning).toMatch(/Review every imported square/i);
    const providerRequest = providerFetch.mock.calls[0][1];
    expect(providerRequest.body).not.toContain('client-token');
  });

  it.each([
    ['network rejection', () => Promise.reject(new Error('socket detail'))],
    ['non-JSON response', () => Promise.resolve(new Response('<html>provider detail</html>', { status: 502 }))],
  ])('normalizes a provider %s into a safe 502', async (_name, providerResult) => {
    vi.stubGlobal('fetch', vi.fn(providerResult));

    const response = await scanBoard({
      request: scanRequest(validImage),
      env,
    });
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain('The scan provider is unavailable.');
    expect(body).not.toContain('socket detail');
    expect(body).not.toContain('provider detail');
  });

  it.each([
    ['missing candidate text', { candidates: [] }, 502, 'no board data'],
    ['invalid JSON', { candidates: [{ content: { parts: [{ text: 'not-json' }] } }] }, 422, 'Unexpected token'],
    ['unreliable axes', {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              bearsAxis: Array(10).fill(0),
              oppAxis: axis,
              squaresGrid,
            }),
          }],
        },
      }],
    }, 422, 'axis digits'],
  ])('rejects malformed provider output: %s', async (_name, payload, status, message) => {
    vi.stubGlobal('fetch', vi.fn(async (..._args: any[]) => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const response = await scanBoard({
      request: scanRequest(validImage),
      env,
    });
    expect(response.status).toBe(status);
    expect((await response.json() as any).error).toContain(message);
  });
});
