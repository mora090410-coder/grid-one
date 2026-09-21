import { familyAdmin, familyFailure, familyResponse, hashFamilyToken, isRecord, readFamilyBody, validCells, validRevision } from '../../_lib/familyAccess';
import { guestEnabled, type GuestEnv } from '../../_lib/guestInvites';
import { keyedGuestHash, signInvite, uuid } from '../../_lib/guestInviteCredentials';

const states = ['not_created', 'active', 'disabled', 'expired', 'locked', 'not_shared', 'scope_mismatch'];
const unavailable = () => familyResponse({ code: 'SHARING_UNAVAILABLE', error: 'Guest sharing is not available for this board yet.' }, 404);

/** The private family capability authorizes only its database-derived assignment. */
export const onRequestPost = async ({ request, env }: { request: Request; env: GuestEnv }) => {
 const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
 if (!/^[a-f0-9]{64}$/.test(token)) return familyResponse({ error: 'Ask the organizer for a valid family link.' }, 403);
 let body;
 try { body = await readFamilyBody(request); } catch { return familyResponse({ error: 'Invalid sharing request.' }, 400); }
 if (!body || typeof body.action !== 'string' || !['read', 'create'].includes(body.action) || Object.keys(body).some(key => key !== 'action')) return familyResponse({ error: 'Invalid sharing request.' }, 400);
 if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.GUEST_INVITE_SECRET || env.GUEST_INVITE_SECRET.length < 32) return unavailable();
 try {
  const db = familyAdmin(env);
  const hash = await hashFamilyToken(token);
  // Identity lookup is not authorization. The transaction rechecks revocation,
  // expiry, assignment and lifecycle under the canonical board lock.
  const identity = await db.from('family_board_access').select('contest_id').eq('token_hash', hash).maybeSingle();
  if (identity.error) throw identity.error;
  if (!identity.data || typeof identity.data.contest_id !== 'string') throw new Error('family_access_denied');
  const boardId = identity.data.contest_id;
  if (!guestEnabled(env, boardId)) return unavailable();
  const limit = body.action === 'create' ? 30 : 120;
  for (const key of [`family-share:ip:${request.headers.get('CF-Connecting-IP') || 'local-unknown'}`, `family-share:capability:${hash}`]) {
   const rate = await db.rpc('gridone_guest_rate_limit', { p_key: await keyedGuestHash(env.GUEST_INVITE_SECRET, `${body.action}:${key}`), p_limit: limit, p_window_seconds: 60 });
   if (rate.error) throw rate.error;
   if (rate.data !== true) return familyResponse({ code: 'RATE_LIMITED', error: 'Please wait a moment before trying again.' }, 429);
  }
  const { data, error } = await db.rpc('gridone_family_guest_link', { p_board_id: boardId, p_token_hash: hash, p_action: body.action });
  if (error) throw error;
  if (!isRecord(data) || data.boardId !== boardId || typeof data.title !== 'string' || typeof data.label !== 'string' || !validCells(data.cells) || !validRevision(data.revision) || typeof data.state !== 'string' || !states.includes(data.state) || !Number.isInteger(data.availableCount) || Number(data.availableCount) < 0 || Number(data.availableCount) > data.cells.length) throw new Error('invalid_sharing_response');
  let url: string | undefined;
  if (data.state === 'active') {
   if (typeof data.inviteId !== 'string' || !uuid.test(data.inviteId) || !validRevision(data.version) || !Number.isInteger(data.maxSquares) || Number(data.maxSquares) < 1 || Number(data.maxSquares) > data.cells.length) throw new Error('invalid_sharing_response');
   const origin = new URL(env.PUBLIC_SITE_URL || 'https://getgridone.com').origin;
   url = `${origin}/p/${boardId}?invite=${await signInvite(env.GUEST_INVITE_SECRET, boardId, data.inviteId, Number(data.version))}`;
  }
  return familyResponse({ boardId, title: data.title, label: data.label, cells: data.cells, revision: data.revision, state: data.state, availableCount: data.availableCount, ...(data.state === 'active' ? { maxSquares: data.maxSquares } : {}), ...(url ? { url } : {}) });
 } catch (error) { return familyFailure(error); }
};
