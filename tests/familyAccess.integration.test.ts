import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Scoped helper access, database authorization, public metadata, and row-lock races.

const DATABASE_NAME = 'gridone_family_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-family-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-family-${process.pid}-${randomUUID().slice(0, 8)}`;

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
  expect(files.some(file => file.startsWith('027_'))).toBe(true);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};


const HASH = 'a'.repeat(64);
let id: string;
const rpc = (action: string, extras = '') => `SET ROLE service_role; SELECT public.gridone_family_access(p_action => '${action}', p_contest_id => '${id}'::uuid ${extras});`;
const revision = () => queryScalar(`SELECT revision FROM public.contests WHERE id='${id}'`);
const invite = async () => executeSql(rpc('invite', `, p_owner_id => '${OWNER_ID}', p_expected_revision => ${await revision()}, p_label => 'Mora', p_token_hash => '${HASH}', p_cells => ARRAY[0,1]`));
const read = () => queryScalar(`SET ROLE service_role; SELECT public.gridone_family_access('read', NULL, p_token_hash => '${HASH}');`);

describe('scoped family database access', () => {
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
    await executeSql('DELETE FROM public.family_board_access;');
    id = randomUUID();
    const board = { leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), squares: Array.from({length:100}, (_, i) => [i < 2 ? 'Mora' : 'Other']), allocationLabels: Array.from({length:100}, (_, i) => i < 2 ? 'Mora' : 'Other') };
    await executeSql(`INSERT INTO public.contests(id,owner_id,title,season_year,game_external_id,game_starts_at,side_team_name,side_team_abbr,top_team_name,top_team_abbr,board_data) VALUES('${id}','${OWNER_ID}','Family board',2026,'401772999','2026-09-13T17:00:00Z','Chicago Bears','CHI','Green Bay Packers','GB',${sqlText(JSON.stringify(board))}::jsonb);`);
  });
  it('returns only assigned names and availability, then saves without changing responsibility', async () => {
    await executeSql(`INSERT INTO public.contest_entries(contest_id,cell_index,paid_status,seller_label,contact_type,contact_value) VALUES('${id}',0,'paid','Mora','email','private@example.test');`);
    await invite();
    const result = JSON.parse(await read());
    expect(Object.keys(result).sort()).toEqual(['cells','label','revision','title']);
    expect(result.cells).toEqual([{index:0,name:'Mora',availability:'unspecified'},{index:1,name:'Mora',availability:'unspecified'}]);
    await executeSql(rpc('edit', `, p_token_hash => '${HASH}', p_expected_revision => ${result.revision}, p_changes => '[{"index":0,"name":"Bill W","availability":"unavailable"}]'::jsonb`));
    expect(JSON.parse(await read()).cells[0]).toEqual({index:0,name:'Bill W',availability:'unavailable'});
    expect(await queryScalar(`SELECT board_data->'allocationLabels'->>0 FROM public.contests WHERE id='${id}'`)).toBe('Mora');
    expect(await queryScalar(`SELECT paid_status||':'||contact_value FROM public.contest_entries WHERE contest_id='${id}' AND cell_index=0`)).toBe('paid:private@example.test');
  });

  it('keeps payment-only bulk updates private and preserves the other entry fields', async () => {
    await executeSql(`INSERT INTO public.contest_entries(contest_id,cell_index,paid_status,seller_label,contact_type,contact_value,notify_opt_in) VALUES('${id}',0,'unpaid','Coach','email','private@example.test',true);`);
    // Match the narrow columns sent by the payment-only PostgREST upsert.
    await executeSql(asUser(OWNER_ID, `INSERT INTO public.contest_entries(contest_id,cell_index,paid_status) VALUES('${id}',0,'paid'),('${id}',1,'paid') ON CONFLICT(contest_id,cell_index) DO UPDATE SET paid_status=EXCLUDED.paid_status;`));
    expect(await queryScalar(`SELECT paid_status||':'||seller_label||':'||contact_value||':'||notify_opt_in FROM public.contest_entries WHERE contest_id='${id}' AND cell_index=0`)).toBe('paid:Coach:private@example.test:true');
    expect(await queryScalar(asUser(STRANGER_ID, `SELECT count(*) FROM public.contest_entries WHERE contest_id='${id}'`))).toContain('0');
    await expect(executeSql(asUser(STRANGER_ID, `INSERT INTO public.contest_entries(contest_id,cell_index,paid_status) VALUES('${id}',0,'unpaid') ON CONFLICT(contest_id,cell_index) DO UPDATE SET paid_status=EXCLUDED.paid_status;`))).rejects.toThrow();
    await expect(queryScalar(`SET ROLE anon; SELECT count(*) FROM public.contest_entries WHERE contest_id='${id}'`)).rejects.toThrow(/permission denied/);
    await invite();
    const family = await read();
    expect(family).not.toContain('paid_status');
    expect(family).not.toContain('private@example.test');
  });
  it('rejects unknown keys, out-of-scope cells, missing names and stale writes', async () => {
    await invite();
    for (const change of [{index:2,name:'Bill'}, {index:0,name:'Bill',paid_status:'paid'}, {index:0}, {index:0,name:null}, {index:0,name:'x'.repeat(81)}, {index:0,name:'Bill',availability:'sold'}]) {
      await expect(executeSql(rpc('edit', `, p_token_hash => '${HASH}', p_expected_revision => ${await revision()}, p_changes => ${sqlText(JSON.stringify([change]))}::jsonb`))).rejects.toThrow(/family_invalid_request|family_access_denied/);
    }
    await expect(executeSql(rpc('edit', `, p_token_hash => '${HASH}', p_expected_revision => 0, p_changes => '[{"index":0,"name":"Bill"}]'::jsonb`))).rejects.toThrow(/revision_conflict/);
  });
  it('denies wrong owners, public roles and table reads', async () => {
    await expect(executeSql(rpc('invite', `, p_owner_id => '${STRANGER_ID}', p_expected_revision => ${await revision()}, p_label => 'Mora', p_token_hash => '${HASH}', p_cells => ARRAY[0]`))).rejects.toThrow(/family_access_denied/);
    for (const role of ['anon','authenticated']) {
      await expect(executeSql(`SET ROLE ${role}; SELECT public.gridone_family_access('read',NULL,p_token_hash => '${HASH}');`)).rejects.toThrow(/permission denied/);
      await expect(executeSql(`SET ROLE ${role}; SELECT * FROM public.family_board_access;`)).rejects.toThrow(/permission denied/);
    }
  });
  it('revokes old access after assignment changes even when restored', async () => {
    await invite();
    await executeSql(asUser(OWNER_ID, `UPDATE public.contests SET board_data=jsonb_set(board_data,'{allocationLabels,0}','"Other"') WHERE id='${id}'; UPDATE public.contests SET board_data=jsonb_set(board_data,'{allocationLabels,0}','"Mora"') WHERE id='${id}';`));
    await expect(read()).rejects.toThrow(/family_access_denied/);
  });
  it('archives private payment notes on deliberate reassignment, preserves holder names', async () => {
    await invite();
    await executeSql(`INSERT INTO public.contest_entries(contest_id,cell_index,paid_status,seller_label) VALUES('${id}',0,'paid','Mora');`);
    await executeSql(rpc('reassign', `, p_owner_id => '${OWNER_ID}', p_expected_revision => ${await revision()}, p_label => 'Smith', p_cells => ARRAY[0], p_changes => '{"reviewPaymentNotes":true}'::jsonb`));
    expect(await queryScalar(`SELECT paid_status FROM public.contest_entries WHERE contest_id='${id}' AND cell_index=0`)).toBe('unknown');
    expect(await queryScalar(`SELECT board_data->'squares'->0->>0 FROM public.contests WHERE id='${id}'`)).toBe('Mora');
    expect(await queryScalar(`SELECT count(*) FROM public.contest_audit_events WHERE contest_id='${id}' AND event_type='family_reassigned' AND details->'paymentNotes'->0->>'paid_status'='paid'`)).toBe('1');
    await expect(read()).rejects.toThrow(/family_access_denied/);
  });
  it('serializes two family edits so exactly one revision wins', async () => {
    await invite();
    const rev = await revision();
    const outcomes = await Promise.allSettled(['Bill','Ann'].map(name => executeSql(rpc('edit', `, p_token_hash => '${HASH}', p_expected_revision => ${rev}, p_changes => '[{"index":0,"name":"${name}"}]'::jsonb`))));
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
  });
  it('rejects expired access and malformed public metadata', async () => {
    await invite();
    await executeSql(`UPDATE public.family_board_access SET expires_at=now()-interval '1 second';`);
    await expect(read()).rejects.toThrow(/family_access_denied/);
    await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{participation}','{"email":"private"}') WHERE id='${id}';`)).rejects.toThrow(/participation/);
  });
  it('rotates and revokes credentials without exposing either token', async () => {
    await invite();
    const newHash = 'b'.repeat(64);
    await executeSql(rpc('invite', `, p_owner_id => '${OWNER_ID}', p_expected_revision => ${await revision()}, p_label => 'Mora', p_token_hash => '${newHash}', p_cells => ARRAY[0,1]`));
    await expect(read()).rejects.toThrow(/family_access_denied/);
    await executeSql(rpc('revoke', `, p_owner_id => '${OWNER_ID}', p_expected_revision => ${await revision()}, p_label => 'Mora'`));
    await expect(queryScalar(`SELECT public.gridone_family_access('read',NULL,p_token_hash => '${newHash}')`)).rejects.toThrow(/family_access_denied/);
  });

  it('waits for finalization and refuses a racing post-lock family edit', async () => {
    await executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{participation}','{"purpose":"Support the team","squarePrice":"$20"}') WHERE id='${id}'`);
    await invite();
    const rev = await revision();
    const oldBoard = JSON.parse(await queryScalar(`SELECT board_data FROM public.contests WHERE id='${id}'`));
    const finalized = { ...oldBoard, leftAxis: [0,1,2,3,4,5,6,7,8,9], topAxis: [9,8,7,6,5,4,3,2,1,0] };
    const lockName = `family-finalize-${id}`;
    const publish = executeSql(`SET application_name='${lockName}'; BEGIN;
      SET LOCAL ROLE service_role;
      SELECT * FROM public.gridone_publish_board('${id}','${OWNER_ID}',${rev},${VALID_SIDE_AXIS},${VALID_TOP_AXIS},${sqlText(JSON.stringify(oldBoard.squares))}::jsonb,${sqlText(JSON.stringify(finalized))}::jsonb,${sqlText(JSON.stringify(matchup))}::jsonb,false);
      SELECT pg_sleep(1); COMMIT;`);
    // Observe the transaction after publication has acquired the board lock.
    let observedLock = false;
    for (let attempts = 0; attempts < 30; attempts++) {
      if (await queryScalar(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${lockName}' AND wait_event='PgSleep'`) === '1') { observedLock = true; break; }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    expect(observedLock).toBe(true);
    const edit = executeSql(rpc('edit', `, p_token_hash => '${HASH}', p_expected_revision => ${rev}, p_changes => '[{"index":0,"name":"Late change"}]'::jsonb`));
    const outcomes = await Promise.allSettled([publish, edit]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1].status).toBe('rejected');
    expect(String((outcomes[1] as PromiseRejectedResult).reason)).toContain('family_board_locked');
    await executeSql(`UPDATE public.public_board_snapshots SET board=jsonb_set(board,'{participation}','{"privateEmail":"private@example.test"}') WHERE contest_id='${id}'`);
    expect(JSON.parse(await queryScalar(`SELECT board->'participation' FROM public.public_board_snapshots WHERE contest_id='${id}'`))).toEqual({purpose:'Support the team',squarePrice:'$20'});
    expect(await queryScalar(`SELECT board_data->'squares'->0->>0 FROM public.contests WHERE id='${id}'`)).toBe('Mora');
  });

  it('allows trailing spaces in configured instructions but rejects excessive or invalid public data', async () => {
    await executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{participation}','{"instructions":"Ask the organizer "}') WHERE id='${id}'`);
    for (const value of [{purpose:'x'.repeat(281)}, {instructions:7}, {squarePrice:'x'.repeat(41)}]) {
      await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{participation}',${sqlText(JSON.stringify(value))}::jsonb) WHERE id='${id}'`)).rejects.toThrow(/participation/);
    }
    for (const value of [[], Array(100).fill(null), Array(100).fill('sold')]) {
      await expect(executeSql(`UPDATE public.contests SET board_data=jsonb_set(board_data,'{availability}',${sqlText(JSON.stringify(value))}::jsonb) WHERE id='${id}'`)).rejects.toThrow(/availability/);
    }
  });

});
