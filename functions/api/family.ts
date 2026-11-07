import {familyAdmin,familyFailure,familyResponse,hashFamilyToken,isRecord,readFamilyBody,validCells,validLabel,validRevision,type FamilyEnv} from '../_lib/familyAccess';

/** Family credentials grant only the scoped RPC, never an organizer session. Writes are not retried. */
export const onRequestPost = async ({request,env}: {request:Request;env:FamilyEnv}) => {
 const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')??'';
 if(!/^[a-f0-9]{64}$/.test(token))return familyResponse({error:'Ask the organizer for a valid family link.'},403);
 let body; try { body=await readFamilyBody(request); } catch { return familyResponse({error:'Invalid family request.'},400); }
 if(!body||typeof body.action!=='string'||!['read','edit'].includes(body.action)||Object.keys(body).some(key=>!['action','revision','changes'].includes(key)))return familyResponse({error:'Invalid family request.'},400);
 if(body.action==='edit'){
  if(!validRevision(body.revision)||!Array.isArray(body.changes)||!validCells(body.changes.map(change=>isRecord(change)?change.index:null))||body.changes.some(change=>!isRecord(change)||Object.keys(change).some(key=>!['index','name','availability'].includes(key))||(change.name!==''&&!validLabel(change.name))||typeof change.availability!=='string'||!['unspecified','available','unavailable'].includes(change.availability)))return familyResponse({error:'Check the selected squares and entered names.'},400);
 }
 try{
  const {data,error}=await familyAdmin(env).rpc('gridone_family_access',{p_action:body.action,p_contest_id:null,p_token_hash:await hashFamilyToken(token),...(body.action==='edit'?{p_expected_revision:body.revision,p_changes:body.changes}:{})});
  if(error)throw error;if(!data)throw new Error('family_access_denied');
  return familyResponse(data);
 }catch(error){return familyFailure(error);}
};
