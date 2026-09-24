import { beforeEach, expect, it, vi } from 'vitest';
const { insert, from, createClient } = vi.hoisted(() => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));
  return { insert, from, createClient: vi.fn(() => ({ from })) };
});
vi.mock('@supabase/supabase-js', () => ({ createClient }));
import { onRequestPost } from '../functions/api/events';

const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'server' };
const post = (body: string) => new Request('https://getgridone.com/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  body,
});

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

it('stores a valid event as its name plus the validated payload and answers 204', async () => {
  const response = await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_resolved', matchBucket: 'one' })), env });
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(from).toHaveBeenCalledWith('client_events');
  expect(insert).toHaveBeenCalledWith({ name: 'find_my_squares_resolved', payload: { matchBucket: 'one' } });
});

it('rejects unknown events, bad values and unknown fields with 400 without touching the database', async () => {
  for (const body of [
    { name: 'square_owner_name_entered' },
    { name: 'find_my_squares_resolved', matchBucket: 'three' },
    { name: 'find_my_squares_resolved', matchBucket: 'one', boardId: 'abc' },
    { name: 'homepage_primary_action', action: 'create_board' },
  ]) {
    expect((await onRequestPost({ request: post(JSON.stringify(body)), env })).status).toBe(400);
  }
  for (const raw of ['not json', '[]', '"text"', '']) {
    expect((await onRequestPost({ request: post(raw), env })).status).toBe(400);
  }
  expect(insert).not.toHaveBeenCalled();
});

it('rejects prohibited personal fields with 400', async () => {
  for (const field of ['email', 'nameLabel', 'url', 'errorMessage']) {
    const response = await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_opened', surface: 'viewer', [field]: 'x' })), env });
    expect(response.status).toBe(400);
  }
  expect(insert).not.toHaveBeenCalled();
});

it('rejects bodies over 2 KB with 413', async () => {
  const response = await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_opened', surface: 'viewer', pad: 'x'.repeat(4096) })), env });
  expect(response.status).toBe(413);
  expect(insert).not.toHaveBeenCalled();
});

it('answers 503 when the service key is missing, without building a client', async () => {
  const response = await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_opened', surface: 'viewer' })), env: { ...env, SUPABASE_SERVICE_ROLE_KEY: '' } });
  expect(response.status).toBe(503);
  expect(createClient).not.toHaveBeenCalled();
});

it('masks database failures as 503', async () => {
  insert.mockResolvedValueOnce({ error: { message: 'relation "client_events" does not exist' } });
  const failed = await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_opened', surface: 'viewer' })), env });
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain('client_events');

  insert.mockRejectedValueOnce(new Error('network down'));
  expect((await onRequestPost({ request: post(JSON.stringify({ name: 'find_my_squares_opened', surface: 'viewer' })), env })).status).toBe(503);
});
