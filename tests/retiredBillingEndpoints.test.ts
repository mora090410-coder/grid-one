import { describe, expect, it, vi } from 'vitest';
import * as activate from '../functions/api/pools/activate';
import * as checkout from '../functions/api/stripe/create-checkout-session';
import * as status from '../functions/api/billing/status';
import * as webhook from '../functions/api/stripe/webhook';

describe('former billing routes', () => {
  it.each([
    ['/api/pools/activate', 'POST', activate],
    ['/api/stripe/create-checkout-session', 'POST', checkout],
    ['/api/billing/status', 'GET', status],
    ['/api/stripe/webhook', 'POST', webhook],
  ] as const)('returns 410 for %s without reading credentials, requests, or invoking services', async (path, method, module) => {
    const access = vi.fn(() => { throw new Error('A retired route must not read the environment'); });
    const env = new Proxy({}, { get: access });
    const request = new Request('https://example.test' + path, { method });
    const routes = module as Record<string, (context: { request: Request; env: unknown }) => Promise<Response> | Response>;
    const handler = routes.onRequest ?? (method === 'POST' ? routes.onRequestPost : routes.onRequestGet);
    const result = await handler({ request, env });
    expect(result.status).toBe(410);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(result.json()).resolves.toEqual({ code: 'BILLING_RETIRED', error: 'GridOne no longer offers checkout.' });
    expect(access).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });
});
