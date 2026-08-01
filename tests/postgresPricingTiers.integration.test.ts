import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_NAME = 'gridone_pricing_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-pricing-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-pricing-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const LEGACY_OWNER_ID = '20000000-0000-4000-8000-000000000001';
const LEGACY_ENTITLEMENT_ID = '20000000-0000-4000-8000-000000000010';
const LEGACY_BOARD_IDS = [
  '20000000-0000-4000-8000-000000000011',
  '20000000-0000-4000-8000-000000000012',
] as const;
const BOARD_IDS = Array.from(
  { length: 10 },
  (_, index) => `10000000-0000-4000-8000-${String(index + 11).padStart(12, '0')}`,
);

const VALID_SIDE_AXIS = 'ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[]';
const VALID_TOP_AXIS = 'ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[]';
const validNames = Array.from(
  { length: 100 },
  (_, index) => [`Buyer ${index + 1}`],
);
const publicBoard = {
  bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  oppAxis: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  squares: validNames,
  isDynamic: false,
};
const matchup = {
  sideTeamName: 'Chicago Bears',
  sideTeamAbbr: 'CHI',
  topTeamName: 'Green Bay Packers',
  topTeamAbbr: 'GB',
  gameExternalId: '401772510',
  gameStartsAt: '2026-09-13T17:00:00.000Z',
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

const queryJson = async <T>(sql: string) =>
  JSON.parse(await queryScalar(sql)) as T;

const sqlText = (value: unknown) =>
  `'${String(value ?? '').replaceAll("'", "''")}'`;

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await docker(
        psqlArgs(['-qAt', '-c', 'SELECT 1']),
        undefined,
        5_000,
      );
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

const migrationFiles = () => readdirSync(
  resolve(process.cwd(), 'supabase/migrations'),
)
  .filter(file => /^\d{3}_.+\.sql$/.test(file))
  .sort();

const applyMigrationsThrough = async (lastNumber: number) => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = migrationFiles().filter(
    file => Number(file.slice(0, 3)) <= lastNumber,
  );
  expect(files.map(file => Number(file.slice(0, 3)))).toEqual(
    Array.from({ length: lastNumber + 1 }, (_, index) => index),
  );
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const applyPricingMigration = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = migrationFiles().filter(file => Number(file.slice(0, 3)) <= 19);
  expect(files.map(file => Number(file.slice(0, 3)))).toEqual(
    Array.from({ length: 20 }, (_, index) => index),
  );
  await executeSql(
    readFileSync(resolve(directory, '019_pricing_tiers.sql'), 'utf8'),
  );
};

const applyPostPricingMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  for (const file of [
    '020_score_refresh_scheduler.sql',
    '021_payout_descriptions.sql',
    '022_open_squares.sql',
  ]) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

const seedPrePricingFixtures = async () => {
  const legacyContestValues = LEGACY_BOARD_IDS.map(
    (contestId, index) => `(
      '${contestId}'::uuid,
      '${LEGACY_OWNER_ID}'::uuid,
      'AAAAAA2${index + 2}',
      'Legacy board ${index + 1}',
      2026,
      'legacy-game-${index + 1}',
      '2026-09-13T17:00:00Z'::timestamptz
    )`,
  ).join(',\n');
  const ownerContestValues = BOARD_IDS.map(
    (contestId, index) => `(
      '${contestId}'::uuid,
      '${OWNER_ID}'::uuid,
      'BBBBB22${'23456789AB'[index]}',
      'Pricing board ${index + 1}',
      2026,
      'owner-game-${index + 1}',
      '2026-09-13T17:00:00Z'::timestamptz,
      'Chicago Bears',
      'CHI',
      'Green Bay Packers',
      'GB'
    )`,
  ).join(',\n');

  await executeSql(`
    INSERT INTO auth.users (id, email)
    VALUES
      ('${OWNER_ID}'::uuid, 'owner@example.test'),
      ('${LEGACY_OWNER_ID}'::uuid, 'legacy@example.test');

    INSERT INTO public.contests (
      id,
      owner_id,
      share_code,
      title,
      season_year,
      game_external_id,
      game_starts_at
    )
    VALUES
      ${legacyContestValues};

    INSERT INTO public.contests (
      id,
      owner_id,
      share_code,
      title,
      season_year,
      game_external_id,
      game_starts_at,
      side_team_name,
      side_team_abbr,
      top_team_name,
      top_team_abbr
    )
    VALUES
      ${ownerContestValues};

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
      '${LEGACY_ENTITLEMENT_ID}'::uuid,
      '${LEGACY_OWNER_ID}'::uuid,
      2026,
      'active',
      20,
      499,
      'usd'
    );

    INSERT INTO public.board_activations (entitlement_id, contest_id)
    VALUES
      ('${LEGACY_ENTITLEMENT_ID}'::uuid, '${LEGACY_BOARD_IDS[0]}'::uuid),
      ('${LEGACY_ENTITLEMENT_ID}'::uuid, '${LEGACY_BOARD_IDS[1]}'::uuid);
  `);
};

type PublishResult = {
  published: boolean;
  share_code: string;
  next_revision: number;
  tier: 'free' | 'gameday' | 'org' | 'legacy';
  used: number;
  allowance: number;
};

const publishBoard = async ({
  contestId,
  expectedRevision = 1,
  normalizedNames = validNames,
  sideAxis = VALID_SIDE_AXIS,
  topAxis = VALID_TOP_AXIS,
  allowOpenSquares = false,
}: {
  contestId: string;
  expectedRevision?: number;
  normalizedNames?: string[][];
  sideAxis?: string;
  topAxis?: string;
  allowOpenSquares?: boolean;
}) => {
  const projectedBoard = { ...publicBoard, squares: normalizedNames };
  const output = await queryScalar(`
    SET ROLE service_role;
    SELECT row_to_json(result)::text
    FROM public.gridone_publish_board(
      '${contestId}'::uuid,
      '${OWNER_ID}'::uuid,
      ${expectedRevision}::bigint,
      ${sideAxis},
      ${topAxis},
      ${sqlText(JSON.stringify(normalizedNames))}::jsonb,
      ${sqlText(JSON.stringify(projectedBoard))}::jsonb,
      ${sqlText(JSON.stringify(matchup))}::jsonb,
      ${allowOpenSquares}::boolean
    ) AS result
  `);
  return output ? JSON.parse(output) as PublishResult : null;
};

describe.sequential('pricing tiers on disposable PostgreSQL 17', () => {
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
    await applyMigrationsThrough(18);
    await seedPrePricingFixtures();
    await applyPricingMigration();
    await applyPostPricingMigrations();
  }, 240_000);

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName], undefined, 30_000);
      containerStarted = false;
    }
  }, 60_000);

  it('backfills legacy usage and consumes free allowance only on a valid publish', async () => {
    expect(await queryJson<{
      tier: string;
      allowance: number;
      used: number;
    }>(`
      SELECT json_build_object(
        'tier', entitlement.tier,
        'allowance', entitlement.boards_allowance,
        'used', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          WHERE activation.entitlement_id = entitlement.id
        )
      )::text
      FROM public.season_entitlements entitlement
      WHERE entitlement.id = '${LEGACY_ENTITLEMENT_ID}'::uuid
    `)).toEqual({
      tier: 'legacy',
      allowance: 2,
      used: 2,
    });

    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.season_entitlements
      WHERE owner_id = '${OWNER_ID}'::uuid
        AND season_year = 2026
    `)).toBe('0');

    await expect(publishBoard({
      contestId: BOARD_IDS[1],
      normalizedNames: validNames.slice(0, 99),
    })).rejects.toThrow('The board must contain exactly 100 squares');

    expect(await publishBoard({
      contestId: BOARD_IDS[1],
      expectedRevision: 999,
    })).toBeNull();

    expect(await queryJson<{
      entitlements: number;
      activations: number;
      snapshots: number;
    }>(`
      SELECT json_build_object(
        'entitlements', (
          SELECT count(*)::integer
          FROM public.season_entitlements
          WHERE owner_id = '${OWNER_ID}'::uuid
        ),
        'activations', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          JOIN public.contests contest ON contest.id = activation.contest_id
          WHERE contest.owner_id = '${OWNER_ID}'::uuid
        ),
        'snapshots', (
          SELECT count(*)::integer
          FROM public.public_board_snapshots snapshot
          JOIN public.contests contest ON contest.id = snapshot.contest_id
          WHERE contest.owner_id = '${OWNER_ID}'::uuid
        )
      )::text
    `)).toEqual({
      entitlements: 0,
      activations: 0,
      snapshots: 0,
    });

    expect(await publishBoard({
      contestId: BOARD_IDS[0],
    })).toMatchObject({
      published: true,
      tier: 'free',
      used: 1,
      allowance: 1,
    });

    expect(await queryJson<{
      tier: string;
      allowance: number;
      activationCount: number;
      snapshotCount: number;
    }>(`
      SELECT json_build_object(
        'tier', entitlement.tier,
        'allowance', entitlement.boards_allowance,
        'activationCount', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          WHERE activation.entitlement_id = entitlement.id
        ),
        'snapshotCount', (
          SELECT count(*)::integer
          FROM public.public_board_snapshots snapshot
          JOIN public.contests contest ON contest.id = snapshot.contest_id
          WHERE contest.owner_id = '${OWNER_ID}'::uuid
        )
      )::text
      FROM public.season_entitlements entitlement
      WHERE entitlement.owner_id = '${OWNER_ID}'::uuid
        AND entitlement.season_year = 2026
    `)).toEqual({
      tier: 'free',
      allowance: 1,
      activationCount: 1,
      snapshotCount: 1,
    });

    await expect(publishBoard({
      contestId: BOARD_IDS[1],
    })).rejects.toThrow('PUBLISH_ALLOWANCE_EXHAUSTED:free:1:1');
  }, 60_000);

  it('uses the same entitlement for Game Day and stops exactly at five boards', async () => {
    const entitlementId = await queryScalar(`
      UPDATE public.season_entitlements
      SET
        tier = 'gameday',
        boards_allowance = 5,
        price_cents = 999,
        stripe_price_id = 'price_gameday',
        updated_at = now()
      WHERE owner_id = '${OWNER_ID}'::uuid
        AND season_year = 2026
      RETURNING id::text
    `);

    for (const [index, contestId] of BOARD_IDS.slice(1, 5).entries()) {
      expect(await publishBoard({ contestId })).toMatchObject({
        tier: 'gameday',
        used: index + 2,
        allowance: 5,
      });
    }

    await expect(publishBoard({
      contestId: BOARD_IDS[5],
    })).rejects.toThrow('PUBLISH_ALLOWANCE_EXHAUSTED:gameday:5:5');

    expect(await queryJson<{
      entitlementId: string;
      activationCount: number;
      snapshotCount: number;
    }>(`
      SELECT json_build_object(
        'entitlementId', entitlement.id,
        'activationCount', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          WHERE activation.entitlement_id = entitlement.id
        ),
        'snapshotCount', (
          SELECT count(*)::integer
          FROM public.public_board_snapshots snapshot
          JOIN public.contests contest ON contest.id = snapshot.contest_id
          WHERE contest.owner_id = '${OWNER_ID}'::uuid
        )
      )::text
      FROM public.season_entitlements entitlement
      WHERE entitlement.id = '${entitlementId}'::uuid
    `)).toEqual({
      entitlementId,
      activationCount: 5,
      snapshotCount: 5,
    });
  }, 60_000);

  it('upgrades to Organization without publishing its checkout draft and brands all season boards', async () => {
    const entitlementIdBefore = await queryScalar(`
      SELECT id::text
      FROM public.season_entitlements
      WHERE owner_id = '${OWNER_ID}'::uuid
        AND season_year = 2026
    `);
    const checkoutDraftId = BOARD_IDS[7];
    const claim = await queryJson<{
      order_id: string;
      order_status: string;
      already_entitled: boolean;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_claim_checkout_order(
        '${OWNER_ID}'::uuid,
        '${checkoutDraftId}'::uuid,
        2026::smallint,
        'price_org',
        7900,
        'usd',
        'org',
        'Riverside Ravens Booster Club'
      ) AS result
    `);
    expect(claim).toMatchObject({
      order_status: 'pending',
      already_entitled: false,
    });

    const fulfilled = await queryJson<{
      outcome: string;
      entitlement_id: string;
      activated: boolean;
      used: number;
      allowance: number;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_fulfill_checkout_v2(
        'evt_org_upgrade',
        'checkout.session.completed',
        '${claim.order_id}'::uuid,
        'cs_org_upgrade',
        'pi_org_upgrade',
        'cus_org_upgrade',
        'price_org',
        7900,
        'usd'
      ) AS result
    `);
    expect(fulfilled).toMatchObject({
      outcome: 'fulfilled',
      entitlement_id: entitlementIdBefore,
      activated: false,
      used: 5,
      allowance: 50,
    });
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.public_board_snapshots snapshot
      JOIN public.contests contest ON contest.id = snapshot.contest_id
      WHERE contest.owner_id = '${OWNER_ID}'::uuid
        AND snapshot.organization_display_name = 'Riverside Ravens Booster Club'
    `)).toBe('5');

    expect(await queryJson<{
      entitlementId: string;
      tier: string;
      allowance: number;
      organizationDisplayName: string;
      activationCount: number;
      draftStatus: string;
      draftActivationCount: number;
      draftSnapshotCount: number;
    }>(`
      SELECT json_build_object(
        'entitlementId', entitlement.id,
        'tier', entitlement.tier,
        'allowance', entitlement.boards_allowance,
        'organizationDisplayName', entitlement.organization_display_name,
        'activationCount', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          WHERE activation.entitlement_id = entitlement.id
        ),
        'draftStatus', contest.status,
        'draftActivationCount', (
          SELECT count(*)::integer
          FROM public.board_activations activation
          WHERE activation.contest_id = contest.id
        ),
        'draftSnapshotCount', (
          SELECT count(*)::integer
          FROM public.public_board_snapshots snapshot
          WHERE snapshot.contest_id = contest.id
        )
      )::text
      FROM public.season_entitlements entitlement
      JOIN public.contests contest
        ON contest.id = '${checkoutDraftId}'::uuid
      WHERE entitlement.id = '${entitlementIdBefore}'::uuid
    `)).toEqual({
      entitlementId: entitlementIdBefore,
      tier: 'org',
      allowance: 50,
      organizationDisplayName: 'Riverside Ravens Booster Club',
      activationCount: 5,
      draftStatus: 'draft',
      draftActivationCount: 0,
      draftSnapshotCount: 0,
    });

    expect(await publishBoard({
      contestId: BOARD_IDS[5],
    })).toMatchObject({
      tier: 'org',
      used: 6,
      allowance: 50,
    });
    expect(await queryScalar(`
      SELECT organization_display_name
      FROM public.public_board_snapshots
      WHERE contest_id = '${BOARD_IDS[5]}'::uuid
    `)).toBe('Riverside Ravens Booster Club');
  }, 60_000);

  it('projects payout descriptions on publish and updates them atomically afterward', async () => {
    const contestId = BOARD_IDS[6];
    const draftUpdate = await queryJson<{
      next_revision: number;
      payout_descriptions: Record<string, string>;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_update_payout_descriptions(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        1::bigint,
        '{"Q1":"A pie","notes":"Organizer rules apply."}'::jsonb
      ) AS result
    `);
    expect(draftUpdate).toMatchObject({
      next_revision: 2,
      payout_descriptions: { Q1: 'A pie', notes: 'Organizer rules apply.' },
    });

    expect(await queryScalar(`
      SELECT payout_labels::text
      FROM public.contests
      WHERE id = '${contestId}'::uuid
    `)).toBe('{}');

    expect(await publishBoard({ contestId, expectedRevision: 2 })).toMatchObject({
      published: true,
      tier: 'org',
      used: 7,
      allowance: 50,
    });
    expect(await queryJson<Record<string, string>>(`
      SELECT payout_descriptions::text
      FROM public.public_board_snapshots
      WHERE contest_id = '${contestId}'::uuid
    `)).toEqual({ Q1: 'A pie', notes: 'Organizer rules apply.' });

    const publishedUpdate = await queryJson<{
      next_revision: number;
      payout_descriptions: Record<string, string>;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_update_payout_descriptions(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        3::bigint,
        '{"FINAL":"Winner gets the trophy"}'::jsonb
      ) AS result
    `);
    expect(publishedUpdate).toMatchObject({
      next_revision: 4,
      payout_descriptions: { FINAL: 'Winner gets the trophy' },
    });
    expect(await queryJson<{
      revision: number;
      payoutDescriptions: Record<string, string>;
    }>(`
      SELECT json_build_object(
        'revision', revision,
        'payoutDescriptions', payout_descriptions
      )::text
      FROM public.public_board_snapshots
      WHERE contest_id = '${contestId}'::uuid
    `)).toEqual({
      revision: 4,
      payoutDescriptions: { FINAL: 'Winner gets the trophy' },
    });

    await expect(queryScalar(`
      SET ROLE authenticated;
      SELECT *
      FROM public.gridone_update_payout_descriptions(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        4::bigint,
        '{}'::jsonb
      )
    `)).rejects.toThrow(/permission denied/i);

    await expect(executeSql(`
      SET ROLE service_role;
      UPDATE public.contests
      SET payout_descriptions = '{"Q1":"https://example.com"}'::jsonb
      WHERE id = '${contestId}'::uuid;
    `)).rejects.toThrow(/contests_payout_descriptions_check/i);
  }, 60_000);

  it('publishes open squares only by opt-in, fills only before kickoff, and resolves an open milestone without email', async () => {
    const contestId = BOARD_IDS[8];
    const openNames = validNames.map((cell, index) => index < 94 ? cell : []);
    const openBoard = { ...publicBoard, allowOpenSquares: true, squares: openNames };
    await executeSql(`
      UPDATE public.contests
      SET board_data = ${sqlText(JSON.stringify(openBoard))}::jsonb
      WHERE id = '${contestId}'::uuid
    `);

    await expect(publishBoard({
      contestId,
      expectedRevision: 2,
      normalizedNames: openNames,
    })).rejects.toThrow(/confirm open-square publication/i);

    expect(await publishBoard({
      contestId,
      expectedRevision: 2,
      normalizedNames: openNames,
      allowOpenSquares: true,
    })).toMatchObject({ published: true, tier: 'org' });

    expect(await queryJson<{
      optedIn: boolean;
      projectedOptIn: boolean;
      assignments: number;
      openCells: number;
    }>(`
      SELECT json_build_object(
        'optedIn', contest.allow_open_squares,
        'projectedOptIn', (snapshot.board ->> 'allowOpenSquares')::boolean,
        'assignments', (
          SELECT count(*)::integer FROM public.square_assignments assignment
          WHERE assignment.contest_id = contest.id
        ),
        'openCells', (
          SELECT count(*)::integer
          FROM jsonb_array_elements(snapshot.board -> 'squares') cell(value)
          WHERE jsonb_array_length(cell.value) = 0
        )
      )::text
      FROM public.contests contest
      JOIN public.public_board_snapshots snapshot ON snapshot.contest_id = contest.id
      WHERE contest.id = '${contestId}'::uuid
    `)).toEqual({ optedIn: true, projectedOptIn: true, assignments: 94, openCells: 6 });

    const lateNames = openNames.map((cell) => [...cell]);
    lateNames[94] = ['Late Buyer'];
    const fillResult = await queryJson<{
      next_revision: number;
      filled_count: number;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_fill_open_squares(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        3::bigint,
        ${sqlText(JSON.stringify(lateNames))}::jsonb
      ) AS result
    `);
    expect(fillResult).toMatchObject({ next_revision: 4, filled_count: 1 });

    expect(await queryJson<{
      assignmentName: string;
      snapshotName: string;
      auditFilled: number;
    }>(`
      SELECT json_build_object(
        'assignmentName', participant.display_name,
        'snapshotName', snapshot.board -> 'squares' -> 94 ->> 0,
        'auditFilled', (audit.details ->> 'filledCount')::integer
      )::text
      FROM public.square_assignments assignment
      JOIN public.contest_participants participant ON participant.id = assignment.participant_id
      JOIN public.public_board_snapshots snapshot ON snapshot.contest_id = assignment.contest_id
      JOIN public.contest_audit_events audit
        ON audit.contest_id = assignment.contest_id
       AND audit.event_type = 'board.open_squares_filled'
      WHERE assignment.contest_id = '${contestId}'::uuid
        AND assignment.cell_index = 94
    `)).toEqual({ assignmentName: 'Late Buyer', snapshotName: 'Late Buyer', auditFilled: 1 });

    const occupiedMutation = lateNames.map((cell) => [...cell]);
    occupiedMutation[0] = ['Replacement'];
    await expect(queryScalar(`
      SET ROLE service_role;
      SELECT * FROM public.gridone_fill_open_squares(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        4::bigint,
        ${sqlText(JSON.stringify(occupiedMutation))}::jsonb
      )
    `)).rejects.toThrow(/occupied squares cannot be changed/i);

    const participantId = await queryScalar(`
      SELECT participant_id::text FROM public.square_assignments
      WHERE contest_id = '${contestId}'::uuid AND cell_index = 0
    `);
    await executeSql(`
      INSERT INTO public.notification_subscriptions (
        contest_id, participant_id, email, status, unsubscribe_token_hash, verified_at
      ) VALUES (
        '${contestId}'::uuid,
        '${participantId}'::uuid,
        'buyer@example.test',
        'verified',
        'unsubscribe-hash',
        now()
      );

      INSERT INTO public.contest_score_state (contest_id)
      VALUES ('${contestId}'::uuid)
      ON CONFLICT (contest_id) DO NOTHING;

      WITH inserted AS (
        INSERT INTO public.score_snapshots (
          contest_id, source_mode, provider, game_state, period,
          side_score, top_score, quarter_scores, validation_status,
          retrieved_at, stale_after, is_current
        ) VALUES (
          '${contestId}'::uuid, 'manual', 'organizer', 'in', 2,
          9, 4, '{"Q1":{"left":9,"top":4}}'::jsonb, 'accepted',
          now(), now() + interval '5 minutes', true
        ) RETURNING id
      )
      UPDATE public.contest_score_state state
      SET current_snapshot_id = inserted.id
      FROM inserted
      WHERE state.contest_id = '${contestId}'::uuid;
    `);
    const snapshotId = await queryScalar(`
      SELECT current_snapshot_id::text FROM public.contest_score_state
      WHERE contest_id = '${contestId}'::uuid
    `);
    await queryScalar(`
      SET ROLE service_role;
      SELECT count(*)::text FROM public.gridone_observe_milestones(
        '${contestId}'::uuid,
        '${snapshotId}'::uuid
      )
    `);

    expect(await queryJson<{
      openSquare: boolean;
      assignmentId: string | null;
      participantId: string | null;
      projectedOpenSquare: boolean;
      deliveries: number;
    }>(`
      SELECT json_build_object(
        'openSquare', resolution.open_square,
        'assignmentId', resolution.assignment_id,
        'participantId', resolution.participant_id,
        'projectedOpenSquare', (snapshot.winner_history -> 0 ->> 'openSquare')::boolean,
        'deliveries', (
          SELECT count(*)::integer FROM public.notification_deliveries delivery
          WHERE delivery.resolution_id = resolution.id
        )
      )::text
      FROM public.milestone_resolutions resolution
      JOIN public.public_board_snapshots snapshot ON snapshot.contest_id = resolution.contest_id
      WHERE resolution.contest_id = '${contestId}'::uuid
        AND resolution.milestone = 'Q1'
    `)).toEqual({
      openSquare: true,
      assignmentId: null,
      participantId: null,
      projectedOpenSquare: true,
      deliveries: 0,
    });

    await queryScalar(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_correct_milestone(
        '${contestId}'::uuid,
        '${OWNER_ID}'::uuid,
        'Q1',
        1,
        0,
        9,
        'Corrected organizer score'
      ) AS result
    `);
    expect(await queryJson<{
      openSquare: boolean;
      projectedOpenSquare: boolean;
      originalVersionOpenSquare: boolean;
      correctionDeliveries: number;
    }>(`
      WITH current_resolution AS (
        SELECT * FROM public.milestone_resolutions
        WHERE contest_id = '${contestId}'::uuid AND milestone = 'Q1'
        ORDER BY resolution_version DESC LIMIT 1
      )
      SELECT json_build_object(
        'openSquare', resolution.open_square,
        'projectedOpenSquare', (snapshot.winner_history -> 0 ->> 'openSquare')::boolean,
        'originalVersionOpenSquare',
          (snapshot.winner_history -> 0 -> 'versions' -> 0 ->> 'openSquare')::boolean,
        'correctionDeliveries', (
          SELECT count(*)::integer FROM public.notification_deliveries delivery
          WHERE delivery.resolution_id = resolution.id
        )
      )::text
      FROM current_resolution resolution
      JOIN public.public_board_snapshots snapshot ON snapshot.contest_id = resolution.contest_id
    `)).toEqual({
      openSquare: false,
      projectedOpenSquare: false,
      originalVersionOpenSquare: true,
      correctionDeliveries: 1,
    });

    const frozenContestId = BOARD_IDS[9];
    await executeSql(`
      UPDATE public.contests
      SET
        board_data = ${sqlText(JSON.stringify(openBoard))}::jsonb,
        game_starts_at = clock_timestamp() - interval '1 second'
      WHERE id = '${frozenContestId}'::uuid
    `);
    await publishBoard({
      contestId: frozenContestId,
      expectedRevision: 2,
      normalizedNames: openNames,
      allowOpenSquares: true,
    });
    const anotherFill = openNames.map((cell) => [...cell]);
    anotherFill[94] = ['Too Late'];
    await expect(queryScalar(`
      SET ROLE service_role;
      SELECT * FROM public.gridone_fill_open_squares(
        '${frozenContestId}'::uuid,
        '${OWNER_ID}'::uuid,
        3::bigint,
        ${sqlText(JSON.stringify(anotherFill))}::jsonb
      )
    `)).rejects.toThrow(/frozen at kickoff/i);
  }, 60_000);
});
