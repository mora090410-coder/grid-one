import { cleanBuyerName, readSellerBody, sellerAdmin, sellerFailure, sellerResponse, validClaimCells, validSellerCode, type SellerEnv } from '../../_lib/sellerLinks';

type Context = { request: Request; env: SellerEnv; params: { code?: string } };
const notFound = () => sellerResponse({ error: 'This seller link isn’t active. Ask the seller for a new one.' }, 404);

/** Public: anyone with the seller's link sees that seller's squares. No account. */
export const onRequestGet = async ({ env, params }: Context) => {
  const code = String(params.code ?? '');
  if (!validSellerCode(code)) return notFound();
  try {
    const { data, error } = await sellerAdmin(env).rpc('gridone_seller_link', { p_action: 'read', p_code: code });
    if (error) throw error;
    if (!data) throw new Error('seller_access_denied');
    return sellerResponse(data);
  } catch (error) { return sellerFailure(error); }
};

/** Public: claim unsold squares from this seller by name. One atomic database write; never retried. */
export const onRequestPost = async ({ request, env, params }: Context) => {
  const code = String(params.code ?? '');
  if (!validSellerCode(code)) return notFound();
  let body: Record<string, unknown> | null;
  try { body = await readSellerBody(request); } catch { body = null; }
  const name = cleanBuyerName(body?.name);
  if (!body || Object.keys(body).some((key) => !['cells', 'name'].includes(key)) || !validClaimCells(body.cells) || !name) {
    return sellerResponse({ error: 'Pick up to 10 squares and enter your name.' }, 400);
  }
  try {
    const { data, error } = await sellerAdmin(env).rpc('gridone_seller_link', { p_action: 'claim', p_code: code, p_cells: body.cells, p_name: name });
    if (error) throw error;
    if (!data) throw new Error('seller_access_denied');
    return sellerResponse(data);
  } catch (error) { return sellerFailure(error); }
};
