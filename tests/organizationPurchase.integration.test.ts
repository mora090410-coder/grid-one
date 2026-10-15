import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

// Real SQL only: no production connection or Stripe calls.
const container = `gridone-org-${process.pid}-${randomUUID().slice(0, 8)}`;
let started = false;
const run = (args: string[], input?: string): Promise<string> => new Promise((accept, reject) => {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = ''; let err = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('error', error => { clearTimeout(timer); reject(error); });
  child.on('close', code => { clearTimeout(timer); code === 0 ? accept(out.trim()) : reject(new Error(err || out)); });
  child.stdin.end(input);
});
const sql = (query: string) => run(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], query);
const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const json = async (query: string) => JSON.parse(await sql(query));
const fixture = async () => {
  const owner = randomUUID(); const board = randomUUID();
  await sql(`INSERT INTO auth.users VALUES ('${owner}', 'fixture@example.test');
    INSERT INTO public.contests(id,owner_id,share_code,title,season_year)
    VALUES ('${board}','${owner}',upper(substr(replace('${board}','-',''),1,8)),'Billing fixture',2026);`);
  return { owner, board };
};
const claim = (owner: string, board: string, tier = 'org', name = 'Ravens Club') => json(`SET ROLE service_role;
  SELECT row_to_json(r) FROM public.gridone_claim_checkout_order_v3('${owner}','${board}',2026::smallint,
    'price_${tier}',${tier === 'org' ? 7900 : 999},'usd','${tier}',${text(name)}) r;`);
const fulfill = (id: string, amount: number, tier = 'org', suffix = '') => json(`SET ROLE service_role;
  SELECT row_to_json(r) FROM public.gridone_fulfill_checkout_v2('evt_${id}${suffix}','checkout.session.completed',
    '${id}','cs_${id}','pi_${id}','cus_fixture','price_${tier}',${amount},'usd') r;`);
const paidGameDay = async () => {
  const f = await fixture();
  const source = await claim(f.owner, f.board, 'gameday');
  await fulfill(source.order_id, 999, 'gameday');
  return { ...f, source: source.order_id };
};
const reversal = (id: string, type = 'charge.refunded', status = '', amount = 999) => sql(`SET ROLE service_role;
  SELECT * FROM public.gridone_apply_entitlement_payment_event('evt_reverse_${id}_${status}_${amount}',${text(type)},
    'pi_${id}','ch_${id}',${type.includes('dispute') ? text(`dp_${id}`) : 'NULL'},${text(status)},'fixture',999,${amount},${amount === 999 && !type.includes('dispute')});`);

describe.sequential('approved Organization purchase canonical SQL', () => {
  beforeAll(async () => {
    await run(['run', '--rm', '--detach', '--name', container, '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17']);
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await sql('SELECT 1;'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 300)); }
    }
    if (!ready) throw new Error('Disposable Postgres did not become ready');
    await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
    const dir = resolve('supabase/migrations');
    const files = readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
    expect(files.map(f => Number(f.slice(0, 3)))).toEqual(expectedMigrationNumbers(Number(files.at(-1)!.slice(0, 3))));
    for (const file of files) await sql(readFileSync(resolve(dir, file), 'utf8'));
  }, 240_000);
  afterAll(async () => { if (started) await run(['rm', '--force', container]); }, 60_000);

  it('buys Organization directly with no entitlement and sets exactly 50 total', async () => {
    const f = await fixture(); const order = await claim(f.owner, f.board);
    expect(order).toMatchObject({ amount_cents: 7900, credit_cents: 0 });
    expect(await fulfill(order.order_id, 7900)).toMatchObject({ outcome: 'fulfilled', allowance: 50, used: 0 });
    expect(await sql(`SELECT organization_display_name FROM season_entitlements WHERE owner_id='${f.owner}'`)).toBe('Ravens Club');
  });
  it('reserves credit only from a verified paid same-owner/season Game Day order, before allowance exhaustion', async () => {
    const f = await paidGameDay(); const order = await claim(f.owner, f.board);
    expect(order).toMatchObject({ amount_cents: 6901, credit_cents: 999, credit_source_order_id: f.source });
    const retries = await Promise.all([claim(f.owner, f.board), claim(f.owner, f.board)]);
    expect(retries.map(r => r.order_id)).toEqual([order.order_id, order.order_id]);
    await expect(fulfill(order.order_id, 7900)).rejects.toThrow(/price/i);
    expect(await fulfill(order.order_id, 6901)).toMatchObject({ outcome: 'fulfilled', allowance: 50 });
    expect(await fulfill(order.order_id, 6901, 'org', '_retry')).toMatchObject({ outcome: 'already_fulfilled' });
    expect(await sql(`SELECT count(*) FROM checkout_orders WHERE credit_source_order_id='${f.source}'`)).toBe('1');
  });
  it('does not invent credit from an unverified tier/grant', async () => {
    const f = await fixture();
    await sql(`INSERT INTO season_entitlements(owner_id,season_year,status,tier,boards_allowance,price_cents,currency)
      VALUES('${f.owner}',2026,'active','gameday',5,999,'usd');`);
    expect(await claim(f.owner, f.board)).toMatchObject({ amount_cents: 7900, credit_cents: 0 });
  });
  it('does not reuse another account or season purchase', async () => {
    const paid = await paidGameDay(); const f = await fixture();
    expect(await claim(f.owner, f.board)).toMatchObject({ amount_cents: 7900, credit_cents: 0 });
    await sql(`UPDATE season_entitlements SET season_year=2025 WHERE owner_id='${paid.owner}';
      UPDATE checkout_orders SET season_year=2025 WHERE id='${paid.source}';`);
    expect(await claim(paid.owner, paid.board)).toMatchObject({ amount_cents: 7900, credit_cents: 0 });
  });
  it('blocks a source refund before payment, records the net payment for manual refund review without capacity', async () => {
    const f = await paidGameDay(); const order = await claim(f.owner, f.board);
    await reversal(f.source);
    expect(await fulfill(order.order_id, 6901)).toMatchObject({ outcome: 'duplicate_payment', refundable: true });
    expect(await sql(`SELECT status FROM season_entitlements WHERE owner_id='${f.owner}'`)).not.toBe('active');
  });
  it('revokes the dependent upgrade on even a partial source refund', async () => {
    const f = await paidGameDay(); const order = await claim(f.owner, f.board);
    await fulfill(order.order_id, 6901); await reversal(f.source, 'charge.refunded', '', 100);
    expect(await sql(`SELECT status FROM season_entitlements WHERE owner_id='${f.owner}'`)).toBe('revoked');
  });
  it('suspends on source dispute and restores only after a won dispute with both payments intact', async () => {
    const f = await paidGameDay(); const order = await claim(f.owner, f.board);
    await fulfill(order.order_id, 6901);
    await reversal(f.source, 'charge.dispute.created', 'needs_response', 0);
    expect(await sql(`SELECT status FROM season_entitlements WHERE owner_id='${f.owner}'`)).toBe('revoked');
    await reversal(f.source, 'charge.dispute.closed', 'won', 0);
    expect(await sql(`SELECT status FROM season_entitlements WHERE owner_id='${f.owner}'`)).toBe('active');
    await reversal(order.order_id);
    expect(await sql(`SELECT status FROM season_entitlements WHERE owner_id='${f.owner}'`)).not.toBe('active');
  });
  it('releases expired unpaid reservations but never consumes one credit twice', async () => {
    const f = await paidGameDay(); const first = await claim(f.owner, f.board);
    await sql(`UPDATE checkout_orders SET status='expired' WHERE id='${first.order_id}';`);
    const second = await claim(f.owner, f.board);
    expect(second.order_id).not.toBe(first.order_id);
    expect(second).toMatchObject({ amount_cents: 6901, credit_source_order_id: f.source });
    await fulfill(second.order_id, 6901);
    expect(await fulfill(first.order_id, 6901)).toMatchObject({ outcome: 'duplicate_payment', refundable: true });
    expect(await sql(`SELECT boards_allowance FROM season_entitlements WHERE owner_id='${f.owner}'`)).toBe('50');
  });
  it('rejects client amounts/currencies and denies public execution', async () => {
    const f = await fixture();
    await expect(sql(`SET ROLE service_role; SELECT * FROM gridone_claim_checkout_order_v3('${f.owner}','${f.board}',2026::smallint,'price_org',6901,'usd','org','Club');`)).rejects.toThrow(/price/i);
    await expect(sql(`SET ROLE authenticated; SELECT * FROM gridone_claim_checkout_order_v3('${f.owner}','${f.board}',2026::smallint,'price_org',7900,'usd','org','Club');`)).rejects.toThrow(/permission denied/i);
  });
});
