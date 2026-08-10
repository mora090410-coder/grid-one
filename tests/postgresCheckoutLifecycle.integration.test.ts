import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}));

const DATABASE_NAME = 'gridone_checkout_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-checkout-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-checkout-postgres-${process.pid}-${randomUUID().slice(0, 8)}`;

const OWNER_ASYNC = '10000000-0000-4000-8000-000000000001';
const OWNER_REFUND = '20000000-0000-4000-8000-000000000001';
const OWNER_DISPUTE = '30000000-0000-4000-8000-000000000001';

const CONTEST_ASYNC_A = '10000000-0000-4000-8000-000000000011';
const CONTEST_ASYNC_B = '10000000-0000-4000-8000-000000000012';
const CONTEST_REFUND_A = '20000000-0000-4000-8000-000000000011';
const CONTEST_REFUND_B = '20000000-0000-4000-8000-000000000012';
const CONTEST_REFUND_C = '20000000-0000-4000-8000-000000000013';
const CONTEST_DISPUTE_A = '30000000-0000-4000-8000-000000000011';
const CONTEST_DISPUTE_B = '30000000-0000-4000-8000-000000000012';

const hostedProofEnvironment = {
  secretKey: process.env.GRIDONE_STRIPE_HOSTED_PROOF_SECRET_KEY,
  webhookSecret: process.env.GRIDONE_STRIPE_HOSTED_PROOF_WEBHOOK_SECRET,
  sessionId: process.env.GRIDONE_STRIPE_HOSTED_PROOF_SESSION_ID,
  checkoutEventId: process.env.GRIDONE_STRIPE_HOSTED_PROOF_CHECKOUT_EVENT_ID,
  orderId: process.env.GRIDONE_STRIPE_HOSTED_PROOF_ORDER_ID,
  priceId: process.env.GRIDONE_STRIPE_HOSTED_PROOF_PRICE_ID,
};
const hostedProofEnabled = Object.values(hostedProofEnvironment).every(Boolean);

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

const sqlText = (value: unknown) => `'${String(value ?? '').replaceAll("'", "''")}'`;

const postgresAdminClient = () => {
  const client = {
    rpc: vi.fn(async (functionName: string, args: Record<string, unknown>) => {
      try {
        if (functionName === 'gridone_fulfill_checkout_v2') {
          const result = await queryJson<Record<string, unknown>>(`
            SET ROLE service_role;
            SELECT row_to_json(result)::text
            FROM public.gridone_fulfill_checkout_v2(
              ${sqlText(args.p_event_id)},
              ${sqlText(args.p_event_type)},
              ${sqlText(args.p_order_id)}::uuid,
              ${sqlText(args.p_session_id)},
              ${sqlText(args.p_payment_intent_id)},
              ${sqlText(args.p_customer_id)},
              ${sqlText(args.p_price_id)},
              ${Number(args.p_price_cents)},
              ${sqlText(args.p_currency)}
            ) AS result
          `);
          return { data: [result], error: null };
        }

        if (functionName === 'gridone_apply_entitlement_payment_event') {
          const nullableText = (value: unknown) => (
            value === null || value === undefined || value === ''
              ? 'NULL'
              : sqlText(value)
          );
          const result = await queryJson<Record<string, unknown>>(`
            SET ROLE service_role;
            SELECT row_to_json(result)::text
            FROM public.gridone_apply_entitlement_payment_event(
              ${sqlText(args.p_event_id)},
              ${sqlText(args.p_event_type)},
              ${nullableText(args.p_payment_intent_id)},
              ${nullableText(args.p_charge_id)},
              ${nullableText(args.p_dispute_id)},
              ${nullableText(args.p_dispute_status)},
              ${nullableText(args.p_reason)},
              ${Number(args.p_amount)},
              ${Number(args.p_amount_refunded)},
              ${Boolean(args.p_refunded)}
            ) AS result
          `);
          return { data: [result], error: null };
        }

        return {
          data: null,
          error: new Error(`Unexpected Supabase RPC in hosted proof: ${functionName}`),
        };
      } catch (error) {
        return { data: null, error };
      }
    }),
    from: vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
        update: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: (resolveResult: (value: unknown) => unknown) => (
          Promise.resolve({ data: [], error: null }).then(resolveResult)
        ),
      };
      return chain;
    }),
  };
  return client;
};

const signedWebhookRequest = (
  stripe: Stripe,
  event: Stripe.Event,
  webhookSecret: string,
) => {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return new Request('https://example.test/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload,
  });
};

const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000);
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
      && Number(file.slice(0, 3)) <= 12
    ))
    .sort();

  expect(migrationFiles.map((file) => Number(file.slice(0, 3)))).toEqual(
    expectedMigrationNumbers(12),
  );

  for (const migrationFile of migrationFiles) {
    await executeSql(readFileSync(resolve(migrationDirectory, migrationFile), 'utf8'));
  }
};

const seedFixtures = async () => {
  await executeSql(`
    INSERT INTO auth.users (id, email)
    VALUES
      ('${OWNER_ASYNC}'::uuid, 'async-owner@example.test'),
      ('${OWNER_REFUND}'::uuid, 'refund-owner@example.test'),
      ('${OWNER_DISPUTE}'::uuid, 'dispute-owner@example.test');

    INSERT INTO public.contests (id, owner_id, title, season_year)
    VALUES
      ('${CONTEST_ASYNC_A}'::uuid, '${OWNER_ASYNC}'::uuid, 'Async A', 2026),
      ('${CONTEST_ASYNC_B}'::uuid, '${OWNER_ASYNC}'::uuid, 'Async B', 2026),
      ('${CONTEST_REFUND_A}'::uuid, '${OWNER_REFUND}'::uuid, 'Refund A', 2026),
      ('${CONTEST_REFUND_B}'::uuid, '${OWNER_REFUND}'::uuid, 'Refund B', 2026),
      ('${CONTEST_REFUND_C}'::uuid, '${OWNER_REFUND}'::uuid, 'Refund C', 2026),
      ('${CONTEST_DISPUTE_A}'::uuid, '${OWNER_DISPUTE}'::uuid, 'Dispute A', 2026),
      ('${CONTEST_DISPUTE_B}'::uuid, '${OWNER_DISPUTE}'::uuid, 'Dispute B', 2026);
  `);
};

const claimOrder = async (ownerId: string, contestId: string) =>
  queryJson<{
    order_id: string;
    order_status: string;
    stripe_checkout_session_id: string | null;
    entitlement_status: string | null;
    already_entitled: boolean;
  }>(`
    SET ROLE service_role;
    SELECT row_to_json(result)::text
    FROM public.gridone_claim_checkout_order(
      '${ownerId}'::uuid,
      '${contestId}'::uuid,
      2026::smallint,
      'price_2026',
      499,
      'usd'
    ) AS result
  `);

const attachSession = async (orderId: string, sessionId: string) => {
  await executeSql(`
    SET ROLE service_role;
    SELECT *
    FROM public.gridone_attach_checkout_session(
      '${orderId}'::uuid,
      '${sessionId}',
      now() + interval '30 minutes'
    );
  `);
};

const fulfillOrder = async (
  eventId: string,
  orderId: string,
  sessionId: string,
  paymentIntentId: string,
) => queryJson<{
  outcome: string;
  contest_id: string;
  owner_id: string;
  entitlement_id: string;
  activated: boolean;
  used: number;
  allowance: number;
  refundable: boolean;
}>(`
  SET ROLE service_role;
  SELECT row_to_json(result)::text
  FROM public.gridone_fulfill_checkout_v2(
    '${eventId}',
    'checkout.session.completed',
    '${orderId}'::uuid,
    '${sessionId}',
    '${paymentIntentId}',
    'cus_test',
    'price_2026',
    499,
    'usd'
  ) AS result
`);

const applyPaymentEvent = async ({
  eventId,
  eventType,
  paymentIntentId,
  chargeId,
  disputeId = null,
  disputeStatus = null,
  amountCents = 499,
  amountRefundedCents = 0,
}: {
  eventId: string;
  eventType: string;
  paymentIntentId: string;
  chargeId: string;
  disputeId?: string | null;
  disputeStatus?: string | null;
  amountCents?: number;
  amountRefundedCents?: number;
}) => queryJson<{
  outcome: string;
  entitlement_status: string | null;
  order_id: string;
}>(`
  SET ROLE service_role;
  SELECT row_to_json(result)::text
  FROM public.gridone_apply_entitlement_payment_event(
    '${eventId}',
    '${eventType}',
    '${paymentIntentId}',
    '${chargeId}',
    ${disputeId ? `'${disputeId}'` : 'NULL'},
    ${disputeStatus ? `'${disputeStatus}'` : 'NULL'},
    NULL,
    ${amountCents},
    ${amountRefundedCents},
    ${amountRefundedCents >= amountCents}
  ) AS result
`);

describe.sequential('checkout lifecycle migration on disposable PostgreSQL 17', () => {
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

  afterAll(async () => {
    if (containerStarted) {
      await docker(['rm', '--force', containerName], undefined, 30_000);
      containerStarted = false;
    }
  }, 60_000);

  it('claims one owner-season order and makes async failure and expiry terminal', async () => {
    const claims = await Promise.all(
      Array.from({ length: 5 }, () => claimOrder(OWNER_ASYNC, CONTEST_ASYNC_A)),
    );
    expect(new Set(claims.map((claim) => claim.order_id))).toHaveLength(1);
    const firstOrderId = claims[0].order_id;
    await attachSession(firstOrderId, 'cs_async_1');

    const awaiting = await queryJson<{ outcome: string; order_status: string }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_record_checkout_session_event(
        'evt_async_unpaid',
        'checkout.session.completed',
        '${firstOrderId}'::uuid,
        'cs_async_1',
        'awaiting_payment',
        'Checkout completed while payment is still processing.'
      ) AS result
    `);
    expect(awaiting).toEqual({
      outcome: 'awaiting_payment',
      order_status: 'awaiting_payment',
    });

    const replay = await queryJson<{ outcome: string; order_status: string }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_record_checkout_session_event(
        'evt_async_unpaid',
        'checkout.session.completed',
        '${firstOrderId}'::uuid,
        'cs_async_1',
        'awaiting_payment',
        'Checkout completed while payment is still processing.'
      ) AS result
    `);
    expect(replay).toEqual(awaiting);

    const failed = await queryJson<{ outcome: string; order_status: string }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_record_checkout_session_event(
        'evt_async_failed',
        'checkout.session.async_payment_failed',
        '${firstOrderId}'::uuid,
        'cs_async_1',
        'failed',
        'Stripe reported that the delayed payment failed.'
      ) AS result
    `);
    expect(failed).toEqual({
      outcome: 'payment_failed',
      order_status: 'failed',
    });

    const replacement = await claimOrder(OWNER_ASYNC, CONTEST_ASYNC_B);
    expect(replacement.order_id).not.toBe(firstOrderId);
    await attachSession(replacement.order_id, 'cs_async_2');

    const expired = await queryJson<{ outcome: string; order_status: string }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_record_checkout_session_event(
        'evt_async_expired',
        'checkout.session.expired',
        '${replacement.order_id}'::uuid,
        'cs_async_2',
        'expired',
        'Stripe Checkout expired before payment completed.'
      ) AS result
    `);
    expect(expired).toEqual({
      outcome: 'checkout_expired',
      order_status: 'expired',
    });
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.stripe_events
      WHERE event_id = 'evt_async_unpaid'
    `)).toBe('1');
  }, 60_000);

  it('records duplicate payment as refundable and revokes only on a full refund', async () => {
    const firstOrder = await claimOrder(OWNER_REFUND, CONTEST_REFUND_A);
    await attachSession(firstOrder.order_id, 'cs_refund_1');
    const fulfilled = await fulfillOrder(
      'evt_refund_fulfill',
      firstOrder.order_id,
      'cs_refund_1',
      'pi_refund_1',
    );
    expect(fulfilled).toMatchObject({
      outcome: 'fulfilled',
      activated: true,
      used: 1,
      allowance: 20,
      refundable: false,
    });

    await executeSql(`
      INSERT INTO public.checkout_orders (
        owner_id,
        contest_id,
        season_year,
        price_id,
        price_cents,
        currency
      )
      VALUES (
        '${OWNER_REFUND}'::uuid,
        '${CONTEST_REFUND_B}'::uuid,
        2026,
        'price_2026',
        499,
        'usd'
      );
    `);
    const duplicateOrderId = await queryScalar(`
      SELECT id::text
      FROM public.checkout_orders
      WHERE contest_id = '${CONTEST_REFUND_B}'::uuid
    `);
    await attachSession(duplicateOrderId, 'cs_refund_duplicate');
    const duplicate = await fulfillOrder(
      'evt_refund_duplicate',
      duplicateOrderId,
      'cs_refund_duplicate',
      'pi_refund_duplicate',
    );
    expect(duplicate).toMatchObject({
      outcome: 'duplicate_payment',
      activated: false,
      refundable: true,
    });
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.season_entitlements
      WHERE owner_id = '${OWNER_REFUND}'::uuid
        AND season_year = 2026
    `)).toBe('1');
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.board_activations activation
      JOIN public.contests contest ON contest.id = activation.contest_id
      WHERE contest.owner_id = '${OWNER_REFUND}'::uuid
    `)).toBe('1');

    const duplicateReplay = await fulfillOrder(
      'evt_refund_duplicate',
      duplicateOrderId,
      'cs_refund_duplicate',
      'pi_refund_duplicate',
    );
    expect(duplicateReplay.outcome).toBe('duplicate_payment');

    await executeSql(`
      UPDATE public.contests
      SET
        status = 'published',
        side_axis = ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
        top_axis = ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
        axis_locked_at = now(),
        axis_locked_by = '${OWNER_REFUND}'::uuid,
        published_at = now()
      WHERE id = '${CONTEST_REFUND_A}'::uuid;

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
        id,
        share_code,
        revision,
        title,
        '{}'::jsonb,
        '{}'::jsonb,
        published_at
      FROM public.contests
      WHERE id = '${CONTEST_REFUND_A}'::uuid;
    `);

    const partial = await applyPaymentEvent({
      eventId: 'evt_refund_partial',
      eventType: 'charge.refunded',
      paymentIntentId: 'pi_refund_1',
      chargeId: 'ch_refund_1',
      amountRefundedCents: 200,
    });
    expect(partial).toMatchObject({
      outcome: 'partial_refund_recorded',
      entitlement_status: 'active',
    });

    const full = await applyPaymentEvent({
      eventId: 'evt_refund_full',
      eventType: 'charge.refunded',
      paymentIntentId: 'pi_refund_1',
      chargeId: 'ch_refund_1',
      amountRefundedCents: 499,
    });
    expect(full).toMatchObject({
      outcome: 'entitlement_revoked',
      entitlement_status: 'revoked',
    });

    const existingActivation = await queryJson<{
      activated: boolean;
      used: number;
      allowance: number;
    }>(`
      SET ROLE service_role;
      SELECT row_to_json(result)::text
      FROM public.gridone_activate_board(
        '${CONTEST_REFUND_A}'::uuid,
        '${OWNER_REFUND}'::uuid,
        2026::smallint
      ) AS result
    `);
    expect(existingActivation).toEqual({
      activated: true,
      used: 1,
      allowance: 20,
    });

    await expect(queryScalar(`
      SET ROLE service_role;
      SELECT *
      FROM public.gridone_activate_board(
        '${CONTEST_REFUND_C}'::uuid,
        '${OWNER_REFUND}'::uuid,
        2026::smallint
      )
    `)).rejects.toThrow('SEASON_PASS_INACTIVE');

    expect(await queryJson<{
      snapshotCount: number;
      activationCount: number;
      withdrawnCount: number;
    }>(`
      SELECT json_build_object(
        'snapshotCount', count(snapshot.contest_id),
        'activationCount', count(activation.id),
        'withdrawnCount', count(snapshot.contest_id) FILTER (
          WHERE snapshot.withdrawn_at IS NOT NULL
        )
      )::text
      FROM public.public_board_snapshots snapshot
      LEFT JOIN public.board_activations activation
        ON activation.contest_id = snapshot.contest_id
      WHERE snapshot.contest_id = '${CONTEST_REFUND_A}'::uuid
    `)).toEqual({
      snapshotCount: 1,
      activationCount: 1,
      withdrawnCount: 0,
    });
  }, 60_000);

  it('restores a won dispute without letting an old source overwrite a repurchase', async () => {
    const firstOrder = await claimOrder(OWNER_DISPUTE, CONTEST_DISPUTE_A);
    await attachSession(firstOrder.order_id, 'cs_dispute_1');
    await fulfillOrder(
      'evt_dispute_fulfill_1',
      firstOrder.order_id,
      'cs_dispute_1',
      'pi_dispute_1',
    );

    const opened = await applyPaymentEvent({
      eventId: 'evt_dispute_open_1',
      eventType: 'charge.dispute.created',
      paymentIntentId: 'pi_dispute_1',
      chargeId: 'ch_dispute_1',
      disputeId: 'dp_1',
      disputeStatus: 'needs_response',
    });
    expect(opened).toMatchObject({
      outcome: 'entitlement_revoked',
      entitlement_status: 'revoked',
    });

    const replacementOrder = await claimOrder(OWNER_DISPUTE, CONTEST_DISPUTE_B);
    await attachSession(replacementOrder.order_id, 'cs_dispute_2');
    const replacementFulfilled = await fulfillOrder(
      'evt_dispute_fulfill_2',
      replacementOrder.order_id,
      'cs_dispute_2',
      'pi_dispute_2',
    );
    expect(replacementFulfilled.outcome).toBe('fulfilled');

    const oldDisputeWon = await applyPaymentEvent({
      eventId: 'evt_dispute_won_1',
      eventType: 'charge.dispute.closed',
      paymentIntentId: 'pi_dispute_1',
      chargeId: 'ch_dispute_1',
      disputeId: 'dp_1',
      disputeStatus: 'won',
    });
    expect(oldDisputeWon).toMatchObject({
      outcome: 'dispute_won_recorded',
      entitlement_status: 'active',
    });
    expect(await applyPaymentEvent({
      eventId: 'evt_dispute_won_1',
      eventType: 'charge.dispute.closed',
      paymentIntentId: 'pi_dispute_1',
      chargeId: 'ch_dispute_1',
      disputeId: 'dp_1',
      disputeStatus: 'won',
    })).toEqual(oldDisputeWon);
    expect(await queryScalar(`
      SELECT source_checkout_order_id::text
      FROM public.season_entitlements
      WHERE owner_id = '${OWNER_DISPUTE}'::uuid
        AND season_year = 2026
    `)).toBe(replacementOrder.order_id);

    const replacementDisputed = await applyPaymentEvent({
      eventId: 'evt_dispute_open_2',
      eventType: 'charge.dispute.created',
      paymentIntentId: 'pi_dispute_2',
      chargeId: 'ch_dispute_2',
      disputeId: 'dp_2',
      disputeStatus: 'under_review',
    });
    expect(replacementDisputed.entitlement_status).toBe('revoked');

    const replacementWon = await applyPaymentEvent({
      eventId: 'evt_dispute_won_2',
      eventType: 'charge.dispute.closed',
      paymentIntentId: 'pi_dispute_2',
      chargeId: 'ch_dispute_2',
      disputeId: 'dp_2',
      disputeStatus: 'won',
    });
    expect(replacementWon).toMatchObject({
      outcome: 'entitlement_restored',
      entitlement_status: 'active',
    });

    await applyPaymentEvent({
      eventId: 'evt_dispute_open_3',
      eventType: 'charge.dispute.created',
      paymentIntentId: 'pi_dispute_2',
      chargeId: 'ch_dispute_2',
      disputeId: 'dp_3',
      disputeStatus: 'needs_response',
    });
    const replacementLost = await applyPaymentEvent({
      eventId: 'evt_dispute_lost_3',
      eventType: 'charge.dispute.closed',
      paymentIntentId: 'pi_dispute_2',
      chargeId: 'ch_dispute_2',
      disputeId: 'dp_3',
      disputeStatus: 'lost',
    });
    expect(replacementLost).toMatchObject({
      outcome: 'dispute_lost_recorded',
      entitlement_status: 'revoked',
    });

    const replay = await applyPaymentEvent({
      eventId: 'evt_dispute_lost_3',
      eventType: 'charge.dispute.closed',
      paymentIntentId: 'pi_dispute_2',
      chargeId: 'ch_dispute_2',
      disputeId: 'dp_3',
      disputeStatus: 'lost',
    });
    expect(replay).toEqual(replacementLost);
    expect(await queryScalar(`
      SELECT count(*)::text
      FROM public.entitlement_audit_events
      WHERE stripe_event_id = 'evt_dispute_lost_3'
    `)).toBe('1');
  }, 60_000);

  (hostedProofEnabled ? it : it.skip)(
    'processes a real Stripe Sandbox checkout event and refund through the production webhook handler',
    async () => {
      const {
        secretKey,
        webhookSecret,
        sessionId,
        checkoutEventId,
        orderId,
        priceId,
      } = hostedProofEnvironment as Record<string, string>;
      const stripe = new Stripe(secretKey, {
        apiVersion: '2026-02-25.clover',
        httpClient: Stripe.createFetchHttpClient(),
      });
      const checkoutEvent = await stripe.events.retrieve(checkoutEventId);
      expect(checkoutEvent.livemode).toBe(false);
      expect(checkoutEvent.type).toBe('checkout.session.completed');

      const checkoutSession = checkoutEvent.data.object as Stripe.Checkout.Session;
      expect(checkoutSession).toMatchObject({
        id: sessionId,
        client_reference_id: orderId,
        payment_status: 'paid',
        status: 'complete',
      });
      expect(checkoutSession.metadata?.order_id).toBe(orderId);
      expect(checkoutSession.metadata?.owner_id).toBe(OWNER_ASYNC);
      expect(checkoutSession.metadata?.contest_id).toBe(CONTEST_ASYNC_A);
      const paymentIntentId = String(checkoutSession.payment_intent);
      expect(paymentIntentId).toMatch(/^pi_/);

      await executeSql(`
        INSERT INTO public.checkout_orders (
          id,
          owner_id,
          contest_id,
          season_year,
          price_id,
          price_cents,
          currency,
          status,
          stripe_checkout_session_id,
          stripe_expires_at
        )
        VALUES (
          ${sqlText(orderId)}::uuid,
          '${OWNER_ASYNC}'::uuid,
          '${CONTEST_ASYNC_A}'::uuid,
          2026,
          ${sqlText(priceId)},
          499,
          'usd',
          'checkout_created',
          ${sqlText(sessionId)},
          now() + interval '30 minutes'
        );
      `);

      supabaseMocks.createClient.mockReturnValue(postgresAdminClient());
      const completionResponse = await stripeWebhook({
        request: signedWebhookRequest(stripe, checkoutEvent, webhookSecret),
        env: {
          VITE_SUPABASE_URL: 'https://disposable-postgres.example.test',
          SUPABASE_SERVICE_ROLE_KEY: 'disposable-service-role',
          STRIPE_SECRET_KEY: secretKey,
          STRIPE_WEBHOOK_SECRET: webhookSecret,
          STRIPE_2026_PRICE_ID: priceId,
        },
      });
      expect(completionResponse.status).toBe(200);
      expect(await completionResponse.text()).toBe('Fulfilled.');

      expect(await queryJson<{
        orderStatus: string;
        entitlementStatus: string;
        activationCount: number;
        stripeEventCount: number;
      }>(`
        SELECT json_build_object(
          'orderStatus', checkout_order.status,
          'entitlementStatus', entitlement.status,
          'activationCount', (
            SELECT count(*)::integer
            FROM public.board_activations activation
            WHERE activation.contest_id = '${CONTEST_ASYNC_A}'::uuid
          ),
          'stripeEventCount', (
            SELECT count(*)::integer
            FROM public.stripe_events stripe_event
            WHERE stripe_event.event_id = ${sqlText(checkoutEventId)}
          )
        )::text
        FROM public.checkout_orders checkout_order
        JOIN public.season_entitlements entitlement
          ON entitlement.source_checkout_order_id = checkout_order.id
        WHERE checkout_order.id = ${sqlText(orderId)}::uuid
      `)).toEqual({
        orderStatus: 'paid',
        entitlementStatus: 'active',
        activationCount: 1,
        stripeEventCount: 1,
      });

      await executeSql(`
        UPDATE public.contests
        SET
          status = 'published',
          side_axis = ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],
          top_axis = ARRAY[9,8,7,6,5,4,3,2,1,0]::smallint[],
          axis_locked_at = now(),
          axis_locked_by = '${OWNER_ASYNC}'::uuid,
          published_at = now()
        WHERE id = '${CONTEST_ASYNC_A}'::uuid;

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
          id,
          share_code,
          revision,
          title,
          '{}'::jsonb,
          '{}'::jsonb,
          published_at
        FROM public.contests
        WHERE id = '${CONTEST_ASYNC_A}'::uuid;
      `);

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: 499,
        reason: 'requested_by_customer',
        metadata: {
          gridone_phase: 'phase_1_hosted_proof',
          checkout_order_id: orderId,
        },
      }, {
        idempotencyKey: `gridone-phase1-refund-${orderId}`,
      });
      expect(refund.status).toBe('succeeded');
      expect(refund.amount).toBe(499);

      let refundEvent: Stripe.Event | undefined;
      const refundEventDeadline = Date.now() + 30_000;
      while (!refundEvent && Date.now() < refundEventDeadline) {
        const events = await stripe.events.list({
          type: 'charge.refunded',
          limit: 20,
        });
        refundEvent = events.data.find((event) => {
          const charge = event.data.object as Stripe.Charge;
          return (
            String(charge.payment_intent) === paymentIntentId
            && charge.amount_refunded === 499
            && charge.refunded
          );
        });
        if (!refundEvent) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 250));
        }
      }
      expect(refundEvent).toBeDefined();
      expect(refundEvent?.livemode).toBe(false);

      supabaseMocks.createClient.mockReturnValue(postgresAdminClient());
      const refundResponse = await stripeWebhook({
        request: signedWebhookRequest(stripe, refundEvent!, webhookSecret),
        env: {
          VITE_SUPABASE_URL: 'https://disposable-postgres.example.test',
          SUPABASE_SERVICE_ROLE_KEY: 'disposable-service-role',
          STRIPE_SECRET_KEY: secretKey,
          STRIPE_WEBHOOK_SECRET: webhookSecret,
          STRIPE_2026_PRICE_ID: priceId,
        },
      });
      expect(refundResponse.status).toBe(200);
      expect(await refundResponse.text()).toBe('Entitlement payment event recorded.');

      expect(await queryJson<{
        orderStatus: string;
        entitlementStatus: string;
        amountRefundedCents: number;
        snapshotCount: number;
        activationCount: number;
        withdrawnCount: number;
      }>(`
        SELECT json_build_object(
          'orderStatus', checkout_order.status,
          'entitlementStatus', entitlement.status,
          'amountRefundedCents', checkout_order.amount_refunded_cents,
          'snapshotCount', (
            SELECT count(*)::integer
            FROM public.public_board_snapshots snapshot
            WHERE snapshot.contest_id = '${CONTEST_ASYNC_A}'::uuid
          ),
          'activationCount', (
            SELECT count(*)::integer
            FROM public.board_activations activation
            WHERE activation.contest_id = '${CONTEST_ASYNC_A}'::uuid
          ),
          'withdrawnCount', (
            SELECT count(*)::integer
            FROM public.public_board_snapshots snapshot
            WHERE snapshot.contest_id = '${CONTEST_ASYNC_A}'::uuid
              AND snapshot.withdrawn_at IS NOT NULL
          )
        )::text
        FROM public.checkout_orders checkout_order
        JOIN public.season_entitlements entitlement
          ON entitlement.source_checkout_order_id = checkout_order.id
        WHERE checkout_order.id = ${sqlText(orderId)}::uuid
      `)).toEqual({
        orderStatus: 'refunded',
        entitlementStatus: 'revoked',
        amountRefundedCents: 499,
        snapshotCount: 1,
        activationCount: 1,
        withdrawnCount: 0,
      });

      console.info('Stripe Sandbox hosted lifecycle proof', {
        checkoutSessionId: sessionId,
        checkoutEventId,
        paymentIntentId,
        refundId: refund.id,
        refundEventId: refundEvent!.id,
        livemode: false,
        amountCents: 499,
      });
    },
    120_000,
  );

  it('keeps lifecycle RPC execution restricted to service_role', async () => {
    await expect(queryScalar(`
      SET ROLE authenticated;
      SELECT *
      FROM public.gridone_claim_checkout_order(
        '${OWNER_ASYNC}'::uuid,
        '${CONTEST_ASYNC_A}'::uuid,
        2026::smallint,
        'price_2026',
        499,
        'usd'
      )
    `)).rejects.toThrow(/permission denied/i);
  });
});
