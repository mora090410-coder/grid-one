import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

const DATABASE_NAME = 'gridone_notifications';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-notification-test';
const POSTGRES_IMAGE = 'postgres:17';
const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const CONTEST_IDS = Array.from(
  { length: 5 },
  (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const PARTICIPANT_IDS = Array.from(
  { length: 15 },
  (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const containerName = `gridone-notifications-${process.pid}-${randomUUID().slice(0, 8)}`;

let containerStarted = false;

type CommandResult = {
  stdout: string;
  stderr: string;
};

type ClaimResult = {
  claim_id: string | null;
  should_send: boolean;
  is_throttled: boolean;
  retry_after_seconds: number | null;
  subscription_id: string | null;
  participant_name: string | null;
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
  const migrationDirectory = resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = readdirSync(migrationDirectory)
    .filter(file => /^\d{3}_.+\.sql$/.test(file) && Number(file.slice(0, 3)) <= 13)
    .sort();

  expect(migrationFiles.map(file => Number(file.slice(0, 3)))).toEqual(
    expectedMigrationNumbers(13),
  );

  for (const migrationFile of migrationFiles) {
    await executeSql(readFileSync(resolve(migrationDirectory, migrationFile), 'utf8'));
  }
};

const seedFixtures = async () => {
  const contests = CONTEST_IDS.map((contestId, index) => (
    `(
      '${contestId}'::uuid,
      '${OWNER_ID}'::uuid,
      'AAAAAA${String(index + 2).padStart(2, 'A')}',
      'Notification board ${index + 1}',
      'published',
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
      now(),
      now()
    )`
  )).join(',\n');
  const primaryParticipants = PARTICIPANT_IDS.slice(0, 11).map((participantId, index) => (
    `('${participantId}'::uuid, '${CONTEST_IDS[0]}'::uuid, 'Participant ${index + 1}', 'P${index + 1}')`
  ));
  const additionalParticipants = PARTICIPANT_IDS.slice(11).map((participantId, index) => (
    `('${participantId}'::uuid, '${CONTEST_IDS[index + 1]}'::uuid, 'Address participant ${index + 1}', 'A${index + 1}')`
  ));

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
    VALUES ${contests};

    INSERT INTO public.contest_participants (id, contest_id, display_name, public_label)
    VALUES ${[...primaryParticipants, ...additionalParticipants].join(',\n')};

    INSERT INTO public.public_board_snapshots (
      contest_id,
      share_code,
      revision,
      board_title,
      matchup,
      board,
      published_at
    )
    SELECT
      contest.id,
      contest.share_code,
      contest.revision,
      contest.title,
      '{}'::jsonb,
      '{}'::jsonb,
      contest.published_at
    FROM public.contests contest;
  `);
};

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

const claim = async ({
  contestId,
  participantId,
  email,
  ip,
}: {
  contestId: string;
  participantId: string;
  email: string;
  ip: string;
}) => queryJson<ClaimResult>(`
  SET ROLE service_role;
  SELECT row_to_json(result)::text
  FROM public.gridone_claim_notification_send(
    '${contestId}'::uuid,
    '${participantId}'::uuid,
    '${email}',
    '${sha(`address:${email}`)}',
    '${ip}'::inet,
    '${sha(`verification:${email}`)}',
    '${sha(`unsubscribe:${email}`)}'
  ) AS result
`);

const verifySubscription = async (subscriptionId: string, tokenHash: string) => queryScalar(`
  SET ROLE service_role;
  SELECT public.gridone_verify_notification_subscription(
    '${subscriptionId}'::uuid,
    '${tokenHash}'
  )
`);

const resetNotificationState = async () => {
  await executeSql(`
    TRUNCATE TABLE public.notification_send_log, public.notification_subscriptions CASCADE;
  `);
};

describe.sequential('notification rate limits and address lifecycle in disposable PostgreSQL', () => {
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
    await resetNotificationState();
  });

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName], undefined, 30_000);
      containerStarted = false;
    }
  }, 60_000);

  it('serializes the ten-per-board rolling-hour limit', async () => {
    const results = await Promise.all(PARTICIPANT_IDS.slice(0, 11).map((participantId, index) =>
      claim({
        contestId: CONTEST_IDS[0],
        participantId,
        email: `board-${index}@example.test`,
        ip: `203.0.113.${index + 1}`,
      })
    ));

    expect(results.filter(result => result.should_send)).toHaveLength(10);
    expect(results.filter(result => result.is_throttled)).toHaveLength(1);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_send_log
      WHERE claim_outcome = 'throttled_board'
    `)).toBe('1');
  });

  it('serializes the three-per-address rolling-day limit across boards', async () => {
    const results = await Promise.all(CONTEST_IDS.slice(1).map((contestId, index) =>
      claim({
        contestId,
        participantId: PARTICIPANT_IDS[index + 11],
        email: 'same-address@example.test',
        ip: `198.51.100.${index + 1}`,
      })
    ));

    expect(results.filter(result => result.should_send)).toHaveLength(3);
    expect(results.filter(result => result.is_throttled)).toHaveLength(1);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_send_log
      WHERE claim_outcome = 'throttled_address'
    `)).toBe('1');
  });

  it('serializes the five-per-IP rolling-ten-minute limit', async () => {
    const results = await Promise.all(PARTICIPANT_IDS.slice(0, 6).map((participantId, index) =>
      claim({
        contestId: CONTEST_IDS[0],
        participantId,
        email: `ip-${index}@example.test`,
        ip: '192.0.2.44',
      })
    ));

    expect(results.filter(result => result.should_send)).toHaveLength(5);
    expect(results.filter(result => result.is_throttled)).toHaveLength(1);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_send_log
      WHERE claim_outcome = 'throttled_ip'
        AND counts_toward_ip_limit = false
    `)).toBe('1');
  });

  it('allows only two active pending addresses for one participant', async () => {
    const results = await Promise.all(Array.from({ length: 3 }, (_, index) =>
      claim({
        contestId: CONTEST_IDS[0],
        participantId: PARTICIPANT_IDS[0],
        email: `pending-${index}@example.test`,
        ip: `203.0.113.${index + 30}`,
      })
    ));

    expect(results.filter(result => result.should_send)).toHaveLength(2);
    expect(results.filter(result => result.is_throttled)).toHaveLength(1);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_subscriptions
      WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
        AND status = 'pending'
    `)).toBe('2');
  });

  it('retains the old verified address until the new address verifies atomically', async () => {
    const oldSubscriptionId = '40000000-0000-4000-8000-000000000001';
    await executeSql(`
      INSERT INTO public.notification_subscriptions (
        id,
        contest_id,
        participant_id,
        email,
        status,
        verification_token_hash,
        unsubscribe_token_hash,
        verification_sent_at,
        verified_at
      )
      VALUES (
        '${oldSubscriptionId}'::uuid,
        '${CONTEST_IDS[0]}'::uuid,
        '${PARTICIPANT_IDS[0]}'::uuid,
        'old@example.test',
        'verified',
        NULL,
        '${sha('unsubscribe:old')}',
        now() - interval '1 day',
        now() - interval '1 day'
      );
    `);

    const sameAddress = await claim({
      contestId: CONTEST_IDS[0],
      participantId: PARTICIPANT_IDS[0],
      email: 'old@example.test',
      ip: '203.0.113.50',
    });
    expect(sameAddress.should_send).toBe(false);
    expect(await queryScalar(`
      SELECT status FROM public.notification_subscriptions
      WHERE id = '${oldSubscriptionId}'::uuid
    `)).toBe('verified');

    const newAddress = await claim({
      contestId: CONTEST_IDS[0],
      participantId: PARTICIPANT_IDS[0],
      email: 'new@example.test',
      ip: '203.0.113.51',
    });
    expect(newAddress.should_send).toBe(true);
    expect(await queryJson<Array<{ email: string; status: string }>>(`
      SELECT json_agg(row_to_json(state) ORDER BY state.email)::text
      FROM (
        SELECT email, status
        FROM public.notification_subscriptions
        WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
      ) state
    `)).toEqual([
      { email: 'new@example.test', status: 'pending' },
      { email: 'old@example.test', status: 'verified' },
    ]);

    const invalidVerification = await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_verify_notification_subscription(
        '${newAddress.subscription_id}'::uuid,
        '${sha('wrong-token')}'
      )
    `);
    expect(invalidVerification).toBe('f');
    expect(await queryScalar(`
      SELECT email FROM public.notification_subscriptions
      WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
        AND status = 'verified'
    `)).toBe('old@example.test');

    const validVerification = await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_verify_notification_subscription(
        '${newAddress.subscription_id}'::uuid,
        '${sha('verification:new@example.test')}'
      )
    `);
    expect(validVerification).toBe('t');
    expect(await queryJson<Array<{ email: string; status: string }>>(`
      SELECT json_agg(row_to_json(state) ORDER BY state.email)::text
      FROM (
        SELECT email, status
        FROM public.notification_subscriptions
        WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
      ) state
    `)).toEqual([
      { email: 'new@example.test', status: 'verified' },
      { email: 'old@example.test', status: 'replaced' },
    ]);
  });

  it('leaves exactly one verified address after concurrent valid verifications', async () => {
    const firstEmail = 'race-first@example.test';
    const secondEmail = 'race-second@example.test';
    const [first, second] = await Promise.all([
      claim({
        contestId: CONTEST_IDS[0],
        participantId: PARTICIPANT_IDS[0],
        email: firstEmail,
        ip: '203.0.113.60',
      }),
      claim({
        contestId: CONTEST_IDS[0],
        participantId: PARTICIPANT_IDS[0],
        email: secondEmail,
        ip: '203.0.113.61',
      }),
    ]);

    expect(first.subscription_id).toBeTruthy();
    expect(second.subscription_id).toBeTruthy();
    expect(await Promise.all([
      verifySubscription(first.subscription_id!, sha(`verification:${firstEmail}`)),
      verifySubscription(second.subscription_id!, sha(`verification:${secondEmail}`)),
    ])).toEqual(['t', 't']);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_subscriptions
      WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
        AND status = 'verified'
    `)).toBe('1');
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_subscriptions
      WHERE participant_id = '${PARTICIPANT_IDS[0]}'::uuid
        AND status = 'replaced'
    `)).toBe('1');
  });

  it('permits an unsubscribed address to begin a fresh verification', async () => {
    const subscriptionId = '40000000-0000-4000-8000-000000000002';
    await executeSql(`
      INSERT INTO public.notification_subscriptions (
        id,
        contest_id,
        participant_id,
        email,
        status,
        verification_token_hash,
        unsubscribe_token_hash,
        verification_sent_at,
        verified_at,
        unsubscribed_at
      )
      VALUES (
        '${subscriptionId}'::uuid,
        '${CONTEST_IDS[0]}'::uuid,
        '${PARTICIPANT_IDS[0]}'::uuid,
        'returning@example.test',
        'unsubscribed',
        NULL,
        '${sha('unsubscribe:returning')}',
        now() - interval '1 day',
        now() - interval '1 day',
        now()
      );
    `);

    const result = await claim({
      contestId: CONTEST_IDS[0],
      participantId: PARTICIPANT_IDS[0],
      email: 'returning@example.test',
      ip: '203.0.113.65',
    });
    expect(result).toMatchObject({
      should_send: true,
      is_throttled: false,
      subscription_id: subscriptionId,
    });
    expect(await queryScalar(`
      SELECT status FROM public.notification_subscriptions
      WHERE id = '${subscriptionId}'::uuid
    `)).toBe('pending');
  });

  it('records invalid identities and completed sends without plaintext addresses', async () => {
    const invalid = await claim({
      contestId: CONTEST_IDS[0],
      participantId: '39999999-9999-4999-8999-999999999999',
      email: 'invalid-participant@example.test',
      ip: '203.0.113.70',
    });
    expect(invalid).toMatchObject({
      should_send: false,
      is_throttled: false,
      subscription_id: null,
    });

    const accepted = await claim({
      contestId: CONTEST_IDS[0],
      participantId: PARTICIPANT_IDS[0],
      email: 'completed@example.test',
      ip: '203.0.113.71',
    });
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_complete_notification_send(
        '${accepted.claim_id}'::uuid,
        'sent',
        200,
        'provider-message-1',
        NULL
      )
    `)).toBe('t');

    const forensic = await queryJson<{
      invalidCount: number;
      sentCount: number;
      rawAddressCount: number;
      clientIp: string;
    }>(`
      SELECT json_build_object(
        'invalidCount', count(*) FILTER (WHERE claim_outcome = 'invalid_participant'),
        'sentCount', count(*) FILTER (WHERE delivery_outcome = 'sent'),
        'rawAddressCount', count(*) FILTER (
          WHERE row_to_json(notification_send_log)::text LIKE '%completed@example.test%'
        ),
        'clientIp', max(client_ip::text) FILTER (WHERE delivery_outcome = 'sent')
      )::text
      FROM public.notification_send_log
    `);
    expect(forensic).toEqual({
      invalidCount: 1,
      sentCount: 1,
      rawAddressCount: 0,
      clientIp: '203.0.113.71/32',
    });
  });

  it('keeps the RPCs and forensic log service-role only', async () => {
    const privileges = await queryJson<{
      anonClaim: boolean;
      authenticatedClaim: boolean;
      serviceClaim: boolean;
      anonLog: boolean;
      authenticatedLog: boolean;
      serviceLog: boolean;
    }>(`
      SELECT json_build_object(
        'anonClaim', has_function_privilege(
          'anon',
          'public.gridone_claim_notification_send(uuid,uuid,text,text,inet,text,text)',
          'EXECUTE'
        ),
        'authenticatedClaim', has_function_privilege(
          'authenticated',
          'public.gridone_claim_notification_send(uuid,uuid,text,text,inet,text,text)',
          'EXECUTE'
        ),
        'serviceClaim', has_function_privilege(
          'service_role',
          'public.gridone_claim_notification_send(uuid,uuid,text,text,inet,text,text)',
          'EXECUTE'
        ),
        'anonLog', has_table_privilege('anon', 'public.notification_send_log', 'SELECT'),
        'authenticatedLog', has_table_privilege(
          'authenticated',
          'public.notification_send_log',
          'SELECT'
        ),
        'serviceLog', has_table_privilege(
          'service_role',
          'public.notification_send_log',
          'SELECT'
        )
      )::text
    `);

    expect(privileges).toEqual({
      anonClaim: false,
      authenticatedClaim: false,
      serviceClaim: true,
      anonLog: false,
      authenticatedLog: false,
      serviceLog: true,
    });
  });
});
