import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

const DATABASE_NAME = 'gridone_milestones';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-milestone-test';
const POSTGRES_IMAGE = 'postgres:17';
const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const CONTEST_ID = '20000000-0000-4000-8000-000000000001';
const OLD_PARTICIPANT_ID = '30000000-0000-4000-8000-000000000001';
const NEW_PARTICIPANT_ID = '30000000-0000-4000-8000-000000000002';
const OLD_SUBSCRIPTION_ID = '40000000-0000-4000-8000-000000000001';
const NEW_SUBSCRIPTION_ID = '40000000-0000-4000-8000-000000000002';
const containerName = `gridone-milestones-${process.pid}-${randomUUID().slice(0, 8)}`;

let containerStarted = false;
let snapshotSequence = 0;

type CommandResult = {
  stdout: string;
  stderr: string;
};

type ObservationResult = {
  winner_history: Array<Record<string, unknown>>;
  pending_milestones: Array<Record<string, unknown>>;
  newly_confirmed_resolution_ids: string[];
};

type CorrectionResult = {
  resolution: Record<string, unknown>;
  winner_history: Array<Record<string, unknown>>;
  pending_milestones: Array<Record<string, unknown>>;
  delivery_ids: string[];
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
  child.stdout.on('data', chunk => {
    stdout += chunk;
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });
  child.on('error', error => {
    clearTimeout(timeout);
    rejectCommand(error);
  });
  child.on('close', code => {
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

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const { stdout: logs, stderr: errorLogs } = await docker([
        'logs',
        containerName,
      ], undefined, 5_000);
      if (!`${logs}\n${errorLogs}`.includes(
        'PostgreSQL init process complete; ready for start up.',
      )) {
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
    .filter(file => /^\d{3}_.+\.sql$/.test(file) && Number(file.slice(0, 3)) <= 17)
    .sort();

  expect(migrationFiles.map(file => Number(file.slice(0, 3)))).toEqual(
    expectedMigrationNumbers(17),
  );

  for (const migrationFile of migrationFiles) {
    await executeSql(readFileSync(resolve(migrationDirectory, migrationFile), 'utf8'));
  }
};

const seedFixtures = async () => {
  await executeSql(`
    INSERT INTO auth.users (id, email)
    VALUES ('${OWNER_ID}'::uuid, 'owner@example.test');

    INSERT INTO public.contests (
      id,
      owner_id,
      share_code,
      title,
      status,
      side_axis,
      top_axis,
      axis_locked_at,
      published_at
    )
    VALUES (
      '${CONTEST_ID}'::uuid,
      '${OWNER_ID}'::uuid,
      'ABCDEFGH',
      'Milestone confirmation board',
      'published',
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      '2026-09-13T16:00:00Z',
      '2026-09-13T16:00:00Z'
    );

    INSERT INTO public.contest_participants (
      id,
      contest_id,
      display_name,
      public_label
    )
    VALUES
      (
        '${OLD_PARTICIPANT_ID}'::uuid,
        '${CONTEST_ID}'::uuid,
        'Original winner',
        'Original'
      ),
      (
        '${NEW_PARTICIPANT_ID}'::uuid,
        '${CONTEST_ID}'::uuid,
        'Corrected winner',
        'Corrected'
      );

    INSERT INTO public.square_assignments (
      contest_id,
      cell_index,
      participant_id
    )
    VALUES
      ('${CONTEST_ID}'::uuid, 73, '${OLD_PARTICIPANT_ID}'::uuid),
      ('${CONTEST_ID}'::uuid, 74, '${NEW_PARTICIPANT_ID}'::uuid);

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
      '${CONTEST_ID}'::uuid,
      'ABCDEFGH',
      1,
      'Milestone confirmation board',
      '{}'::jsonb,
      '{}'::jsonb,
      '2026-09-13T16:00:00Z'
    );

    INSERT INTO public.notification_subscriptions (
      id,
      contest_id,
      participant_id,
      email,
      status,
      unsubscribe_token_hash,
      verified_at,
      created_at
    )
    VALUES
      (
        '${OLD_SUBSCRIPTION_ID}'::uuid,
        '${CONTEST_ID}'::uuid,
        '${OLD_PARTICIPANT_ID}'::uuid,
        'original@example.test',
        'verified',
        repeat('a', 64),
        '2026-01-13T15:00:00Z',
        '2026-01-13T15:00:00Z'
      ),
      (
        '${NEW_SUBSCRIPTION_ID}'::uuid,
        '${CONTEST_ID}'::uuid,
        '${NEW_PARTICIPANT_ID}'::uuid,
        'corrected@example.test',
        'verified',
        repeat('b', 64),
        '2026-01-13T15:00:00Z',
        '2026-01-13T15:00:00Z'
      );
  `);
};

const resetMilestones = async () => {
  snapshotSequence = 0;
  await executeSql(`
    TRUNCATE TABLE public.score_snapshots CASCADE;
    DELETE FROM public.contest_audit_events
    WHERE contest_id = '${CONTEST_ID}'::uuid
      AND event_type = 'milestone.corrected';
    UPDATE public.public_board_snapshots
    SET winner_history = '[]'::jsonb, pending_milestones = '[]'::jsonb
    WHERE contest_id = '${CONTEST_ID}'::uuid;
  `);
};

const makeSnapshot = async ({
  retrievedAt,
  q1Side,
  q1Top,
  period = 2,
  gameState = 'in',
  sourceMode = 'automatic',
}: {
  retrievedAt: string;
  q1Side: number;
  q1Top: number;
  period?: number;
  gameState?: 'pre' | 'in' | 'post';
  sourceMode?: 'automatic' | 'manual';
}) => {
  snapshotSequence += 1;
  const snapshotId = `50000000-0000-4000-8000-${String(snapshotSequence).padStart(12, '0')}`;
  const quarterScores = JSON.stringify({
    Q1: { left: q1Side, top: q1Top },
    Q2: { left: 0, top: 0 },
    Q3: { left: 0, top: 0 },
    Q4: { left: 0, top: 0 },
    OT: { left: 0, top: 0 },
  });

  await executeSql(`
    UPDATE public.score_snapshots
    SET is_current = false
    WHERE contest_id = '${CONTEST_ID}'::uuid
      AND is_current;

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
      is_current,
      authority_generation,
      refresh_sequence,
      refresh_started_at
    )
    VALUES (
      '${snapshotId}'::uuid,
      '${CONTEST_ID}'::uuid,
      '${sourceMode}',
      '${sourceMode === 'manual' ? 'organizer' : 'provider'}',
      '${gameState}',
      ${period},
      ${q1Side},
      ${q1Top},
      '${quarterScores}'::jsonb,
      'accepted',
      '${retrievedAt}'::timestamptz,
      '${retrievedAt}'::timestamptz + interval '5 minutes',
      true,
      ${sourceMode === 'automatic' ? 1 : 'NULL'},
      ${sourceMode === 'automatic' ? snapshotSequence : 'NULL'},
      ${sourceMode === 'automatic' ? `'${retrievedAt}'::timestamptz` : 'NULL'}
    );

    INSERT INTO public.contest_score_state (
      contest_id,
      scoring_mode,
      current_snapshot_id,
      authority_generation,
      latest_refresh_sequence,
      promoted_refresh_sequence
    )
    VALUES (
      '${CONTEST_ID}'::uuid,
      '${sourceMode}',
      '${snapshotId}'::uuid,
      1,
      ${sourceMode === 'automatic' ? snapshotSequence : 0},
      ${sourceMode === 'automatic' ? snapshotSequence : 0}
    )
    ON CONFLICT (contest_id) DO UPDATE
    SET
      scoring_mode = EXCLUDED.scoring_mode,
      current_snapshot_id = EXCLUDED.current_snapshot_id,
      authority_generation = EXCLUDED.authority_generation,
      latest_refresh_sequence = EXCLUDED.latest_refresh_sequence,
      promoted_refresh_sequence = EXCLUDED.promoted_refresh_sequence;
  `);

  return snapshotId;
};

const observe = async (snapshotId: string) => queryJson<ObservationResult>(`
  SET ROLE service_role;
  SELECT row_to_json(result)::text
  FROM public.gridone_observe_milestones(
    '${CONTEST_ID}'::uuid,
    '${snapshotId}'::uuid
  ) result
`);

const correct = async ({
  expectedVersion,
  sideScore,
  topScore,
}: {
  expectedVersion: number;
  sideScore: number;
  topScore: number;
}) => queryJson<CorrectionResult>(`
  SET ROLE service_role;
  SELECT row_to_json(result)::text
  FROM public.gridone_correct_milestone(
    '${CONTEST_ID}'::uuid,
    '${OWNER_ID}'::uuid,
    'Q1',
    ${expectedVersion},
    ${sideScore},
    ${topScore},
    'Provider corrected the first-quarter score'
  ) result
`);

describe.sequential('milestone confirmation and correction in disposable PostgreSQL', () => {
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
    await seedFixtures();
  }, 240_000);

  beforeEach(async () => {
    await resetMilestones();
  });

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName], undefined, 30_000);
      containerStarted = false;
    }
  }, 60_000);

  it('resets a changed candidate and confirms only a distinct stable read 45 seconds later', async () => {
    const first = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    const firstResult = await observe(first);
    expect(firstResult.newly_confirmed_resolution_ids).toEqual([]);
    expect(firstResult.pending_milestones).toMatchObject([{
      milestone: 'Q1',
      status: 'pending',
      sideScore: 7,
      topScore: 13,
    }]);
    expect(await queryScalar('SELECT count(*) FROM public.notification_deliveries')).toBe('0');

    const changed = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:25Z',
      q1Side: 7,
      q1Top: 14,
    });
    expect((await observe(changed)).newly_confirmed_resolution_ids).toEqual([]);

    const stable = await makeSnapshot({
      retrievedAt: '2026-09-13T18:01:10Z',
      q1Side: 7,
      q1Top: 14,
    });
    const confirmed = await observe(stable);
    expect(confirmed.newly_confirmed_resolution_ids).toHaveLength(1);
    expect(confirmed.pending_milestones).toEqual([]);
    expect(confirmed.winner_history).toMatchObject([{
      milestone: 'Q1',
      sideScore: 7,
      topScore: 14,
      participantName: 'Corrected winner',
      resolutionVersion: 1,
      corrected: false,
    }]);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_deliveries
      WHERE notification_kind = 'winner'
        AND subscription_id = '${NEW_SUBSCRIPTION_ID}'::uuid
    `)).toBe('1');
  });

  it('does not advance or duplicate confirmation when the same snapshot is replayed', async () => {
    const first = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    await observe(first);
    await observe(first);
    expect(await queryScalar(`
      SELECT successful_read_count FROM public.pending_resolutions
      WHERE contest_id = '${CONTEST_ID}'::uuid AND milestone = 'Q1'
    `)).toBe('1');

    const stable = await makeSnapshot({
      retrievedAt: '2026-09-13T18:01:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    await observe(stable);
    await observe(stable);
    expect(await queryScalar(`
      SELECT count(*) FROM public.milestone_resolutions
      WHERE contest_id = '${CONTEST_ID}'::uuid AND milestone = 'Q1'
    `)).toBe('1');
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_deliveries
      WHERE notification_kind = 'winner'
    `)).toBe('1');
  });

  it('discards pending state on a provider regression and confirms manual saves immediately', async () => {
    const endedQuarter = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    await observe(endedQuarter);

    const regression = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:30Z',
      q1Side: 7,
      q1Top: 13,
      period: 1,
    });
    expect((await observe(regression)).pending_milestones).toEqual([]);
    expect(await queryScalar('SELECT count(*) FROM public.milestone_resolutions')).toBe('0');

    const manual = await makeSnapshot({
      retrievedAt: '2026-09-13T18:01:00Z',
      q1Side: 7,
      q1Top: 13,
      sourceMode: 'manual',
    });
    expect((await observe(manual)).newly_confirmed_resolution_ids).toHaveLength(1);
  });

  it('appends corrections, records audit, queues both correction recipients, and rejects stale replay', async () => {
    const first = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    await observe(first);
    const stable = await makeSnapshot({
      retrievedAt: '2026-09-13T18:01:00Z',
      q1Side: 7,
      q1Top: 13,
    });
    await observe(stable);

    const before = await queryJson<Record<string, unknown>>(`
      SELECT to_jsonb(resolution)::text
      FROM public.milestone_resolutions resolution
      WHERE contest_id = '${CONTEST_ID}'::uuid
        AND milestone = 'Q1'
        AND resolution_version = 1
    `);

    const corrected = await correct({
      expectedVersion: 1,
      sideScore: 7,
      topScore: 14,
    });
    expect(corrected.delivery_ids).toHaveLength(2);
    expect(corrected.pending_milestones).toEqual([]);
    expect(corrected.resolution).toMatchObject({
      milestone: 'Q1',
      side_score: 7,
      top_score: 14,
      resolution_version: 2,
    });
    expect(corrected.winner_history).toMatchObject([{
      milestone: 'Q1',
      participantName: 'Corrected winner',
      resolutionVersion: 2,
      corrected: true,
      versions: [
        { resolutionVersion: 1, participantName: 'Original winner', isCurrent: false },
        { resolutionVersion: 2, participantName: 'Corrected winner', isCurrent: true },
      ],
    }]);
    expect(await queryJson<Record<string, unknown>>(`
      SELECT to_jsonb(resolution)::text
      FROM public.milestone_resolutions resolution
      WHERE contest_id = '${CONTEST_ID}'::uuid
        AND milestone = 'Q1'
        AND resolution_version = 1
    `)).toEqual(before);
    expect(await queryJson<string[]>(`
      SELECT json_agg(notification_kind ORDER BY notification_kind)::text
      FROM public.notification_deliveries
      WHERE notification_kind LIKE 'correction_%'
    `)).toEqual(['correction_current', 'correction_previous']);
    expect(await queryScalar(`
      SELECT count(*) FROM public.contest_audit_events
      WHERE event_type = 'milestone.corrected'
        AND actor_id = '${OWNER_ID}'::uuid
    `)).toBe('1');

    await expect(correct({
      expectedVersion: 1,
      sideScore: 7,
      topScore: 14,
    })).rejects.toThrow(/Milestone correction is stale/);
    expect(await queryScalar(`
      SELECT count(*) FROM public.milestone_resolutions
      WHERE contest_id = '${CONTEST_ID}'::uuid AND milestone = 'Q1'
    `)).toBe('2');
  });

  it('keeps pending storage and both mutation RPCs service-role-only', async () => {
    expect(await queryJson<Record<string, boolean>>(`
      SELECT json_build_object(
        'anonPending', has_table_privilege('anon', 'public.pending_resolutions', 'SELECT'),
        'authPending', has_table_privilege('authenticated', 'public.pending_resolutions', 'SELECT'),
        'anonObserve', has_function_privilege(
          'anon',
          'public.gridone_observe_milestones(uuid,uuid)',
          'EXECUTE'
        ),
        'authObserve', has_function_privilege(
          'authenticated',
          'public.gridone_observe_milestones(uuid,uuid)',
          'EXECUTE'
        ),
        'anonCorrect', has_function_privilege(
          'anon',
          'public.gridone_correct_milestone(uuid,uuid,text,integer,integer,integer,text)',
          'EXECUTE'
        ),
        'authCorrect', has_function_privilege(
          'authenticated',
          'public.gridone_correct_milestone(uuid,uuid,text,integer,integer,integer,text)',
          'EXECUTE'
        )
      )::text
    `)).toEqual({
      anonPending: false,
      authPending: false,
      anonObserve: false,
      authObserve: false,
      anonCorrect: false,
      authCorrect: false,
    });
  });

  it('records exactly one observation when the same promoted snapshot is replayed', async () => {
    const snapshot = await makeSnapshot({
      retrievedAt: '2026-09-13T18:00:00Z',
      q1Side: 7,
      q1Top: 13,
    });

    await Promise.all(Array.from({ length: 20 }, () => observe(snapshot)));
    await Promise.all(Array.from({ length: 20 }, () => observe(snapshot)));

    expect(await queryJson<Record<string, unknown>>(`
      SELECT json_build_object(
        'count', milestone_observation_count,
        'snapshotId', milestone_observed_snapshot_id
      )::text
      FROM public.contest_score_state
      WHERE contest_id = '${CONTEST_ID}'::uuid
    `)).toEqual({
      count: 1,
      snapshotId: snapshot,
    });
  });

  it('commits automatic promotion and its one milestone observation together', async () => {
    const snapshotId = '60000000-0000-4000-8000-000000000001';
    const leaseToken = '70000000-0000-4000-8000-000000000001';
    const lease = await queryJson<{
      authority_generation: number;
      refresh_sequence: number;
      refresh_started_at: string;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_acquire_score_refresh_lease_v2(
        '${CONTEST_ID}'::uuid,
        '${leaseToken}'::uuid,
        45
      ) result
    `);

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
        '${snapshotId}'::uuid,
        '${CONTEST_ID}'::uuid,
        'automatic',
        'provider',
        'in',
        2,
        7,
        13,
        '{
          "Q1":{"left":7,"top":13},
          "Q2":{"left":0,"top":0},
          "Q3":{"left":0,"top":0},
          "Q4":{"left":0,"top":0},
          "OT":{"left":0,"top":0}
        }'::jsonb,
        'accepted',
        '${lease.refresh_started_at}'::timestamptz,
        '${lease.refresh_started_at}'::timestamptz + interval '5 minutes',
        ${lease.authority_generation},
        ${lease.refresh_sequence},
        '${lease.refresh_started_at}'::timestamptz
      );
    `);

    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_promote_score_snapshot(
        '${CONTEST_ID}'::uuid,
        '${snapshotId}'::uuid
      )
    `)).toBe('t');
    expect(await queryJson<Record<string, unknown>>(`
      SELECT json_build_object(
        'currentSnapshotId', current_snapshot_id,
        'observedSnapshotId', milestone_observed_snapshot_id,
        'observationCount', milestone_observation_count,
        'pendingCount', (
          SELECT count(*)
          FROM public.pending_resolutions pending
          WHERE pending.contest_id = state.contest_id
        )
      )::text
      FROM public.contest_score_state state
      WHERE state.contest_id = '${CONTEST_ID}'::uuid
    `)).toEqual({
      currentSnapshotId: snapshotId,
      observedSnapshotId: snapshotId,
      observationCount: 1,
      pendingCount: 1,
    });
  });

  it('permanently skips completed finals and leaves an unchanged projection untouched', async () => {
    const finalSnapshot = await makeSnapshot({
      retrievedAt: '2026-09-13T21:00:00Z',
      q1Side: 7,
      q1Top: 13,
      period: 4,
      gameState: 'post',
      sourceMode: 'manual',
    });
    await observe(finalSnapshot);

    await executeSql(`
      UPDATE public.public_board_snapshots
      SET updated_at = '2026-01-01T00:00:00Z'
      WHERE contest_id = '${CONTEST_ID}'::uuid;
    `);
    await queryScalar(`
      SET ROLE service_role;
      SELECT count(*) FROM public.gridone_project_milestones('${CONTEST_ID}'::uuid)
    `);
    expect(await queryScalar(`
      SELECT updated_at
      FROM public.public_board_snapshots
      WHERE contest_id = '${CONTEST_ID}'::uuid
    `)).toBe('2026-01-01 00:00:00+00');

    await Promise.all(Array.from({ length: 20 }, () => observe(finalSnapshot)));
    expect(await queryJson<Record<string, unknown>>(`
      SELECT json_build_object(
        'count', milestone_observation_count,
        'finalized', milestones_finalized_at IS NOT NULL
      )::text
      FROM public.contest_score_state
      WHERE contest_id = '${CONTEST_ID}'::uuid
    `)).toEqual({
      count: 1,
      finalized: true,
    });
  }, 15_000);
});
