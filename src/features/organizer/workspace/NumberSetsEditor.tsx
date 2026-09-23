import React, { useState } from 'react';
import type { BoardData, GameState } from '../../../../types';
import { QUARTER_KEYS, QUARTER_LABELS, axisIssues, type QuarterAxisKey } from '../../../../utils/quarterAxes';
import { getAxisForQuarter } from '../../../../utils/winnerLogic';
import { CapsuleButton } from '../../../design/primitives';
import { photoOrientationResolved, resolvePhotoOrientation } from '../../../../utils/photoOrientation';

/**
 * How the game numbers work on this board: one set for the whole game, or
 * new numbers each quarter (like a paper board with 1st, 2nd, 3rd and Final
 * rows). Digit-by-digit editing only appears for boards read from a photo,
 * because those numbers were already written on paper.
 */
export default function NumberSetsEditor({ board, game, onChange, disabled = false, selected = 'Q1', onSelect, allowPhotoTranspose = false }: {
  board: BoardData; game: Pick<GameState, 'topAbbr' | 'leftAbbr'>;
  onChange?: (board: BoardData) => void; disabled?: boolean;
  selected?: QuarterAxisKey; onSelect?: (key: QuarterAxisKey) => void;
  allowPhotoTranspose?: boolean;
}) {
  const [localPeriod, setLocalPeriod] = useState<QuarterAxisKey>('Q1');
  const period = onSelect ? selected : localPeriod;
  const [requestedMode, setRequestedMode] = useState<boolean | null>(null);
  const fromPhoto = Boolean(board.scanReview);
  const setMode = (isDynamic: boolean) => {
    onChange?.({ ...board, isDynamic });
    setRequestedMode(null);
  };
  const modeLabel = (dynamic: boolean) => (dynamic ? 'New numbers each quarter' : 'One set for the whole game');

  return <section aria-label="Game numbers" className="flex min-w-0 flex-col gap-3 rounded-card border border-hairline bg-panel p-4">
    <h2 className="font-ui text-[17px] font-medium">Game numbers</h2>

    {fromPhoto && !photoOrientationResolved(board, game) && <fieldset disabled={disabled || !onChange} className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Which team is across the top of your photo?</legend>
      <p className="text-sm">The photo says top: {board.scanReview!.topTeamText || 'unreadable'}, side: {board.scanReview!.leftTeamText || 'unreadable'}.</p>
      <CapsuleButton variant="quiet" onClick={() => onChange?.(resolvePhotoOrientation(board, game))}>{game.topAbbr} is across the top</CapsuleButton>
      {allowPhotoTranspose && !board.scanReview!.orientation
        ? <CapsuleButton variant="quiet" onClick={() => onChange?.(resolvePhotoOrientation(board, game, true))}>{game.leftAbbr} is across the top (flip the board)</CapsuleButton>
        : <p className="text-sm">If the photo has {game.leftAbbr} across the top, import it again before saving.</p>}
    </fieldset>}

    {onChange ? <fieldset disabled={disabled} className="flex flex-col gap-1">
      <legend className="text-sm text-fg-2">How numbers work</legend>
      {[false, true].map(mode => <label key={String(mode)} className="flex min-h-11 items-center gap-2 text-sm">
        <input type="radio" name="number-mode" checked={Boolean(board.isDynamic) === mode} onChange={() => {
          const hasDigits = [board.topAxis, board.leftAxis, ...QUARTER_KEYS.flatMap(key => [board.topAxisByQuarter?.[key], board.leftAxisByQuarter?.[key]])].some(axis => axis?.some(digit => digit !== null));
          if (hasDigits) setRequestedMode(mode); else setMode(mode);
        }} />{modeLabel(mode)}
      </label>)}
    </fieldset> : <p className="text-sm">{modeLabel(Boolean(board.isDynamic))} · locked</p>}

    {requestedMode !== null && <div role="group" aria-label="Change how numbers work" className="flex flex-col gap-2">
      <p className="text-sm">Switch to {modeLabel(requestedMode).toLowerCase()}? Numbers you already have stay saved. Nothing is redrawn.</p>
      <div className="flex flex-wrap gap-2"><CapsuleButton variant="quiet" onClick={() => setRequestedMode(null)}>Keep it</CapsuleButton><CapsuleButton disabled={disabled} onClick={() => setMode(requestedMode)}>Switch</CapsuleButton></div>
    </div>}

    {board.isDynamic && <>
      <div role="group" aria-label="Quarter numbers" className="flex flex-wrap gap-2">
        {QUARTER_KEYS.map(key => <CapsuleButton key={key} variant="quiet" aria-pressed={key === period} onClick={() => onSelect ? onSelect(key) : setLocalPeriod(key)}>{QUARTER_LABELS[key]}</CapsuleButton>)}
      </div>
      <p className="text-sm text-fg-2">Showing {QUARTER_LABELS[period]} numbers. Names stay in the same squares. Final includes overtime.</p>
    </>}

    {fromPhoto && (['top', 'left'] as const).map(side => {
      const axis = getAxisForQuarter(board, side, period);
      const issue = axisIssues(axis);
      const label = side === 'top' ? `${game.topAbbr} across the top, left to right` : `${game.leftAbbr} down the side, top to bottom`;
      const issueId = `axis-issue-${side}`;
      return <fieldset key={side} disabled={disabled || !onChange} className="min-w-0">
        <legend className="text-sm text-fg-2">{label}</legend>
        <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">{Array.from({ length: 10 }, (_, i) => <label key={i} className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-fg-3">{i + 1}</span>
          <input aria-label={`${board.isDynamic ? QUARTER_LABELS[period] + ' ' : ''}${side === 'top' ? 'Top' : 'Side'} digit ${i + 1}`} aria-invalid={!issue.valid} aria-describedby={!issue.valid ? issueId : undefined} inputMode="numeric" maxLength={1} value={axis[i] ?? ''} className="min-h-11 w-full min-w-0 rounded-control border border-hairline bg-ground text-center font-mono text-fg" onChange={event => {
            const value = event.target.value;
            if (!/^\d?$/.test(value)) return;
            const next = Array.from({ length: 10 }, (_, index) => index === i ? (value === '' ? null : Number(value)) : axis[index] ?? null);
            onChange?.(board.isDynamic ? { ...board, [side === 'top' ? 'topAxisByQuarter' : 'leftAxisByQuarter']: { ...(side === 'top' ? board.topAxisByQuarter : board.leftAxisByQuarter), [period]: next } } : { ...board, [side === 'top' ? 'topAxis' : 'leftAxis']: next });
          }} />
        </label>)}</div>
        {!issue.valid && <p id={issueId} className="mt-2 text-sm text-fg-2">{issue.duplicates.length > 0 ? `Used twice: ${issue.duplicates.join(', ')}. ` : ''}{issue.missing.length > 0 ? `Missing: ${issue.missing.join(', ')}. ` : ''}{issue.unknown.length > 0 ? `Blank: box ${issue.unknown.map(i => i + 1).join(', ')}. ` : ''}Fix before locking the numbers.</p>}
      </fieldset>;
    })}

    {fromPhoto && board.isDynamic && <ul aria-label="Quarter number checks" className="text-sm text-fg-2">{QUARTER_KEYS.map(key => <li key={key}>{QUARTER_LABELS[key]}: {axisIssues(board.topAxisByQuarter?.[key]).valid && axisIssues(board.leftAxisByQuarter?.[key]).valid ? 'ready' : 'needs a fix'}</li>)}</ul>}
    {fromPhoto && <details className="text-sm text-fg-2"><summary className="min-h-11 cursor-pointer">What the photo said</summary><pre className="whitespace-pre-wrap break-all">{board.scanReview!.literalAxes}</pre></details>}
  </section>;
}
