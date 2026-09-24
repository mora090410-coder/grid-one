import { authenticate, authUnavailableBody } from '../../../_lib/http';
import { createAuthClient, readSellerBody, sellerAdmin, sellerFailure, sellerLinkUrl, sellerResponse, type SellerEnv } from '../../../_lib/sellerLinks';

type Link = { label: string; code: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Organizer: create (sync) links for every seller on a shared board, or replace one seller's link (rotate). */
export const onRequestPost = async ({ request, env, params }: { request: Request; env: SellerEnv; params: { id?: string } }) => {
  const id = String(params.id ?? '');
  if (!UUID.test(id)) return sellerResponse({ error: 'Invalid board.' }, 400);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return sellerResponse({ error: 'Sign in to manage seller links.' }, 401);
  try {
    const auth = await authenticate(createAuthClient(env), bearer);
    if (!('user' in auth)) {
      return auth.failure === 'unavailable'
        ? sellerResponse(authUnavailableBody(), 503)
        : sellerResponse({ error: 'Sign in to manage seller links.' }, 401);
    }
    let body: Record<string, unknown> | null;
    try { body = await readSellerBody(request); } catch { body = null; }
    const label = typeof body?.label === 'string' ? body.label.trim() : '';
    const valid = body
      && (body.action === 'sync' || body.action === 'rotate')
      && Object.keys(body).every((key) => ['action', 'label'].includes(key))
      && (body.action === 'sync' ? body.label === undefined : label.length >= 1 && label.length <= 80);
    if (!valid) return sellerResponse({ error: 'Invalid seller link request.' }, 400);
    const { data, error } = await sellerAdmin(env).rpc('gridone_seller_link', {
      p_action: body!.action, p_contest_id: id, p_owner_id: auth.user.id, ...(body!.action === 'rotate' ? { p_label: label } : {}),
    });
    if (error) throw error;
    const links: Link[] = Array.isArray(data?.links) ? data.links : [];
    return sellerResponse({ links: links.map((link) => ({ ...link, url: sellerLinkUrl(env, request, link.code) })) });
  } catch (error) { return sellerFailure(error); }
};
