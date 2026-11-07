import { beforeEach, expect, it, vi } from 'vitest';
const {rpc,getUser}=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc,auth:{getUser}})}));
import {onRequestPost as family} from '../functions/api/family';
import {onRequestPost as owner} from '../functions/api/pools/[id]/family';
const env={VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server'};
const id='30000000-0000-4000-8000-000000000001';
const token='a'.repeat(64);
const context=(body:unknown,bearer=token)=>({request:new Request('https://getgridone.com/api/family',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,params:{id}});
beforeEach(()=>{vi.clearAllMocks();rpc.mockResolvedValue({data:{title:'Team board',revision:4,label:'Mora',cells:[{index:12,name:'Bill W',availability:'available'}]},error:null});getUser.mockResolvedValue({data:{user:{id}},error:null});});
it('never passes the family bearer token to the database or response',async()=>{
 const response=await family(context({action:'read'}));expect(response.status).toBe(200);
 expect(rpc.mock.calls[0][1].p_token_hash).toMatch(/^[a-f0-9]{64}$/);expect(rpc.mock.calls[0][1].p_token_hash).not.toBe(token);
 expect(await response.text()).not.toContain(token);
});
it('rejects forged action or extra private fields before database access',async()=>{
 for(const body of [{action:'invite'},{action:'edit',revision:4,changes:[{index:12,name:'Bill',paid_status:'paid'}]},{action:'edit',revision:4,changes:[{index:101,name:'Bill'}]}]){
  expect((await family(context(body))).status).toBe(400);
 }expect(rpc).not.toHaveBeenCalled();
});
it('maps expired and revoked access to a non-enumerating denial',async()=>{
 rpc.mockResolvedValue({error:{message:'family_access_denied'},data:null});expect((await family(context({action:'read'}))).status).toBe(403);
});
it('preserves conflicts as conflicts without retrying a write',async()=>{
 rpc.mockResolvedValue({error:{message:'revision_conflict'},data:null});expect((await family(context({action:'edit',revision:4,changes:[{index:12,name:'Bill W',availability:'unavailable'}]}))).status).toBe(409);expect(rpc).toHaveBeenCalledTimes(1);
});
it('allows clearing a scoped display name without allowing blank family labels',async()=>{
 expect((await family(context({action:'edit',revision:4,changes:[{index:12,name:'',availability:'available'}]}))).status).toBe(200);
 expect(rpc.mock.calls[0][1].p_changes).toEqual([{index:12,name:'',availability:'available'}]);
 rpc.mockClear();
 expect((await owner(context({action:'invite',revision:4,label:'',cells:[12]}))).status).toBe(400);
 expect(rpc).not.toHaveBeenCalled();
});
it.each([' ', 'x'.repeat(81), null])('rejects invalid family display name %j before database access',async(name)=>{
 expect((await family(context({action:'edit',revision:4,changes:[{index:12,name,availability:'available'}]}))).status).toBe(400);
 expect(rpc).not.toHaveBeenCalled();
});
it('requires verified owner identity for invite',async()=>{
 getUser.mockResolvedValue({data:{user:null},error:null});expect((await owner(context({action:'invite',revision:4,label:'Mora',cells:[12]}))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();
});
it('issues a private fragment link and never returns the hash',async()=>{
 const response=await owner(context({action:'invite',revision:4,label:'Mora',cells:[12]}));const result=await response.json();expect(response.status).toBe(200);expect(result.url).toMatch(/^https:\/\/getgridone.com\/family#[a-f0-9]{64}$/);expect(JSON.stringify(result)).not.toContain(rpc.mock.calls[0][1].p_token_hash);
});
it('rejects object actions without throwing or calling the database',async()=>{
 for(const endpoint of [family,owner]) expect((await endpoint(context({action:{toString:null},revision:4,label:'Mora',cells:[12]}))).status).toBe(400);
 expect(rpc).not.toHaveBeenCalled();
});
