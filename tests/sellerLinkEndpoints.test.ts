import { beforeEach, expect, it, vi } from 'vitest';
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc, auth: { getUser } }) }));
import { onRequestGet as readSeller, onRequestPost as claimSeller } from '../functions/api/sellers/[code]';
import { onRequestPost as ownerLinks } from '../functions/api/pools/[id]/seller-links';

const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server' };
const id = '30000000-0000-4000-8000-000000000001';
const code = '0123456789abcdef';
const post = (url: string, body: unknown, bearer?: string) => new Request(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
});

it('reads a seller link without an account and passes only the code', async () => {
  rpc.mockResolvedValue({ data: { title: 'Lincoln', label: 'Mora', open: true, shareCode: 'ABCDEFGH', cells: [{ index: 0, available: true }] }, error: null });
  const response = await readSeller({ request: new Request(`https://getgridone.com/api/sellers/${code}`), env, params: { code } });
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('gridone_seller_link', { p_action: 'read', p_code: code });
  expect((await response.json()).label).toBe('Mora');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('rejects malformed codes and claims before touching the database', async () => {
  expect((await readSeller({ request: new Request('https://getgridone.com/api/sellers/nope'), env, params: { code: 'nope' } })).status).toBe(404);
  for (const body of [
    { cells: [], name: 'Ann' },
    { cells: [1, 1], name: 'Ann' },
    { cells: [100], name: 'Ann' },
    { cells: Array.from({ length: 11 }, (_, i) => i), name: 'Ann' },
    { cells: [1], name: '' },
    { cells: [1], name: 'x'.repeat(81) },
    { cells: [1], name: 'Ann', paid: true },
  ]) {
    const response = await claimSeller({ request: post(`https://getgridone.com/api/sellers/${code}`, body), env, params: { code } });
    expect(response.status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

it('claims with a trimmed name and maps a lost race to a clear conflict', async () => {
  rpc.mockResolvedValueOnce({ data: { cells: [3], name: 'Ann', label: 'Mora', shareCode: 'ABCDEFGH' }, error: null });
  const ok = await claimSeller({ request: post(`https://getgridone.com/api/sellers/${code}`, { cells: [3], name: '  Ann  ' }), env, params: { code } });
  expect(ok.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('gridone_seller_link', { p_action: 'claim', p_code: code, p_cells: [3], p_name: 'Ann' });

  rpc.mockResolvedValueOnce({ data: null, error: { message: 'seller_square_taken' } });
  const taken = await claimSeller({ request: post(`https://getgridone.com/api/sellers/${code}`, { cells: [3], name: 'Bob' }), env, params: { code } });
  expect(taken.status).toBe(409);
  expect((await taken.json()).code).toBe('SQUARE_TAKEN');

  rpc.mockResolvedValueOnce({ data: null, error: { message: 'seller_board_locked' } });
  const locked = await claimSeller({ request: post(`https://getgridone.com/api/sellers/${code}`, { cells: [4], name: 'Bob' }), env, params: { code } });
  expect(locked.status).toBe(409);
  expect((await locked.json()).code).toBe('BOARD_LOCKED');

  rpc.mockResolvedValueOnce({ data: null, error: { message: 'seller_access_denied' } });
  expect((await readSeller({ request: new Request(`https://getgridone.com/api/sellers/${code}`), env, params: { code } })).status).toBe(404);
});

it('requires a signed-in owner and returns full links for every seller', async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await ownerLinks({ request: post('https://getgridone.com/api/pools/x/seller-links', { action: 'sync' }, 'jwt'), env, params: { id } })).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();

  rpc.mockResolvedValue({ data: { links: [{ label: 'Mora', code }] }, error: null });
  const response = await ownerLinks({ request: post('https://getgridone.com/api/pools/x/seller-links', { action: 'sync' }, 'jwt'), env, params: { id } });
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('gridone_seller_link', { p_action: 'sync', p_contest_id: id, p_owner_id: id });
  expect(await response.json()).toEqual({ links: [{ label: 'Mora', code, url: `https://getgridone.com/s/${code}` }] });
});

it('rotates one seller link and explains an unshared board', async () => {
  rpc.mockResolvedValueOnce({ data: { links: [{ label: 'Mora', code }] }, error: null });
  const rotated = await ownerLinks({ request: post('https://getgridone.com/api/pools/x/seller-links', { action: 'rotate', label: 'Mora' }, 'jwt'), env, params: { id } });
  expect(rotated.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('gridone_seller_link', { p_action: 'rotate', p_contest_id: id, p_owner_id: id, p_label: 'Mora' });

  rpc.mockResolvedValueOnce({ data: null, error: { message: 'seller_board_not_shared' } });
  const unshared = await ownerLinks({ request: post('https://getgridone.com/api/pools/x/seller-links', { action: 'sync' }, 'jwt'), env, params: { id } });
  expect(unshared.status).toBe(409);
  expect((await unshared.json()).code).toBe('NOT_SHARED');

  for (const body of [{ action: 'claim' }, { action: 'rotate' }, { action: 'sync', extra: 1 }]) {
    expect((await ownerLinks({ request: post('https://getgridone.com/api/pools/x/seller-links', body, 'jwt'), env, params: { id } })).status).toBe(400);
  }
});
