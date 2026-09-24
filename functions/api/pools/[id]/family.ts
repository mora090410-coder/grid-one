import {anonClient,authenticate,authUnavailableBody} from '../../../_lib/http';
import {familyAdmin,familyFailure,familyResponse,hashFamilyToken,newFamilyToken,readFamilyBody,validCells,validLabel,validRevision,type FamilyEnv} from '../../../_lib/familyAccess';

export const onRequestPost = async ({request,env,params}: {request:Request;env:FamilyEnv;params:{id:string}}) => {
 const id=String(params.id??'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return familyResponse({error:'Invalid board.'},400);
 const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
 if(!bearer)return familyResponse({error:'Sign in to manage family access.'},401);
 try{
  const client=anonClient(env);
  const auth=await authenticate(client,bearer);
  if(!('user' in auth))return auth.failure==='unavailable'?familyResponse(authUnavailableBody(),503):familyResponse({error:'Sign in to manage family access.'},401);
  let body; try { body=await readFamilyBody(request); } catch { return familyResponse({error:'Invalid family request.'},400); }
  if(!body||typeof body.action!=='string'||!['invite','revoke','reassign'].includes(body.action)||!validRevision(body.revision)||!validLabel(body.label)||Object.keys(body).some(key=>!['action','revision','label','cells','reviewPaymentNotes'].includes(key))||(body.action!=='revoke'&&!validCells(body.cells))||(body.action==='reassign'&&body.reviewPaymentNotes!==true))return familyResponse({error:'Review the family, selected squares, and payment-note acknowledgement.'},400);
  const token=body.action==='invite'?newFamilyToken():null;
  const {data,error}=await familyAdmin(env).rpc('gridone_family_access',{p_action:body.action,p_contest_id:id,p_owner_id:auth.user.id,p_expected_revision:body.revision,p_label:body.label,...(body.action!=='revoke'?{p_cells:body.cells}:{}),...(token?{p_token_hash:await hashFamilyToken(token)}:{}),...(body.action==='reassign'?{p_changes:{reviewPaymentNotes:true}}:{})});
  if(error)throw error;if(!data)throw new Error('family_access_denied');
  const origin=env.PUBLIC_SITE_URL?new URL(env.PUBLIC_SITE_URL).origin:new URL(request.url).origin;
  return familyResponse({...data,...(token?{url:`${origin}/family#${token}`}:{})});
 }catch(error){return familyFailure(error);}
};
