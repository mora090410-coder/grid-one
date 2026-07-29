import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_NAME = 'gridone_score_test_mode';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-score-test-mode';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-score-test-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_OWNER_ID = '10000000-0000-4000-8000-000000000002';
const CONTEST_ID = '20000000-0000-4000-8000-000000000001';
const PARTICIPANT_ID = '30000000-0000-4000-8000-000000000001';
const SNAPSHOT_ID = '40000000-0000-4000-8000-000000000001';
const RESOLUTION_ID = '50000000-0000-4000-8000-000000000001';
const SUBSCRIPTION_ID = '60000000-0000-4000-8000-000000000001';
const ORDINARY_CONTEST_ID = '20000000-0000-4000-8000-000000000002';
const ORDINARY_PARTICIPANT_ID = '30000000-0000-4000-8000-000000000002';
const ORDINARY_SNAPSHOT_ID = '40000000-0000-4000-8000-000000000002';
const ORDINARY_RESOLUTION_ID = '50000000-0000-4000-8000-000000000002';
const ORDINARY_SUBSCRIPTION_ID = '60000000-0000-4000-8000-000000000002';

let containerStarted = false;

type CommandResult = { stdout: string; stderr: string };

const runCommand = (
  command: string,
  args: string[],
  input?: string,
  timeoutMs = 120_000,
) => new Promise<CommandResult>((resolveCommand, rejectCommand) => {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
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
  child.on('error', error => {
    clearTimeout(timeout);
    rejectCommand(error);
  });
  child.on('close', code => {
    clearTimeout(timeout);
    if (code === 0) resolveCommand({ stdout, stderr });
    else rejectCommand(new Error(
      `${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`,
    ));
  });
  child.stdin.end(input);
});

const docker = (args: string[], input?: string, timeoutMs?: number) =>
  runCommand('docker', args, input, timeoutMs);

const psqlArgs = (extraArgs: string[]) => [
  'exec',
  '-e',
  `PGPASSWORD=${DATABASE_PASSWORD}`,
  '-i',
  containerName,
  'psql',
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  DATABASE_USER,
  '-d',
  DATABASE_NAME,
  ...extraArgs,
];

const executeSql = async (sql: string) => {
  await docker(psqlArgs(['-q']), sql);
};

const queryScalar = async (sql: string) => {
  const { stdout } = await docker(psqlArgs(['-qAt', '-c', sql]));
  return stdout.trim();
};

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const { stdout: logs, stderr: errorLogs } = await docker([
        'logs',
        containerName,
      ], undefined, 5_000);
      if (!`${logs}\n${errorLogs}`.includes('PostgreSQL init process complete; ready for start up.')) {
        throw new Error('PostgreSQL image initialization is still in progress.');
      }
      await docker([
        'exec',
        containerName,
        'pg_isready',
        '-U',
        DATABASE_USER,
        '-d',
        DATABASE_NAME,
      ], undefined, 5_000);
      return;
    } catch {
      await new Promise(resolveWait => setTimeout(resolveWait, 250));
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
};

const bootstrapSupabasePrimitives = async () => {
  await executeSql(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END
    $roles$;

    ALTER ROLE service_role BYPASSRLS;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY,
      email text
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $function$;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $function$
      SELECT coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        current_user
      )
    $function$;

    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
  `);
};

const applyFullMigrationChain = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  expect(files).toContain('018_score_test_mode.sql');
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const seedScoreTestBoard = async () => {
  await executeSql(`
    INSERT INTO auth.users (id, email)
    VALUES
      ('${OWNER_ID}'::uuid, 'owner@example.test'),
      ('${OTHER_OWNER_ID}'::uuid, 'other@example.test');

    SET ROLE service_role;
    INSERT INTO public.contests (
      id,
      owner_id,
      share_code,
      title,
      status,
      score_test_mode,
      side_team_name,
      side_team_abbr,
      top_team_name,
      top_team_abbr,
      side_axis,
      top_axis,
      axis_locked_at,
      published_at
    )
    VALUES (
      '${CONTEST_ID}'::uuid,
      '${OWNER_ID}'::uuid,
      'ABCDEFGH',
      'Synthetic board',
      'published',
      true,
      'Chicago',
      'CHI',
      'Green Bay',
      'GB',
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      '2026-09-13T18:00:00Z'::timestamptz,
      '2026-09-13T18:00:00Z'::timestamptz
    );

    INSERT INTO public.public_board_snapshots (
      contest_id,
      share_code,
      revision,
      board_title,
      matchup,
      board,
      score_test_mode,
      published_at
    )
    VALUES (
      '${CONTEST_ID}'::uuid,
      'ABCDEFGH',
      1,
      'Synthetic board',
      '{}'::jsonb,
      '{}'::jsonb,
      false,
      '2026-09-13T18:00:00Z'::timestamptz
    );

    INSERT INTO public.contest_participants (
      id,
      contest_id,
      display_name,
      public_label
    )
    VALUES (
      '${PARTICIPANT_ID}'::uuid,
      '${CONTEST_ID}'::uuid,
      'Winner One',
      'Winner 1'
    );

    INSERT INTO public.score_snapshots (
      id,
      contest_id,
      source_mode,
      provider,
      game_state,
      period,
      side_score,
      top_score,
      quarter_scores,
      validation_status,
      retrieved_at,
      stale_after
    )
    VALUES (
      '${SNAPSHOT_ID}'::uuid,
      '${CONTEST_ID}'::uuid,
      'manual',
      'test',
      'post',
      4,
      17,
      13,
      '{}'::jsonb,
      'accepted',
      '2026-09-13T20:00:00Z'::timestamptz,
      '2026-09-13T20:01:00Z'::timestamptz
    );

    INSERT INTO public.milestone_resolutions (
      id,
      contest_id,
      milestone,
      score_snapshot_id,
      side_score,
      top_score,
      side_digit,
      top_digit,
      participant_id,
      resolved_at
    )
    VALUES (
      '${RESOLUTION_ID}'::uuid,
      '${CONTEST_ID}'::uuid,
      'FINAL',
      '${SNAPSHOT_ID}'::uuid,
      17,
      13,
      7,
      3,
      '${PARTICIPANT_ID}'::uuid,
      '2026-09-13T20:00:00Z'::timestamptz
    );

    INSERT INTO public.notification_subscriptions (
      id,
      contest_id,
      participant_id,
      email,
      status,
      unsubscribe_token_hash,
      verified_at
    )
    VALUES (
      '${SUBSCRIPTION_ID}'::uuid,
      '${CONTEST_ID}'::uuid,
      '${PARTICIPANT_ID}'::uuid,
      'winner@example.test',
      'verified',
      'test-token',
      '2026-09-13T19:00:00Z'::timestamptz
    );
    RESET ROLE;
  `);
};

beforeAll(async () => {
  await docker([
    'run',
    '--name',
    containerName,
    '-e',
    `POSTGRES_DB=${DATABASE_NAME}`,
    '-e',
    `POSTGRES_USER=${DATABASE_USER}`,
    '-e',
    `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
    '-d',
    POSTGRES_IMAGE,
  ], undefined, 120_000);
  containerStarted = true;
  await waitForPostgres();
  await bootstrapSupabasePrimitives();
  await applyFullMigrationChain();
  await seedScoreTestBoard();
}, 180_000);

afterAll(async () => {
  if (containerStarted) {
    await docker(['rm', '-f', containerName], undefined, 30_000).catch(() => undefined);
  }
}, 40_000);

describe.sequential('score-test mode boundary (full disposable migration chain)', () => {
  it('rejects direct authenticated attempts to create a flagged board', async () => {
    await expect(executeSql(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.role" = 'authenticated';
      SET LOCAL "request.jwt.claim.sub" = '${OWNER_ID}';
      INSERT INTO public.contests (
        owner_id,
        title,
        score_test_mode
      )
      VALUES (
        '${OWNER_ID}'::uuid,
        'Direct synthetic board',
        true
      );
      COMMIT;
    `)).rejects.toThrow(/server creation boundary/i);
  });

  it('allows the owner to read the flag but no other authenticated owner', async () => {
    expect(await queryScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.role" = 'authenticated';
      SET LOCAL "request.jwt.claim.sub" = '${OWNER_ID}';
      SELECT score_test_mode::text
      FROM public.contests
      WHERE id = '${CONTEST_ID}'::uuid;
      COMMIT;
    `)).toBe('true');

    expect(await queryScalar(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.role" = 'authenticated';
      SET LOCAL "request.jwt.claim.sub" = '${OTHER_OWNER_ID}';
      SELECT count(*)::text
      FROM public.contests
      WHERE id = '${CONTEST_ID}'::uuid;
      COMMIT;
    `)).toBe('0');
  });

  it('keeps the permanent flag immutable even for the service role', async () => {
    await expect(executeSql(`
      SET ROLE service_role;
      UPDATE public.contests
      SET score_test_mode = false
      WHERE id = '${CONTEST_ID}'::uuid;
    `)).rejects.toThrow(/immutable/i);
  });

  it('forces the public projection to the permanent contest flag', async () => {
    expect(await queryScalar(`
      SELECT score_test_mode::text
      FROM public.public_board_snapshots
      WHERE contest_id = '${CONTEST_ID}'::uuid;
    `)).toBe('true');
  });

  it('silently suppresses winner and correction delivery queue inserts', async () => {
    await executeSql(`
      SET ROLE service_role;
      INSERT INTO public.notification_deliveries (
        resolution_id,
        subscription_id,
        notification_kind,
        idempotency_key
      )
      VALUES
        (
          '${RESOLUTION_ID}'::uuid,
          '${SUBSCRIPTION_ID}'::uuid,
          'winner',
          'winner:${RESOLUTION_ID}:${SUBSCRIPTION_ID}'
        ),
        (
          '${RESOLUTION_ID}'::uuid,
          '${SUBSCRIPTION_ID}'::uuid,
          'correction_current',
          'correction:${RESOLUTION_ID}:${SUBSCRIPTION_ID}'
        );
    `);

    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.notification_deliveries
      WHERE resolution_id = '${RESOLUTION_ID}'::uuid;
    `)).toBe('0');
  });

  it('preserves ordinary-board winner delivery queue behavior', async () => {
    await executeSql(`
      SET ROLE service_role;
      INSERT INTO public.contests (
        id,
        owner_id,
        share_code,
        title,
        score_test_mode
      )
      VALUES (
        '${ORDINARY_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        'ABCDEFGJ',
        'Ordinary board',
        false
      );

      INSERT INTO public.contest_participants (
        id,
        contest_id,
        display_name,
        public_label
      )
      VALUES (
        '${ORDINARY_PARTICIPANT_ID}'::uuid,
        '${ORDINARY_CONTEST_ID}'::uuid,
        'Ordinary Winner',
        'Winner 2'
      );

      INSERT INTO public.score_snapshots (
        id,
        contest_id,
        source_mode,
        provider,
        game_state,
        period,
        side_score,
        top_score,
        quarter_scores,
        validation_status,
        retrieved_at,
        stale_after
      )
      VALUES (
        '${ORDINARY_SNAPSHOT_ID}'::uuid,
        '${ORDINARY_CONTEST_ID}'::uuid,
        'manual',
        'test',
        'post',
        4,
        10,
        7,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T20:00:00Z'::timestamptz,
        '2026-09-13T20:01:00Z'::timestamptz
      );

      INSERT INTO public.milestone_resolutions (
        id,
        contest_id,
        milestone,
        score_snapshot_id,
        side_score,
        top_score,
        side_digit,
        top_digit,
        participant_id
      )
      VALUES (
        '${ORDINARY_RESOLUTION_ID}'::uuid,
        '${ORDINARY_CONTEST_ID}'::uuid,
        'FINAL',
        '${ORDINARY_SNAPSHOT_ID}'::uuid,
        10,
        7,
        0,
        7,
        '${ORDINARY_PARTICIPANT_ID}'::uuid
      );

      INSERT INTO public.notification_subscriptions (
        id,
        contest_id,
        participant_id,
        email,
        status,
        unsubscribe_token_hash,
        verified_at
      )
      VALUES (
        '${ORDINARY_SUBSCRIPTION_ID}'::uuid,
        '${ORDINARY_CONTEST_ID}'::uuid,
        '${ORDINARY_PARTICIPANT_ID}'::uuid,
        'ordinary@example.test',
        'verified',
        'ordinary-token',
        '2026-09-13T19:00:00Z'::timestamptz
      );

      INSERT INTO public.notification_deliveries (
        resolution_id,
        subscription_id,
        notification_kind,
        idempotency_key
      )
      VALUES (
        '${ORDINARY_RESOLUTION_ID}'::uuid,
        '${ORDINARY_SUBSCRIPTION_ID}'::uuid,
        'winner',
        'winner:${ORDINARY_RESOLUTION_ID}:${ORDINARY_SUBSCRIPTION_ID}'
      );
    `);

    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.notification_deliveries
      WHERE resolution_id = '${ORDINARY_RESOLUTION_ID}'::uuid;
    `)).toBe('1');
  });

  it('does not grant direct viewer access to either permanent flag column', async () => {
    expect(await queryScalar(`
      SELECT
        has_column_privilege(
          'anon',
          'public.contests',
          'score_test_mode',
          'SELECT'
        )::text
        || ':'
        || has_column_privilege(
          'anon',
          'public.public_board_snapshots',
          'score_test_mode',
          'SELECT'
        )::text;
    `)).toBe('false:false');
  });
});
