import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const DATABASE_NAME = 'gridone_delivery_retry';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-delivery-retry-test';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-delivery-retry-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const CONTEST_ID = '20000000-0000-4000-8000-000000000001';
const PARTICIPANT_ID = '30000000-0000-4000-8000-000000000001';
const SNAPSHOT_ID = '40000000-0000-4000-8000-000000000001';
const RESOLUTION_ID = '50000000-0000-4000-8000-000000000001';
const SUBSCRIPTION_ID = '60000000-0000-4000-8000-000000000001';
const DELIVERY_ID = '70000000-0000-4000-8000-000000000001';

let containerStarted = false;

type CommandResult = { stdout: string; stderr: string };
type Claim = {
  delivery_id: string;
  lease_token: string;
  attempt_count: number;
  recipient_email: string;
};
type Completion = {
  status: string;
  attempt_count: number;
  next_attempt_at: string | null;
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

const queryJson = async <T>(sql: string) => JSON.parse(await queryScalar(sql)) as T;

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
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file) && Number(file.slice(0, 3)) <= 16)
    .sort();
  expect(files).toContain('016_notification_delivery_retry.sql');
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const seedDelivery = async () => {
  await executeSql(`
    TRUNCATE TABLE auth.users CASCADE;

    INSERT INTO auth.users (id, email)
    VALUES ('${OWNER_ID}'::uuid, 'owner@example.test');

    INSERT INTO public.contests (
      id,
      owner_id,
      share_code,
      title,
      status,
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
      'Retry board',
      'published',
      'Chicago',
      'CHI',
      'Green Bay',
      'GB',
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      '2026-09-13T18:00:00Z'::timestamptz,
      '2026-09-13T18:00:00Z'::timestamptz
    );

    INSERT INTO public.contest_participants (id, contest_id, display_name, public_label)
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
      'test-token-hash',
      '2026-09-13T19:00:00Z'::timestamptz
    );

    INSERT INTO public.notification_deliveries (
      id,
      resolution_id,
      subscription_id,
      idempotency_key
    )
    VALUES (
      '${DELIVERY_ID}'::uuid,
      '${RESOLUTION_ID}'::uuid,
      '${SUBSCRIPTION_ID}'::uuid,
      'winner:${RESOLUTION_ID}:${SUBSCRIPTION_ID}'
    );
  `);
};

const claim = async (now: string) => queryJson<Claim[]>(`
  SET ROLE service_role;
  SELECT coalesce(json_agg(row_to_json(claimed)), '[]'::json)
  FROM public.gridone_claim_notification_deliveries(
    20,
    120,
    '${now}'::timestamptz
  ) claimed;
`);

const complete = async (
  claimed: Claim,
  outcome: 'sent' | 'transient' | 'permanent',
  now: string,
) => queryJson<Completion[]>(`
  SET ROLE service_role;
  SELECT coalesce(json_agg(row_to_json(completed)), '[]'::json)
  FROM public.gridone_complete_notification_delivery(
    '${claimed.delivery_id}'::uuid,
    '${claimed.lease_token}'::uuid,
    '${outcome}',
    NULL,
    '${outcome} provider result',
    '${now}'::timestamptz
  ) completed;
`);

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
  await applyMigrations();
}, 180_000);

beforeEach(seedDelivery);

afterAll(async () => {
  if (containerStarted) {
    await docker(['rm', '-f', containerName], undefined, 30_000).catch(() => undefined);
  }
}, 40_000);

describe.sequential('notification delivery retry queue (disposable PostgreSQL)', () => {
  it('enforces every backoff and becomes terminal after the fifth transient failure', async () => {
    const attemptTimes = [
      '2026-09-13T20:00:00Z',
      '2026-09-13T20:01:00Z',
      '2026-09-13T20:06:00Z',
      '2026-09-13T20:31:00Z',
      '2026-09-13T22:31:00Z',
    ];
    const expectedNext = [
      '2026-09-13T20:01:00+00:00',
      '2026-09-13T20:06:00+00:00',
      '2026-09-13T20:31:00+00:00',
      '2026-09-13T22:31:00+00:00',
      null,
    ];

    for (let index = 0; index < attemptTimes.length; index += 1) {
      const claims = await claim(attemptTimes[index]);
      expect(claims).toHaveLength(1);
      expect(claims[0].attempt_count).toBe(index + 1);
      const completion = await complete(claims[0], 'transient', attemptTimes[index]);
      expect(completion).toHaveLength(1);
      expect(completion[0].status).toBe(index === 4 ? 'failed_permanent' : 'failed');
      expect(completion[0].next_attempt_at).toBe(expectedNext[index]);
    }

    expect(await claim('2026-09-14T20:00:00Z')).toEqual([]);
    expect(await queryScalar(`
      SELECT attempt_count || ':' || status
      FROM public.notification_deliveries
      WHERE id = '${DELIVERY_ID}'::uuid;
    `)).toBe('5:failed_permanent');
  });

  it('refuses an early retry and claims it when the one-minute delay expires', async () => {
    const first = await claim('2026-09-13T20:00:00Z');
    await complete(first[0], 'transient', '2026-09-13T20:00:00Z');

    expect(await claim('2026-09-13T20:00:30Z')).toEqual([]);
    const due = await claim('2026-09-13T20:01:00Z');
    expect(due).toHaveLength(1);
    expect(due[0].attempt_count).toBe(2);
  });

  it('makes a permanent provider failure terminal after one attempt', async () => {
    const first = await claim('2026-09-13T20:00:00Z');
    const completion = await complete(first[0], 'permanent', '2026-09-13T20:00:00Z');

    expect(completion[0]).toMatchObject({
      status: 'failed_permanent',
      attempt_count: 1,
      next_attempt_at: null,
    });
    expect(await claim('2026-09-14T20:00:00Z')).toEqual([]);
  });

  it('atomically gives one delivery to only one concurrent worker', async () => {
    const results = await Promise.all([
      claim('2026-09-13T20:00:00Z'),
      claim('2026-09-13T20:00:00Z'),
    ]);
    expect(results.flat()).toHaveLength(1);
  });

  it('terminalizes an expired fifth-attempt lease without making a sixth claim', async () => {
    await executeSql(`
      UPDATE public.notification_deliveries
      SET attempt_count = 4
      WHERE id = '${DELIVERY_ID}'::uuid;
    `);
    const fifth = await claim('2026-09-13T20:00:00Z');
    expect(fifth[0].attempt_count).toBe(5);

    expect(await claim('2026-09-13T20:03:00Z')).toEqual([]);
    expect(await queryScalar(`
      SELECT attempt_count || ':' || status
      FROM public.notification_deliveries
      WHERE id = '${DELIVERY_ID}'::uuid;
    `)).toBe('5:failed_permanent');
  });

  it('does not expose queue mutation RPCs to viewer roles', async () => {
    expect(await queryScalar(`
      SELECT
        has_function_privilege(
          'anon',
          'public.gridone_claim_notification_deliveries(integer,integer,timestamptz)',
          'EXECUTE'
        )::text
        || ':'
        || has_function_privilege(
          'authenticated',
          'public.gridone_complete_notification_delivery(uuid,uuid,text,text,text,timestamptz)',
          'EXECUTE'
        )::text;
    `)).toBe('false:false');
  });
});
