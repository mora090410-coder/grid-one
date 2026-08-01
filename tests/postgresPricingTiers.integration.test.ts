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
  { length: 8 },
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
  const files = migrationFiles();
  expect(files.map(file => Number(file.slice(0, 3)))).toEqual(
    Array.from({ length: 21 }, (_, index) => index),
  );
  await executeSql(
    readFileSync(resolve(directory, '019_pricing_tiers.sql'), 'utf8'),
  );
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
      'BBBBB${String(index + 2).padStart(3, '2')}',
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
}: {
  contestId: string;
  expectedRevision?: number;
  normalizedNames?: string[][];
  sideAxis?: string;
  topAxis?: string;
}) => {
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
      ${sqlText(JSON.stringify(publicBoard))}::jsonb,
      ${sqlText(JSON.stringify(matchup))}::jsonb
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
});
