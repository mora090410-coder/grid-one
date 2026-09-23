import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Seller links: public per-seller claiming, database authorization, and row-lock races.

const DATABASE_NAME = 'gridone_seller_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-seller-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-seller-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '30000000-0000-4000-8000-000000000001';
const STRANGER_ID = '30000000-0000-4000-8000-000000000002';
const ENTITLEMENT_ID = '30000000-0000-4000-8000-000000000010';
const VALID_SIDE_AXIS = 'ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]';
const VALID_TOP_AXIS = 'ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[]';
const matchup = {
  sideTeamName: 'Chicago Bears',
  sideTeamAbbr: 'CHI',
  topTeamName: 'Green Bay Packers',
  topTeamAbbr: 'GB',
  gameExternalId: '401772999',
  gameStartsAt: '2026-09-13T17:00:00.000Z',
};

let containerStarted = false;

type CommandResult = { stdout: string; stderr: string };

const runCommand = (
  command: string,
  args: string[],
  input?: string,
  timeoutMs = 120_000,
) => new Promise<CommandResult>((resolveCommand, rejectCommand) => {
  const child = spawn(command, args, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
    rejectCommand(new Error(`${command} timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => { clearTimeout(timeout); rejectCommand(error); });
  child.on('close', (code) => {
    clearTimeout(timeout);
    if (code === 0) { resolveCommand({ stdout, stderr }); return; }
    rejectCommand(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`));
  });
  child.stdin.end(input);
});

const docker = (args: string[], input?: string, timeoutMs?: number) =>
  runCommand('docker', args, input, timeoutMs);

const psqlArgs = (extraArgs: string[]) => [
  'exec', '-e', `PGPASSWORD=${DATABASE_PASSWORD}`, '-i', containerName,
  'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', DATABASE_USER, '-d', DATABASE_NAME,
  ...extraArgs,
];

const executeSql = async (sql: string) => { await docker(psqlArgs(['-q']), sql); };

const queryScalar = async (sql: string) => {
  const { stdout } = await docker(psqlArgs(['-qAt', '-c', sql]));
  return stdout.trim();
};

const sqlText = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;

/** Runs SQL as an authenticated end user with `auth.uid()` bound to `userId`. */
const asUser = (userId: string, sql: string) => `
  SELECT set_config('request.jwt.claim.sub', '${userId}', false);
  SET ROLE authenticated;
  ${sql}
`;

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
};

const bootstrapSupabasePrimitives = async () => {
  await executeSql(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END
    $roles$;

    ALTER ROLE service_role BYPASSRLS;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $function$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $function$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $function$
      SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user)
    $function$;

    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
  `);
};

/** Apply the complete migration sequence against disposable PostgreSQL. */
const applyAllMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  expect(files.some(file => file.startsWith('031_'))).toBe(true);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};



let id: string;
const call = (action: string, extras = '') => `SET ROLE service_role; SELECT public.gridone_seller_link(p_action => '${action}', p_contest_id => ${action === 'read' || action === 'claim' ? 'NULL' : `'${id}'::uuid`} ${extras});`;
const revision = () => queryScalar(`SELECT revision FROM public.contests WHERE id='${id}'`);
const share = async () => executeSql(`SET ROLE service_role; SELECT * FROM public.gridone_share_board('${id}','${OWNER_ID}',${await revision()});`);
const sync = async () => JSON.parse(await queryScalar(call('sync', `, p_owner_id => '${OWNER_ID}'`))).links as Array<{ label: string; code: string }>;
const codeFor = async (label: string) => (await sync()).find(link => link.label === label)!.code;
const read = (code: string) => queryScalar(call('read', `, p_code => '${code}'`)).then(value => JSON.parse(value));
const claim = (code: string, cells: number[], name: string) =>
  queryScalar(call('claim', `, p_code => '${code}', p_cells => ARRAY[${cells.join(',')}]::integer[], p_name => ${sqlText(name)}`)).then(value => JSON.parse(value));
const nameAt = (cell: number) => queryScalar(`SELECT board_data->'squares'->${cell}->>0 FROM public.contests WHERE id='${id}'`);

describe('seller links', () => {
  beforeAll(async () => {
    await docker(['run', '--detach', '--name', containerName, '-e', `POSTGRES_DB=${DATABASE_NAME}`, '-e', `POSTGRES_USER=${DATABASE_USER}`, '-e', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`, POSTGRES_IMAGE]);
    containerStarted = true;
    await waitForPostgres();
    await bootstrapSupabasePrimitives();
    await applyAllMigrations();
    await executeSql(`INSERT INTO auth.users(id) VALUES('${OWNER_ID}'),('${STRANGER_ID}'); INSERT INTO public.season_entitlements(id,owner_id,season_year,status,boards_allowance,price_cents,currency) VALUES('${ENTITLEMENT_ID}','${OWNER_ID}',2026,'active',50,7900,'usd');`);
  }, 120_000);
  afterAll(async () => { if (containerStarted) await docker(['rm','--force',containerName]); }, 60_000);
  beforeEach(async () => {
    id = randomUUID();
    // Squares 0-9 belong to Mora, 10-19 to Lee; everything else is unassigned.
    const label = (i: number) => (i < 10 ? 'Mora' : i < 20 ? 'Lee' : null);
    const board = {
      leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null),
      squares: Array.from({ length: 100 }, (_, i) => (label(i) ? [label(i)] : [])),
      allocationLabels: Array.from({ length: 100 }, (_, i) => label(i)),
      availability: Array.from({ length: 100 }, (_, i) => (i === 9 ? 'unavailable' : 'unspecified')),
      participation: { squarePrice: '$20', instructions: 'Venmo me.' },
    };
    await executeSql(`INSERT INTO public.contests(id,owner_id,title,season_year,game_external_id,game_starts_at,side_team_name,side_team_abbr,top_team_name,top_team_abbr,board_data) VALUES('${id}','${OWNER_ID}','Seller board',2026,'401772999','2026-09-13T17:00:00Z','Chicago Bears','CHI','Green Bay Packers','GB',${sqlText(JSON.stringify(board))}::jsonb);`);
  });

  it('refuses links until the board is shared', async () => {
    await expect(sync()).rejects.toThrow(/seller_board_not_shared/);
  });

  it('creates one stable link per seller and shows only that seller’s squares', async () => {
    await share();
    const first = await sync();
    expect(first.map(link => link.label)).toEqual(['Lee', 'Mora']);
    expect(first.every(link => /^[a-f0-9]{16}$/.test(link.code))).toBe(true);
    expect(await sync()).toEqual(first);
    const view = await read(first[1].code);
    expect(view.label).toBe('Mora');
    expect(view.open).toBe(true);
    expect(view.squarePrice).toBe('$20');
    expect(view.cells).toHaveLength(10);
    expect(view.cells[0]).toEqual({ index: 0, available: true });
    expect(view.cells[9]).toEqual({ index: 9, available: false });
    expect(JSON.stringify(view)).not.toMatch(/owner|paid|contact|seller_label/i);
  });

  it('claims unsold squares with the buyer name and records an audit event', async () => {
    await share();
    const code = await codeFor('Mora');
    const before = await revision();
    const result = await claim(code, [0, 1], '  Ann Buyer ');
    expect(result).toMatchObject({ cells: [0, 1], name: 'Ann Buyer', label: 'Mora' });
    expect(await nameAt(0)).toBe('Ann Buyer');
    expect(await nameAt(1)).toBe('Ann Buyer');
    expect(Number(await revision())).toBe(Number(before) + 1);
    expect(await queryScalar(`SELECT board_data->'allocationLabels'->>0 FROM public.contests WHERE id='${id}'`)).toBe('Mora');
    expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${id}' AND event_type='seller_claim'`)).toBe('1');
    expect((await read(code)).cells[0]).toEqual({ index: 0, available: false });
  });

  it('rejects taken, held-back, other-seller, and malformed claims', async () => {
    await share();
    const code = await codeFor('Mora');
    await claim(code, [0], 'Ann');
    await expect(claim(code, [0], 'Bob')).rejects.toThrow(/seller_square_taken/);
    await expect(claim(code, [9], 'Bob')).rejects.toThrow(/seller_square_taken/);
    await expect(claim(code, [10], 'Bob')).rejects.toThrow(/seller_access_denied/);
    await expect(claim(code, [50], 'Bob')).rejects.toThrow(/seller_access_denied/);
    await expect(claim(code, [1], '   ')).rejects.toThrow(/seller_invalid_request/);
    await expect(claim(code, [1, 1], 'Bob')).rejects.toThrow(/seller_invalid_request/);
    await expect(claim(code, [1,2,3,4,5,6,7,8,11,12,13], 'Bob')).rejects.toThrow(/seller_invalid_request/);
    // A failed multi-square claim changes nothing.
    await expect(claim(code, [1, 0], 'Bob')).rejects.toThrow(/seller_square_taken/);
    expect(await nameAt(1)).toBe('Mora');
  });

  it('lets exactly one of two racing buyers win a square', async () => {
    await share();
    const code = await codeFor('Mora');
    const outcomes = await Promise.allSettled([claim(code, [3], 'Ann'), claim(code, [3], 'Bob')]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(String(loser.reason)).toMatch(/seller_square_taken/);
  });

  it('stops working after rotation, for strangers, and for public roles', async () => {
    await share();
    const oldCode = await codeFor('Mora');
    await expect(queryScalar(call('sync', `, p_owner_id => '${STRANGER_ID}'`))).rejects.toThrow(/seller_access_denied/);
    const rotated = JSON.parse(await queryScalar(call('rotate', `, p_owner_id => '${OWNER_ID}', p_label => 'Mora'`))).links;
    const newCode = rotated.find((link: { label: string }) => link.label === 'Mora').code;
    expect(newCode).not.toBe(oldCode);
    await expect(read(oldCode)).rejects.toThrow(/seller_access_denied/);
    expect((await read(newCode)).label).toBe('Mora');
    for (const role of ['anon', 'authenticated']) {
      await expect(executeSql(`SET ROLE ${role}; SELECT public.gridone_seller_link('read', p_code => '${newCode}');`)).rejects.toThrow(/permission denied/);
      await expect(executeSql(`SET ROLE ${role}; SELECT * FROM public.seller_links;`)).rejects.toThrow(/permission denied/);
    }
  });

  it('follows reassignment: moved squares leave the old seller’s link', async () => {
    await share();
    const code = await codeFor('Mora');
    await executeSql(`SET ROLE service_role; UPDATE public.contests SET board_data=jsonb_set(jsonb_set(board_data,'{allocationLabels,2}','"Lee"'),'{squares,2}','["Lee"]') WHERE id='${id}';`);
    await expect(claim(code, [2], 'Ann')).rejects.toThrow(/seller_access_denied/);
    expect((await read(code)).cells.map((cell: { index: number }) => cell.index)).not.toContain(2);
  });

  it('works on boards that use new numbers each quarter', async () => {
    const digits = [0,1,2,3,4,5,6,7,8,9];
    const sets = { Q1: digits, Q2: [...digits].reverse(), Q3: digits, Q4: [...digits].reverse() };
    await executeSql(`UPDATE public.contests SET board_data = board_data || ${sqlText(JSON.stringify({ isDynamic: true, leftAxisByQuarter: sets, topAxisByQuarter: sets }))}::jsonb WHERE id='${id}';`);
    await share();
    const code = await codeFor('Mora');
    expect((await read(code)).open).toBe(true);
    await claim(code, [4], 'Quarter Buyer');
    expect(await nameAt(4)).toBe('Quarter Buyer');
  });

  it('closes claiming once numbers are locked but keeps the link readable', async () => {
    await share();
    const code = await codeFor('Mora');
    const board = JSON.parse(await queryScalar(`SELECT board_data FROM public.contests WHERE id='${id}'`));
    const finalized = { ...board, leftAxis: [0,1,2,3,4,5,6,7,8,9], topAxis: [9,8,7,6,5,4,3,2,1,0] };
    await executeSql(`SET ROLE service_role; SELECT * FROM public.gridone_publish_board('${id}','${OWNER_ID}',${await revision()},${VALID_SIDE_AXIS},${VALID_TOP_AXIS},${sqlText(JSON.stringify(board.squares))}::jsonb,${sqlText(JSON.stringify(finalized))}::jsonb,${sqlText(JSON.stringify(matchup))}::jsonb,true);`);
    await expect(claim(code, [0], 'Ann')).rejects.toThrow(/seller_board_locked/);
    const view = await read(code);
    expect(view.open).toBe(false);
    expect(view.shareCode).toMatch(/^[A-Z0-9]+$/);
  });
});
