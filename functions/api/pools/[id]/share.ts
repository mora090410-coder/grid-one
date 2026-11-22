import { adminClient, isUuid, maskedError, readJsonObject, requireUser, type PagesFunction } from '../../../_lib/http';

const MAX_LIFECYCLE_BODY_BYTES = 4096;
const SHARE_FAILED = 'The board could not be shared. Please try again.';

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Board sharing is not configured.' }, { status: 503 });
    const user = await requireUser(request, env, { missing: 'Sign in before sharing.', expired: 'Your session has expired.' });
    if (user instanceof Response) return user;
    if (!user.email || !user.email_confirmed_at) {
      return Response.json({ error: 'Verify your email before sharing your board.' }, { status: 403 });
    }
    const body = await readJsonObject(request, MAX_LIFECYCLE_BODY_BYTES);
    if (body instanceof Response && body.status === 413) return body;
    const revision = body instanceof Response ? undefined : body.revision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
      return Response.json({ error: 'A current board revision is required.' }, { status: 409 });
    }
    const id = String(params.id || '');
    if (!isUuid(id)) {
      return Response.json({ error: 'Invalid board ID.' }, { status: 400 });
    }
    const { data, error } = await adminClient(env).rpc('gridone_share_free_board', {
      p_contest_id: id,
      p_owner_id: user.id,
      p_expected_revision: revision,
    });
    if (error) {
      const message = error.message || 'The board could not be shared.';
      const validationError = /^(Only a board|Link a scheduled|The board must|Legacy dynamic|Every square|Public allocation)/i.test(message);
      if (validationError) return Response.json({ error: message }, { status: 409 });
      return maskedError('Share RPC failed', error, SHARE_FAILED);
    }
    const shared = Array.isArray(data) ? data[0] : data;
    if (!shared) return Response.json({
      error: 'This board changed before sharing. Reload and try again.', code: 'REVISION_CONFLICT',
    }, { status: 409 });
    return Response.json({
      shared: true,
      sharedAt: shared.shared_at,
      shareCode: shared.share_code,
      viewerUrl: `/b/${shared.share_code}`,
      revision: shared.next_revision,
    });
  } catch (error) {
    return maskedError('Share failed', error, SHARE_FAILED);
  }
};
