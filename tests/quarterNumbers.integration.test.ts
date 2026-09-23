import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const container = `gridone-quarters-${process.pid}-${randomUUID().slice(0,8)}`;
const owner = '40000000-0000-4000-8000-000000000001';
const id = '40000000-0000-4000-8000-000000000002';
const digits = [0,1,2,3,4,5,6,7,8,9];
const sets = {Q1:digits,Q2:[...digits.slice(1),0],Q3:[...digits.slice(2),0,1],Q4:[...digits].reverse()};
const board = {isDynamic:true,leftAxis:Array(10).fill(null),topAxis:Array(10).fill(null),leftAxisByQuarter:sets,topAxisByQuarter:sets,squares:Array.from({length:100},(_,i) => i === 88 ? [] : [`Buyer ${i}`]),allowOpenSquares:true,scanReview:{literalAxes:'PRIVATE',topTeamText:'TOP',leftTeamText:'SIDE',orientation:{operation:'unchanged',topAbbr:'TOP',leftAbbr:'SIDE'}}};
const publicBoard = {...board,leftAxis:sets.Q1,topAxis:sets.Q1};
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const docker = (...args: string[]) => execFileSync('docker',args,{encoding:'utf8',timeout:60000});
const sql = (input: string) => execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','gridone_quarters'],{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']}).trim();
const revision = () => sql(`SELECT revision FROM contests WHERE id='${id}'`);
const publish = (projection = publicBoard) => sql(`SET ROLE service_role; SELECT published FROM gridone_publish_board('${id}','${owner}',${revision()},ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],ARRAY[0,1,2,3,4,5,6,7,8,9]::smallint[],${quote(board.squares)},${quote(projection)},'{}'::jsonb,true);`);
let started = false;

beforeAll(async () => {
  docker('image','inspect','postgres:17'); // Never pull or install an image.
  docker('run','--pull=never','--rm','--detach','--name',container,'-e','POSTGRES_PASSWORD=quarter-local-test','-e','POSTGRES_DB=gridone_quarters','postgres:17');
  started = true;
  let ready = false;
  for (let i=0;i<80;i++) {
    try { sql('SELECT 1'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve,100)); }
  }
  if (!ready) throw new Error('Disposable PostgreSQL failed readiness');
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO anon,authenticated,service_role;`);
  const dir = resolve('supabase/migrations');
  for (const file of readdirSync(dir).filter(file => /^\d{3}_.+\.sql$/.test(file)).sort()) sql(readFileSync(resolve(dir,file),'utf8'));
  sql(`INSERT INTO auth.users VALUES ('${owner}','owner@example.test');
    INSERT INTO contests(id,owner_id,share_code,title,game_external_id,game_starts_at,top_team_abbr,side_team_abbr,board_data)
    VALUES ('${id}','${owner}','QQQQQ234','Local quarter verification','401772999','2027-02-01T00:00:00Z','TOP','SIDE',${quote(board)});`);
},120000);
afterAll(() => { if (started) docker('rm','--force',container); });

describe.sequential('quarter-specific numbers: real disposable database', () => {
  it('retains duplicate draft axes, denies malformed mode and blocks finalization atomically', () => {
    const invalid = {...board,topAxisByQuarter:{...sets,Q1:[9,2,6,0,7,4,5,8,0,9]}};
    sql(`UPDATE contests SET board_data=${quote(invalid)} WHERE id='${id}'`);
    expect(JSON.parse(sql(`SELECT board_data FROM contests WHERE id='${id}'`))).toEqual(invalid);
    expect(() => publish()).toThrow(/unique digits/);
    expect(sql('SELECT count(*) FROM board_activations')).toBe('0');
    expect(() => sql(`UPDATE contests SET board_data=jsonb_set(board_data,'{isDynamic}','"true"') WHERE id='${id}'`)).toThrow(/Invalid number mode/);
    sql(`UPDATE contests SET board_data=${quote(board)} WHERE id='${id}'`);
  });
  it('shares before numbers lock, preserving the four sets without creating a finalized snapshot', () => {
    expect(sql(`SET ROLE service_role; SELECT shared FROM gridone_share_board('${id}','${owner}',${revision()})`)).toBe('t');
    expect(sql('SELECT count(*) FROM public_board_snapshots')).toBe('0');
    expect(JSON.parse(sql(`SELECT board_data->'topAxisByQuarter' FROM contests WHERE id='${id}'`))).toEqual(sets);
    expect(sql(`SELECT (axis_locked_at IS NULL)::text FROM contests WHERE id='${id}'`)).toBe('true');
  });
  it('rejects flattened public payloads, then locks all sets on the same allowance and strips private scan evidence', () => {
    expect(() => publish({...publicBoard,isDynamic:false})).toThrow(/locked board/);
    expect(sql(`SELECT (published_at IS NULL)::text FROM contests WHERE id='${id}'`)).toBe('true');
    expect(publish()).toBe('t');
    expect(sql('SELECT count(*) FROM board_activations')).toBe('1');
    const projected = JSON.parse(sql('SELECT board FROM public_board_snapshots'));
    expect(projected.topAxisByQuarter).toEqual(sets);
    expect(projected.squares).toEqual(board.squares);
    expect(projected).not.toHaveProperty('scanReview');
    for(const side of ['topAxisByQuarter','leftAxisByQuarter']) for(const key of ['Q1','Q2','Q3','Q4'] as const) {
      const axis=sets[key]; const changed=[...axis.slice(1),axis[0]];
      expect(() => sql(`SET ROLE service_role; UPDATE contests SET board_data=jsonb_set(board_data,'{${side},${key}}',${quote(changed)}) WHERE id='${id}'`)).toThrow(/locked/);
    }
    expect(() => sql(`SET ROLE authenticated; SELECT gridone_axis_for_milestone('{}',ARRAY[0]::smallint[],'top','Q1')`)).toThrow(/permission denied/);
  });
  it('settles manual Q1/Q2/Q3/Final against matching sets, uses OT in Final, and queues no OPEN email', () => {
    sql(`INSERT INTO notification_subscriptions(contest_id,participant_id,email,status,unsubscribe_token_hash,verified_at)
      SELECT '${id}',id,id::text || '@example.test','verified',id::text,now() FROM contest_participants WHERE contest_id='${id}';`);
    const regulation = {Q1:{left:0,top:0},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:0,top:0}};
    sql(`SET ROLE service_role; SELECT id FROM gridone_commit_manual_score('${id}','${owner}','in',2::smallint,0::smallint,0::smallint,${quote(regulation)},'15:00',now());`);
    const first = sql(`SELECT row_to_json(r) FROM milestone_resolutions r WHERE milestone='Q1'`);
    for (const period of [3,4,5]) {
      sql(`SET ROLE service_role; SELECT id FROM gridone_commit_manual_score('${id}','${owner}','in',${period}::smallint,0::smallint,0::smallint,${quote(regulation)},'15:00',now());`);
      expect(sql(`SELECT row_to_json(r) FROM milestone_resolutions r WHERE milestone='Q1'`)).toBe(first);
    }
    const quarters = {Q1:{left:0,top:0},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:3,top:0}};
    sql(`SET ROLE service_role; SELECT id FROM gridone_commit_manual_score('${id}','${owner}','post',5::smallint,3::smallint,0::smallint,${quote(quarters)},'',now());`);
    const results = JSON.parse(sql(`SELECT json_agg(json_build_object('period',r.milestone,'cell',a.cell_index,'open',r.open_square) ORDER BY r.milestone) FROM milestone_resolutions r LEFT JOIN square_assignments a ON a.id=r.assignment_id`));
    expect(results).toEqual([{period:'FINAL',cell:69,open:false},{period:'Q1',cell:0,open:false},{period:'Q2',cell:99,open:false},{period:'Q3',cell:null,open:true}]);
    expect(sql(`SELECT count(*) FROM notification_deliveries d JOIN milestone_resolutions r ON r.id=d.resolution_id WHERE r.open_square`)).toBe('0');
    expect(sql('SELECT count(*) FROM notification_deliveries')).toBe('3');
  });
  it('keeps historical axes and resolutions stable on repeated score publication', () => {
    const before = sql('SELECT winner_history FROM public_board_snapshots');
    const quarters = {Q1:{left:0,top:0},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:3,top:0}};
    sql(`SET ROLE service_role; SELECT id FROM gridone_commit_manual_score('${id}','${owner}','post',5::smallint,3::smallint,0::smallint,${quote(quarters)},'',now());`);
    expect(sql('SELECT winner_history FROM public_board_snapshots')).toBe(before);
    expect(sql('SELECT count(*) FROM notification_deliveries')).toBe('3');
    expect(JSON.parse(sql(`SELECT board_data->'topAxisByQuarter' FROM contests WHERE id='${id}'`))).toEqual(sets);
  });
  it('uses the corrected milestone set and preserves the previous result and both recipient notices', () => {
    sql(`SET ROLE service_role; SELECT resolution FROM gridone_correct_milestone('${id}','${owner}','Q2',1,1,1,'Local quarter correction');`);
    expect(sql(`SELECT a.cell_index FROM milestone_resolutions r JOIN square_assignments a ON a.id=r.assignment_id WHERE r.milestone='Q2' AND r.resolution_version=2`)).toBe('0');
    expect(sql(`SELECT a.cell_index FROM milestone_resolutions r JOIN square_assignments a ON a.id=r.assignment_id WHERE r.milestone='Q2' AND r.resolution_version=1`)).toBe('99');
    expect(sql(`SELECT count(*) FROM notification_deliveries WHERE notification_kind LIKE 'correction_%'`)).toBe('2');
    expect(sql(`SELECT count(*) FROM contest_audit_events WHERE event_type='milestone.corrected'`)).toBe('1');
  });
});
