import { describe, expect, it } from 'vitest';
import { projectSalesBoard, validateSalesBoard } from '../functions/_lib/pregameBoard';
const board = () => ({ squares: Array.from({length:100},()=>[] as string[]), allocationLabels: Array(100).fill(null), leftAxis:[0,1,2,3,4,5,6,7,8,9],topAxis:[0,1,2,3,4,5,6,7,8,9],isDynamic:false });
describe('pregame public projection',()=>{
 it('keeps public allocation separate from private metadata and hides drawn draft digits',()=>{
  const input=board(); input.squares[26]=['Jane']; input.allocationLabels[26]='Mora family';
  const result=projectSalesBoard({...input,seller_label:'PRIVATE',payments:{Jane:'paid'},contacts:['private@example.com']});
  expect(result).toEqual({availability:Array(100).fill('unspecified'),participation:{},squares:input.squares,allocationLabels:input.allocationLabels,leftAxis:Array(10).fill(null),topAxis:Array(10).fill(null),isDynamic:false});
 });
 it('permits a completely unsold board',()=>expect(validateSalesBoard(board())).toBeNull());
 it('rejects invalid lengths, allocations, duplicate buyers, and legacy dynamic boards',()=>{
  expect(validateSalesBoard({...board(),squares:[]})).toMatch(/100/);
  expect(validateSalesBoard({...board(),allocationLabels:['Family']})).toMatch(/100/);
  expect(validateSalesBoard({...board(),allocationLabels:Array(100).fill('  ')})).toMatch(/allocation/i);
  expect(validateSalesBoard({...board(),squares:Array(100).fill(['A','B'])})).toMatch(/buyer/i);
  expect(validateSalesBoard({...board(),isDynamic:true})).toBeNull();
  expect(validateSalesBoard({...board(),isDynamic:'true'})).toMatch(/number mode/i);
  const dynamic = {...board(),isDynamic:true,topAxisByQuarter:{Q1:[9,2,6,0,7,4,5,8,0,9]}};
  expect(projectSalesBoard(dynamic).isDynamic).toBe(true);
  expect(projectSalesBoard(dynamic)).not.toHaveProperty('topAxisByQuarter');
 });
 it('does not infer allocation from a legacy seller field',()=>{
  const input=board(); delete (input as any).allocationLabels;
  expect(projectSalesBoard({...input,seller_label:'private'}).allocationLabels).toEqual(Array(100).fill(null));
 });
});

import { beforeEach, vi } from 'vitest';
import { onRequestPost as shareBoard } from '../functions/api/pools/[id]/share';
import { onRequestGet as getBoard } from '../functions/api/pools/[id]';
const mocks=vi.hoisted(()=>({clients:[] as any[]}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>mocks.clients.shift()}));
const env={VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};
const id='11111111-1111-4111-8111-111111111111';
const invokeShare=(revision:any=4,token='token')=>shareBoard({request:new Request('https://example.test/api/pools/'+id+'/share',{method:'POST',headers:{Authorization:token?'Bearer '+token:'','Content-Type':'application/json'},body:JSON.stringify({revision})}),env,params:{id}});
const authClient=(confirmed=true)=>({auth:{getUser:vi.fn(async()=>({data:{user:{id,email:'owner@example.test',email_confirmed_at:confirmed?'2026-01-01':null}}}))}});
beforeEach(()=>{mocks.clients.length=0;});
describe('share endpoint authorization and allowance',()=>{
 it('requires sign-in and verified email',async()=>{
  expect((await invokeShare(4,'')).status).toBe(401);
  mocks.clients.push(authClient(false)); expect((await invokeShare()).status).toBe(403);
 });
 it('requires revision and does not call the service for invalid requests',async()=>{
  mocks.clients.push(authClient()); expect((await invokeShare('4')).status).toBe(409);
 });
 it('uses verified owner identity and returns stable participant link',async()=>{
  const rpc=vi.fn(async()=>({data:[{share_code:'ABCDEFGH',next_revision:5,shared_at:'2026-09-01',tier:'free',used:1,allowance:1}],error:null}));
  mocks.clients.push(authClient(),{rpc}); const response=await invokeShare();
  expect(rpc).toHaveBeenCalledWith('gridone_share_board',{p_contest_id:id,p_owner_id:id,p_expected_revision:4});
  expect(await response.json()).toMatchObject({shared:true,viewerUrl:'/b/ABCDEFGH',sharedAt:'2026-09-01',revision:5,used:1});
 });
 it('preserves revision conflict and upgrade handling',async()=>{
  mocks.clients.push(authClient(),{rpc:async()=>({data:[],error:null})});
  const conflict=await invokeShare();expect(conflict.status).toBe(409);expect(await conflict.json()).toMatchObject({code:'REVISION_CONFLICT'});
  mocks.clients.push(authClient(),{rpc:async()=>({data:null,error:{message:'PUBLISH_ALLOWANCE_EXHAUSTED:gameday:5:5'}})});
  const exhausted=await invokeShare();expect(exhausted.status).toBe(402);expect(await exhausted.json()).toMatchObject({used:5,allowance:5,upgradeTo:'org'});
 });
});
const query=(data:any)=>{
 const chain:any={select:vi.fn(()=>chain),eq:vi.fn(()=>chain),is:vi.fn(()=>chain),not:vi.fn(()=>chain),in:vi.fn(()=>chain),maybeSingle:async()=>({data,error:null})}; return chain;
};
describe('public sales access',()=>{
 it('shows an explicitly shared board without exposing owner, ledger, or draft axes',async()=>{
  const data={share_code:'ABCDEFGH',title:'Team',revision:4,shared_at:'2026-09-01',published_at:null,board_data:{...board(),seller_label:'PRIVATE'},owner_id:'PRIVATE',settings:{email:'PRIVATE'}};
  const from=vi.fn((table:string)=>query(table==='contests'?data:null));mocks.clients.push({from});
  const response=await getBoard({request:new Request('https://example.test/api/pools/ABCDEFGH'),env,params:{id:'ABCDEFGH'}});
  expect(response.status).toBe(200);const body=await response.json();expect(body).toMatchObject({stage:'selling',published_at:null,score:null});
  expect(body.board.leftAxis).toEqual(Array(10).fill(null));expect(JSON.stringify(body)).not.toContain('PRIVATE');
 });
 it('fails closed for an unshared draft or finalized board with no public snapshot',async()=>{
  for(const data of [{shared_at:null,board_data:board()},{shared_at:'2026-09-01',published_at:'2026-09-02',board_data:board()}]){
   mocks.clients.push({from:(table:string)=>query(table==='contests'?data:null)});
   const response=await getBoard({request:new Request('https://example.test/api/pools/ABCDEFGH'),env,params:{id:'ABCDEFGH'}});
   expect(response.status).toBe(404);
  }
 });
});

import { refreshContestScore } from '../functions/_lib/scoreRefresh';
import { onRequestGet as getOwnerScore } from '../functions/api/pools/[id]/score';
import { onRequestPost as postManualScore, onRequestPut as enableManualScore, onRequestDelete as disableManualScore } from '../functions/api/pools/[id]/score/manual';
describe('shared sales boards cannot start scoring',()=>{
 const selling={id,status:'draft',shared_at:'2026-09-01',published_at:null,game_external_id:'401000001',board_activations:[{id:'activation'}]};
 it('skips refresh before acquiring a lease or writing a snapshot',async()=>{
  const admin={rpc:vi.fn(),from:vi.fn()};
  expect(await refreshContestScore(admin,selling,null as any)).toEqual({status:'unpublished'});
  expect(admin.rpc).not.toHaveBeenCalled();expect(admin.from).not.toHaveBeenCalled();
 });
 it('rejects owner automatic score refresh even with a paid activation',async()=>{
  const rpc=vi.fn();mocks.clients.push({from:()=>query(selling),rpc},authClient());
  const response=await getOwnerScore({request:new Request(`https://example.test/api/pools/${id}/score`,{headers:{Authorization:'Bearer token'}}),env,params:{id}});
  expect(response.status).toBe(409);expect(rpc).not.toHaveBeenCalled();
 });
 it('rejects manual entry, switching on, and switching back before finalization',async()=>{
  for(const [method,handler] of [['POST',postManualScore],['PUT',enableManualScore],['DELETE',disableManualScore]] as const){
   const rpc=vi.fn();mocks.clients.push(authClient(),{from:()=>query(selling),rpc});
   const response=await handler({request:new Request(`https://example.test/api/pools/${id}/score/manual`,{method,headers:{Authorization:'Bearer token'}}),env,params:{id}});
   expect(response.status).toBe(409);expect(rpc).not.toHaveBeenCalled();
  }
 });
});

describe('public link handoff and failure recovery',()=>{
 it('rereads final publication if it commits between final and sales lookup',async()=>{
  let snapshotReads=0;
  mocks.clients.push({from:(table:string)=>{
   if(table==='contests')return query(null);
   snapshotReads++;
   return query(snapshotReads===1?null:{share_code:'ABCDEFGH',board_title:'Final board',published_at:'2026-09-02',board:board(),contest:{id,status:'published'}});
  }});
  const response=await getBoard({request:new Request('https://example.test/api/pools/ABCDEFGH'),env,params:{id:'ABCDEFGH'}});
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({stage:'finalized'});expect(snapshotReads).toBe(2);
 });
 it('returns a stable error if the sharing service throws',async()=>{
  mocks.clients.push(authClient(),{rpc:async()=>{throw new Error('private database details');}});
  const response=await invokeShare();expect(response.status).toBe(500);expect(JSON.stringify(await response.json())).not.toContain('private database');
 });
});
