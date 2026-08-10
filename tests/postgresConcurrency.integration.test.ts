import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}));

import { onRequestPost as activateBoard } from '../functions/api/pools/activate';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

const DATABASE_NAME = 'gridone_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ENTITLEMENT_ID = '22222222-2222-4222-8222-222222222222';
const SCORE_CONTEST_ID = '33333333-3333-4333-8333-333333333333';
const MANUAL_CONTEST_ID = '44444444-4444-4444-8444-444444444444';
const NEWER_SNAPSHOT_ID = '55555555-5555-4555-8555-555555555555';
const OLDER_SNAPSHOT_ID = '66666666-6666-4666-8666-666666666666';
const MANUAL_MODE_SNAPSHOT_ID = '77777777-7777-4777-8777-777777777777';
const OLDER_LEASE_TOKEN = '88888888-8888-4888-8888-888888888888';
const NEWER_LEASE_TOKEN = '99999999-9999-4999-8999-999999999999';
const MANUAL_LEASE_TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUTO_AFTER_MANUAL_SNAPSHOT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AUTO_AFTER_MANUAL_LEASE_TOKEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PROJECTION_FAILURE_CONTEST_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECTION_FAILURE_SNAPSHOT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PROJECTION_FAILURE_LEASE_TOKEN = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const containerName = `gridone-postgres-${process.pid}-${randomUUID().slice(0, 8)}`;
const contestIds = Array.from(
  { length: 25 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);

const env = {
  VITE_SUPABASE_URL: 'http://disposable-postgres.test',
  VITE_SUPABASE_ANON_KEY: 'local-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
};

let containerStarted = false;

type CommandResult = {
  stdout: string;
  stderr: string;
};

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
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.on('error', (error) => {
    clearTimeout(timeout);
    rejectCommand(error);
  });
  child.on('close', (code) => {
    clearTimeout(timeout);
    if (code === 0) {
      resolveCommand({ stdout, stderr });
      return;
    }
    rejectCommand(new Error(
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

const queryJson = async <T>(sql: string) => JSON.parse(await queryScalar(sql)) as T;

const acquireScoreLease = async (contestId: string, leaseToken: string) =>
  queryJson<{
    acquired: boolean;
    scoring_mode: string;
    authority_generation: number;
    refresh_sequence: number;
    refresh_started_at: string | null;
  }>(`
    SET ROLE service_role;
    SELECT row_to_json(result)::text
    FROM public.gridone_acquire_score_refresh_lease_v2(
      '${contestId}'::uuid,
      '${leaseToken}'::uuid,
      45
    ) AS result
  `);

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
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
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

const applyMigrations = async () => {
  const migrationDirectory = resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((file) => (
      /^\d{3}_.+\.sql$/.test(file)
      && Number(file.slice(0, 3)) <= 14
    ))
    .sort();

  const migrationNumbers = migrationFiles.map((file) => Number(file.slice(0, 3)));
  expect(migrationNumbers).toEqual(
    expectedMigrationNumbers(14),
  );

  for (const migrationFile of migrationFiles) {
    await executeSql(readFileSync(resolve(migrationDirectory, migrationFile), 'utf8'));
  }
};

const seedActivationFixture = async () => {
  const contestValues = contestIds
    .map((contestId, index) => (
      `('${contestId}'::uuid, '${OWNER_ID}'::uuid, 'Concurrency board ${index + 1}', 2026)`
    ))
    .join(',\n');

  await executeSql(`
    INSERT INTO auth.users (id, email)
    VALUES ('${OWNER_ID}'::uuid, 'owner@example.test');

    INSERT INTO public.contests (id, owner_id, title, season_year)
    VALUES
      ${contestValues};

    INSERT INTO public.season_entitlements (
      id,
      owner_id,
      season_year,
      status,
      boards_allowance,
      price_cents,
      currency
    )
    VALUES (
      '${ENTITLEMENT_ID}'::uuid,
      '${OWNER_ID}'::uuid,
      2026,
      'active',
      20,
      499,
      'usd'
    );
  `);
};

const invokeActivationRpc = async (
  functionName: string,
  params: Record<string, unknown>,
) => {
  if (functionName !== 'gridone_activate_board') {
    return { data: null, error: { message: `Unexpected RPC ${functionName}` } };
  }
  const contestId = String(params.p_contest_id);
  const ownerId = String(params.p_owner_id);
  const seasonYear = Number(params.p_season_year);

  try {
    const row = await queryJson<{ activated: boolean; used: number; allowance: number }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_activate_board(
        '${contestId}'::uuid,
        '${ownerId}'::uuid,
        ${seasonYear}::smallint
      ) AS result
    `);
    return { data: [row], error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
};

const activate = async (contestId: string) => {
  const request = new Request('https://example.test/api/pools/activate', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer local-owner-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contestId }),
  });
  const response = await activateBoard({ request, env });
  return {
    contestId,
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
};

describe.sequential('disposable Postgres transaction boundaries', () => {
  beforeAll(async () => {
    await docker([
      'run',
      '--rm',
      '--detach',
      '--name',
      containerName,
      '--env',
      `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env',
      `POSTGRES_DB=${DATABASE_NAME}`,
      POSTGRES_IMAGE,
    ], undefined, 180_000);
    containerStarted = true;
    await waitForPostgres();
    await bootstrapSupabasePrimitives();
    await applyMigrations();
    await seedActivationFixture();

    supabaseMocks.createClient.mockImplementation(
      (_url: string, key: string) => {
        if (key === env.VITE_SUPABASE_ANON_KEY) {
          return {
            auth: {
              getUser: vi.fn(async () => ({
                data: { user: { id: OWNER_ID } },
              })),
            },
          };
        }
        if (key === env.SUPABASE_SERVICE_ROLE_KEY) {
          return { rpc: invokeActivationRpc };
        }
        throw new Error('Unexpected disposable Supabase client key.');
      },
    );
  }, 240_000);

  afterAll(async () => {
    supabaseMocks.createClient.mockReset();
    if (containerStarted) {
      await docker(['rm', '--force', containerName], undefined, 30_000);
      containerStarted = false;
    }
  }, 60_000);

  it('retires the pre-publish activation handler without consuming any allowance', async () => {
    const firstRun = await Promise.all(contestIds.map(activate));
    expect(firstRun.every(({ status, body }) => (
      status === 410
      && body.code === 'PUBLISH_IS_ALLOWANCE_BOUNDARY'
    ))).toBe(true);
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.board_activations
      WHERE entitlement_id = '${ENTITLEMENT_ID}'::uuid
    `)).toBe('0');
  }, 120_000);

  it('rejects a slow older refresh after a newer-started refresh owns canonical and public score', async () => {
    await executeSql(`
      INSERT INTO public.contests (
        id,
        owner_id,
        title,
        season_year,
        share_code,
        status,
        side_axis,
        top_axis,
        axis_locked_at,
        axis_locked_by,
        published_at
      )
      VALUES (
        '${SCORE_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        'Score ordering board',
        2026,
        'ABCDEFGH',
        'published',
        ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
        ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
        '2026-09-13T17:59:00Z'::timestamptz,
        '${OWNER_ID}'::uuid,
        '2026-09-13T18:00:00Z'::timestamptz
      );

      INSERT INTO public.public_board_snapshots (
        contest_id,
        share_code,
        revision,
        board_title,
        matchup,
        board,
        published_at
      )
      VALUES (
        '${SCORE_CONTEST_ID}'::uuid,
        'ABCDEFGH',
        1,
        'Score ordering board',
        '{}'::jsonb,
        '{}'::jsonb,
        '2026-09-13T18:00:00Z'::timestamptz
      );
    `);

    const olderLease = await acquireScoreLease(SCORE_CONTEST_ID, OLDER_LEASE_TOKEN);
    expect(olderLease).toMatchObject({
      acquired: true,
      authority_generation: 1,
      refresh_sequence: 1,
    });
    await executeSql(`
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
        stale_after,
        authority_generation,
        refresh_sequence,
        refresh_started_at
      )
      VALUES (
        '${OLDER_SNAPSHOT_ID}'::uuid,
        '${SCORE_CONTEST_ID}'::uuid,
        'automatic',
        'test',
        'in',
        2,
        7,
        10,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T19:05:00Z'::timestamptz,
        '2026-09-13T19:06:00Z'::timestamptz,
        ${olderLease.authority_generation},
        ${olderLease.refresh_sequence},
        '${olderLease.refresh_started_at}'::timestamptz
      );

      UPDATE public.score_refresh_leases
      SET locked_until = clock_timestamp() - interval '1 second'
      WHERE contest_id = '${SCORE_CONTEST_ID}'::uuid;
    `);

    const newerLease = await acquireScoreLease(SCORE_CONTEST_ID, NEWER_LEASE_TOKEN);
    expect(newerLease).toMatchObject({
      acquired: true,
      authority_generation: 1,
      refresh_sequence: 2,
    });
    await executeSql(`
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
        stale_after,
        authority_generation,
        refresh_sequence,
        refresh_started_at
      )
      VALUES (
        '${NEWER_SNAPSHOT_ID}'::uuid,
        '${SCORE_CONTEST_ID}'::uuid,
        'automatic',
        'test',
        'in',
        2,
        14,
        10,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T19:00:00Z'::timestamptz,
        '2026-09-13T19:01:00Z'::timestamptz,
        ${newerLease.authority_generation},
        ${newerLease.refresh_sequence},
        '${newerLease.refresh_started_at}'::timestamptz
      );
    `);

    expect(await queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${SCORE_CONTEST_ID}'::uuid,
        '${NEWER_SNAPSHOT_ID}'::uuid
      )::text
    `)).toBe('true');
    expect(await queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${SCORE_CONTEST_ID}'::uuid,
        '${OLDER_SNAPSHOT_ID}'::uuid
      )::text
    `)).toBe('false');

    expect(await queryJson<{
      currentSnapshotId: string;
      newerIsCurrent: boolean;
      olderIsCurrent: boolean;
      publicLeftScore: number;
      publicTopScore: number;
    }>(`
      SELECT json_build_object(
        'currentSnapshotId', state.current_snapshot_id,
        'newerIsCurrent', newer.is_current,
        'olderIsCurrent', older.is_current,
        'publicLeftScore', (public_snapshot.score ->> 'leftScore')::integer,
        'publicTopScore', (public_snapshot.score ->> 'topScore')::integer
      )::text
      FROM public.contest_score_state state
      JOIN public.score_snapshots newer ON newer.id = '${NEWER_SNAPSHOT_ID}'::uuid
      JOIN public.score_snapshots older ON older.id = '${OLDER_SNAPSHOT_ID}'::uuid
      JOIN public.public_board_snapshots public_snapshot
        ON public_snapshot.contest_id = state.contest_id
      WHERE state.contest_id = '${SCORE_CONTEST_ID}'::uuid
    `)).toEqual({
      currentSnapshotId: NEWER_SNAPSHOT_ID,
      newerIsCurrent: true,
      olderIsCurrent: false,
      publicLeftScore: 14,
      publicTopScore: 10,
    });
  });

  it('rolls canonical promotion back when a published viewer projection is unavailable', async () => {
    await executeSql(`
      INSERT INTO public.contests (
        id,
        owner_id,
        title,
        season_year,
        share_code,
        status,
        side_axis,
        top_axis,
        axis_locked_at,
        axis_locked_by,
        published_at
      )
      VALUES (
        '${PROJECTION_FAILURE_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        'Projection rollback board',
        2026,
        'RSTUVWXY',
        'published',
        ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
        ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
        '2026-09-13T17:59:00Z'::timestamptz,
        '${OWNER_ID}'::uuid,
        '2026-09-13T18:00:00Z'::timestamptz
      );
    `);
    const lease = await acquireScoreLease(
      PROJECTION_FAILURE_CONTEST_ID,
      PROJECTION_FAILURE_LEASE_TOKEN,
    );
    await executeSql(`
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
        stale_after,
        authority_generation,
        refresh_sequence,
        refresh_started_at
      )
      VALUES (
        '${PROJECTION_FAILURE_SNAPSHOT_ID}'::uuid,
        '${PROJECTION_FAILURE_CONTEST_ID}'::uuid,
        'automatic',
        'test',
        'in',
        1,
        7,
        3,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T19:00:00Z'::timestamptz,
        '2026-09-13T19:01:00Z'::timestamptz,
        ${lease.authority_generation},
        ${lease.refresh_sequence},
        '${lease.refresh_started_at}'::timestamptz
      );
    `);

    await expect(queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${PROJECTION_FAILURE_CONTEST_ID}'::uuid,
        '${PROJECTION_FAILURE_SNAPSHOT_ID}'::uuid
      )::text
    `)).rejects.toThrow('Published score projection is unavailable');
    expect(await queryJson<{
      currentSnapshotId: string | null;
      promotedRefreshSequence: number;
      snapshotIsCurrent: boolean;
    }>(`
      SELECT json_build_object(
        'currentSnapshotId', state.current_snapshot_id,
        'promotedRefreshSequence', state.promoted_refresh_sequence,
        'snapshotIsCurrent', snapshot.is_current
      )::text
      FROM public.contest_score_state state
      JOIN public.score_snapshots snapshot
        ON snapshot.id = '${PROJECTION_FAILURE_SNAPSHOT_ID}'::uuid
      WHERE state.contest_id = '${PROJECTION_FAILURE_CONTEST_ID}'::uuid
    `)).toEqual({
      currentSnapshotId: null,
      promotedRefreshSequence: 0,
      snapshotIsCurrent: false,
    });
  });

  it('invalidates in-flight automatic authority across manual and automatic transitions', async () => {
    await executeSql(`
      INSERT INTO public.contests (
        id,
        owner_id,
        title,
        season_year,
        share_code,
        status,
        side_axis,
        top_axis,
        axis_locked_at,
        axis_locked_by,
        published_at,
        game_external_id,
        game_starts_at,
        side_team_name,
        side_team_abbr,
        top_team_name,
        top_team_abbr
      )
      VALUES (
        '${MANUAL_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        'Manual mode board',
        2026,
        'JKLMNPQR',
        'published',
        ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
        ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
        '2026-09-13T17:59:00Z'::timestamptz,
        '${OWNER_ID}'::uuid,
        '2026-09-13T18:00:00Z'::timestamptz,
        '401000001',
        '2026-09-13T17:00:00Z'::timestamptz,
        'Chicago Bears',
        'CHI',
        'Green Bay Packers',
        'GB'
      );

      INSERT INTO public.public_board_snapshots (
        contest_id,
        share_code,
        revision,
        board_title,
        matchup,
        board,
        published_at
      )
      VALUES (
        '${MANUAL_CONTEST_ID}'::uuid,
        'JKLMNPQR',
        1,
        'Manual mode board',
        '{}'::jsonb,
        '{}'::jsonb,
        '2026-09-13T18:00:00Z'::timestamptz
      );
    `);

    const oldAutomaticLease = await acquireScoreLease(
      MANUAL_CONTEST_ID,
      MANUAL_LEASE_TOKEN,
    );
    expect(oldAutomaticLease).toMatchObject({
      acquired: true,
      authority_generation: 1,
      refresh_sequence: 1,
    });
    await executeSql(`
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
        stale_after,
        authority_generation,
        refresh_sequence,
        refresh_started_at
      )
      VALUES (
        '${MANUAL_MODE_SNAPSHOT_ID}'::uuid,
        '${MANUAL_CONTEST_ID}'::uuid,
        'automatic',
        'test',
        'in',
        2,
        14,
        10,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T19:00:00Z'::timestamptz,
        '2026-09-13T19:01:00Z'::timestamptz,
        ${oldAutomaticLease.authority_generation},
        ${oldAutomaticLease.refresh_sequence},
        '${oldAutomaticLease.refresh_started_at}'::timestamptz
      );
    `);

    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_enable_manual_scoring(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        '2026-09-13T19:00:30Z'::timestamptz
      )::text
    `)).toBe('true');
    expect(await queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${MANUAL_MODE_SNAPSHOT_ID}'::uuid
      )::text
    `)).toBe('false');

    expect(await queryJson<{
      scoringMode: string;
      currentSnapshotId: string | null;
      automaticIsCurrent: boolean;
      publicScore: unknown;
      leaseCount: number;
    }>(`
      SELECT json_build_object(
        'scoringMode', state.scoring_mode,
        'currentSnapshotId', state.current_snapshot_id,
        'automaticIsCurrent', snapshot.is_current,
        'publicScore', public_snapshot.score,
        'leaseCount', (
          SELECT count(*)::integer
          FROM public.score_refresh_leases lease
          WHERE lease.contest_id = state.contest_id
        )
      )::text
      FROM public.contest_score_state state
      JOIN public.score_snapshots snapshot
        ON snapshot.id = '${MANUAL_MODE_SNAPSHOT_ID}'::uuid
      JOIN public.public_board_snapshots public_snapshot
        ON public_snapshot.contest_id = state.contest_id
      WHERE state.contest_id = '${MANUAL_CONTEST_ID}'::uuid
    `)).toEqual({
      scoringMode: 'manual',
      currentSnapshotId: null,
      automaticIsCurrent: false,
      publicScore: null,
      leaseCount: 0,
    });

    const manualSnapshotId = await queryScalar(`
      SET ROLE service_role;
      SELECT id::text
      FROM public.gridone_commit_manual_score(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        'in',
        2::smallint,
        7::smallint,
        14::smallint,
        '{"Q1":{"left":7,"top":14},"Q2":{"left":0,"top":0},"Q3":{"left":0,"top":0},"Q4":{"left":0,"top":0},"OT":{"left":0,"top":0}}'::jsonb,
        '12:00',
        '2026-09-13T19:01:00Z'::timestamptz
      )
    `);
    expect(manualSnapshotId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await queryJson<{ isManual: boolean; leftScore: number; topScore: number }>(`
      SELECT json_build_object(
        'isManual', (score ->> 'isManual')::boolean,
        'leftScore', (score ->> 'leftScore')::integer,
        'topScore', (score ->> 'topScore')::integer
      )::text
      FROM public.public_board_snapshots
      WHERE contest_id = '${MANUAL_CONTEST_ID}'::uuid
    `)).toEqual({
      isManual: true,
      leftScore: 7,
      topScore: 14,
    });

    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_enable_automatic_scoring(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        '2026-09-13T19:02:00Z'::timestamptz
      )::text
    `)).toBe('true');
    expect(await queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${MANUAL_MODE_SNAPSHOT_ID}'::uuid
      )::text
    `)).toBe('false');

    const newAutomaticLease = await acquireScoreLease(
      MANUAL_CONTEST_ID,
      AUTO_AFTER_MANUAL_LEASE_TOKEN,
    );
    expect(newAutomaticLease).toMatchObject({
      acquired: true,
      authority_generation: 3,
      refresh_sequence: 2,
    });
    await executeSql(`
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
        stale_after,
        authority_generation,
        refresh_sequence,
        refresh_started_at
      )
      VALUES (
        '${AUTO_AFTER_MANUAL_SNAPSHOT_ID}'::uuid,
        '${MANUAL_CONTEST_ID}'::uuid,
        'automatic',
        'test',
        'in',
        2,
        10,
        14,
        '{}'::jsonb,
        'accepted',
        '2026-09-13T19:03:00Z'::timestamptz,
        '2026-09-13T19:04:00Z'::timestamptz,
        ${newAutomaticLease.authority_generation},
        ${newAutomaticLease.refresh_sequence},
        '${newAutomaticLease.refresh_started_at}'::timestamptz
      );
    `);
    expect(await queryScalar(`
      SELECT public.gridone_promote_score_snapshot(
        '${MANUAL_CONTEST_ID}'::uuid,
        '${AUTO_AFTER_MANUAL_SNAPSHOT_ID}'::uuid
      )::text
    `)).toBe('true');
    expect(await queryJson<{
      scoringMode: string;
      currentSnapshotId: string;
      isManual: boolean;
      leftScore: number;
    }>(`
      SELECT json_build_object(
        'scoringMode', state.scoring_mode,
        'currentSnapshotId', state.current_snapshot_id,
        'isManual', (public_snapshot.score ->> 'isManual')::boolean,
        'leftScore', (public_snapshot.score ->> 'leftScore')::integer
      )::text
      FROM public.contest_score_state state
      JOIN public.public_board_snapshots public_snapshot
        ON public_snapshot.contest_id = state.contest_id
      WHERE state.contest_id = '${MANUAL_CONTEST_ID}'::uuid
    `)).toEqual({
      scoringMode: 'automatic',
      currentSnapshotId: AUTO_AFTER_MANUAL_SNAPSHOT_ID,
      isManual: false,
      leftScore: 10,
    });
  });
});
