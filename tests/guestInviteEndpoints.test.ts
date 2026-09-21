import { webcrypto } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, auth: { getUser } }) }));
import { onRequestPost as guest } from '../functions/api/pools/[id]/guest';
import { onRequestGet as list, onRequestPost as owner } from '../functions/api/pools/[id]/invites';
import { onRequestGet as publicState } from '../functions/api/pools/[id]/guest-state';
import { signInvite, claimCodeFor, hashGuestCredential } from '../functions/_lib/guestInviteCredentials';

const id = '30000000-0000-4000-8000-000000000001';
const inviteId = '30000000-0000-4000-8000-000000000002';
const groupId = '30000000-0000-4000-8000-000000000003';
const session = 'a'.repeat(64);
const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server', GUEST_INVITE_SECRET: 'test-only-secret-with-at-least-32-bytes', GUEST_INVITE_POOL_IDS: id, PUBLIC_SITE_URL: 'https://getgridone.com' };
const receipt = { groupId, inviteId, displayName: 'Sam', cells: [0], claimedAt: '2026-09-20T12:00:00Z', canManage: true, payment: { label: 'Arrange payment', detail: 'Contact Anthony' } };
const summary = { revision: 5, invites: [{ id: inviteId, label: 'Anthony', cells: [0, 1], maxSquares: 1, version: 1, expiresAt: null, disabledAt: null, payment: null, counts: { available: 1, held: 0, claimed: 1 } }], claims: [receipt], holds: [] };
const snapshot = { boardId: id, title: 'Team board', shareCode: 'ABCDEFGH', revision: 5, serverTime: '2026-09-20T12:00:00Z', stage: 'selling', squares: Array.from({length:100}, () => []), allocationLabels: Array(100).fill(null), availability: Array(100).fill('available'), holds: [], claimedCells: [], invite: summary.invites[0] };
const context = (body?: unknown, changes: Partial<typeof env> = {}) => ({ request: new Request(`https://getgridone.com/api/pools/${id}/guest`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer organizer', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.5' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env: { ...env, ...changes }, params: { id } });
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto); vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  rpc.mockImplementation(async (name, args) => ({ data: name === 'gridone_guest_rate_limit' ? true : args.p_action.startsWith('owner_') ? summary : args.p_action === 'guest_confirm' || args.p_action === 'guest_receipt' ? receipt : snapshot, error: null }));
});
it('fails closed without rollout allowlist or signing secret', async () => {
  for (const changes of [{ GUEST_INVITE_POOL_IDS: '' }, { GUEST_INVITE_POOL_IDS: inviteId }, { GUEST_INVITE_SECRET: '' }]) {
    expect((await guest(context({ action: 'read' }, changes))).status).toBe(404);
    expect((await list(context(undefined, changes))).status).toBe(404);
    expect((await publicState(context(undefined, changes))).status).toBe(404);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it('requires verified organizer identity rather than trusting a bearer string', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await owner(context({ action: 'disable', inviteId, revision: 5 }))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it('returns stable copy URLs without exposing stored credential hashes', async () => {
  const one = await (await list(context())).json();
  const two = await (await list(context())).json();
  expect(one.invites[0].url).toBe(two.invites[0].url);
  expect(one.invites[0].url).toMatch(new RegExp(`/p/${id}\\?invite=`));
  expect(JSON.stringify(one)).not.toContain('session_hash');
});
it('rejects invalid scope, missing review, extra fields and unsafe external URLs', async () => {
  const valid = { action: 'create', revision: 5, label: 'Anthony', cells: [0], maxSquares: 1, expiresAt: null, offerAcknowledged: true };
  for (const change of [{ cells: [100] }, { cells: [0,0] }, { offerAcknowledged: false }, { paid_status: 'paid' }, { payment: { label: 'Pay', detail: 'Details', url: 'javascript:alert(1)' } }]) {
    expect((await owner(context({ ...valid, ...change }))).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects tampered invite tokens before accessing guest state', async () => {
  expect((await guest(context({ action: 'read', inviteToken: 'bad', guestToken: session }))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it('hashes capabilities, rechecks version through RPC and recovers the same confirmation code', async () => {
  const inviteToken = await signInvite(env.GUEST_INVITE_SECRET, id, inviteId, 3);
  const response = await guest(context({ action: 'confirm', inviteToken, guestToken: session, cells: [0], name: 'Sam' }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.claimCode).toBe(await claimCodeFor(env.GUEST_INVITE_SECRET, id, inviteId, session));
  const call = rpc.mock.calls.find(([,args]) => args.p_action === 'guest_confirm')![1];
  expect(call.p_guest_hash).toBe(await hashGuestCredential(session));
  expect(call.p_payload.credentialVersion).toBe(3);
  expect(call.p_payload.claimCodeHash).toBe(await hashGuestCredential(result.claimCode));
  expect(JSON.stringify(call)).not.toContain(session);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('accepts a claim code for a private receipt without a still-active invite URL', async () => {
  const result = await guest(context({ action: 'receipt', claimCode: 'tiger-lamp-orbit-seven' }));
  expect(result.status).toBe(200);
  const call = rpc.mock.calls.find(([,args]) => args.p_action === 'guest_receipt')![1];
  expect(call.p_payload.credentialKind).toBe('code');
  expect(call.p_invite_id).toBeNull();
});
it('rate limits credential guessing without invoking the claim lookup', async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect((await guest(context({ action: 'receipt', claimCode: 'tiger-lamp-orbit-seven' }))).status).toBe(429);
  expect(rpc.mock.calls.some(([,args]) => args.p_action === 'guest_receipt')).toBe(false);
});
it('never exposes payment instructions or private columns in public snapshots', async () => {
  rpc.mockImplementation(async name => ({ data: name === 'gridone_guest_rate_limit' ? true : { ...snapshot, payment: receipt.payment, claim_code_hash: 'secret', mine: receipt }, error: null }));
  const result = await (await publicState(context())).json();
  expect(JSON.stringify(result)).not.toContain('Contact Anthony');
  expect(result).not.toHaveProperty('mine');
  expect(result).not.toHaveProperty('invite');
  expect(result).not.toHaveProperty('claim_code_hash');
});
it('maps expected contention without leaking SQL errors or retrying a mutation', async () => {
  rpc.mockImplementation(async name => name === 'gridone_guest_rate_limit' ? { data: true, error: null } : { data: null, error: { message: 'guest_square_conflict: internal sensitive detail' } });
  const inviteToken = await signInvite(env.GUEST_INVITE_SECRET, id, inviteId, 1);
  const result = await guest(context({ action: 'hold', inviteToken, guestToken: session, cells: [0] }));
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ code: 'SQUARE_CONFLICT', error: 'Someone just grabbed that one — pick another.' });
  expect(rpc.mock.calls.filter(([,args]) => args.p_action === 'guest_hold')).toHaveLength(1);
});

it('applies separate bounded IP and invite mutation limits before taking a hold', async () => {
  const inviteToken = await signInvite(env.GUEST_INVITE_SECRET, id, inviteId, 1);
  rpc.mockImplementation(async (name, args) => name === 'gridone_guest_rate_limit' ? {data: args.p_limit !== 300, error:null} : {data:snapshot,error:null});
  expect((await guest(context({action:'hold',inviteToken,guestToken:session,cells:[0]}))).status).toBe(429);
  expect(rpc.mock.calls.some(([,args])=>args.p_limit===30)).toBe(true);
  expect(rpc.mock.calls.some(([,args])=>args.p_action==='guest_hold')).toBe(false);
});
it('rejects oversized JSON, two guest credentials, missing confirmation selection and cross-board tokens', async () => {
  const inviteToken = await signInvite(env.GUEST_INVITE_SECRET, id, inviteId, 1);
  for (const body of [
    {action:'confirm',inviteToken,guestToken:session,name:'Sam'},
    {action:'receipt',guestToken:session,claimCode:'tiger-lamp-orbit-seven'},
    {action:'hold',inviteToken,guestToken:session,cells:[0],padding:'x'.repeat(25_000)},
  ]) expect((await guest(context(body))).status).toBe(400);
  const crossBoard = await signInvite(env.GUEST_INVITE_SECRET, inviteId, inviteId, 1);
  expect((await guest(context({action:'read',inviteToken:crossBoard}))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

it('includes source invite identity only in authenticated owner hold summaries', async () => {
  rpc.mockImplementation(async (name, args) => ({ data: name === 'gridone_guest_rate_limit' ? true : args.p_action === 'owner_list'
    ? {...summary,holds:[{index:0,expiresAt:'2026-09-20T12:01:30Z',inviteId,session_hash:'secret'}]}
    : {...snapshot,holds:[{index:0,expiresAt:'2026-09-20T12:01:30Z',inviteId,session_hash:'secret',mine:true}]}, error:null }));
  const ownerResult=await (await list(context())).json();
  expect(ownerResult.holds[0]).toEqual({index:0,expiresAt:'2026-09-20T12:01:30Z',inviteId});
  const publicResult=await (await publicState(context())).json();
  expect(publicResult.holds[0]).toEqual({index:0,expiresAt:'2026-09-20T12:01:30Z'});
});
