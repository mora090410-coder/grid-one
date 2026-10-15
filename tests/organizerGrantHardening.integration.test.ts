import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

// Organizer JWT privileges after 036. Disposable Postgres only.

const DATABASE_NAME = 'gridone_grant_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-grant-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-grants-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ID = '40000000-0000-4000-8000-000000000001';
const STRANGER_ID = '40000000-0000-4000-8000-000000000002';
const CONTEST_ID = '40000000-0000-4000-8000-000000000011';
const DRAFT_ID = '40000000-0000-4000-8000-000000000012';
const ENTITLEMENT_ID = '40000000-0000-4000-8000-000000000021';
const ORDER_ID = '40000000-0000-4000-8000-000000000031';
const PARTICIPANT_ID = '40000000-0000-4000-8000-000000000041';
const ASSIGNMENT_ID = '40000000-0000-4000-8000-000000000042';

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

const asUser = (userId: string, sql: string) => `
  DO $cfg$ BEGIN PERFORM set_config('request.jwt.claim.sub', '${userId}', false); END $cfg$;
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
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
  `);
};

const applyMigrations = async () => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory).filter(file => /^\d{3}_.+\.sql$/.test(file)).sort();
  const numbers = files.map(file => Number(file.slice(0, 3)));
  expect(numbers.filter(number => number <= 34)).toEqual(expectedMigrationNumbers(34));
  expect(numbers).toContain(36);
  for (const file of files) {
    await executeSql(readFileSync(resolve(directory, file), 'utf8'));
  }
};

describe.sequential('organizer column and grant hardening', () => {
  beforeAll(async () => {
    await docker(['run', '--rm', '--detach', '--name', containerName,
      '--env', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DATABASE_NAME}`, POSTGRES_IMAGE]);
    containerStarted = true;
    await waitForPostgres();
    await bootstrap();
    await applyMigrations();
    await executeSql(`
      INSERT INTO auth.users (id, email) VALUES
        ('${OWNER_ID}', 'owner@example.test'),
        ('${STRANGER_ID}', 'stranger@example.test');
      INSERT INTO public.contests (id, owner_id, share_code, title, board_data)
      VALUES ('${CONTEST_ID}', '${OWNER_ID}', 'GRANT234', 'Grant board', '{"squares":[]}'::jsonb);
      INSERT INTO public.season_entitlements (
        id, owner_id, season_year, status, boards_allowance, price_cents, currency
      ) VALUES (
        '${ENTITLEMENT_ID}', '${OWNER_ID}', 2026, 'active', 1, 0, 'usd'
      );
      INSERT INTO public.board_activations (entitlement_id, contest_id)
      VALUES ('${ENTITLEMENT_ID}', '${CONTEST_ID}');
      INSERT INTO public.checkout_orders (
        id, owner_id, contest_id, season_year, price_id, price_cents, currency, status
      ) VALUES (
        '${ORDER_ID}', '${OWNER_ID}', '${CONTEST_ID}', 2026, 'price_test', 999, 'usd', 'pending'
      );
      INSERT INTO public.contest_participants (id, contest_id, display_name, public_label)
      VALUES ('${PARTICIPANT_ID}', '${CONTEST_ID}', 'Buyer', 'Buyer');
      INSERT INTO public.square_assignments (id, contest_id, cell_index, participant_id)
      VALUES ('${ASSIGNMENT_ID}', '${CONTEST_ID}', 0, '${PARTICIPANT_ID}');
      INSERT INTO public.square_assignment_private (assignment_id, contest_id, payment_status, private_note)
      VALUES ('${ASSIGNMENT_ID}', '${CONTEST_ID}', 'paid', 'collected at the door');
    `);
  }, 300_000);

  afterAll(async () => {
    if (containerStarted) await docker(['rm', '--force', containerName]).catch(() => undefined);
  }, 60_000);

  it('pins search_path on the contest_entries timestamp trigger', async () => {
    expect(await queryScalar(`
      SELECT proconfig FROM pg_proc
      WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace
    `)).toContain('search_path=pg_catalog, public');
  });

  it('scopes contest_entries to authenticated and reads auth.uid() once', async () => {
    const policy = await queryScalar(`
      SELECT roles::text || '|' || qual || '|' || with_check
      FROM pg_policies
      WHERE tablename = 'contest_entries' AND policyname = 'Organizer can manage entries'
    `);
    const [roles, qual, withCheck] = policy.split('|');
    expect(roles).toBe('{authenticated}');
    expect(qual).toContain('( SELECT auth.uid()');
    expect(withCheck).toContain('( SELECT auth.uid()');
    expect(qual).not.toMatch(/(^|[^T]) auth\.uid\(\)/);
  });

  it('lets the owner create a draft and save board_data, and bumps revision', async () => {
    const created = await queryScalar(asUser(OWNER_ID, `
      INSERT INTO public.contests (
        owner_id, title, season_year, game_external_id, game_starts_at,
        side_team_abbr, side_team_name, top_team_abbr, top_team_name,
        payout_labels, payout_descriptions, settings, board_data, score_test_mode
      ) VALUES (
        '${OWNER_ID}', 'Created by the organizer', 2026, '401772510', '2026-11-01T17:00:00Z',
        'CHI', 'Chicago Bears', 'GB', 'Green Bay Packers',
        '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{"squares":[]}'::jsonb, false
      ) RETURNING id::text;
    `));
    expect(created).toMatch(/^[0-9a-f-]{36}$/);
    expect(await queryScalar(`SELECT status || ' ' || (published_at IS NULL)::text FROM public.contests WHERE id = '${created}'`)).toBe('draft true');

    await executeSql(asUser(OWNER_ID, `
      UPDATE public.contests
      SET board_data = '{"squares":[["Jane"]]}'::jsonb
      WHERE id = '${CONTEST_ID}';
    `));
    expect(await queryScalar(`SELECT board_data #>> '{squares,0,0}' FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('Jane');
    expect(await queryScalar(`SELECT revision FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('2');
  });

  it('refuses server-owned contest columns from the organizer JWT', async () => {
    const denied = [
      `UPDATE public.contests SET status = 'published' WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET published_at = now() WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET shared_at = now() WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET is_activated = true WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET stripe_checkout_session_id = 'cs_test' WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET axis_locked_at = now() WHERE id = '${CONTEST_ID}'`,
      `UPDATE public.contests SET season_year = 2027 WHERE id = '${CONTEST_ID}'`,
      `INSERT INTO public.contests (owner_id, title, status, published_at) VALUES ('${OWNER_ID}', 'Sneaky', 'published', now())`,
    ];
    for (const statement of denied) {
      await expect(executeSql(asUser(OWNER_ID, `${statement};`))).rejects.toThrow(/permission denied/i);
    }
    expect(await queryScalar(`SELECT status FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('draft');
    expect(await queryScalar(`SELECT published_at IS NULL FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('t');
  });

  it('still lets the service role write those columns and read checkout', async () => {
    await executeSql(`
      SET ROLE service_role;
      UPDATE public.contests SET status = 'ready' WHERE id = '${CONTEST_ID}';
      RESET ROLE;
    `);
    expect(await queryScalar(`SELECT status FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('ready');
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT status || ' ' || price_cents::text FROM public.checkout_orders WHERE id = '${ORDER_ID}';
    `)).toBe('pending 999');
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT count(*) FROM public.public_board_snapshots;
    `)).toBe('0');
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT count(*) FROM public.seller_links;
    `)).toBe('0');
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT count(*) FROM public.family_board_access;
    `)).toBe('0');
  });

  it('lets the service role take a live-score lease and refuses the organizer role', async () => {
    const token = '40000000-0000-4000-8000-000000000099';
    expect(await queryScalar(`
      SET ROLE service_role;
      SELECT acquired::text FROM public.gridone_acquire_score_refresh_lease_v2(
        '${CONTEST_ID}'::uuid, '${token}'::uuid, 30
      );
    `)).toBe('true');
    await expect(queryScalar(`
      SET ROLE authenticated;
      SELECT acquired FROM public.gridone_acquire_score_refresh_lease_v2(
        '${CONTEST_ID}'::uuid, '${token}'::uuid, 30
      );
    `)).rejects.toThrow(/permission denied/i);
  });

  it('keeps another organizer out of this board, its payments, and its private notes', async () => {
    expect(await queryScalar(asUser(STRANGER_ID, `SELECT count(*) FROM public.contests WHERE id = '${CONTEST_ID}';`))).toBe('0');
    expect(await queryScalar(asUser(OWNER_ID, `SELECT public.gridone_owns_contest('${CONTEST_ID}'::uuid)::text;`))).toBe('true');
    expect(await queryScalar(asUser(STRANGER_ID, `SELECT public.gridone_owns_contest('${CONTEST_ID}'::uuid)::text;`))).toBe('false');

    await executeSql(asUser(OWNER_ID, `
      INSERT INTO public.contest_entries (contest_id, cell_index, paid_status, contact_value)
      VALUES ('${CONTEST_ID}', 4, 'paid', 'owner@example.test');
    `));
    expect(await queryScalar(asUser(OWNER_ID, `
      SELECT paid_status FROM public.contest_entries WHERE contest_id = '${CONTEST_ID}' AND cell_index = 4;
    `))).toBe('paid');
    expect(await queryScalar(asUser(STRANGER_ID, `
      SELECT count(*) FROM public.contest_entries WHERE contest_id = '${CONTEST_ID}';
    `))).toBe('0');
    await expect(executeSql(asUser(STRANGER_ID, `
      INSERT INTO public.contest_entries (contest_id, cell_index, paid_status)
      VALUES ('${CONTEST_ID}', 5, 'unpaid');
    `))).rejects.toThrow(/row-level security/i);

    expect(await queryScalar(asUser(OWNER_ID, `
      SELECT count(*) FROM public.board_activations WHERE contest_id = '${CONTEST_ID}';
    `))).toBe('1');
    expect(await queryScalar(asUser(STRANGER_ID, `
      SELECT count(*) FROM public.board_activations WHERE contest_id = '${CONTEST_ID}';
    `))).toBe('0');
  });

  it('removes direct reads and writes of billing, assignments, and snapshots', async () => {
    const denied = [
      `SELECT count(*) FROM public.checkout_orders`,
      `SELECT count(*) FROM public.season_entitlements`,
      `SELECT private_note FROM public.square_assignment_private`,
      `SELECT count(*) FROM public.square_assignments`,
      `SELECT count(*) FROM public.public_board_snapshots`,
      `SELECT count(*) FROM public.seller_links`,
      `SELECT count(*) FROM public.family_board_access`,
      `UPDATE public.square_assignments SET cell_index = 1 WHERE id = '${ASSIGNMENT_ID}'`,
      `INSERT INTO public.contest_participants (contest_id, display_name, public_label) VALUES ('${CONTEST_ID}', 'Swap', 'Swap')`,
      `UPDATE public.season_entitlements SET boards_allowance = 50 WHERE id = '${ENTITLEMENT_ID}'`,
      `UPDATE public.checkout_orders SET status = 'paid' WHERE id = '${ORDER_ID}'`,
      `UPDATE public.board_activations SET activated_at = now() WHERE contest_id = '${CONTEST_ID}'`,
    ];
    for (const statement of denied) {
      await expect(executeSql(asUser(OWNER_ID, `${statement};`))).rejects.toThrow(/permission denied/i);
    }
    expect(await queryScalar(`SELECT cell_index FROM public.square_assignments WHERE id = '${ASSIGNMENT_ID}'`)).toBe('0');
    expect(await queryScalar(`SELECT boards_allowance FROM public.season_entitlements WHERE id = '${ENTITLEMENT_ID}'`)).toBe('1');
    expect(await queryScalar(`SELECT status FROM public.checkout_orders WHERE id = '${ORDER_ID}'`)).toBe('pending');
  });

  it('still lets the owner delete an unshared draft and not a published board', async () => {
    await executeSql(`
      INSERT INTO public.contests (id, owner_id, share_code, title)
      VALUES ('${DRAFT_ID}', '${OWNER_ID}', 'DRAFT234', 'Throwaway draft');
    `);
    await executeSql(asUser(OWNER_ID, `DELETE FROM public.contests WHERE id = '${DRAFT_ID}';`));
    expect(await queryScalar(`SELECT count(*) FROM public.contests WHERE id = '${DRAFT_ID}'`)).toBe('0');

    await executeSql(`
      UPDATE public.contests
      SET side_axis = ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
          top_axis = ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
          axis_locked_at = now(),
          published_at = now(),
          status = 'published'
      WHERE id = '${CONTEST_ID}';
    `);
    await executeSql(asUser(OWNER_ID, `DELETE FROM public.contests WHERE id = '${CONTEST_ID}';`));
    expect(await queryScalar(`SELECT count(*) FROM public.contests WHERE id = '${CONTEST_ID}'`)).toBe('1');
    await expect(executeSql(asUser(OWNER_ID, `
      UPDATE public.contests SET published_at = NULL, status = 'draft' WHERE id = '${CONTEST_ID}';
    `))).rejects.toThrow(/permission denied/i);
  });

  it('covers the hot-path foreign keys', async () => {
    const names = [
      'square_assignments_participant_fk_idx',
      'milestone_resolutions_assignment_fk_idx',
      'milestone_resolutions_participant_fk_idx',
      'milestone_resolutions_score_snapshot_fk_idx',
      'notification_deliveries_subscription_fk_idx',
      'notification_subscriptions_participant_fk_idx',
      'contest_score_state_current_snapshot_fk_idx',
      'contest_score_state_observed_snapshot_fk_idx',
      'pending_resolutions_first_snapshot_fk_idx',
      'pending_resolutions_latest_snapshot_fk_idx',
      'checkout_orders_contest_fk_idx',
      'stripe_events_checkout_order_fk_idx',
    ];
    expect(await queryScalar(`
      SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN (${names.map(name => `'${name}'`).join(',')})
    `)).toBe(String(names.length));
  });
});
