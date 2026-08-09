import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Covers 023_entry_seller_label.sql and 024_published_square_rename.sql: the
// seller field that outlives the buyer rename, and the narrowed publish lock
// that lets exactly one audited path through.

const DATABASE_NAME = 'gridone_rename_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-rename-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-rename-${process.pid}-${randomUUID().slice(0, 8)}`;

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

/** Applies every migration on disk, so 023 and 024 run against real schema. */
const applyAllMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  expect(files.some(file => file.startsWith('023_'))).toBe(true);
  expect(files.some(file => file.startsWith('024_'))).toBe(true);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const seedPublishedBoard = async () => {
  await executeSql(`
    INSERT INTO auth.users (id, email) VALUES
      ('${OWNER_ID}'::uuid, 'coach@example.test'),
      ('${STRANGER_ID}'::uuid, 'stranger@example.test');

    INSERT INTO public.contests (
      id, owner_id, share_code, title, season_year,
      game_external_id, game_starts_at,
      side_team_name, side_team_abbr, top_team_name, top_team_abbr
    ) VALUES (
      '${CONTEST_ID}'::uuid, '${OWNER_ID}'::uuid, '${SHARE_CODE}', 'Booster board', 2026,
      '401772999', '2026-09-13T17:00:00Z'::timestamptz,
      'Chicago Bears', 'CHI', 'Green Bay Packers', 'GB'
    );

    INSERT INTO public.season_entitlements (
      id, owner_id, season_year, status, boards_allowance, price_cents, currency
    ) VALUES (
      '${ENTITLEMENT_ID}'::uuid, '${OWNER_ID}'::uuid, 2026, 'active', 20, 1499, 'usd'
    );
  `);

  // gridone_publish_board sets status, axes, and published_at; the square names
  // live in contests.board_data, written by the organizer's draft saves. Seed
  // that first or the board publishes with an empty grid.
  await executeSql(`
    UPDATE public.contests
    SET board_data = ${sqlText(JSON.stringify(publicBoard))}::jsonb
    WHERE id = '${CONTEST_ID}'::uuid;
  `);

  await executeSql(`
    SET ROLE service_role;
    SELECT public.gridone_publish_board(
      '${CONTEST_ID}'::uuid,
      '${OWNER_ID}'::uuid,
      (SELECT revision FROM public.contests WHERE id = '${CONTEST_ID}'::uuid)::bigint,
      ${VALID_SIDE_AXIS},
      ${VALID_TOP_AXIS},
      ${sqlText(JSON.stringify(names))}::jsonb,
      ${sqlText(JSON.stringify(publicBoard))}::jsonb,
      ${sqlText(JSON.stringify(matchup))}::jsonb,
      false::boolean
    );
  `);

  // A second board published *with* open squares, so the 022 fill path has a
  // legitimate target under the rewritten trigger.
  const openNames = names.map((cell, index) => (index === OPEN_CELL ? [] : cell));
  await executeSql(`
    INSERT INTO public.contests (
      id, owner_id, share_code, title, season_year,
      game_external_id, game_starts_at,
      side_team_name, side_team_abbr, top_team_name, top_team_abbr,
      board_data
    ) VALUES (
      '${OPEN_CONTEST_ID}'::uuid, '${OWNER_ID}'::uuid, '${OPEN_SHARE_CODE}', 'Open board', 2026,
      '401772998', '2026-09-13T17:00:00Z'::timestamptz,
      'Chicago Bears', 'CHI', 'Green Bay Packers', 'GB',
      ${sqlText(JSON.stringify({ ...publicBoard, squares: openNames, allowOpenSquares: true }))}::jsonb
    );
  `);

  await executeSql(`
    SET ROLE service_role;
    SELECT public.gridone_publish_board(
      '${OPEN_CONTEST_ID}'::uuid,
      '${OWNER_ID}'::uuid,
      (SELECT revision FROM public.contests WHERE id = '${OPEN_CONTEST_ID}'::uuid)::bigint,
      ${VALID_SIDE_AXIS},
      ${VALID_TOP_AXIS},
      ${sqlText(JSON.stringify(openNames))}::jsonb,
      ${sqlText(JSON.stringify({ ...publicBoard, squares: openNames, allowOpenSquares: true }))}::jsonb,
      ${sqlText(JSON.stringify(matchup))}::jsonb,
      true::boolean
    );
  `);
};

describe.sequential('published square rename on disposable PostgreSQL 17', () => {
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
    await applyAllMigrations();
    await seedPublishedBoard();
  }, 300_000);

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName]).catch(() => undefined);
    }
  }, 60_000);

  it('keeps a seller alongside the buyer name and caps its length', async () => {
    await executeSql(`
      INSERT INTO public.contest_entries (contest_id, cell_index, paid_status, seller_label)
      VALUES ('${CONTEST_ID}'::uuid, 7, 'unpaid', 'Mora');
    `);

    expect(await queryScalar(`
      SELECT seller_label FROM public.contest_entries
      WHERE contest_id = '${CONTEST_ID}'::uuid AND cell_index = 7
    `)).toBe('Mora');

    await expect(executeSql(`
      UPDATE public.contest_entries
      SET seller_label = repeat('x', 81)
      WHERE contest_id = '${CONTEST_ID}'::uuid AND cell_index = 7;
    `)).rejects.toThrow(/seller_label/i);
  });

  it('still rejects a direct write to a published board', async () => {
    await expect(executeSql(`
      UPDATE public.contests
      SET board_data = jsonb_set(board_data, ARRAY['squares','0'], '["Sneaky"]'::jsonb, false)
      WHERE id = '${CONTEST_ID}'::uuid;
    `)).rejects.toThrow(/locked/i);
  });

  it('renames through the audited path and updates the viewer snapshot', async () => {
    const revisionBefore = Number(await queryScalar(
      `SELECT revision FROM public.public_board_snapshots WHERE contest_id = '${CONTEST_ID}'::uuid`,
    ));

    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${CONTEST_ID}'::uuid, 7, 'Sam Whitfield');
    `));

    expect(await queryScalar(`
      SELECT board_data -> 'squares' -> 7 ->> 0 FROM public.contests WHERE id = '${CONTEST_ID}'::uuid
    `)).toBe('Sam Whitfield');

    // The shared link must never disagree with the organizer's copy.
    expect(await queryScalar(`
      SELECT board -> 'squares' -> 7 ->> 0 FROM public.public_board_snapshots
      WHERE contest_id = '${CONTEST_ID}'::uuid
    `)).toBe('Sam Whitfield');

    expect(Number(await queryScalar(
      `SELECT revision FROM public.public_board_snapshots WHERE contest_id = '${CONTEST_ID}'::uuid`,
    ))).toBe(revisionBefore + 1);

    // Seller survives the buyer rename — that is the whole point of 023.
    expect(await queryScalar(`
      SELECT seller_label FROM public.contest_entries
      WHERE contest_id = '${CONTEST_ID}'::uuid AND cell_index = 7
    `)).toBe('Mora');

    expect(await queryScalar(`
      SELECT previous_name || ' -> ' || new_name FROM public.contest_square_edits
      WHERE contest_id = '${CONTEST_ID}'::uuid AND cell_index = 7
      ORDER BY changed_at DESC LIMIT 1
    `)).toBe('Buyer 8 -> Sam Whitfield');
  });

  it('records reopening a square as its own audited change', async () => {
    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${CONTEST_ID}'::uuid, 7, '');
    `));

    expect(await queryScalar(`
      SELECT jsonb_array_length(board_data -> 'squares' -> 7)
      FROM public.contests WHERE id = '${CONTEST_ID}'::uuid
    `)).toBe('0');

    expect(await queryScalar(`
      SELECT count(*) FROM public.contest_square_edits
      WHERE contest_id = '${CONTEST_ID}'::uuid AND cell_index = 7
    `)).toBe('2');
  });

  it('refuses a rename from anyone but the organizer', async () => {
    await expect(executeSql(asUser(STRANGER_ID, `
      SELECT public.gridone_rename_published_square('${CONTEST_ID}'::uuid, 3, 'Intruder');
    `))).rejects.toThrow(/only the organizer/i);

    expect(await queryScalar(`
      SELECT board_data -> 'squares' -> 3 ->> 0 FROM public.contests WHERE id = '${CONTEST_ID}'::uuid
    `)).toBe('Buyer 4');
  });

  // 024 rewrites the trigger that 022's open-squares fill depends on, and the
  // pricing-tier suite that covers that fill stops at migration 022 — so this
  // is the only place the two escape hatches are exercised together.
  it('still lets the open-squares fill through after the trigger rewrite', async () => {
    const filledNames = names.map((cell, index) => (
      index === OPEN_CELL ? ['Late Buyer'] : cell
    ));

    const result = await queryScalar(`
      SET ROLE service_role;
      SELECT filled_count FROM public.gridone_fill_open_squares(
        '${OPEN_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        (SELECT revision FROM public.contests WHERE id = '${OPEN_CONTEST_ID}'::uuid)::bigint,
        ${sqlText(JSON.stringify(filledNames))}::jsonb
      );
    `);

    expect(result).toBe('1');
    expect(await queryScalar(`
      SELECT board_data -> 'squares' -> ${OPEN_CELL} ->> 0
      FROM public.contests WHERE id = '${OPEN_CONTEST_ID}'::uuid
    `)).toBe('Late Buyer');
  });

  it('leaves the axis digits locked even on the rename path', async () => {
    const axisBefore = await queryScalar(
      `SELECT board_data -> 'leftAxis' FROM public.contests WHERE id = '${CONTEST_ID}'::uuid`,
    );

    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${CONTEST_ID}'::uuid, 12, 'Dana Reyes');
    `));

    expect(await queryScalar(
      `SELECT board_data -> 'leftAxis' FROM public.contests WHERE id = '${CONTEST_ID}'::uuid`,
    )).toBe(axisBefore);
  });
});
