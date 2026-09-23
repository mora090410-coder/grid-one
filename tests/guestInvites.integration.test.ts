import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DATABASE_NAME = 'gridone_guest_invites_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-guest-invites-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-guests-${process.pid}-${randomUUID().slice(0, 8)}`;
const OWNER_ID = '40000000-0000-4000-8000-000000000001';
const STRANGER_ID = '40000000-0000-4000-8000-000000000002';
const ENTITLEMENT_ID = '40000000-0000-4000-8000-000000000010';
const SESSION_A = 'a'.repeat(64);
const SESSION_B = 'b'.repeat(64);
const CODE_A = 'c'.repeat(64);
const MANAGEMENT_A = 'd'.repeat(64);
let containerStarted = false;
let boardId: string;
let inviteId: string;

type CommandResult = { stdout: string; stderr: string };
const runCommand = (command: string, args: string[], input?: string, timeoutMs = 120_000) =>
  new Promise<CommandResult>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectCommand(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timeout); rejectCommand(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolveCommand({ stdout, stderr });
      else rejectCommand(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
const docker = (args: string[], input?: string, timeoutMs?: number) => runCommand('docker', args, input, timeoutMs);
const psqlArgs = (extra: string[]) => ['exec', '-e', `PGPASSWORD=${DATABASE_PASSWORD}`, '-i', containerName,
  'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', DATABASE_USER, '-d', DATABASE_NAME, ...extra];
const executeSql = async (sql: string) => { await docker(psqlArgs(['-q']), sql); };
const queryScalar = async (sql: string) => (await docker(psqlArgs(['-qAt', '-c', sql]))).stdout.trim();
const sqlText = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000); return; }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 250)); }
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
};
const bootstrap = async () => executeSql(`
  DO $roles$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $roles$;
  ALTER ROLE service_role BYPASSRLS;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email text);
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
    SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $f$;
  GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION auth.role() TO anon,authenticated,service_role;
`);
const applyMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory).filter(file => /^\d{3}_.+\.sql$/.test(file)).sort();
  expect(files.some(file => file.startsWith('029_'))).toBe(true);
  for (const file of files) await executeSql(readFileSync(resolve(directory, file), 'utf8'));
};
const revision = () => queryScalar(`SELECT revision FROM public.contests WHERE id='${boardId}'`);
const rpc = async (action: string, options: { owner?: string; invite?: string; guest?: string; payload?: unknown } = {}) => {
  const value = await queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_action(
    p_action=>${sqlText(action)},p_board_id=>'${boardId}',
    p_owner_id=>${options.owner ? `'${options.owner}'::uuid` : 'NULL'},
    p_invite_id=>${options.invite ? `'${options.invite}'::uuid` : 'NULL'},
    p_guest_hash=>${options.guest ? sqlText(options.guest) : 'NULL'},
    p_payload=>${sqlText(JSON.stringify(options.payload || {}))}::jsonb);`);
  return JSON.parse(value);
};
const createInvite = async (cells = [0, 1, 2], maxSquares = 2) => {
  const result = await rpc('owner_create', { owner: OWNER_ID, payload: {
    revision: Number(await revision()), label: 'Anthony', cells, maxSquares,
    expiresAt: null, offerAcknowledged: true,
    payment: { label: 'Arrange payment', detail: 'Contact Anthony after claiming.', url: 'https://example.test/pay' },
  } });
  inviteId = result.invites[0].id;
  return result;
};
const hold = (guest: string, cells: number[], invite = inviteId) => rpc('guest_hold', {
  invite, guest, payload: { credentialVersion: 1, cells },
});
const confirm = (guest = SESSION_A, cells = [0]) => rpc('guest_confirm', {
  invite: inviteId, guest, payload: {
    credentialVersion: 1, cells, name: 'Pat Guest', claimCodeHash: CODE_A, managementHash: MANAGEMENT_A,
  },
});

describe.sequential('guest invite transactions on disposable PostgreSQL', () => {
  beforeAll(async () => {
    await docker(['run', '--rm', '--detach', '--name', containerName, '--env', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DATABASE_NAME}`, POSTGRES_IMAGE, '-c', 'max_connections=150']);
    containerStarted = true;
    await waitForPostgres();
    await bootstrap();
    await applyMigrations();
    await executeSql(`INSERT INTO auth.users(id,email) VALUES('${OWNER_ID}','owner@example.test'),('${STRANGER_ID}','other@example.test');
      INSERT INTO public.season_entitlements(id,owner_id,season_year,status,tier,boards_allowance,price_cents,currency,organization_display_name)
      VALUES('${ENTITLEMENT_ID}','${OWNER_ID}',2026,'active','org',50,7900,'usd','Guest Test Org');`);
  }, 300_000);
  afterAll(async () => { if (containerStarted) await docker(['rm', '--force', containerName]).catch(() => undefined); }, 60_000);
  beforeEach(async () => {
    await executeSql('DELETE FROM public.contests;');
    boardId = randomUUID();
    inviteId = '';
    const board = {
      leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false,
      squares: Array.from({ length: 100 }, (_, index) => index === 0 ? ['Anthony'] : []),
      allocationLabels: Array.from({ length: 100 }, (_, index) => index < 3 ? 'Anthony' : null),
      availability: Array(100).fill('available'),
    };
    await executeSql(`INSERT INTO public.contests(id,owner_id,share_code,title,season_year,game_external_id,game_starts_at,board_data)
      VALUES('${boardId}','${OWNER_ID}','ABCDEFGH','Guest board',2026,'401772999','2099-09-13T17:00:00Z',${sqlText(JSON.stringify(board))}::jsonb);
      INSERT INTO public.board_activations(entitlement_id,contest_id) VALUES('${ENTITLEMENT_ID}','${boardId}');
      UPDATE public.contests SET shared_at=clock_timestamp() WHERE id='${boardId}';`);
  });

  it('keeps tables and RPC private while requiring explicit reviewed available cells', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(queryScalar(`SET ROLE ${role}; SELECT count(*) FROM public.guest_invites;`)).rejects.toThrow(/permission denied/);
      await expect(queryScalar(`SET ROLE ${role}; SELECT public.gridone_guest_action('public_state','${boardId}');`)).rejects.toThrow(/permission denied/);
    }
    await expect(rpc('owner_create', { owner: OWNER_ID, payload: {
      revision: Number(await revision()), label: 'Anthony', cells: [0], maxSquares: 1,
      offerAcknowledged: false,
    } })).rejects.toThrow(/guest_invalid_request/);
    const result = await createInvite();
    expect(result.invites[0]).toMatchObject({ label: 'Anthony', cells: [0, 1, 2], maxSquares: 2, version: 1 });
    expect(JSON.stringify(result)).toContain('Contact Anthony');
    await executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{allocationLabels,2}','"Other"') WHERE id='${boardId}'`);
    expect(await queryScalar(`SELECT (disabled_at IS NOT NULL)::text FROM public.guest_invites WHERE id='${inviteId}'`)).toBe('true');
    expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${boardId}' AND event_type='guest.invite_scope_revoked'`)).toBe('1');
  });

  it('serializes overlapping holds, reclaims expiry, and enforces cumulative limits', async () => {
    await createInvite([0, 1], 1);
    const outcomes = await Promise.allSettled([hold(SESSION_A, [0]), hold(SESSION_B, [0])]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_holds WHERE contest_id='${boardId}' AND cell_index=0`)).toBe('1');
    const ownerState = await rpc('owner_list', { owner: OWNER_ID });
    expect(ownerState.holds).toEqual([expect.objectContaining({ index: 0, inviteId })]);
    const publicState = await rpc('public_state');
    expect(publicState.holds).toHaveLength(1);
    expect(publicState.holds[0]).not.toHaveProperty('inviteId');
    await executeSql(`UPDATE public.guest_square_holds SET expires_at=now()-interval '1 second' WHERE contest_id='${boardId}'`);
    expect((await rpc('public_state')).holds).toEqual([]);
    const recovered = await hold(SESSION_B, [0]);
    expect(recovered.heldCells).toEqual([0]);
    const deadline = await queryScalar(`SELECT expires_at FROM public.guest_square_holds WHERE contest_id='${boardId}' AND cell_index=0`);
    await hold(SESSION_B, [0]);
    expect(await queryScalar(`SELECT expires_at FROM public.guest_square_holds WHERE contest_id='${boardId}' AND cell_index=0`)).toBe(deadline);
    await expect(hold(SESSION_B, [0, 1])).rejects.toThrow(/guest_limit_exceeded/);
    const released = await hold(SESSION_B, []);
    expect(released.heldCells).toEqual([]);
    const afterReleaseRevision = await revision();
    const noOpRelease = await hold(SESSION_B, []);
    expect(noOpRelease.heldCells).toEqual([]);
    expect(await revision()).toBe(afterReleaseRevision);
  });

  it('moves a 100-contender collision to the temporary hold and confirms only the winner', async () => {
    await createInvite([0], 1);
    const contenders = Array.from({ length: 100 }, (_, index) => index.toString(16).padStart(64, '0'));
    const outcomes = await Promise.allSettled(contenders.map(contender => hold(contender, [0])));
    const winners = outcomes.flatMap((outcome, index) => outcome.status === 'fulfilled' ? [index] : []);
    const conflicts = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(conflicts).toHaveLength(99);
    for (const conflict of conflicts) expect(String(conflict.reason)).toMatch(/guest_hold_conflict/);
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_holds WHERE contest_id='${boardId}' AND cell_index=0`)).toBe('1');

    const winner = contenders[winners[0]];
    const claimed = await confirm(winner, [0]);
    expect(claimed).toMatchObject({ cells: [0], displayName: 'Pat Guest' });
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_claims WHERE contest_id='${boardId}' AND cell_index=0 AND released_at IS NULL`)).toBe('1');
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_holds WHERE contest_id='${boardId}' AND cell_index=0`)).toBe('0');
  });

  it('confirms atomically and idempotently without leaking code, session, or payment publicly', async () => {
    await createInvite();
    await hold(SESSION_A, [1, 0]);
    const first = await confirm(SESSION_A, [0, 1]);
    const retry = await confirm(SESSION_A, [1, 0]);
    expect(retry).toEqual(first);
    expect(first).toMatchObject({ displayName: 'Pat Guest', cells: [0, 1], canManage: true });
    expect(first.payment).toMatchObject({ label: 'Arrange payment' });
    expect(await queryScalar(`SELECT (board_data#>>'{squares,0,0}')||':'||(board_data#>>'{availability,0}') FROM public.contests WHERE id='${boardId}'`)).toBe('Pat Guest:unavailable');
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_claims WHERE contest_id='${boardId}' AND released_at IS NULL`)).toBe('2');
    const publicState = await rpc('public_state');
    expect(publicState.claimedCells).toEqual([0, 1]);
    expect(JSON.stringify(publicState)).not.toMatch(/Contact Anthony|https:\/\/|aaaa|cccc|dddd/i);
    const recovered = await rpc('guest_read', { invite: inviteId, guest: CODE_A,
      payload: { credentialKind: 'code', credentialVersion: 1 } });
    expect(recovered.mine).toMatchObject({ displayName: 'Pat Guest', cells: [0, 1] });
  });

  it('blocks owner and family-style overwrites and allocation reassignment of holds or claims', async () => {
    await createInvite();
    await hold(SESSION_A, [0]);
    await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{squares,0}','["Owner overwrite"]') WHERE id='${boardId}'`)).rejects.toThrow(/guest_square_conflict/);
    await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{allocationLabels,0}','"Other"') WHERE id='${boardId}'`)).rejects.toThrow(/guest_square_conflict/);
    await confirm();
    await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{squares,0}','["Family overwrite"]') WHERE id='${boardId}'`)).rejects.toThrow(/guest_square_conflict/);
    await expect(executeSql(`UPDATE public.contests SET owner_id='${STRANGER_ID}' WHERE id='${boardId}'`)).rejects.toThrow(/guest_square_conflict/);
  });

  it('preserves claims across rotation/disable, releases holds, and keeps private receipts readable', async () => {
    await createInvite();
    await hold(SESSION_A, [0]);
    await confirm();
    await hold(SESSION_B, [1]);
    const rotated = await rpc('owner_rotate', { owner: OWNER_ID, invite: inviteId, payload: { revision: Number(await revision()) } });
    expect(rotated.invites[0].version).toBe(2);
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_holds WHERE contest_id='${boardId}'`)).toBe('0');
    expect(await queryScalar(`SELECT count(*) FROM public.guest_square_claims WHERE contest_id='${boardId}' AND released_at IS NULL`)).toBe('1');
    const receipt = await rpc('guest_receipt', { guest: CODE_A, payload: { credentialKind: 'code' } });
    expect(receipt).toMatchObject({ displayName: 'Pat Guest', canManage: true });
    const sessionReceipt = await rpc('guest_receipt', { guest: SESSION_A, payload: { credentialKind: 'session' } });
    expect(sessionReceipt).toMatchObject({ groupId: receipt.groupId, displayName: 'Pat Guest' });
    const newCode = 'f'.repeat(64);
    await rpc('owner_rotate_code', { owner: OWNER_ID, payload: {
      revision: Number(await revision()), groupId: receipt.groupId, claimCodeHash: newCode,
    } });
    await expect(rpc('guest_receipt', { guest: CODE_A, payload: { credentialKind: 'code' } })).rejects.toThrow(/guest_access_denied/);
    await expect(rpc('guest_receipt', { guest: SESSION_A, payload: { credentialKind: 'session' } })).rejects.toThrow(/guest_access_denied/);
    expect(await rpc('guest_receipt', { guest: newCode, payload: { credentialKind: 'code' } })).toMatchObject({ groupId: receipt.groupId });
    await rpc('owner_disable', { owner: OWNER_ID, invite: inviteId, payload: { revision: Number(await revision()) } });
    const disabledReceipt = await rpc('guest_receipt', { guest: newCode, payload: { credentialKind: 'code' } });
    expect(disabledReceipt).toMatchObject({ displayName: 'Pat Guest', canManage: false,
      payment: { label: 'Arrange payment' } });
    const reactivated = await rpc('owner_rotate', { owner: OWNER_ID, invite: inviteId,
      payload: { revision: Number(await revision()) } });
    expect(reactivated.invites[0]).toMatchObject({ version: 3, disabledAt: null });
  });

  it('makes swap all-or-nothing and allows an explicit release to free the square', async () => {
    await createInvite([0, 1, 2], 2);
    await hold(SESSION_A, [0]);
    await confirm();
    await expect(rpc('guest_swap', { invite: inviteId, guest: MANAGEMENT_A, payload: {
      credentialKind: 'session', credentialVersion: 1, cells: [99],
    } })).rejects.toThrow(/guest_invalid_request/);
    expect(await queryScalar(`SELECT cell_index FROM public.guest_square_claims WHERE contest_id='${boardId}' AND released_at IS NULL`)).toBe('0');
    await hold(SESSION_B, [1]);
    await expect(rpc('guest_swap', { invite: inviteId, guest: MANAGEMENT_A, payload: {
      credentialKind: 'session', credentialVersion: 1, cells: [1],
    } })).rejects.toThrow(/guest_square_conflict/);
    expect(await queryScalar(`SELECT cell_index FROM public.guest_square_claims WHERE contest_id='${boardId}' AND released_at IS NULL`)).toBe('0');
    const released = await rpc('guest_release', { guest: SESSION_A, payload: {
      credentialKind: 'session',
    } });
    expect(released.cells).toEqual([]);
    expect(await queryScalar(`SELECT board_data->'squares'->0 FROM public.contests WHERE id='${boardId}'`)).toBe('[]');
    const retry = await rpc('guest_release', { guest: SESSION_A, payload: {
      credentialKind: 'session',
    } });
    expect(retry.cells).toEqual([]);
  });

  it('keeps self-released groups manageable but permanently revokes an organizer-released group', async () => {
    await createInvite([0, 1, 2], 2);
    await hold(SESSION_A, [0]);
    const confirmed = await confirm();
    await rpc('guest_release', { guest: SESSION_A, payload: { credentialKind: 'session' } });
    const repicked = await rpc('guest_swap', { guest: SESSION_A, payload: {
      credentialKind: 'session', cells: [1],
    } });
    expect(repicked).toMatchObject({ groupId: confirmed.groupId, cells: [1], canManage: true });

    const ownerResult = await rpc('owner_release_claim', { owner: OWNER_ID, payload: {
      revision: Number(await revision()), groupId: confirmed.groupId,
    } });
    expect(ownerResult.claims.find((claim: { groupId: string }) => claim.groupId === confirmed.groupId))
      .toMatchObject({ cells: [], canManage: false });
    expect(await rpc('guest_receipt', { guest: SESSION_A, payload: { credentialKind: 'session' } }))
      .toMatchObject({ groupId: confirmed.groupId, cells: [], canManage: false });
    await expect(rpc('guest_swap', { guest: SESSION_A, payload: {
      credentialKind: 'session', cells: [2],
    } })).rejects.toThrow(/guest_access_denied/);

    const rotatedCode = 'f'.repeat(64);
    const rotated = await rpc('owner_rotate_code', { owner: OWNER_ID, payload: {
      revision: Number(await revision()), groupId: confirmed.groupId, claimCodeHash: rotatedCode,
    } });
    expect(rotated.claims.find((claim: { groupId: string }) => claim.groupId === confirmed.groupId))
      .toMatchObject({ cells: [], canManage: false });
    expect(await rpc('guest_receipt', { guest: rotatedCode, payload: { credentialKind: 'code' } }))
      .toMatchObject({ groupId: confirmed.groupId, cells: [], canManage: false });
    await expect(rpc('guest_swap', { guest: rotatedCode, payload: {
      credentialKind: 'code', cells: [2],
    } })).rejects.toThrow(/guest_access_denied/);
  });

  it('rejects publication with active holds and validates guest-board snapshots against canonical names', async () => {
    await createInvite();
    await hold(SESSION_A, [0]);
    await expect(executeSql(`UPDATE public.contests SET published_at=now(),status='published' WHERE id='${boardId}'`)).rejects.toThrow(/guest_holds_active/);
    await rpc('owner_cancel_holds', { owner: OWNER_ID, payload: { revision: Number(await revision()) } });
    await executeSql(`UPDATE public.contests SET side_axis=ARRAY[0,1,2,3,4,5,6,7,8,9],top_axis=ARRAY[9,8,7,6,5,4,3,2,1,0],axis_locked_at=now(),published_at=now(),status='published' WHERE id='${boardId}'`);
    await expect(executeSql(`INSERT INTO public.public_board_snapshots(contest_id,share_code,revision,board_title,matchup,board,published_at)
      SELECT id,share_code,revision,title,'{}','{"squares":[["wrong"]]}',published_at FROM public.contests WHERE id='${boardId}'`)).rejects.toThrow(/guest_snapshot_conflict/);
    await executeSql(`INSERT INTO public.public_board_snapshots(contest_id,share_code,revision,board_title,matchup,board,published_at)
      SELECT id,share_code,revision,title,'{}',board_data || jsonb_build_object('leftAxis',to_jsonb(side_axis),'topAxis',to_jsonb(top_axis)),published_at FROM public.contests WHERE id='${boardId}';
      SELECT set_config('request.jwt.claim.sub','${OWNER_ID}',false); SET ROLE authenticated;
      SELECT public.gridone_rename_published_square('${boardId}',0,'Audited buyer');`);
    expect(await queryScalar(`SELECT board#>>'{squares,0,0}' FROM public.public_board_snapshots WHERE contest_id='${boardId}'`)).toBe('Audited buyer');
  });

  it('uses persistent bounded rate buckets without retaining raw request identifiers', async () => {
    expect(await queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_rate_limit('${'e'.repeat(64)}',2,60);`)).toBe('t');
    expect(await queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_rate_limit('${'e'.repeat(64)}',2,60);`)).toBe('t');
    expect(await queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_rate_limit('${'e'.repeat(64)}',2,60);`)).toBe('f');
    await expect(queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_rate_limit('raw-ip',2,60);`)).rejects.toThrow(/guest_invalid_request/);
  });
});
