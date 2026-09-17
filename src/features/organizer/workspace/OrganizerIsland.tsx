import React from 'react';
import { ContextNotch, AssignmentRing, type NotchModule } from '../../../design/primitives/ContextNotch';
import type { OrganizerLifecyclePhase } from '../lifecycle/organizerLifecycle';
import { buildOrganizerIslandSummary } from './organizerIslandModel';


interface OrganizerIslandAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface OrganizerIslandProps {
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
    { id: 'game', label: 'Game', detail: <><p>{props.liveSummary || 'Waiting for score'}</p><p>{props.liveTrust}</p><p>{props.pollingText}</p></>, actions: props.onGame ? [{ label: 'View score authority', onClick: props.onGame }] : [] },
    { id: 'results', label: 'Results', detail: <p>{props.isFinal ? 'Final record and published corrections' : 'Published results and corrections'}</p>, actions: props.onResults ? [{ label: 'View results', onClick: props.onResults }] : [] },
  ] : [
    { id: 'board', label: 'Board', medallion: <><AssignmentRing assigned={props.filled} /><span className="context-notch-count">{props.filled}</span></>, reading: `${props.filled}/100 assigned`, detail: <><p>{props.filled} of 100 assigned</p><p>{props.phase}</p><p>{summary.saveLabel}</p>{props.note && <p>{props.note}</p>}</>, actions: boardActions },
    { id: 'payments', label: 'Payments', reading: 'Private', detail: <><p>{props.paid} paid</p><p>{summary.unpaid} unpaid</p><p>{summary.unknown} not asked yet</p><p>Payment notes are private. Counts are squares.</p></>, actions: props.onPayments ? [{ label: 'Open payments', onClick: props.onPayments }] : [] },
  ];
  modules.push({ id: 'share', label: 'Share', detail: <p>{props.isPublished ? 'Finalized viewer link' : props.isShared ? 'Shared selling board · game numbers stay private until finalized' : 'Private draft · sharing is off'}</p>, actions: props.shareAction ? [props.shareAction] : [] });
  return <ContextNotch label="Organizer status" summary={<span role="status" aria-live="polite" aria-atomic="true"><span className="block">{summary.label}</span><span className="block">{summary.detail}</span></span>} modules={modules} primary={primary} secondary={props.secondary} disabled={props.disabled} />;
}
