import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client:vi.fn(), game:vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({createClient:mocks.client}));
vi.mock('../functions/_lib/espnNfl', () => ({fetchScheduledGameById:mocks.game,fetchScheduledGames:vi.fn()}));
import { onRequestPost } from '../functions/api/pools';
import { parseScannedBoard } from '../functions/_lib/scanBoard';
import { resolvePhotoOrientation } from '../utils/photoOrientation';
import { currentSquareIndex } from '../src/features/viewer/scenarios/scenarioModel';
import type { LiveGameData } from '../types';
const container=`gridone-repair01-${process.pid}-${randomUUID().slice(0,8)}`;
const owner='50000000-0000-4000-8000-000000000001';
const id='50000000-0000-4000-8000-000000000002';
const digits=[0,1,2,3,4,5,6,7,8,9];
const sets={Q1:digits,Q2:[...digits].reverse(),Q3:[...digits.slice(2),0,1],Q4:[...digits.slice(3),0,1,2]};
const base={leftAxis:digits,topAxis:digits,squares:Array.from({length:100},(_,i)=>[`Paper ${i}`])};
const dynamic={...base,isDynamic:true,leftAxisByQuarter:sets,topAxisByQuarter:sets};
const q=(v:unknown)=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
const docker=(...args:string[])=>execFileSync('docker',args,{encoding:'utf8',timeout:60000});
const sql=(input:string)=>execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','repair'],{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']}).trim();
const migration=()=>readFileSync(resolve('supabase/migrations/032_quarter_specific_numbers.sql'),'utf8');
let started=false;
const historyOwner='50000000-0000-4000-8000-000000000099';
const historyId='50000000-0000-4000-8000-000000000098';
const historyEvidence=()=>sql(`SELECT json_build_object('milestones',(SELECT json_agg(r ORDER BY r.id) FROM milestone_resolutions r WHERE contest_id='${historyId}'),'deliveries',(SELECT json_agg(d ORDER BY d.id) FROM notification_deliveries d WHERE d.resolution_id IN (SELECT id FROM milestone_resolutions WHERE contest_id='${historyId}')))`);
let inheritedHistory='';
beforeAll(async()=>{
 docker('image','inspect','postgres:17');
 docker('run','--pull=never','--rm','--detach','--name',container,'-e','POSTGRES_PASSWORD=local-disposable','-e','POSTGRES_DB=repair','postgres:17');started=true;
 let ready=false;for(let i=0;i<80;i++){try{sql('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}if(!ready)throw Error('Database not ready');
 sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user) $$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid(),auth.role() TO anon,authenticated,service_role;`);
 for(const file of readdirSync(resolve('supabase/migrations')).filter(f=>/^\d{3}_.*\.sql$/.test(f)&&f<'032').sort())sql(readFileSync(resolve('supabase/migrations',file),'utf8'));
 sql(`INSERT INTO auth.users VALUES('${owner}','local@example.test'),('${historyOwner}','history@example.test');
 INSERT INTO contests(id,owner_id,share_code,title,game_external_id,game_starts_at,board_data) VALUES('${historyId}','${historyOwner}','HHHHH234','Pre-migration history','401772510','2027-02-01',${q(base)});`);
 const rev=sql(`SELECT revision FROM contests WHERE id='${historyId}'`);
 sql(`SET ROLE service_role; SELECT published FROM gridone_publish_board('${historyId}','${historyOwner}',${rev},ARRAY[${digits}]::smallint[],ARRAY[${digits}]::smallint[],${q(base.squares)},${q(base)},'{}',false); INSERT INTO notification_subscriptions(contest_id,participant_id,email,status,unsubscribe_token_hash,verified_at) SELECT '${historyId}',id,'history-winner@example.test','verified',id::text,now() FROM contest_participants WHERE contest_id='${historyId}' AND display_name='Paper 0'; SELECT id FROM gridone_commit_manual_score('${historyId}','${historyOwner}','in',2::smallint,0::smallint,0::smallint,${q({Q1:{left:0,top:0},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:0,top:0}})},'15:00',now());`);
 inheritedHistory=historyEvidence();expect(JSON.parse(inheritedHistory).milestones).toHaveLength(1);expect(JSON.parse(inheritedHistory).deliveries).toHaveLength(1);
},120000);
afterAll(()=>{if(started)docker('rm','--force',container);});

it('preflights published legacy shapes seeded BEFORE 032, aborting atomically without touching evidence',()=>{
 for(const [label,value,side] of [
  ['unequal Q1',dynamic,[...digits].reverse()],
  ['missing sets',{...base,isDynamic:true},digits],
  ['invalid sets',{...dynamic,topAxisByQuarter:{...sets,Q2:Array(10).fill(0)}},digits],
  ['snapshot missing quarter metadata',dynamic,digits],
 ] as const){
  // Prior schema accepts all these shapes; no trigger is disabled for the seeds.
  sql(`INSERT INTO contests(id,owner_id,share_code,title,side_axis,top_axis,axis_locked_at,published_at,status,board_data)
   VALUES('${id}','${owner}','RRRRR234','Legacy fixture',ARRAY[${side}]::smallint[],ARRAY[${digits}]::smallint[],now(),now(),'published',${q(value)});`);
  if(label==='snapshot missing quarter metadata')sql(`INSERT INTO public_board_snapshots(contest_id,share_code,revision,board_title,matchup,board,published_at) VALUES('${id}','RRRRR234',1,'Legacy fixture','{}',${q(base)},now());`);
  const before=sql(`SELECT row_to_json(c) FROM contests c WHERE id='${id}'`);
  expect(()=>sql(migration()),label).toThrow(/Quarter migration preflight/);
  expect(sql(`SELECT row_to_json(c) FROM contests c WHERE id='${id}'`)).toBe(before);
  expect(historyEvidence()).toBe(inheritedHistory);
  expect(sql(`SELECT to_regprocedure('public.gridone_validate_number_sets(jsonb,boolean)') IS NULL`)).toBe('t');
  sql(`DELETE FROM public_board_snapshots WHERE contest_id='${id}'; DELETE FROM contests WHERE id='${id}';`);
 }
 for(const broken of [migration().replace('public.gridone_validate_sales_board(jsonb)','public.gridone_missing_prerequisite(jsonb)'),migration().replace('Legacy dynamic boards require a preservation plan before sharing','Unexpected prerequisite source')]){
   expect(()=>sql(broken)).toThrow(/does not exist|prerequisite mismatch/);
   expect(sql(`SELECT to_regprocedure('public.gridone_validate_number_sets(jsonb,boolean)') IS NULL`)).toBe('t');
 }
 sql(`INSERT INTO contests(id,owner_id,share_code,title,side_axis,top_axis,axis_locked_at,published_at,status,board_data) VALUES('${id}','${owner}','RRRRR234','Compatible legacy',ARRAY[${digits}]::smallint[],ARRAY[${digits}]::smallint[],now(),now(),'published',${q(dynamic)}); INSERT INTO public_board_snapshots(contest_id,share_code,revision,board_title,matchup,board,published_at) VALUES('${id}','RRRRR234',1,'Compatible legacy','{}',${q(dynamic)},now());`);
 const lockedBefore=sql(`SELECT json_build_array(side_axis,top_axis,axis_locked_at,board_data->'leftAxisByQuarter',board_data->'topAxisByQuarter') FROM contests WHERE id='${id}'`);
 sql(migration());
 expect(historyEvidence()).toBe(inheritedHistory);
 sql(`UPDATE contests SET title='Harmless title' WHERE id='${id}'; SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT * FROM gridone_rename_published_square('${id}',0,'Reviewed label');`);
 expect(sql(`SELECT json_build_array(side_axis,top_axis,axis_locked_at,board_data->'leftAxisByQuarter',board_data->'topAxisByQuarter') FROM contests WHERE id='${id}'`)).toBe(lockedBefore);
 expect(sql(`SELECT board->'squares'->0->>0 FROM public_board_snapshots WHERE contest_id='${id}'`)).toBe('Reviewed label');
 sql(`DELETE FROM contests WHERE id='${id}'`);
 expect(()=>sql(migration())).toThrow(/already exists/);
 expect(sql(`SELECT has_function_privilege('service_role','public.gridone_axis_for_milestone(jsonb,smallint[],text,text)','EXECUTE')`)).toBe('f');
 expect(sql(`SELECT bool_and(proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) FROM pg_proc WHERE proname IN ('gridone_axis_for_milestone','gridone_observe_milestones_unchecked','gridone_correct_milestone')`)).toBe('t');
 for(const role of ['anon','authenticated','service_role'])expect(()=>sql(`SET ROLE ${role}; SELECT gridone_axis_for_milestone('{}',ARRAY[0]::smallint[],'top','Q1')`)).toThrow(/permission denied/);
});

it('actual create endpoint persists literal drafts through the real SQL constraints (transport/auth/schedule are local adapters)',async()=>{
 mocks.game.mockResolvedValue({id:'401772510',kickoffAt:'2027-02-01T00:00:00Z',state:'pre',season:2026,week:1,awayTeam:{abbr:'DAL',name:'Dallas Cowboys'},homeTeam:{abbr:'WAS',name:'Washington Commanders'}});
 mocks.client.mockImplementation(()=>({auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>({insert:(payload:any)=>({select:()=>({single:async()=>{
  try{
   const result=sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; INSERT INTO contests(owner_id,title,season_year,game_external_id,game_starts_at,side_team_abbr,side_team_name,top_team_abbr,top_team_name,side_axis,top_axis,settings,board_data)
    VALUES('${owner}','${payload.title}',2026,'${payload.game_external_id}','${payload.game_starts_at}','DAL','Dallas Cowboys','WAS','Washington Commanders',${payload.side_axis===null?'NULL':`ARRAY[${payload.side_axis}]::smallint[]`},${payload.top_axis===null?'NULL':`ARRAY[${payload.top_axis}]::smallint[]`},${q(payload.settings)},${q(payload.board_data)}) RETURNING json_build_object('id',id,'share_code',share_code,'revision',revision);`);
   return {data:JSON.parse(result),error:null};
  }catch(error){return {data:null,error:{message:String(error)}};}
 }})})})}));
 for(const value of [{...base,topAxis:[9,2,6,0,7,4,5,8,0,9]},{...base,topAxis:[null,...digits.slice(1)]},{...dynamic,leftAxis:Array(10).fill(null)}]){
  const response=await onRequestPost({env:{VITE_SUPABASE_URL:'http://local.invalid',VITE_SUPABASE_ANON_KEY:'test'},request:new Request('http://local.invalid/api/pools',{method:'POST',headers:{Authorization:'Bearer local-test'},body:JSON.stringify({game:{title:'Literal draft',gameExternalId:'401772510'},board:value})})});
  const result=await response.json();expect(response.status,JSON.stringify(result)).toBe(201);
  expect(JSON.parse(sql(`SELECT board_data FROM contests WHERE id='${result.boardId}'`))).toEqual(value);
  expect(sql(`SELECT side_axis IS NULL AND top_axis IS NULL FROM contests WHERE id='${result.boardId}'`)).toBe('t');
 }
 for(const value of [{...base,isDynamic:'yes'},{...base,topAxisByQuarter:[]}]){
  const response=await onRequestPost({env:{},request:new Request('http://local.invalid/api/pools',{method:'POST',headers:{Authorization:'Bearer local-test'},body:JSON.stringify({game:{title:'Malformed',gameExternalId:'401772510'},board:value})})});expect(response.status).toBe(400);
 }
});

it('asymmetric reversed fixed/dynamic photos survive actual create, SQL reload, publication and SQL/client winner resolution',async()=>{
 const photoTop=[...digits].reverse();const topSets={...sets,Q1:photoTop,Q2:[...digits.slice(4),0,1,2,3]};
 for(const isDynamic of [false,true]){
  const scanned=parseScannedBoard({isDynamic,leftAxis:digits,topAxis:photoTop,topTeamText:'DAL',leftTeamText:'WAS',squaresGrid:Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>`Paper row ${r} column ${c}`)),...(isDynamic?{leftAxisByQuarter:sets,topAxisByQuarter:topSets}:{})});
  const mapped=resolvePhotoOrientation(scanned,{topAbbr:'WAS',leftAbbr:'DAL'},true);
  const response=await onRequestPost({env:{VITE_SUPABASE_URL:'http://local.invalid',VITE_SUPABASE_ANON_KEY:'test'},request:new Request('http://local.invalid/api/pools',{method:'POST',headers:{Authorization:'Bearer local-test'},body:JSON.stringify({game:{title:'Reversed photo',gameExternalId:'401772510'},board:mapped})})});
  expect(response.status).toBe(201);const result=await response.json();const boardId=result.boardId;
  const loaded=JSON.parse(sql(`SELECT board_data FROM contests WHERE id='${boardId}'`));expect(loaded).toEqual(mapped);
  // Routine draft persistence, then canonical read; no production board or OCR provider.
  sql(`UPDATE contests SET board_data=${q(loaded)} WHERE id='${boardId}'`);
  const rev=sql(`SELECT revision FROM contests WHERE id='${boardId}'`);
  const side=photoTop[2],top=digits[1];
  expect(currentSquareIndex({state:'in',period:1,leftScore:side,topScore:top} as LiveGameData,loaded)).toBe(21);
  const quarters={Q1:{left:side,top},Q2:{left:0,top:0},Q3:{left:0,top:0},Q4:{left:0,top:0},OT:{left:0,top:0}};
  const output=sql(`BEGIN; SET ROLE service_role; SELECT published FROM gridone_publish_board('${boardId}','${owner}',${rev},ARRAY[${photoTop}]::smallint[],ARRAY[${digits}]::smallint[],${q(loaded.squares)},${q(loaded)},'{}',false); SELECT id FROM gridone_commit_manual_score('${boardId}','${owner}','in',2::smallint,${side}::smallint,${top}::smallint,${q(quarters)},'15:00',now()); SELECT json_build_object('cell',a.cell_index,'name',p.display_name) FROM milestone_resolutions r JOIN square_assignments a ON a.id=r.assignment_id JOIN contest_participants p ON p.id=a.participant_id WHERE r.contest_id='${boardId}' AND r.milestone='Q1'; ROLLBACK;`);
  expect(JSON.parse(output.split('\n').at(-1)!)).toEqual({cell:21,name:'Paper row 1 column 2'});
 }
});

it('service-role snapshot writes cannot diverge from fixed/dynamic canonical numbers, identity, or nested participants',()=>{
 for(const value of [base,dynamic]){
  sql(`INSERT INTO contests(id,owner_id,share_code,title,game_external_id,game_starts_at,board_data) VALUES('${id}','${owner}','RRRRR234','Snapshot fixture','401772510','2027-02-01',${q(value)});`);
  const revision=sql(`SELECT revision FROM contests WHERE id='${id}'`);
  sql(`SET ROLE service_role; SELECT published FROM gridone_publish_board('${id}','${owner}',${revision},ARRAY[${digits}]::smallint[],ARRAY[${digits}]::smallint[],${q(base.squares)},${q(value)},'{}',false);`);
  expect(()=>sql(`SET ROLE service_role; UPDATE public_board_snapshots SET board=jsonb_set(board,'{leftAxis}',${q([...digits].reverse())}) WHERE contest_id='${id}';`)).toThrow(/axes must match/);
  expect(()=>sql(`SET ROLE service_role; UPDATE public_board_snapshots SET board=jsonb_set(board,'{isDynamic}',${q(!('isDynamic' in value))}) WHERE contest_id='${id}';`)).toThrow(/mode must match/);
  const other=sql(`SELECT id FROM contests WHERE id<>'${id}' LIMIT 1`);
  expect(()=>sql(`SET ROLE service_role; UPDATE public_board_snapshots SET contest_id='${other}' WHERE contest_id='${id}';`)).toThrow(/identity is locked/);
  sql(`SET ROLE service_role; UPDATE public_board_snapshots SET board=jsonb_set(board,'{participants}','[{"id":"fake","displayName":"fake","publicLabel":"fake","privateEmail":"SECRET"}]') WHERE contest_id='${id}';`);
  const projected=JSON.parse(sql(`SELECT board FROM public_board_snapshots WHERE contest_id='${id}'`));
  expect(JSON.stringify(projected)).not.toContain('SECRET');expect(projected.participants).toHaveLength(100);
  expect(projected.participants[0]).toEqual({id:expect.any(String),displayName:expect.any(String),publicLabel:expect.any(String)});
  // Disposable fixture teardown only, never a production rollback.
  sql(`DELETE FROM public_board_snapshots WHERE contest_id='${id}'; DELETE FROM square_assignments WHERE contest_id='${id}'; DELETE FROM contest_participants WHERE contest_id='${id}'; DELETE FROM board_activations WHERE contest_id='${id}'; DELETE FROM contests WHERE id='${id}';`);
 }
});
