import React from 'react';
import { Sheet, CapsuleButton, CapsuleTag } from '../../../design/primitives';
import type { BoardData, GameState } from '../../../../types';
import { QUARTER_KEYS, QUARTER_LABELS } from '../../../../utils/quarterAxes';
import { getAxisForQuarter } from '../../../../utils/winnerLogic';

export interface PublishSheetProps {
  open: boolean;
  isShared?: boolean;
  onClose: () => void;
  game: GameState;
  board: BoardData;
  allowance?: { tier: string; used: number; allowance: number } | null;
  pending: boolean;
  error: string | null;
  disabled: boolean;
  onPublish: () => void;
}

const TIER_LABEL: Record<string, string> = {
  gameday: 'Game Day',
  org: 'Organization',
  free: 'Free',
};

const tierLabel = (tier: string) => TIER_LABEL[tier] ?? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;

const formatKickoff = (game: GameState): string => {
  if (game.kickoffAt) {
    const parsed = new Date(game.kickoffAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  return game.dates || 'Kickoff not set';
};

/** Confirmation summary shown before a board's viewer link goes live. */
export default function PublishSheet({ open, isShared = false, onClose, game, board, allowance, pending, error, disabled, onPublish }: PublishSheetProps) {
  const assigned = board.squares.filter((s) => s.length).length;
  const open_ = 100 - assigned;

  return (
    <Sheet open={open} onClose={onClose} title={isShared ? 'Lock game numbers' : 'Publish viewer link'}>
      <div className="flex flex-col gap-5">
        <CapsuleButton type="button" variant="quiet" disabled={pending} onClick={onClose} className="self-start">
          Cancel
        </CapsuleButton>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-ui text-[15px] text-fg">
          <dt className="text-fg-3">Board name</dt>
          <dd>{game.title}</dd>
          <dt className="text-fg-3">Matchup</dt>
          <dd>{game.leftAbbr} at {game.topAbbr}</dd>
          <dt className="text-fg-3">Kickoff</dt>
          <dd>{formatKickoff(game)}</dd>
          <dt className="text-fg-3">Squares</dt>
          <dd>{assigned} assigned · {open_} OPEN</dd>
          {(board.isDynamic ? QUARTER_KEYS : ['Q1'] as const).map(key => <React.Fragment key={key}>
            <dt className="text-fg-3">{board.isDynamic ? QUARTER_LABELS[key] + ' · ' : ''}Top axis</dt>
            <dd className="min-w-0 break-words font-mono">{getAxisForQuarter(board, 'top', key).map(n => n ?? '—').join(' ')}</dd>
            <dt className="text-fg-3">{board.isDynamic ? QUARTER_LABELS[key] + ' · ' : ''}Side axis</dt>
            <dd className="min-w-0 break-words font-mono">{getAxisForQuarter(board, 'left', key).map(n => n ?? '—').join(' ')}</dd>
          </React.Fragment>)}
        </dl>

        {open_ > 0 && (
          <p className="font-ui text-[14px] text-fg-2">Open squares stay OPEN on the shared board.</p>
        )}

        <div className="flex flex-col gap-1">
          <h3 className="font-ui text-[14px] font-medium text-fg">What becomes public</h3>
          <p className="font-ui text-[14px] text-fg-2">Board name, matchup, axis digits, buyer names, public family allocations, OPEN squares, payout/rules descriptions, and correction history.</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-ui text-[14px] font-medium text-fg">What remains private</h3>
          <p className="font-ui text-[14px] text-fg-2">Payment status, seller attribution, contact details, and organizer notes.</p>
        </div>

        {isShared && <p className="font-ui text-[14px] text-fg-2">Your existing link will show the final numbers. Numbers and family allocations lock; later buyer corrections are recorded publicly. This uses no additional board from your season allowance.</p>}
        {allowance && (
          <CapsuleTag>{allowance.used} of {allowance.allowance} published this season · {tierLabel(allowance.tier)}</CapsuleTag>
        )}

        {error && (
          <p role="alert" className="font-ui text-[14px] text-tone-cardinal">{error}</p>
        )}

        <div className="flex justify-end">
          <CapsuleButton type="button" disabled={disabled || pending} aria-busy={pending} onClick={onPublish}>
            {pending ? (isShared ? 'Locking…' : 'Publishing…') : (isShared ? 'Lock game numbers' : 'Publish viewer link')}
          </CapsuleButton>
        </div>
      </div>
    </Sheet>
  );
}
