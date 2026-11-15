import { familyAdmin, familyFailure, familyResponse, hashFamilyToken, isRecord, readFamilyBody, type FamilyEnv } from '../../_lib/familyAccess';
import { validSellerCode } from '../../_lib/sellerLinks';

const states = ['active', 'not_created', 'not_shared', 'locked', 'no_available'];

/** Private capability in; only its stable public buyer URL out. */
export const onRequestPost = async ({ request, env }: { request: Request; env: FamilyEnv }) => {
 const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
 if (!/^[a-f0-9]{64}$/.test(token)) return familyResponse({ error: 'Ask the organizer for a valid family link.' }, 403);
 let body;
 try { body = await readFamilyBody(request); } catch { return familyResponse({ error: 'Invalid sharing request.' }, 400); }
 if (!body || typeof body.action !== 'string' || !['read', 'create'].includes(body.action) || Object.keys(body).some(key => key !== 'action')) return familyResponse({ error: 'Invalid sharing request.' }, 400);
 try {
  const { data, error } = await familyAdmin(env).rpc('gridone_family_seller_link', { p_token_hash: await hashFamilyToken(token), p_action: body.action });
  if (error) throw error;
  if (!isRecord(data) || typeof data.state !== 'string' || !states.includes(data.state) || !Number.isInteger(data.availableCount) || Number(data.availableCount) < 0 || Number(data.availableCount) > 100 || (data.state === 'active' && (!validSellerCode(data.code) || Number(data.availableCount) === 0))) throw new Error('invalid_sharing_response');
  // Relative public path stays on the active site, never the private family URL.
  const url = data.state === 'active' ? `/s/${data.code}` : undefined;
  return familyResponse({ state: data.state, availableCount: data.availableCount, ...(url ? { url } : {}) });
 } catch (error) { return familyFailure(error); }
};
