import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectedMigrationNumbers } from './fixtures/migrationSequence';

const DATABASE_NAME = 'gridone_client_events_test';
const DATABASE_USER = 'postgres';
const DATABASE_PASSWORD = 'gridone-client-events-test-password';
const POSTGRES_IMAGE = 'postgres:17';
const containerName = `gridone-client-events-${process.pid}-${randomUUID().slice(0, 8)}`;
let containerStarted = false;

type CommandResult = { stdout: string; stderr: string };
const runCommand = (command: string, args: string[], input?: string, timeoutMs = 120_000) =>
  new Promise<CommandResult>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); rejectCommand(new Error(`${command} timed out`)); }, timeoutMs);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timeout); rejectCommand(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolveCommand({ stdout, stderr });
      else rejectCommand(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr || stdout}`));
    });
    child.stdin.end(input);
  });
const docker = (args: string[], input?: string, timeoutMs?: number) => runCommand('docker', args, input, timeoutMs);
const psqlArgs = (extra: string[]) => ['exec', '-e', `PGPASSWORD=${DATABASE_PASSWORD}`, '-i', containerName,
  'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', DATABASE_USER, '-d', DATABASE_NAME, ...extra];
const executeSql = async (sql: string) => { await docker(psqlArgs(['-q']), sql); };
const queryScalar = async (sql: string) => (await docker(psqlArgs(['-qAt', '-c', sql]))).stdout.trim();
const waitForPostgres = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { await docker(psqlArgs(['-qAt', '-c', 'SELECT 1']), undefined, 5_000); return; }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 250)); }
  }
  throw new Error('Disposable PostgreSQL did not become ready.');
};
const bootstrap = () => executeSql(`
  DO $roles$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $roles$;
  ALTER ROLE service_role BYPASSRLS;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email text);
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
    SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
    SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $f$;
  GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
  GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION auth.role() TO anon,authenticated,service_role;
`);
const migrationFiles = () => readdirSync(resolve(process.cwd(), 'supabase/migrations'))
  .filter(file => /^\d{3}_.+\.sql$/.test(file))
  .sort();
const applyMigration = (file: string) => executeSql(readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8'));

const insertAs = (role: string, payload = `'{"surface":"viewer"}'::jsonb`) =>
  queryScalar(`SET ROLE ${role}; INSERT INTO public.client_events(name,payload) VALUES('find_my_squares_opened',${payload}) RETURNING id;`);

describe.sequential('client events sink (migrations 033-034)', () => {
  beforeAll(async () => {
    await docker(['run', '--rm', '--detach', '--name', containerName, '--env', `POSTGRES_PASSWORD=${DATABASE_PASSWORD}`,
      '--env', `POSTGRES_DB=${DATABASE_NAME}`, POSTGRES_IMAGE]);
    containerStarted = true;
    await waitForPostgres();
    await bootstrap();
    const files = migrationFiles();
    expect(files.map(file => Number(file.slice(0, 3)))).toEqual(expectedMigrationNumbers(34));
    for (const file of files.filter(name => name < '033')) await applyMigration(file);
    // Mirror Supabase: every new public table is granted to all API roles by default.
    await executeSql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;');
    await applyMigration('033_client_events.sql');
    await applyMigration('034_client_events_retention.sql');
  }, 300_000);
  afterAll(async () => { if (containerStarted) await docker(['rm', '--force', containerName]).catch(() => undefined); }, 60_000);

  it('has no personal columns and keeps row-level security on', async () => {
    expect(await queryScalar(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='client_events'`))
      .toBe('id,name,payload,received_at');
    expect(await queryScalar(`SELECT relrowsecurity FROM pg_class WHERE oid='public.client_events'::regclass`)).toBe('t');
  });

  it('lets only the service role append and read', async () => {
    const id = await insertAs('service_role');
    expect(Number(id)).toBeGreaterThan(0);
    expect(await queryScalar(`SET ROLE service_role; SELECT payload->>'surface' FROM public.client_events WHERE id=${id};`)).toBe('viewer');
    await expect(queryScalar(`SET ROLE service_role; UPDATE public.client_events SET name='x' WHERE id=${id};`)).rejects.toThrow(/permission denied/);
    await expect(queryScalar(`SET ROLE service_role; DELETE FROM public.client_events WHERE id=${id};`)).rejects.toThrow(/permission denied/);

    for (const role of ['anon', 'authenticated']) {
      await expect(insertAs(role)).rejects.toThrow(/permission denied/);
      await expect(queryScalar(`SET ROLE ${role}; SELECT count(*) FROM public.client_events;`)).rejects.toThrow(/permission denied/);
    }
  });

  it('refuses non-object and oversized payloads', async () => {
    await expect(insertAs('service_role', `'[]'::jsonb`)).rejects.toThrow(/check constraint/);
    await expect(insertAs('service_role', `'"text"'::jsonb`)).rejects.toThrow(/check constraint/);
    await expect(insertAs('service_role', `jsonb_build_object('pad', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 200) i))`)).rejects.toThrow(/check constraint/);
  });

  it('keeps 13 months of events and only the service role can prune', async () => {
    await executeSql(`INSERT INTO public.client_events(name,payload,received_at) VALUES
      ('find_my_squares_opened','{"surface":"viewer"}', now() - interval '14 months'),
      ('find_my_squares_opened','{"surface":"viewer"}', now() - interval '12 months');`);
    const before = Number(await queryScalar('SELECT count(*) FROM public.client_events'));
    for (const role of ['anon', 'authenticated']) {
      await expect(queryScalar(`SET ROLE ${role}; SELECT public.gridone_prune_client_events();`)).rejects.toThrow(/permission denied/);
    }
    expect(await queryScalar('SET ROLE service_role; SELECT public.gridone_prune_client_events();')).toBe('1');
    expect(Number(await queryScalar('SELECT count(*) FROM public.client_events'))).toBe(before - 1);
    expect(await queryScalar(`SELECT count(*) FROM public.client_events WHERE received_at < now() - interval '13 months'`)).toBe('0');
  });
});
