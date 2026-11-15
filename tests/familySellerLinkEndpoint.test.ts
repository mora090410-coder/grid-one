import { webcrypto } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
import { onRequestPost } from '../functions/api/family/seller-link';
const token = 'a'.repeat(64);
const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server' };
const context = (body: unknown = { action: 'read' }, bearer = token) => ({ env, request: new Request('https://untrusted.example/api/family/seller-link', { method: 'POST', headers: { Authorization: `Bearer ${bearer}` }, body: JSON.stringify(body) }) });
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.clearAllMocks(); rpc.mockResolvedValue({ data: { state: 'active', code: 'b'.repeat(16), availableCount: 3, token_hash: 'private', payment: 'private' } }); });
it('hashes the capability, derives scope only in SQL, and exposes only the public URL', async () => {
 const response = await onRequestPost(context({ action: 'create' }));
 expect(await response.json()).toEqual({ state: 'active', availableCount: 3, url: `/s/${'b'.repeat(16)}` });
 expect(rpc).toHaveBeenCalledWith('gridone_family_seller_link', { p_action: 'create', p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
 expect(rpc.mock.calls[0][1].p_token_hash).not.toBe(token);
 expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
});
it('rejects caller-selected scope and malformed actions without database access', async () => {
 for (const body of [{ action: 'create', label: 'Other' }, { action: 'create', boardId: 'other' }, { action: 'create', cells: [0] }, { action: 'rotate' }, {}, null]) expect((await onRequestPost(context(body))).status).toBe(400);
 expect((await onRequestPost(context(undefined, 'bad'))).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
});
it.each(['not_created','not_shared','locked','no_available'])('omits even a returned code in %s state', async state => {
 rpc.mockResolvedValue({ data: { state, availableCount: 0, code: 'b'.repeat(16) } });
 expect(await (await onRequestPost(context())).json()).toEqual({ state, availableCount: 0 });
});
it('fails closed for invalid RPC responses', async () => {
 for (const data of [null, { state: 'unexpected', availableCount: 1 }, { state: 'active', availableCount: 1, code: '../private' }, { state: 'active', availableCount: 0, code: 'b'.repeat(16) }, { state: 'locked', availableCount: 101 }]) {
  rpc.mockResolvedValue({ data }); expect((await onRequestPost(context())).status).toBe(503);
 }
});
it('hides authorization and infrastructure details', async () => {
 rpc.mockResolvedValue({ error: { message: 'family_access_denied SQL private' } });
 const denied = await onRequestPost(context()); expect(denied.status).toBe(403); expect(await denied.text()).not.toContain('SQL');
 expect((await onRequestPost({ ...context(), env: { ...env, SUPABASE_SERVICE_ROLE_KEY: undefined } })).status).toBe(503);
});
it('returns a relative same-site path and keeps reads as reads', async () => {
 const result = await (await onRequestPost({ ...context(), env: { ...env, PUBLIC_SITE_URL: 'https://www.getgridone.com/path' } })).json();
 expect(result.url).toBe(`/s/${'b'.repeat(16)}`); expect(rpc.mock.calls[0][1].p_action).toBe('read');
});
