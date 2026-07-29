type SupabaseAdmin = any;

export const PUBLIC_BOARD_STATUSES = ['published', 'live', 'final', 'archived'] as const;
export const PUBLIC_BOARD_NOT_FOUND = {
  error: 'This board is unavailable or has not been published.',
} as const;

const PUBLIC_BOARD_NOT_FOUND_TEXT = JSON.stringify(PUBLIC_BOARD_NOT_FOUND);
const SHARE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

interface PublicBoardProjection {
  snapshot: string;
  contest: string;
}

export interface VisiblePublicBoard {
  snapshot: Record<string, any>;
  contest: Record<string, any>;
}

export const findVisiblePublicBoard = async (
  admin: SupabaseAdmin,
  rawShareCode: string,
  projection: PublicBoardProjection,
): Promise<VisiblePublicBoard | null> => {
  const shareCode = rawShareCode.toUpperCase();
  if (!SHARE_CODE_PATTERN.test(shareCode)) return null;

  const { data, error } = await admin
    .from('public_board_snapshots')
    .select(`${projection.snapshot}, contest:contests!inner(${projection.contest})`)
    .eq('share_code', shareCode)
    .is('withdrawn_at', null)
    .in('contest.status', [...PUBLIC_BOARD_STATUSES])
    .maybeSingle();
  if (error) throw error;

  const contest = Array.isArray(data?.contest) ? data.contest[0] : data?.contest;
  if (!data || !contest) return null;
  const { contest: _joinedContest, ...snapshot } = data;
  return { snapshot, contest };
};

export const publicBoardNotFoundResponse = (headers?: HeadersInit) => {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has('Content-Type')) responseHeaders.set('Content-Type', 'application/json');
  if (!responseHeaders.has('Cache-Control')) responseHeaders.set('Cache-Control', 'no-store');
  return new Response(PUBLIC_BOARD_NOT_FOUND_TEXT, {
    status: 404,
    headers: responseHeaders,
  });
};
