import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Migration 035 against disposable Postgres with Supabase's default function
// grants (anon, authenticated, and service_role can execute new functions).
// REVOKE FROM PUBLIC alone does not remove those direct grants.

const DATABASE_NAME = 'gridone_score_grant_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-score-grant-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-score-grant-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '31000000-0000-4000-8000-000000000001';
const STRANGER_ID = '31000000-0000-4000-8000-000000000002';
const ENTITLEMENT_ID = '31000000-0000-4000-8000-000000000010';
const MAIN_ID = '31000000-0000-4000-8000-000000000011';
const FUTURE_ID = '31000000-0000-4000-8000-000000000012';
const BLANK_ID = '31000000-0000-4000-8000-000000000013';
const ZERO_ID = '31000000-0000-4000-8000-000000000014';
const NULL_KICK_ID = '31000000-0000-4000-8000-000000000015';
const SHARED_ID = '31000000-0000-4000-8000-000000000016';
const FAMILY_TOKEN = 'd'.repeat(64);

const SIDE_AXIS = 'ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]';
const TOP_AXIS = 'ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[]';
const PAST_KICKOFF = '2026-01-15T18:00:00Z';
const FUTURE_KICKOFF = '2027-06-01T18:00:00Z';

const names = Array.from({ length: 100 }, (_, index) => {
  if (index === 10 || index === 11) return ['Twin Buyer'];
  return [`Buyer ${index + 1}`];
});
const publicBoard = {
  leftAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  topAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: names,
  isDynamic: false,
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

const asUser = (userId: string, sql: string) => `
  SELECT set_config('request.jwt.claim.sub', '${userId}', false);
  SET ROLE authenticated;
  ${sql}
`;

const quarters = (scores: Record<string, { left: number | null; top: number | null }>) =>
  sqlText(JSON.stringify(scores));

const entered = (left: number, top: number) => ({ left, top });
const blank = { left: null, top: null };

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      // Init starts a temporary server, then shuts it down. Two checks with a
      // gap wait until the server that stays up is the one answering.
      await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000);
      await new Promise(r => setTimeout(r, 400));
      await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready within 60 seconds.');
};

const bootstrap = async () => {
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
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  `);
};

const applyAllMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory).filter(file => /^\d{3}_.+\.sql$/.test(file)).sort();
  expect(files.some(file => file.startsWith('035_'))).toBe(true);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const insertContest = async (
  id: string,
  shareCode: string,
  title: string,
  kickoff: string | null,
  board = publicBoard,
) => {
  await executeSql(`
    INSERT INTO public.contests (
      id, owner_id, share_code, title, season_year,
      game_external_id, game_starts_at,
      side_team_name, side_team_abbr, top_team_name, top_team_abbr,
      board_data
    ) VALUES (
      '${id}'::uuid, '${OWNER_ID}'::uuid, '${shareCode}', ${sqlText(title)}, 2026,
      '401772999', ${kickoff ? `'${kickoff}'::timestamptz` : 'NULL'},
      'Chicago Bears', 'CHI', 'Green Bay Packers', 'GB',
      ${sqlText(JSON.stringify(board))}::jsonb
    );
  `);
};

const publish = async (id: string) => {
  await executeSql(`
    SET ROLE service_role;
    SELECT public.gridone_publish_board(
      '${id}'::uuid,
      '${OWNER_ID}'::uuid,
      (SELECT revision FROM public.contests WHERE id = '${id}'::uuid)::bigint,
      ${SIDE_AXIS},
      ${TOP_AXIS},
      ${sqlText(JSON.stringify(names))}::jsonb,
      ${sqlText(JSON.stringify(publicBoard))}::jsonb,
      ${sqlText(JSON.stringify({
        sideTeamName: 'Chicago Bears',
        sideTeamAbbr: 'CHI',
        topTeamName: 'Green Bay Packers',
        topTeamAbbr: 'GB',
        gameExternalId: '401772999',
        gameStartsAt: PAST_KICKOFF,
      }))}::jsonb,
      false::boolean
    );
  `);
};

const commitScore = (
  id: string,
  state: string,
  period: number,
  side: number,
  top: number,
  scoreQuarters: Record<string, { left: number | null; top: number | null }>,
) => executeSql(`
  SET ROLE service_role;
  SELECT id FROM public.gridone_commit_manual_score(
    '${id}'::uuid,
    '${OWNER_ID}'::uuid,
    '${state}',
    ${period}::smallint,
    ${side}::smallint,
    ${top}::smallint,
    ${quarters(scoreQuarters)}::jsonb,
    '',
    now()
  );
`);

const winnerName = (id: string, milestone: string) => queryScalar(`
  SELECT coalesce(p.display_name, '')
  FROM public.milestone_resolutions r
  LEFT JOIN public.contest_participants p ON p.id = r.participant_id
  WHERE r.contest_id = '${id}'::uuid
    AND r.milestone = '${milestone}'
    AND r.resolution_version = (
      SELECT max(current.resolution_version)
      FROM public.milestone_resolutions current
      WHERE current.contest_id = r.contest_id AND current.milestone = r.milestone
    )
`);

describe.sequential('manual scores, published renames, and function grants', () => {
  beforeAll(async () => {
    await docker([
      'run', '--rm', '--detach', '--name', containerName,
      '--env', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DATABASE_NAME}`,
      POSTGRES_IMAGE,
    ]);
    containerStarted = true;
    await waitForPostgres();
    await bootstrap();
    await applyAllMigrations();
    await executeSql(`
      INSERT INTO auth.users (id, email) VALUES
        ('${OWNER_ID}'::uuid, 'coach@example.test'),
        ('${STRANGER_ID}'::uuid, 'stranger@example.test');
      INSERT INTO public.season_entitlements (
        id, owner_id, season_year, status, boards_allowance, price_cents, currency
      ) VALUES (
        '${ENTITLEMENT_ID}'::uuid, '${OWNER_ID}'::uuid, 2026, 'active', 20, 7900, 'usd'
      );
    `);
    await insertContest(MAIN_ID, 'SCAR2345', 'Score board', PAST_KICKOFF);
    await insertContest(FUTURE_ID, 'FUTUR234', 'Future board', FUTURE_KICKOFF);
    await insertContest(BLANK_ID, 'BLANK234', 'Blank quarters', PAST_KICKOFF);
    await insertContest(ZERO_ID, 'ZERR2345', 'Zero quarters', PAST_KICKOFF);
    await publish(MAIN_ID);
    await publish(FUTURE_ID);
    await publish(BLANK_ID);
    await publish(ZERO_ID);
    await executeSql(`
      INSERT INTO public.contests (
        id, owner_id, share_code, title, status, season_year,
        side_axis, top_axis, axis_locked_at, published_at
      ) VALUES (
        '${NULL_KICK_ID}'::uuid, '${OWNER_ID}'::uuid, 'NULLK234', 'No kickoff', 'published', 2026,
        ${SIDE_AXIS}, ${TOP_AXIS}, now(), now()
      );
    `);
  }, 300_000);

  afterAll(async () => {
    if (containerStarted) await docker(['rm', '--force', containerName]).catch(() => undefined);
  }, 60_000);

  it('drops the v1 lease and leaves internal functions unexecutable by clients', async () => {
    expect(await queryScalar(`
      SELECT to_regprocedure('public.gridone_acquire_score_refresh_lease(uuid,uuid,integer)') IS NULL
    `)).toBe('t');

    expect(await queryScalar(`
      SELECT coalesce(string_agg(
        p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
        ', ' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
      ), '')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND p.proname LIKE 'gridone_%'
        AND p.proname NOT IN ('gridone_rename_published_square', 'gridone_owns_contest')
        AND (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )
    `)).toBe('');

    expect(JSON.parse(await queryScalar(`
      SELECT json_build_object(
        'anonRename', has_function_privilege('anon', 'public.gridone_rename_published_square(uuid,integer,text)', 'EXECUTE'),
        'authRename', has_function_privilege('authenticated', 'public.gridone_rename_published_square(uuid,integer,text)', 'EXECUTE'),
        'anonOwns', has_function_privilege('anon', 'public.gridone_owns_contest(uuid)', 'EXECUTE'),
        'authOwns', has_function_privilege('authenticated', 'public.gridone_owns_contest(uuid)', 'EXECUTE'),
        'anonShareCode', has_function_privilege('anon', 'public.gridone_generate_share_code()', 'EXECUTE'),
        'authShareCode', has_function_privilege('authenticated', 'public.gridone_generate_share_code()', 'EXECUTE'),
        'anonPayout', has_function_privilege('anon', 'public.gridone_valid_payout_descriptions(jsonb)', 'EXECUTE'),
        'authPayout', has_function_privilege('authenticated', 'public.gridone_valid_payout_descriptions(jsonb)', 'EXECUTE'),
        'anonNumbers', has_function_privilege('anon', 'public.gridone_validate_number_sets(jsonb,boolean)', 'EXECUTE'),
        'authNumbers', has_function_privilege('authenticated', 'public.gridone_validate_number_sets(jsonb,boolean)', 'EXECUTE'),
        'anonSales', has_function_privilege('anon', 'public.gridone_validate_sales_board(jsonb)', 'EXECUTE'),
        'authSales', has_function_privilege('authenticated', 'public.gridone_validate_sales_board(jsonb)', 'EXECUTE'),
        'serviceLease', has_function_privilege('authenticated', 'public.gridone_acquire_score_refresh_lease_v2(uuid,uuid,integer)', 'EXECUTE'),
        'serviceRoleLease', has_function_privilege('service_role', 'public.gridone_acquire_score_refresh_lease_v2(uuid,uuid,integer)', 'EXECUTE'),
        'serviceAxis', has_function_privilege('service_role', 'public.gridone_axis_for_milestone(jsonb,smallint[],text,text)', 'EXECUTE'),
        'serviceUnchecked', has_function_privilege('service_role', 'public.gridone_observe_milestones_unchecked(uuid,uuid)', 'EXECUTE')
      )::text
    `))).toEqual({
      anonRename: false,
      authRename: true,
      anonOwns: false,
      authOwns: true,
      anonShareCode: false,
      authShareCode: true,
      anonPayout: false,
      authPayout: true,
      anonNumbers: false,
      authNumbers: true,
      anonSales: false,
      authSales: true,
      serviceLease: false,
      serviceRoleLease: true,
      serviceAxis: false,
      serviceUnchecked: false,
    });
  });

  it('lets an organizer edit a draft and keeps a stranger out', async () => {
    const draftId = (await queryScalar(asUser(OWNER_ID, `
      INSERT INTO public.contests (owner_id, title)
      VALUES ('${OWNER_ID}'::uuid, 'Draft board')
      RETURNING id::text;
    `))).split('\n').at(-1);
    await executeSql(asUser(OWNER_ID, `
      UPDATE public.contests SET title = 'Draft renamed' WHERE id = '${draftId}'::uuid;
    `));
    expect(await queryScalar(`SELECT title FROM public.contests WHERE id = '${draftId}'::uuid`)).toBe('Draft renamed');

    await executeSql(asUser(STRANGER_ID, `
      UPDATE public.contests SET title = 'Taken' WHERE id = '${draftId}'::uuid;
    `));
    expect(await queryScalar(`SELECT title FROM public.contests WHERE id = '${draftId}'::uuid`)).toBe('Draft renamed');
  });

  it('refuses a manual score before kickoff and when kickoff is missing', async () => {
    const zeros = {
      Q1: entered(0, 0), Q2: entered(0, 0), Q3: entered(0, 0), Q4: entered(0, 0), OT: entered(0, 0),
    };
    await expect(commitScore(FUTURE_ID, 'post', 4, 0, 0, zeros)).rejects.toThrow(/before kickoff/i);
    expect(await queryScalar(`
      SELECT count(*) FROM public.score_snapshots WHERE contest_id = '${FUTURE_ID}'::uuid
    `)).toBe('0');
    await expect(commitScore(NULL_KICK_ID, 'post', 4, 0, 0, zeros)).rejects.toThrow(/kickoff is unavailable/i);
  });

  it('settles an explicit 0 and leaves a blank quarter unresolved', async () => {
    await commitScore(ZERO_ID, 'in', 2, 0, 0, {
      Q1: entered(0, 0), Q2: entered(0, 0), Q3: entered(0, 0), Q4: entered(0, 0), OT: entered(0, 0),
    });
    expect(await queryScalar(`
      SELECT string_agg(milestone, ',' ORDER BY milestone)
      FROM public.milestone_resolutions WHERE contest_id = '${ZERO_ID}'::uuid
    `)).toBe('Q1');

    await commitScore(BLANK_ID, 'post', 4, 7, 3, {
      Q1: blank, Q2: blank, Q3: blank, Q4: blank, OT: blank,
    });
    expect(await queryScalar(`
      SELECT string_agg(milestone, ',' ORDER BY milestone)
      FROM public.milestone_resolutions WHERE contest_id = '${BLANK_ID}'::uuid
    `)).toBe('FINAL');
    expect(await queryScalar(`
      SELECT side_score::text || '-' || top_score::text
      FROM public.milestone_resolutions
      WHERE contest_id = '${BLANK_ID}'::uuid AND milestone = 'FINAL'
    `)).toBe('7-3');
  });

  it('updates winner records when a square is renamed before the quarter resolves', async () => {
    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${MAIN_ID}'::uuid, 0, 'Sam Whitfield');
    `));
    expect(await queryScalar(`
      SELECT p.display_name
      FROM public.square_assignments a
      JOIN public.contest_participants p ON p.id = a.participant_id
      WHERE a.contest_id = '${MAIN_ID}'::uuid AND a.cell_index = 0
    `)).toBe('Sam Whitfield');
    expect(await queryScalar(`
      SELECT board -> 'squares' -> 0 ->> 0
      FROM public.public_board_snapshots WHERE contest_id = '${MAIN_ID}'::uuid
    `)).toBe('Sam Whitfield');
    expect(await queryScalar(`
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          (SELECT board -> 'participants' FROM public.public_board_snapshots WHERE contest_id = '${MAIN_ID}'::uuid)
        ) participant
        WHERE participant ->> 'displayName' = 'Sam Whitfield'
      )
    `)).toBe('t');

    await commitScore(MAIN_ID, 'in', 2, 0, 9, {
      Q1: entered(0, 9), Q2: entered(0, 0), Q3: entered(0, 0), Q4: entered(0, 0), OT: entered(0, 0),
    });
    expect(await winnerName(MAIN_ID, 'Q1')).toBe('Sam Whitfield');
    expect(await queryScalar(`
      SELECT winner_history -> 0 ->> 'participantName'
      FROM public.public_board_snapshots WHERE contest_id = '${MAIN_ID}'::uuid
    `)).toBe('Sam Whitfield');
  });

  it('freezes a square that already has a published result and still allows other squares', async () => {
    await expect(executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${MAIN_ID}'::uuid, 0, 'Locked Out');
    `))).rejects.toThrow(/name is locked/i);
    expect(await winnerName(MAIN_ID, 'Q1')).toBe('Sam Whitfield');
    expect(await queryScalar(`
      SELECT board_data -> 'squares' -> 0 ->> 0 FROM public.contests WHERE id = '${MAIN_ID}'::uuid
    `)).toBe('Sam Whitfield');

    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${MAIN_ID}'::uuid, 12, 'Dana Reyes');
    `));
    expect(await queryScalar(`
      SELECT board -> 'squares' -> 12 ->> 0
      FROM public.public_board_snapshots WHERE contest_id = '${MAIN_ID}'::uuid
    `)).toBe('Dana Reyes');
    expect(await winnerName(MAIN_ID, 'Q1')).toBe('Sam Whitfield');

    await executeSql(asUser(OWNER_ID, `
      SELECT public.gridone_rename_published_square('${MAIN_ID}'::uuid, 10, 'Only Ten');
    `));
    expect(await queryScalar(`
      SELECT p.display_name
      FROM public.square_assignments a
      JOIN public.contest_participants p ON p.id = a.participant_id
      WHERE a.contest_id = '${MAIN_ID}'::uuid AND a.cell_index = 11
    `)).toBe('Twin Buyer');
    expect(await queryScalar(`
      SELECT p.display_name
      FROM public.square_assignments a
      JOIN public.contest_participants p ON p.id = a.participant_id
      WHERE a.contest_id = '${MAIN_ID}'::uuid AND a.cell_index = 10
    `)).toBe('Only Ten');
  });

  it('can correct a result without queueing email, and the seven-argument call still does', async () => {
    await executeSql(`
      INSERT INTO public.notification_subscriptions (
        contest_id, participant_id, email, status, unsubscribe_token_hash, verified_at
      )
      SELECT '${MAIN_ID}'::uuid, p.id, p.id::text || '@example.test', 'verified', p.id::text, now()
      FROM public.contest_participants p
      WHERE p.contest_id = '${MAIN_ID}'::uuid
        AND p.display_name IN ('Sam Whitfield', 'Only Ten');
    `);
    await executeSql(`
      SET ROLE service_role;
      SELECT delivery_ids FROM public.gridone_correct_milestone(
        '${MAIN_ID}'::uuid, '${OWNER_ID}'::uuid, 'Q1', 1, 1, 9, 'Quiet score fix', false
      );
    `);
    expect(await queryScalar(`
      SELECT count(*) FROM public.notification_deliveries d
      JOIN public.milestone_resolutions r ON r.id = d.resolution_id
      WHERE r.contest_id = '${MAIN_ID}'::uuid AND d.notification_kind LIKE 'correction_%'
    `)).toBe('0');
    expect(await queryScalar(`
      SELECT details ->> 'notify'
      FROM public.contest_audit_events
      WHERE contest_id = '${MAIN_ID}'::uuid AND event_type = 'milestone.corrected'
      ORDER BY created_at DESC LIMIT 1
    `)).toBe('false');
    expect(await winnerName(MAIN_ID, 'Q1')).toBe('Only Ten');

    await executeSql(`
      SET ROLE service_role;
      SELECT delivery_ids FROM public.gridone_correct_milestone(
        '${MAIN_ID}'::uuid, '${OWNER_ID}'::uuid, 'Q1', 2, 0, 9, 'Restore the first quarter'
      );
    `);
    expect(Number(await queryScalar(`
      SELECT count(*) FROM public.notification_deliveries d
      JOIN public.milestone_resolutions r ON r.id = d.resolution_id
      WHERE r.contest_id = '${MAIN_ID}'::uuid AND d.notification_kind LIKE 'correction_%'
    `))).toBeGreaterThan(0);
    expect(await winnerName(MAIN_ID, 'Q1')).toBe('Sam Whitfield');
  });

  it('still serves the public snapshot, seller links, family links, and the v2 score lease', async () => {
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT board -> 'squares' -> 0 ->> 0
      FROM public.public_board_snapshots WHERE contest_id = '${MAIN_ID}'::uuid
    `)).toBe('Sam Whitfield');

    const sharedBoard = {
      ...publicBoard,
      allocationLabels: Array.from({ length: 100 }, (_, index) => (index === 0 ? 'Mora' : null)),
      availability: Array.from({ length: 100 }, () => 'available'),
    };
    await insertContest(SHARED_ID, 'SHARE234', 'Shared board', FUTURE_KICKOFF, sharedBoard);
    await executeSql(`
      INSERT INTO public.board_activations (entitlement_id, contest_id)
      VALUES ('${ENTITLEMENT_ID}'::uuid, '${SHARED_ID}'::uuid);
    `);
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT shared::text FROM public.gridone_share_board(
        '${SHARED_ID}'::uuid,
        '${OWNER_ID}'::uuid,
        (SELECT revision FROM public.contests WHERE id = '${SHARED_ID}'::uuid)
      );
    `)).toBe('true');

    const links = JSON.parse(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_seller_link('sync', '${SHARED_ID}'::uuid, '${OWNER_ID}'::uuid)::text;
    `)).links as Array<{ label: string; code: string }>;
    expect(links.map(link => link.label)).toEqual(['Mora']);
    const view = JSON.parse(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_seller_link('read', NULL, NULL, NULL, '${links[0].code}')::text;
    `));
    expect(view.label).toBe('Mora');
    await expect(queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_seller_link('read', NULL, NULL, NULL, '0123456789abcdef');
    `)).rejects.toThrow(/seller_access_denied/);

    await executeSql(`
      INSERT INTO public.family_board_access (contest_id, label, token_hash, cells, expires_at)
      VALUES (
        '${SHARED_ID}'::uuid, 'Mora', '${FAMILY_TOKEN}', ARRAY[0],
        clock_timestamp() + interval '7 days'
      );
    `);
    const family = JSON.parse(await queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_family_guest_link('${SHARED_ID}'::uuid, '${FAMILY_TOKEN}', 'read')::text;
    `));
    expect(family.label).toBe('Mora');
    expect(family.state).toBe('not_created');
    await expect(queryScalar(`
      SET ROLE service_role;
      SELECT public.gridone_family_guest_link('${SHARED_ID}'::uuid, '${'c'.repeat(64)}', 'read');
    `)).rejects.toThrow(/family_access_denied/);

    const leaseToken = '31000000-0000-4000-8000-000000000099';
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT acquired::text FROM public.gridone_acquire_score_refresh_lease_v2(
        '${SHARED_ID}'::uuid, '${leaseToken}'::uuid, 30
      );
    `)).toBe('true');
    await expect(queryScalar(`
      SET ROLE anon;
      SELECT acquired FROM public.gridone_acquire_score_refresh_lease_v2(
        '${SHARED_ID}'::uuid, '${randomUUID()}'::uuid, 30
      );
    `)).rejects.toThrow(/permission denied/i);
  });
});
