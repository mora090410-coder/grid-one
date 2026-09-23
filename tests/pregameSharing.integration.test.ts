import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the complete migration chain and the pregame sharing security boundary.

const DATABASE_NAME = 'gridone_sales_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-sales-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-sales-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '30000000-0000-4000-8000-000000000001';
const STRANGER_ID = '30000000-0000-4000-8000-000000000002';
const ENTITLEMENT_ID = '30000000-0000-4000-8000-000000000010';
const CONTEST_ID = '30000000-0000-4000-8000-000000000011';
const OPEN_CONTEST_ID = '30000000-0000-4000-8000-000000000012';
const SHARE_CODE = 'CCCCC234';
const OPEN_SHARE_CODE = 'CCCCC235';
/** Index left OPEN at publish time on the open-squares board. */
const OPEN_CELL = 42;

const VALID_SIDE_AXIS = 'ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]';
const VALID_TOP_AXIS = 'ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[]';
const names = Array.from({ length: 100 }, (_, index) => [`Buyer ${index + 1}`]);
const publicBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: names,
  isDynamic: false,
};
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

/** Applies every migration on disk, including the new sharing migration. */
const applyAllMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  expect(files.some(file => file.startsWith('023_'))).toBe(true);
  expect(files.some(file => file.startsWith('026_'))).toBe(true);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const salesBoard = {
  squares: Array.from({length:100},()=>[]),
  allocationLabels: Array.from({length:100},(_,i)=>i % 11 === 0 ? 'Mora family' : null),
  leftAxis: Array(10).fill(null), topAxis: Array(10).fill(null), isDynamic: false,
};
const revision = () => queryScalar(`SELECT revision FROM contests WHERE id='${CONTEST_ID}'`);
const share = async (id=CONTEST_ID, owner=OWNER_ID, rev?: string) => queryScalar(`
  SET ROLE service_role;
  SELECT row_to_json(result) FROM gridone_share_board('${id}','${owner}',${rev || await revision()}) result;
`);

describe.sequential('pregame sharing on disposable PostgreSQL',()=>{
 beforeAll(async()=>{
  await docker(['run','--rm','--detach','--name',containerName,'--env',`POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,'--env',`POSTGRES_DB=${DATABASE_NAME}`,POSTGRES_IMAGE]);
  containerStarted=true; await waitForPostgres(); await bootstrapSupabasePrimitives(); await applyAllMigrations();
  await executeSql(`
   INSERT INTO auth.users(id,email) VALUES ('${OWNER_ID}','owner@example.test'),('${STRANGER_ID}','other@example.test');
   INSERT INTO contests(id,owner_id,share_code,title,game_external_id,game_starts_at,board_data)
   VALUES ('${CONTEST_ID}','${OWNER_ID}','${SHARE_CODE}','Team board','401772999','2026-09-13T17:00:00Z',${sqlText(JSON.stringify(salesBoard))}::jsonb),
   ('${OPEN_CONTEST_ID}','${OWNER_ID}','${OPEN_SHARE_CODE}','Second board','401772999','2026-09-13T17:00:00Z',${sqlText(JSON.stringify(salesBoard))}::jsonb);
  `);
 },300000);
 afterAll(async()=>{if(containerStarted) await docker(['rm','--force',containerName]).catch(()=>undefined);},60000);

 it('cannot share via direct authenticated column writes or RPC calls',async()=>{
  await expect(executeSql(asUser(OWNER_ID,`UPDATE contests SET shared_at=now() WHERE id='${CONTEST_ID}';`))).rejects.toThrow(/sharing endpoint/i);
  await expect(executeSql(asUser(OWNER_ID,`SELECT * FROM gridone_share_board('${CONTEST_ID}','${OWNER_ID}',1);`))).rejects.toThrow(/permission denied/i);
  expect(await queryScalar(`SELECT count(*) FROM board_activations`)).toBe('0');
 });
 it('checks ownership and revision without reserving allowance',async()=>{
  expect(await share(CONTEST_ID,STRANGER_ID,'1')).toBe('');
  expect(await share(CONTEST_ID,OWNER_ID,'999')).toBe('');
  expect(await queryScalar(`SELECT count(*) FROM board_activations`)).toBe('0');
 });
 it('shares an all-unsold board once and leaves axes and publication unlocked',async()=>{
  const first=JSON.parse(await share()); expect(first).toMatchObject({shared:true,tier:'free',used:1,allowance:1,share_code:SHARE_CODE});
  const second=JSON.parse(await share()); expect(second).toEqual(first);
  expect(await queryScalar(`SELECT (published_at IS NULL AND axis_locked_at IS NULL AND shared_at IS NOT NULL)::text FROM contests WHERE id='${CONTEST_ID}'`)).toBe('true');
  expect(await queryScalar(`SELECT count(*) FROM public_board_snapshots`)).toBe('0');
  expect(await queryScalar(`SELECT count(*) FROM contest_audit_events WHERE event_type='board.shared'`)).toBe('1');
 });
 it('cannot delete a shared board to reclaim its allowance',async()=>{
  await executeSql(asUser(OWNER_ID,`DELETE FROM contests WHERE id='${CONTEST_ID}';`));
  expect(await queryScalar(`SELECT count(*) FROM contests WHERE id='${CONTEST_ID}'`)).toBe('1');
  expect(await queryScalar(`SELECT count(*) FROM board_activations`)).toBe('1');
 });
 it('enforces allowance on a second board and cannot move the reserved season',async()=>{
  await expect(share(OPEN_CONTEST_ID,OWNER_ID,'1')).rejects.toThrow(/PUBLISH_ALLOWANCE_EXHAUSTED:free:1:1/);
  await expect(executeSql(asUser(OWNER_ID,`UPDATE contests SET season_year=2027 WHERE id='${CONTEST_ID}';`))).rejects.toThrow(/identity is locked/i);
 });
 it('keeps owner editing before finalization while rejecting malformed allocation and multi-buyer data',async()=>{
  await executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=jsonb_set(board_data,'{squares,0}','["Jane Smith"]') WHERE id='${CONTEST_ID}';`));
  expect(await queryScalar(`SELECT board_data#>>'{squares,0,0}' FROM contests WHERE id='${CONTEST_ID}'`)).toBe('Jane Smith');
  await expect(executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=jsonb_set(board_data,'{allocationLabels}','["private"]') WHERE id='${CONTEST_ID}';`))).rejects.toThrow(/100 labels/i);
  await expect(executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=jsonb_set(board_data,'{squares,0}','["A","B"]') WHERE id='${CONTEST_ID}';`))).rejects.toThrow(/one trimmed buyer/i);
 });
 it('finalizes on the same allowance and projects explicit allocations but never private metadata',async()=>{
  const filled={...publicBoard,allocationLabels:salesBoard.allocationLabels,seller_label:'PRIVATE',payments:{Jane:'paid'}};
  await executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=${sqlText(JSON.stringify(filled))}::jsonb WHERE id='${CONTEST_ID}';`));
  await executeSql(`SET ROLE service_role; SELECT * FROM gridone_publish_board('${CONTEST_ID}','${OWNER_ID}',${await revision()},${VALID_SIDE_AXIS},${VALID_TOP_AXIS},${sqlText(JSON.stringify(names))}::jsonb,${sqlText(JSON.stringify(publicBoard))}::jsonb,${sqlText(JSON.stringify(matchup))}::jsonb);`);
  expect(await queryScalar(`SELECT count(*) FROM board_activations`)).toBe('1');
  expect(await queryScalar(`SELECT share_code FROM public_board_snapshots WHERE contest_id='${CONTEST_ID}'`)).toBe(SHARE_CODE);
  expect(await queryScalar(`SELECT board#>>'{allocationLabels,0}' FROM public_board_snapshots WHERE contest_id='${CONTEST_ID}'`)).toBe('Mora family');
  expect(await queryScalar(`SELECT (board ? 'seller_label' OR board ? 'payments')::text FROM public_board_snapshots WHERE contest_id='${CONTEST_ID}'`)).toBe('false');
  await expect(executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=jsonb_set(board_data,'{topAxis}','[0,1,2,3,4,5,6,7,8,9]') WHERE id='${CONTEST_ID}';`))).rejects.toThrow(/locked/i);
 });
 it('serializes competing first shares against one account allowance',async()=>{
  const firstId='30000000-0000-4000-8000-000000000021';
  const secondId='30000000-0000-4000-8000-000000000022';
  await executeSql(`INSERT INTO contests(id,owner_id,share_code,title,game_external_id,board_data)
   VALUES ('${firstId}','${STRANGER_ID}','DDDDD234','First','401772999',${sqlText(JSON.stringify(salesBoard))}::jsonb),
   ('${secondId}','${STRANGER_ID}','DDDDD235','Second','401772999',${sqlText(JSON.stringify(salesBoard))}::jsonb);`);
  const results=await Promise.allSettled([share(firstId,STRANGER_ID,'1'),share(secondId,STRANGER_ID,'1')]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(result=>result.status==='rejected') as PromiseRejectedResult;
  expect(String(rejected.reason)).toContain('PUBLISH_ALLOWANCE_EXHAUSTED:free:1:1');
  expect(await queryScalar(`SELECT count(*) FROM board_activations activation JOIN contests c ON c.id=activation.contest_id WHERE c.owner_id='${STRANGER_ID}'`)).toBe('1');
 });
 it('still allows deleting an ordinary unshared draft',async()=>{
  const draftId='30000000-0000-4000-8000-000000000023';
  await executeSql(`INSERT INTO contests(id,owner_id,share_code,title) VALUES ('${draftId}','${OWNER_ID}','DDDDD236','Unshared draft');`);
  await executeSql(asUser(OWNER_ID,`DELETE FROM contests WHERE id='${draftId}';`));
  expect(await queryScalar(`SELECT count(*) FROM contests WHERE id='${draftId}'`)).toBe('0');
 });
 it('preserves legacy dynamic mode and still enforces the seasonal sharing allowance',async()=>{
  await executeSql(asUser(OWNER_ID,`UPDATE contests SET board_data=jsonb_set(board_data - 'allocationLabels','{isDynamic}','true') WHERE id='${OPEN_CONTEST_ID}';`));
  const rev=await queryScalar(`SELECT revision FROM contests WHERE id='${OPEN_CONTEST_ID}'`);
  await expect(share(OPEN_CONTEST_ID,OWNER_ID,rev)).rejects.toThrow(/PUBLISH_ALLOWANCE_EXHAUSTED:free:1:1/);
  expect(await queryScalar(`SELECT board_data->>'isDynamic' FROM contests WHERE id='${OPEN_CONTEST_ID}'`)).toBe('true');
 });
});
