import { webcrypto } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const { rpc, lookup, eq } = vi.hoisted(() => ({ rpc: vi.fn(), lookup: vi.fn(), eq: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, from: () => ({ select: () => ({ eq }) }) }) }));
import { onRequestPost } from '../functions/api/family/guest-link';
const boardId = '30000000-0000-4000-8000-000000000001';
const token = 'a'.repeat(64);
const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server', GUEST_INVITE_SECRET: 's'.repeat(32), GUEST_INVITE_POOL_IDS: boardId };
const value = { boardId, title: 'Test board', label: 'Family', cells: [0, 11, 22], revision: 3, state: 'active', availableCount: 2, maxSquares: 1, inviteId: '40000000-0000-4000-8000-000000000001', version: 1 };
const context = (body: unknown = { action: 'read' }, bearer = token) => ({ env, request: new Request('https://untrusted.example/api/family/guest-link', { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
beforeEach(() => {
 vi.stubGlobal('crypto', webcrypto);
 vi.clearAllMocks(); eq.mockReturnValue({ maybeSingle: lookup }); lookup.mockResolvedValue({ data: { contest_id: boardId }, error: null });
 rpc.mockImplementation(async (name: string) => ({ data: name === 'gridone_guest_rate_limit' ? true : { ...value, token_hash: 'private', payment: { secret: true } }, error: null }));
});
it('derives scope from the capability and returns only a signed public link', async () => {
 const response = await onRequestPost(context({ action: 'create' })); const result = await response.json();
 expect(response.status).toBe(200); expect(result.url).toMatch(new RegExp(`^https://getgridone.com/p/${boardId}\\?invite=`));
 expect(result.cells).toEqual([0, 11, 22]); expect(result.inviteId).toBeUndefined(); expect(result.token_hash).toBeUndefined(); expect(result.payment).toBeUndefined();
 const args = rpc.mock.calls.find(call => call[0] === 'gridone_family_guest_link')![1];
 expect(args).toEqual({ p_board_id: boardId, p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/), p_action: 'create' }); expect(args.p_token_hash).not.toBe(token);
 expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
});
it('rejects client scope and organizer settings before lookup', async () => {
 for (const extra of [{ cells: [99] }, { boardId }, { label: 'Other' }, { maxSquares: 10 }]) expect((await onRequestPost(context({ action: 'create', ...extra }))).status).toBe(400);
 expect(lookup).not.toHaveBeenCalled(); expect((await onRequestPost(context(undefined, 'bad'))).status).toBe(403);
});
it('honors the exact-board rollout gate', async () => {
 const response = await onRequestPost({ ...context(), env: { ...env, GUEST_INVITE_POOL_IDS: '' } });
 expect(response.status).toBe(404); expect((await response.json()).code).toBe('SHARING_UNAVAILABLE'); expect(rpc).not.toHaveBeenCalled();
});
it('does not return a link for disabled invites', async () => {
 rpc.mockImplementation(async (name: string) => ({ data: name === 'gridone_guest_rate_limit' ? true : { ...value, state: 'disabled' }, error: null }));
 const response = await onRequestPost(context()); expect(response.status).toBe(200); expect((await response.json()).url).toBeUndefined();
});
it('does not leak stale invite limits into a changed family scope', async () => {
 rpc.mockImplementation(async (name: string) => ({ data: name === 'gridone_guest_rate_limit' ? true : { ...value, state: 'scope_mismatch', maxSquares: 20 }, error: null }));
 const response = await onRequestPost(context()); expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({ state: 'scope_mismatch', cells: [0, 11, 22] });
 const result = await (await onRequestPost(context())).json(); expect(result.maxSquares).toBeUndefined(); expect(result.url).toBeUndefined();
});
it('rechecks capability authority in the transaction and hides database details', async () => {
 rpc.mockImplementation(async (name: string) => name === 'gridone_guest_rate_limit' ? { data: true } : { error: { message: 'family_access_denied secret SQL' } });
 const response = await onRequestPost(context()); expect(response.status).toBe(403); expect(await response.text()).not.toContain('SQL');
});
it('fails closed when throttled or the canonical response has the wrong board', async () => {
 rpc.mockResolvedValue({ data: false }); expect((await onRequestPost(context())).status).toBe(429);
 rpc.mockImplementation(async (name: string) => ({ data: name === 'gridone_guest_rate_limit' ? true : { ...value, boardId: 'wrong' } }));
 expect((await onRequestPost(context())).status).toBe(503);
});
it('keeps reads side-effect free and public URLs stable across requests', async () => {
 const first = await (await onRequestPost(context())).json();
 const second = await (await onRequestPost(context())).json();
 expect(first.url).toBe(second.url);
 expect(rpc.mock.calls.filter(call => call[0] === 'gridone_family_guest_link').every(call => call[1].p_action === 'read')).toBe(true);
 expect(eq.mock.calls[0][1]).not.toBe(token);
});
it('rejects malformed actions and missing signing configuration without database writes', async () => {
 expect((await onRequestPost(context({ action: { toString: null } }))).status).toBe(400);
 expect((await onRequestPost({ ...context(), env: { ...env, GUEST_INVITE_SECRET: '' } })).status).toBe(404);
 expect(rpc).not.toHaveBeenCalled();
});
it('does not treat a failed rate-limit service as permission to continue', async () => {
 rpc.mockResolvedValue({ data: null, error: { message: 'internal database failure' } });
 const response = await onRequestPost(context()); expect(response.status).toBe(503);
 expect(await response.text()).not.toContain('database'); expect(rpc).toHaveBeenCalledTimes(1);
});
