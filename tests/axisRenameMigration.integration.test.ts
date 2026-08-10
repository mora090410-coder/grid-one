import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 025_axis_naming.sql renames bearsAxis/oppAxis to leftAxis/topAxis inside
// persisted JSON. It rewrites every board that already exists, including
// published ones whose board_data is otherwise frozen, so it is verified here
// against real rows in the legacy shape rather than assumed.

const DATABASE_NAME = 'gridone_axis_rename_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-axis-rename-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-axis-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '40000000-0000-4000-8000-000000000001';
const DRAFT_ID = '40000000-0000-4000-8000-000000000011';
const PUBLISHED_ID = '40000000-0000-4000-8000-000000000012';
const DYNAMIC_ID = '40000000-0000-4000-8000-000000000013';
const PUBLISHED_SHARE = 'DDDDD234';

const SIDE_DIGITS = [3, 7, 1, 9, 0, 5, 2, 8, 4, 6];
const TOP_DIGITS = [5, 0, 8, 2, 6, 9, 3, 1, 7, 4];
const squares = Array.from({ length: 100 }, (_, index) => [`Buyer ${index + 1}`]);

/** A board document in the pre-025 shape. */
const legacyBoard = {
  bearsAxis: SIDE_DIGITS,
  oppAxis: TOP_DIGITS,
  squares,
  isDynamic: false,
};

const quarterAxes = (base: number[]) => ({
  Q1: base, Q2: base, Q3: base, Q4: base,
});

const legacyDynamicBoard = {
  bearsAxis: SIDE_DIGITS,
  oppAxis: TOP_DIGITS,
  squares,
  isDynamic: true,
  bearsAxisByQuarter: quarterAxes(SIDE_DIGITS),
  oppAxisByQuarter: quarterAxes(TOP_DIGITS),
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

const migrationPath = (file: string) =>
  resolve(process.cwd(), 'supabase/migrations', file);

/** Applies everything up to but not including the rename, so rows can be seeded legacy-shaped. */
const applyMigrationsBefore025 = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file) && Number(file.slice(0, 3)) < 25)
    .sort();
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const seedLegacyBoards = async () => {
  await executeSql(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER_ID}'::uuid, 'coach@example.test');

    -- A draft, a published board (board_data normally frozen), and a
    -- per-quarter dynamic board.
    INSERT INTO public.contests (
      id, owner_id, share_code, title, season_year, board_data, published_at, status,
      axis_locked_at, side_axis, top_axis
    ) VALUES
      ('${DRAFT_ID}'::uuid, '${OWNER_ID}'::uuid, 'DDDDD232', 'Draft board', 2026,
       ${sqlText(JSON.stringify(legacyBoard))}::jsonb, NULL, 'draft', NULL, NULL, NULL),
      ('${PUBLISHED_ID}'::uuid, '${OWNER_ID}'::uuid, '${PUBLISHED_SHARE}', 'Published board', 2026,
       ${sqlText(JSON.stringify(legacyBoard))}::jsonb, now(), 'published', now(),
       ARRAY[3,7,1,9,0,5,2,8,4,6]::smallint[], ARRAY[5,0,8,2,6,9,3,1,7,4]::smallint[]),
      ('${DYNAMIC_ID}'::uuid, '${OWNER_ID}'::uuid, 'DDDDD235', 'Dynamic board', 2026,
       ${sqlText(JSON.stringify(legacyDynamicBoard))}::jsonb, NULL, 'draft', NULL, NULL, NULL);

    INSERT INTO public.public_board_snapshots (
      contest_id, share_code, revision, board_title, matchup, board, published_at
    ) VALUES (
      '${PUBLISHED_ID}'::uuid, '${PUBLISHED_SHARE}', 1, 'Published board',
      '{"sideTeamAbbr":"CHI","topTeamAbbr":"GB"}'::jsonb,
      ${sqlText(JSON.stringify(legacyBoard))}::jsonb, now()
    );
  `);
};

describe.sequential('axis rename migration on disposable PostgreSQL 17', () => {
  beforeAll(async () => {
    await docker([
      'run', '--rm', '--detach', '--name', containerName,
      '--env', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DATABASE_NAME}`,
      POSTGRES_IMAGE,
    ]);
    containerStarted = true;
    await waitForPostgres();
    await bootstrapSupabasePrimitives();
    await applyMigrationsBefore025();
    await seedLegacyBoards();
    await executeSql(readFileSync(migrationPath('025_axis_naming.sql'), 'utf8'));
  }, 300_000);

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName]).catch(() => undefined);
    }
  }, 60_000);

  it('renames the axis keys on a draft board and preserves the digits', async () => {
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'leftAxis' FROM public.contests WHERE id = '${DRAFT_ID}'::uuid
    `))).toEqual(SIDE_DIGITS);
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'topAxis' FROM public.contests WHERE id = '${DRAFT_ID}'::uuid
    `))).toEqual(TOP_DIGITS);
    expect(await queryScalar(`
      SELECT board_data ?| ARRAY['bearsAxis','oppAxis'] FROM public.contests WHERE id = '${DRAFT_ID}'::uuid
    `)).toBe('f');
  });

  it('rewrites a published board despite the frozen-board trigger', async () => {
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'leftAxis' FROM public.contests WHERE id = '${PUBLISHED_ID}'::uuid
    `))).toEqual(SIDE_DIGITS);
    expect(await queryScalar(`
      SELECT board_data ?| ARRAY['bearsAxis','oppAxis'] FROM public.contests WHERE id = '${PUBLISHED_ID}'::uuid
    `)).toBe('f');
  });

  it('rewrites the public viewer snapshot so a shared link keeps its numbers', async () => {
    expect(JSON.parse(await queryScalar(`
      SELECT board -> 'topAxis' FROM public.public_board_snapshots
      WHERE contest_id = '${PUBLISHED_ID}'::uuid
    `))).toEqual(TOP_DIGITS);
    expect(await queryScalar(`
      SELECT board ?| ARRAY['bearsAxis','oppAxis'] FROM public.public_board_snapshots
      WHERE contest_id = '${PUBLISHED_ID}'::uuid
    `)).toBe('f');
  });

  it('renames the per-quarter axes on a dynamic board', async () => {
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'leftAxisByQuarter' -> 'Q3' FROM public.contests WHERE id = '${DYNAMIC_ID}'::uuid
    `))).toEqual(SIDE_DIGITS);
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'topAxisByQuarter' -> 'Q1' FROM public.contests WHERE id = '${DYNAMIC_ID}'::uuid
    `))).toEqual(TOP_DIGITS);
    expect(await queryScalar(`
      SELECT board_data ?| ARRAY['bearsAxisByQuarter','oppAxisByQuarter']
      FROM public.contests WHERE id = '${DYNAMIC_ID}'::uuid
    `)).toBe('f');
  });

  it('leaves the squares untouched', async () => {
    expect(JSON.parse(await queryScalar(`
      SELECT board_data -> 'squares' ->> 0 FROM public.contests WHERE id = '${PUBLISHED_ID}'::uuid
    `))).toEqual(['Buyer 1']);
    expect(await queryScalar(`
      SELECT jsonb_array_length(board_data -> 'squares') FROM public.contests WHERE id = '${PUBLISHED_ID}'::uuid
    `)).toBe('100');
  });

  it('restores the frozen-board trigger after the rewrite', async () => {
    await expect(executeSql(`
      UPDATE public.contests
      SET board_data = jsonb_set(board_data, ARRAY['squares','0'], '["Sneaky"]'::jsonb, false)
      WHERE id = '${PUBLISHED_ID}'::uuid;
    `)).rejects.toThrow(/locked/i);
  });
});
