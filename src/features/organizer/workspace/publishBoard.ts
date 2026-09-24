import { supabase } from '../../../../services/supabase';

export type PublishResult =
  | { published: true; shareCode: string; viewerUrl: string; revision: number; tier: string; used: number; allowance: number }
  | { published: false; upgradeTo: 'gameday' | 'org'; message: string };

/** The board moved past the revision the organizer published from. */
export class PublishRevisionConflictError extends Error {
  readonly code = 'REVISION_CONFLICT' as const;
  constructor(message: string, readonly currentRevision: number | null) {
    super(message);
    this.name = 'PublishRevisionConflictError';
  }
}

export const isPublishRevisionConflict = (error: unknown): error is PublishRevisionConflictError =>
  error instanceof PublishRevisionConflictError;

/**
 * Publishes a board's viewer link through the pool publish endpoint.
 * `revision` is the board revision the organizer last loaded or saved; the
 * server refuses to lock numbers when anything (a family, guest, or seller
 * link edit) moved the board past it.
 */
export async function publishBoard(poolId: string, options: { allowOpenSquares: boolean; revision: number }): Promise<PublishResult> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/pools/${poolId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(options.allowOpenSquares
      ? { revision: options.revision, allowOpenSquares: true }
      : { revision: options.revision }),
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 402 && (result.upgradeTo === 'gameday' || result.upgradeTo === 'org')) {
    return { published: false, upgradeTo: result.upgradeTo, message: result.error };
  }
  if (response.status === 409 && result.code === 'REVISION_CONFLICT') {
    throw new PublishRevisionConflictError(
      result.error || 'This board changed since you last loaded it. Reload to review the latest names before locking numbers.',
      Number.isInteger(result.currentRevision) ? result.currentRevision : null,
    );
  }
  if (!response.ok) throw new Error(result.error || 'The board could not be published.');

  return {
    published: true,
    shareCode: result.shareCode,
    viewerUrl: result.viewerUrl,
    revision: result.revision,
    tier: result.tier,
    used: result.used,
    allowance: result.allowance,
  };
}
