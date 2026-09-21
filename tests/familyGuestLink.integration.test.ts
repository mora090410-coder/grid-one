import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DATABASE_NAME = 'gridone_family_guest_link_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-family-guest-link-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-family-guest-link-${process.pid}-${randomUUID().slice(0, 8)}`;
const OWNER_ID = '50000000-0000-4000-8000-000000000001';
const ENTITLEMENT_ID = '50000000-0000-4000-8000-000000000010';
const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);
let containerStarted = false;
let boardId: string;

type CommandResult = { stdout: string; stderr: string };
const runCommand = (command: string, args: string[], input?: string, timeoutMs = 120_000) =>
  new Promise<CommandResult>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); rejectCommand(new Error(`${command} timed out`)); }, timeoutMs);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timeout); rejectCommand(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolveCommand({ stdout, stderr });
      else rejectCommand(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
const docker = (args: string[], input?: string, timeoutMs?: number) => runCommand('docker', args, input, timeoutMs);
const psqlArgs = (extra: string[]) => ['exec','-e',`PGPASSWORD=${DATABASE_PASSWORD}`,'-i',containerName,
  'psql','-X','-v','ON_ERROR_STOP=1','-U',DATABASE_USER,'-d',DATABASE_NAME,...extra];
const executeSql = async (sql: string) => { await docker(psqlArgs(['-q']), sql); };
const queryScalar = async (sql: string) => (await docker(psqlArgs(['-qAt','-c',sql]))).stdout.trim();
const sqlText = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { await docker(psqlArgs(['-qAt','-c','SELECT 1']), undefined, 5_000); return; }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 250)); }
  }
  throw new Error('Disposable PostgreSQL did not become ready.');
};
const bootstrap = () => executeSql(`
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
  const directory = resolve(process.cwd(),'supabase/migrations');
  const files = readdirSync(directory).filter(file => /^\d{3}_.+\.sql$/.test(file)).sort();
  expect(files.some(file => file.startsWith('030_'))).toBe(true);
  for (const file of files) await executeSql(readFileSync(resolve(directory,file),'utf8'));
};
const boardDocument = (cells: number[], unavailable: number[] = []) => ({
  leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false,
  squares: Array.from({ length: 100 }, (_, index) => cells.includes(index) ? [`Holder ${index + 1}`] : []),
  allocationLabels: Array.from({ length: 100 }, (_, index) => cells.includes(index) ? 'Mora' : null),
  availability: Array.from({ length: 100 }, (_, index) => unavailable.includes(index) ? 'unavailable' : 'available'),
});
const seed = async (cells = [0, 17, 99], token = TOKEN_A, shared = true, unavailable = [17]) => {
  boardId = randomUUID();
  const board = boardDocument(cells, unavailable);
  await executeSql(`INSERT INTO public.contests(id,owner_id,share_code,title,season_year,game_external_id,game_starts_at,board_data)
    VALUES('${boardId}','${OWNER_ID}','ABCDEFGH','Family board',2026,'401772999','2099-09-13T17:00:00Z',${sqlText(JSON.stringify(board))}::jsonb);
    INSERT INTO public.board_activations(entitlement_id,contest_id) VALUES('${ENTITLEMENT_ID}','${boardId}');
    ${shared ? `UPDATE public.contests SET shared_at=clock_timestamp() WHERE id='${boardId}';` : ''}
    INSERT INTO public.family_board_access(contest_id,label,token_hash,cells,expires_at)
    VALUES('${boardId}','Mora','${token}',ARRAY[${cells.join(',')}],clock_timestamp()+interval '7 days');`);
  return board;
};
const rpc = async (action = 'read', token = TOKEN_A, id = boardId) => JSON.parse(await queryScalar(
  `SET ROLE service_role; SELECT public.gridone_family_guest_link('${id}','${token}','${action}');`,
));

describe.sequential('family capability to guest link bridge', () => {
  beforeAll(async () => {
    await docker(['run','--rm','--detach','--name',containerName,'--env',`POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env',`POSTGRES_DB=${DATABASE_NAME}`,POSTGRES_IMAGE]);
    containerStarted = true;
    await waitForPostgres(); await bootstrap(); await applyMigrations();
    await executeSql(`INSERT INTO auth.users(id,email) VALUES('${OWNER_ID}','owner@example.test');
      INSERT INTO public.season_entitlements(id,owner_id,season_year,status,tier,boards_allowance,price_cents,currency,organization_display_name)
      VALUES('${ENTITLEMENT_ID}','${OWNER_ID}',2026,'active','org',50,7900,'usd','Family guest test');`);
  }, 300_000);
  afterAll(async () => { if (containerStarted) await docker(['rm','--force',containerName]).catch(() => undefined); }, 60_000);
  beforeEach(async () => { await executeSql('DELETE FROM public.contests;'); boardId = ''; });

  it('reads without creating, then creates an exact scattered scope without changing board content', async () => {
    const original = await seed([0,17,99],TOKEN_A,true,[17]);
    const beforeRevision = await queryScalar(`SELECT revision FROM public.contests WHERE id='${boardId}'`);
    expect(await rpc()).toMatchObject({ boardId, label: 'Mora', cells: [0,17,99], revision: Number(beforeRevision),
      state: 'not_created', availableCount: 2 });
    expect(await queryScalar(`SELECT count(*) FROM public.guest_invites WHERE contest_id='${boardId}'`)).toBe('0');

    const created = await rpc('create');
    expect(created).toMatchObject({ boardId, label: 'Mora', cells: [0,17,99], state: 'active',
      availableCount: 2, version: 1, maxSquares: 1 });
    expect(created.revision).toBe(Number(beforeRevision)+1);
    expect(JSON.parse(await queryScalar(`SELECT board_data FROM public.contests WHERE id='${boardId}'`))).toEqual(original);
    expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${boardId}' AND actor_id IS NULL AND event_type='family.guest_link_created'`)).toBe('1');
    await expect(queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_action(
      'guest_hold','${boardId}',NULL,'${created.inviteId}','${'c'.repeat(64)}',
      '{"credentialVersion":1,"cells":[17]}'::jsonb);`)).rejects.toThrow(/guest_access_denied/);
    const held = JSON.parse(await queryScalar(`SET ROLE service_role; SELECT public.gridone_guest_action(
      'guest_hold','${boardId}',NULL,'${created.inviteId}','${'c'.repeat(64)}',
      '{"credentialVersion":1,"cells":[0]}'::jsonb);`));
    expect(held.heldCells).toEqual([0]);
  });

  it('supports variable family sizes and serializes concurrent create into one stable invite', async () => {
    const scopes = [
      [7],
      Array.from({ length: 10 }, (_, index) => index * 9),
      Array.from({ length: 20 }, (_, index) => index * 5),
    ];
    for (const cells of scopes) {
      await executeSql('DELETE FROM public.contests;');
      await seed(cells,TOKEN_A,true,[]);
      const outcomes = await Promise.all([rpc('create'),rpc('create')]);
      expect(outcomes[0].inviteId).toBe(outcomes[1].inviteId);
      expect(outcomes[0].cells).toEqual(cells);
      expect(outcomes[1].cells).toEqual(cells);
      expect(await queryScalar(`SELECT count(*) FROM public.guest_invites WHERE contest_id='${boardId}'`)).toBe('1');
      expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${boardId}' AND event_type='family.guest_link_created'`)).toBe('1');
    }
  });

  it('reuses an exact case-insensitive organizer invite and preserves all organizer settings', async () => {
    await seed([0,17,99],TOKEN_A,true,[]);
    const expires = '2099-09-20T12:00:00Z';
    const inviteId = randomUUID();
    await executeSql(`INSERT INTO public.guest_invites(id,contest_id,seller_label,cells,max_squares,credential_version,expires_at,payment)
      VALUES('${inviteId}','${boardId}','mORA',ARRAY[99,0,17],3,7,'${expires}','{"label":"Pay organizer","detail":"Private instructions"}');`);
    const revision = await queryScalar(`SELECT revision FROM public.contests WHERE id='${boardId}'`);
    expect(await rpc('create')).toMatchObject({ inviteId, version: 7, maxSquares: 3, state: 'active', revision: Number(revision) });
    expect(await queryScalar(`SELECT max_squares||':'||credential_version||':'||(payment->>'detail') FROM public.guest_invites WHERE id='${inviteId}'`))
      .toBe('3:7:Private instructions');
    expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${boardId}' AND event_type='family.guest_link_created'`)).toBe('0');
  });

  it('does not bypass disabled, expired, or mismatched organizer invites', async () => {
    await seed([0,17],TOKEN_A,true,[]);
    await executeSql(`INSERT INTO public.guest_invites(contest_id,seller_label,cells,max_squares,disabled_at)
      VALUES('${boardId}','Mora',ARRAY[0,17],1,clock_timestamp());`);
    expect(await rpc('create')).toMatchObject({ state: 'disabled' });
    expect(await queryScalar(`SELECT count(*) FROM public.guest_invites WHERE contest_id='${boardId}'`)).toBe('1');

    await executeSql(`DELETE FROM public.guest_invites WHERE contest_id='${boardId}';
      INSERT INTO public.guest_invites(contest_id,seller_label,cells,max_squares,expires_at)
      VALUES('${boardId}','Mora',ARRAY[0,17],1,clock_timestamp()-interval '1 second');`);
    expect(await rpc('create')).toMatchObject({ state: 'expired' });

    await executeSql(`DELETE FROM public.guest_invites WHERE contest_id='${boardId}';
      INSERT INTO public.guest_invites(contest_id,seller_label,cells,max_squares)
      VALUES('${boardId}','Mora',ARRAY[0],1);`);
    expect(await rpc('create')).toMatchObject({ state: 'scope_mismatch' });
    expect(await queryScalar(`SELECT count(*) FROM public.guest_invites WHERE contest_id='${boardId}'`)).toBe('1');
  });

  it('reports sharing and lifecycle blockers without creating or changing availability', async () => {
    const original = await seed([0,17],TOKEN_A,false,[17]);
    expect(await rpc('create')).toMatchObject({ state: 'not_shared', availableCount: 1 });
    expect(await queryScalar(`SELECT count(*) FROM public.guest_invites WHERE contest_id='${boardId}'`)).toBe('0');
    await executeSql(`UPDATE public.contests SET shared_at=clock_timestamp(),status='archived' WHERE id='${boardId}'`);
    expect(await rpc('create')).toMatchObject({ state: 'locked', availableCount: 1 });
    expect(JSON.parse(await queryScalar(`SELECT board_data FROM public.contests WHERE id='${boardId}'`))).toEqual(original);
  });

  it('keeps reissued family tokens on the same invite and rejects revoked, reassigned, expired, and wrong-board access', async () => {
    await seed([0,17],TOKEN_A,true,[]);
    const created = await rpc('create');
    await executeSql(`UPDATE public.family_board_access SET revoked_at=clock_timestamp() WHERE token_hash='${TOKEN_A}';
      INSERT INTO public.family_board_access(contest_id,label,token_hash,cells,expires_at)
      VALUES('${boardId}','Mora','${TOKEN_B}',ARRAY[17,0],clock_timestamp()+interval '7 days');`);
    expect(await rpc('read',TOKEN_B)).toMatchObject({ inviteId: created.inviteId, state: 'active' });
    await expect(rpc('read',TOKEN_A)).rejects.toThrow(/family_access_denied/);

    const wrongBoard = randomUUID();
    await executeSql(`INSERT INTO public.contests(id,owner_id,share_code,title,season_year,board_data)
      VALUES('${wrongBoard}','${OWNER_ID}','BCDEFGHJ','Wrong board',2026,${sqlText(JSON.stringify(boardDocument([])))}::jsonb);`);
    await expect(rpc('read',TOKEN_B,wrongBoard)).rejects.toThrow(/family_access_denied/);
    await executeSql(`UPDATE public.family_board_access SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash='${TOKEN_B}';`);
    await expect(rpc('read',TOKEN_B)).rejects.toThrow(/family_access_denied/);

    await executeSql(`UPDATE public.family_board_access SET expires_at=clock_timestamp()+interval '1 day' WHERE token_hash='${TOKEN_B}';
      UPDATE public.contests SET board_data=jsonb_set(board_data,'{allocationLabels,0}','"Other"') WHERE id='${boardId}';`);
    await expect(rpc('read',TOKEN_B)).rejects.toThrow(/family_access_denied/);
  });

  it('keeps tables and the narrow RPC private from browser roles', async () => {
    await seed([0],TOKEN_A,true,[]);
    const result = await rpc('create');
    expect(Object.keys(result).sort()).toEqual(['availableCount','boardId','cells','inviteId','label','maxSquares','revision','state','title','version'].sort());
    expect(JSON.stringify(result)).not.toMatch(/payment|token|Holder/i);
    for (const role of ['anon','authenticated']) {
      await expect(queryScalar(`SET ROLE ${role}; SELECT public.gridone_family_guest_link('${boardId}','${TOKEN_A}','read');`)).rejects.toThrow(/permission denied/);
      await expect(queryScalar(`SET ROLE ${role}; SELECT count(*) FROM public.guest_invites;`)).rejects.toThrow(/permission denied/);
      await expect(queryScalar(`SET ROLE ${role}; SELECT count(*) FROM public.family_board_access;`)).rejects.toThrow(/permission denied/);
    }
  });
});
