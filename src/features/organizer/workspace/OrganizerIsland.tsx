import React from 'react';
import type { WinnerResolution, PendingMilestone } from '../../../../types';
import NotchResults from '../../viewer/shell/NotchResults';
import { DigitFlow } from '../../../design/primitives';
import type { NotchModule } from '../../../design/primitives/ContextNotch';
import { BoardActionsIsland, type IslandDestination } from '../../../design/primitives/BoardActionsIsland';
import type { OrganizerLifecyclePhase } from '../lifecycle/organizerLifecycle';
import { buildOrganizerIslandSummary } from './organizerIslandModel';


interface OrganizerIslandAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface OrganizerIslandProps {
  boardTitle?: string;
  destinations?: IslandDestination[];
  filled: number;
  paid: number;
  drawn: boolean;
  phase: OrganizerLifecyclePhase;
  primary: OrganizerIslandAction | null;
  secondary?: OrganizerIslandAction[];
  note?: string;
  /** Retained for the homepage example; text summaries have no entry animation. */
  growOnEnter?: boolean;
  unpaid?: number;
  unknown?: number;
  saveStatus?: string;
  isShared?: boolean;
  isPublished?: boolean;
  activeTask?: 'board' | 'payments';
  liveSummary?: string;
  liveTrust?: string;
  pollingText?: string;
  isFinal?: boolean;
  winnerHistory?: WinnerResolution[];
  pendingMilestones?: PendingMilestone[];
  leftLabel?: string;
  topLabel?: string;
  shareActions?: OrganizerIslandAction[];
  hasBlocker?: boolean;
  onPayments?: () => void;
  onFindPerson?: () => void;
  onShowUnassigned?: () => void;
  onReviewIssue?: () => void;
  onGame?: () => void;
  onResults?: () => void;
  shareAction?: OrganizerIslandAction;
  disabled?: boolean;
}

/** Private adapter; readiness and issue priority remain in the existing model. */
export default function OrganizerIsland(props: OrganizerIslandProps) {
  const summary = buildOrganizerIslandSummary(props);
  const primary = summary.issue && props.onReviewIssue
    ? { label: 'Review issue', onClick: props.onReviewIssue }
    : props.primary;
  const boardActions = [
    { label: 'Find a person', onClick: props.onFindPerson },
    { label: 'Show unassigned', onClick: props.onShowUnassigned },
  ].filter((action): action is { label: string; onClick: () => void } => Boolean(action.onClick));
  const modules: NotchModule[] = props.isPublished ? [
    { id: 'game', label: 'Game', detail: <><p className="context-notch-score">{props.liveSummary || 'Waiting for score'}</p><p>{props.liveTrust}</p><p>{props.pollingText}</p></>, actions: props.onGame ? [{ label: 'View score authority', onClick: props.onGame }] : [] },
    { id: 'results', label: 'Results', reading: `${props.winnerHistory?.length || 0} published`, detail: <NotchResults winnerHistory={props.winnerHistory || []} pendingMilestones={props.pendingMilestones} leftLabel={props.leftLabel} topLabel={props.topLabel} />, actions: props.onResults && props.winnerHistory?.length ? [{ label: 'Correct a published result', onClick: props.onResults }] : [] },
  ] : [
    { id: 'board', label: 'Board', reading: `${props.filled}/100 assigned`, detail: <><p><DigitFlow value={props.filled} /> of 100 assigned</p><p>{props.phase}</p><p>{summary.saveLabel}</p>{props.note && <p>{props.note}</p>}</>, actions: boardActions },
    { id: 'payments', label: 'Payments', reading: 'Private', detail: <><p>{props.paid} paid</p><p>{summary.unpaid} unpaid</p><p>{summary.unknown} not asked yet</p><p>Payment notes are private. Counts are squares.</p></>, actions: props.onPayments ? [{ label: 'Open payments', onClick: props.onPayments }] : [] },
  ];
  modules.push({ id: 'share', label: 'Share', detail: <p>{props.isPublished ? 'Finalized viewer link' : props.isShared ? 'Shared selling board · game numbers stay private until finalized' : 'Private draft · sharing is off'}</p>, actions: [...(props.shareActions || []), ...(props.shareAction ? [props.shareAction] : [])] });
  return <BoardActionsIsland title={props.boardTitle} description={props.isPublished ? 'Published board tools and status' : `${props.filled} of 100 assigned${props.drawn ? ' · Numbers drawn' : ''}`} summary={summary.label} saveLabel={summary.saveLabel} issue={summary.issue} onReviewIssue={props.onReviewIssue} modules={modules} primary={primary} secondary={props.secondary} destinations={props.destinations} disabled={props.disabled} />;
}
