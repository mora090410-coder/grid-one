import { useEffect, useState } from 'react';
import type { GameState, PayoutDescriptions } from '../../../../types';
import type { PayoutRulesStatus } from './PayoutRulesCard';

const PAYOUT_FAILED = 'Prize notes were not saved. Try again.';

interface PayoutDraftInput {
  activePoolId: string | null;
  saved: PayoutDescriptions | undefined;
  /** Serializes the save with the board autosave (same revision chain). */
  saveExternalGame: (save: () => Promise<Partial<GameState>>) => Promise<void>;
  onSavePayoutDescriptions: (descriptions: PayoutDescriptions) => Promise<PayoutDescriptions>;
  onNote: (note: string | null) => void;
  onAlert: (alert: string | null) => void;
}

/**
 * The prize-notes form. Edits stay local (and guard page unload) until the
 * organizer saves; publishing and sharing save a pending draft first.
 */
export function usePayoutDraft({ activePoolId, saved, saveExternalGame, onSavePayoutDescriptions, onNote, onAlert }: PayoutDraftInput) {
  const [status, setStatus] = useState<PayoutRulesStatus>('idle');
  const [draft, setDraft] = useState<PayoutDescriptions | null>(null);

  useEffect(() => {
    if (draft === null) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [draft]);

  const update = (field: keyof PayoutDescriptions, value: string) => {
    setStatus('dirty');
    setDraft((current) => ({ ...(current ?? saved), [field]: value }));
  };

  /** Resolves true once saved; false when there is nothing to save to or it failed. */
  const save = async (): Promise<boolean> => {
    if (!activePoolId || status === 'saving') return false;
    setStatus('saving');
    try {
      await saveExternalGame(async () => ({
        payoutDescriptions: await onSavePayoutDescriptions(draft ?? saved ?? {}),
      }));
      setDraft(null);
      setStatus('saved');
      onNote(null);
      onAlert(null);
      return true;
    } catch {
      setStatus('error');
      onAlert(PAYOUT_FAILED);
      return false;
    }
  };

  /** Save first when there are unsaved prize notes; true when it is safe to continue. */
  const saveIfPending = async () => draft === null || save();

  return {
    descriptions: draft ?? saved ?? {},
    status,
    pending: draft !== null,
    update,
    save,
    saveIfPending,
  };
}
