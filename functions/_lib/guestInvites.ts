import { readFamilyBody } from './familyAccess';
import { adminClient, anonClient, authenticate } from './http';
import { claimCodeFor, codePattern, hashGuestCredential, keyedGuestHash, randomGuestToken, sessionPattern, signInvite, uuid, validPayment, verifyInvite } from './guestInviteCredentials';
import type { GuestInvite, GuestReceipt, GuestSnapshot, OrganizerInvites } from '../../src/features/guest/guestInviteTypes';

export interface GuestEnv {
  VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string;
  PUBLIC_SITE_URL?: string; GUEST_INVITE_POOL_IDS?: string; GUEST_INVITE_SECRET?: string;
}
export type GuestContext = { request: Request; env: GuestEnv; params: { id?: string } };
type RecordValue = Record<string, any>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
const fail = (code: string, error: string, status: number) => response({ code, error }, status);
const validCells = (cells: unknown, empty = false): cells is number[] => Array.isArray(cells) && cells.length >= (empty ? 0 : 1) && cells.length <= 100 && new Set(cells).size === cells.length && cells.every(cell => Number.isInteger(cell) && cell >= 0 && cell < 100);
const revision = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value === value.trim() && [...value].length >= min && [...value].length <= max && !/[\u0000-\u001f\u007f]/.test(value);

export function guestEnabled(env: GuestEnv, id: string): boolean {
  return uuid.test(id) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY && env.GUEST_INVITE_SECRET && env.GUEST_INVITE_SECRET.length >= 32) &&
    (env.GUEST_INVITE_POOL_IDS ?? '').split(',').map(item => item.trim().toLowerCase()).includes(id.toLowerCase());
}
function admin(env: GuestEnv) {
  return adminClient(env);
}
function errorResponse(error: unknown): Response {
  const message = record(error) && typeof error.message === 'string' ? error.message : '';
  if (/revision_conflict/.test(message)) return fail('REVISION_CONFLICT', 'This board changed. Your edits are still here. Reload the latest board before saving.', 409);
  if (/guest_holds_active/.test(message)) return fail('ACTIVE_GUEST_HOLDS', 'Guests are choosing squares. Wait for their holds to finish, or cancel holds in Guest claim links before locking numbers.', 409);
  if (/guest_invites_active_seller_key/.test(message)) return fail('SELLER_LINK_EXISTS', 'This seller already has a link. Update or regenerate that link, or disable it before creating another.', 409);
  if (/guest_square_conflict|guest_square_unavailable|guest_hold_conflict|duplicate key/.test(message)) return fail('SQUARE_CONFLICT', 'Someone just grabbed that one — pick another.', 409);
  if (/guest_limit/.test(message)) return fail('GUEST_LIMIT', 'This selection exceeds the limit for your guest pass.', 409);
  if (/guest_hold_expired|guest_hold_required/.test(message)) return fail('HOLD_EXPIRED', 'Your hold expired. Your name is still here — choose available squares again.', 409);
  if (/guest_board_locked/.test(message)) return fail('BOARD_LOCKED', 'Game numbers are locked. You can still follow the board.', 409);
  if (/guest_invite_inactive/.test(message)) return fail('INVITE_INACTIVE', 'This invite link is no longer active.', 403);
  if (/guest_access_denied|guest_not_found/.test(message)) return fail('ACCESS_DENIED', 'This link or claim code is unavailable. Check it or contact the organizer.', 403);
  if (/guest_invalid_request|guest_scope|guest_not_available/.test(message)) return fail('INVALID_REQUEST', 'Review the selected available squares and entered details.', 400);
  if (/guest_rate_limit/.test(message)) return fail('RATE_LIMITED', 'Please wait a moment before trying again.', 429);
  return fail('UNAVAILABLE', 'Guest claiming is temporarily unavailable. Please try again.', 503);
}
function inviteProjection(value: RecordValue): GuestInvite {
  return { id: value.id, label: value.label, cells: value.cells, maxSquares: value.maxSquares, version: value.version, expiresAt: value.expiresAt ?? null, disabledAt: value.disabledAt ?? null };
}
function receiptProjection(value: RecordValue): GuestReceipt {
  return { groupId: value.groupId, inviteId: value.inviteId, displayName: value.displayName, cells: value.cells, claimedAt: value.claimedAt ?? null, canManage: value.canManage === true, payment: validPayment(value.payment) ? value.payment : null };
}
function snapshotProjection(value: RecordValue, publicOnly = false): GuestSnapshot {
  const result: GuestSnapshot = {
    boardId: value.boardId, title: value.title, shareCode: value.shareCode, revision: value.revision,
    serverTime: value.serverTime, stage: value.stage, squares: value.squares, allocationLabels: value.allocationLabels,
    availability: value.availability, holds: (value.holds ?? []).map((hold: RecordValue) => ({ index: hold.index, expiresAt: hold.expiresAt, ...(!publicOnly && hold.mine === true ? { mine: true } : {}) })), claimedCells: value.claimedCells ?? [],
  };
  if (!publicOnly) {
    if (record(value.invite)) result.invite = inviteProjection(value.invite);
    if (record(value.mine)) result.mine = receiptProjection(value.mine);
    result.heldCells = value.heldCells ?? [];
  }
  return result;
}
async function ownerProjection(value: RecordValue, env: GuestEnv, id: string): Promise<OrganizerInvites> {
  // PUBLIC_SITE_URL is server configuration, never the request Host supplied by a caller.
  const origin = new URL(env.PUBLIC_SITE_URL || 'https://getgridone.com').origin;
  return {
    revision: value.revision,
    invites: await Promise.all((value.invites ?? []).map(async (raw: RecordValue) => ({
      ...inviteProjection(raw), payment: validPayment(raw.payment) ? raw.payment : null,
      counts: { available: raw.counts.available, held: raw.counts.held, claimed: raw.counts.claimed },
      url: `${origin}/p/${id}?invite=${await signInvite(env.GUEST_INVITE_SECRET!, id, raw.id, raw.version)}`,
    }))),
    claims: (value.claims ?? []).map(receiptProjection),
    holds: (value.holds ?? []).map((hold: RecordValue) => ({ index: hold.index, expiresAt: hold.expiresAt, inviteId: hold.inviteId })),
  };
}
async function consumeLimit(db: ReturnType<typeof admin>, env: GuestEnv, key: string, limit: number, window = 60): Promise<boolean> {
  const { data, error } = await db.rpc('gridone_guest_rate_limit', { p_key: await keyedGuestHash(env.GUEST_INVITE_SECRET!, key), p_limit: limit, p_window_seconds: window });
  if (error) throw error;
  return data === true;
}
const ipKey = (request: Request) => request.headers.get('CF-Connecting-IP') || 'local-unknown';
const actions = ['create', 'update', 'disable', 'regenerate', 'cancel_holds', 'release_claim', 'rotate_code'];

function validOwnerBody(body: RecordValue): boolean {
  if (typeof body.action !== 'string' || !actions.includes(body.action) || !revision(body.revision) || Object.keys(body).some(key => !['action','revision','inviteId','groupId','label','cells','maxSquares','expiresAt','payment','offerAcknowledged'].includes(key))) return false;
  if (['update','disable','regenerate'].includes(body.action) && (typeof body.inviteId !== 'string' || !uuid.test(body.inviteId))) return false;
  if (['release_claim','rotate_code'].includes(body.action) && (typeof body.groupId !== 'string' || !uuid.test(body.groupId))) return false;
  if (['create','update'].includes(body.action)) {
    if (!text(body.label, 1, 80) || !validCells(body.cells) || !Number.isInteger(body.maxSquares) || body.maxSquares < 1 || body.maxSquares > body.cells.length || body.offerAcknowledged !== true) return false;
    if (body.expiresAt !== undefined && body.expiresAt !== null && (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now())) return false;
    if (body.payment !== undefined && !validPayment(body.payment)) return false;
  }
  return true;
}

export async function ownerInvites(context: GuestContext, mutate: boolean): Promise<Response> {
  const { env, request } = context; const id = String(context.params.id ?? '').toLowerCase();
  if (!guestEnabled(env, id)) return fail('NOT_FOUND', 'Not found.', 404);
  try {
    let body: RecordValue = {};
    if (mutate) {
      const parsed = await readFamilyBody(request);
      if (!parsed || !validOwnerBody(parsed)) return fail('INVALID_REQUEST', 'Review the selected available squares and entered details.', 400);
      body = parsed;
    }
    const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!bearer) return fail('SIGN_IN_REQUIRED', 'Sign in to manage guest links.', 401);
    const auth = anonClient(env);
    const user = await authenticate(auth, bearer);
    if (!('user' in user)) {
      return user.failure === 'unavailable'
        ? fail('AUTH_UNAVAILABLE', 'Sign-in is temporarily unavailable. Try again.', 503)
        : fail('SIGN_IN_REQUIRED', 'Sign in to manage guest links.', 401);
    }
    const db = admin(env);
    const action = !mutate ? 'owner_list' : body.action === 'regenerate' ? 'owner_rotate' : `owner_${body.action}`;
    const payload: RecordValue = { ...body }; delete payload.action; delete payload.inviteId;
    let claimCode: string | undefined;
    if (body.action === 'rotate_code') {
      claimCode = await claimCodeFor(env.GUEST_INVITE_SECRET!, id, body.groupId, randomGuestToken());
      payload.claimCodeHash = await hashGuestCredential(claimCode);
    }
    const { data, error } = await db.rpc('gridone_guest_action', { p_action: action, p_board_id: id, p_owner_id: user.user.id, p_invite_id: body.inviteId ?? null, p_guest_hash: null, p_payload: payload });
    if (error) throw error;
    if (!record(data)) throw new Error('guest_access_denied');
    const result = await ownerProjection(data, env, id);
    return response({ ...result, ...(claimCode ? { claimCode } : {}) });
  } catch (error) { return errorResponse(error); }
}

export async function guestAction(context: GuestContext): Promise<Response> {
  const { env, request } = context; const id = String(context.params.id ?? '').toLowerCase();
  if (!guestEnabled(env, id)) return fail('NOT_FOUND', 'Not found.', 404);
  try {
    const body = await readFamilyBody(request);
    if (!body || typeof body.action !== 'string' || !['read','hold','confirm','receipt','release','swap'].includes(body.action) || Object.keys(body).some(key => !['action','inviteToken','guestToken','claimCode','cells','name'].includes(key))) return fail('INVALID_REQUEST', 'Check the claim request.', 400);
    if (body.guestToken !== undefined && (typeof body.guestToken !== 'string' || !sessionPattern.test(body.guestToken))) return fail('INVALID_REQUEST', 'Check the guest pass.', 400);
    if (body.claimCode !== undefined && (typeof body.claimCode !== 'string' || !codePattern.test(body.claimCode))) return fail('INVALID_REQUEST', 'Enter your four-word claim code.', 400);
    if (body.guestToken && body.claimCode) return fail('INVALID_REQUEST', 'Use one guest credential.', 400);
    if (body.cells !== undefined && !validCells(body.cells, true)) return fail('INVALID_REQUEST', 'Check the selected squares.', 400);
    if (['hold','confirm','swap'].includes(body.action) && !validCells(body.cells, body.action === 'hold')) return fail('INVALID_REQUEST', 'Check the selected squares.', 400);
    if (body.action === 'confirm' && !text(body.name, 2, 30)) return fail('INVALID_REQUEST', 'Enter a display name with 2–30 characters.', 400);
    let invite: { id: string; version: number } | null = null;
    if (body.inviteToken !== undefined) {
      if (typeof body.inviteToken !== 'string' || body.inviteToken.length > 200) return fail('ACCESS_DENIED', 'This invite link is no longer active.', 403);
      invite = await verifyInvite(env.GUEST_INVITE_SECRET!, id, body.inviteToken);
      if (!invite) return fail('ACCESS_DENIED', 'This invite link is no longer active.', 403);
    }
    if (['read','hold','confirm'].includes(body.action) && !invite) return fail('ACCESS_DENIED', 'This invite link is no longer active.', 403);
    if (body.action !== 'read' && !body.guestToken && !body.claimCode) return fail('ACCESS_DENIED', 'Enter your claim code or return using your guest pass.', 403);
    if (['hold','confirm'].includes(body.action) && !body.guestToken) return fail('ACCESS_DENIED', 'Return using your guest pass to finish claiming.', 403);
    const db = admin(env);
    const code = body.claimCode as string | undefined;
    const capability = code || body.guestToken as string | undefined;
    const ip = ipKey(request);
    const mutating = ['hold', 'confirm', 'release', 'swap'].includes(body.action);
    if (mutating && (!await consumeLimit(db, env, `ip|${ip}|mutate`, 30) ||
        (invite && !await consumeLimit(db, env, `invite|${invite.id}|mutate`, 300)))) {
      return fail('RATE_LIMITED', 'Please wait a moment before trying again.', 429);
    }
    if (!await consumeLimit(db, env, `ip|${ip}|${code ? 'code' : 'guest'}`, code ? 10 : 600) ||
        !await consumeLimit(db, env, `board|${id}|${code ? 'code' : 'guest'}`, code ? 300 : 6000) ||
        (capability && !await consumeLimit(db, env, `capability|${id}|${capability}`, body.action === 'read' ? 180 : 60))) {
      return fail('RATE_LIMITED', 'Please wait a moment before trying again.', 429);
    }
    const payload: RecordValue = { credentialKind: code ? 'code' : 'session', ...(invite ? { credentialVersion: invite.version } : {}), ...(Array.isArray(body.cells) ? { cells: [...body.cells].sort((a, b) => a - b) } : {}), ...(body.name !== undefined ? { name: body.name } : {}) };
    let claimCode: string | undefined;
    if (body.action === 'confirm') {
      claimCode = await claimCodeFor(env.GUEST_INVITE_SECRET!, id, invite!.id, body.guestToken as string);
      payload.claimCodeHash = await hashGuestCredential(claimCode);
    }
    const { data, error } = await db.rpc('gridone_guest_action', { p_action: `guest_${body.action}`, p_board_id: id, p_owner_id: null, p_invite_id: invite?.id ?? null, p_guest_hash: capability ? await hashGuestCredential(capability) : null, p_payload: payload });
    if (error) throw error;
    if (!record(data)) throw new Error('guest_access_denied');
    return response(['read','hold'].includes(body.action) ? snapshotProjection(data) : { ...receiptProjection(data), ...(claimCode ? { claimCode } : {}) });
  } catch (error) { return errorResponse(error); }
}

export async function guestPublicState(context: GuestContext): Promise<Response> {
  const { env, request } = context; const id = String(context.params.id ?? '').toLowerCase();
  if (!guestEnabled(env, id)) return fail('NOT_FOUND', 'Not found.', 404);
  try {
    const db = admin(env);
    if (!await consumeLimit(db, env, `public|${ipKey(request)}|${id}`, 6000)) return fail('RATE_LIMITED', 'Please wait a moment before trying again.', 429);
    const { data, error } = await db.rpc('gridone_guest_action', { p_action: 'public_state', p_board_id: id, p_owner_id: null, p_invite_id: null, p_guest_hash: null, p_payload: {} });
    if (error) throw error;
    if (!record(data)) throw new Error('guest_access_denied');
    return response(snapshotProjection(data, true));
  } catch (error) { return errorResponse(error); }
}
