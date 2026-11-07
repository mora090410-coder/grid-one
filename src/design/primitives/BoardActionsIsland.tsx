import React, { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IslandDialog } from './IslandDialog';
import { useReducedMotion } from './motion';
import type { NotchAction, NotchModule } from './ContextNotch';

export interface IslandDestination extends NotchAction { id: string; detail?: string }

/** The organizer's deliberate, labelled control. Viewer companion behavior stays separate. */
export function BoardActionsIsland({ summary, description, saveLabel, issue, title, modules, primary, secondary, destinations = [], disabled, onReviewIssue }: {
  description?: string;
  summary: React.ReactNode; saveLabel: string; issue: boolean; title?: string;
  modules: NotchModule[]; primary?: NotchAction | null; secondary?: NotchAction[];
  destinations?: IslandDestination[]; disabled?: boolean; onReviewIssue?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const label = primary?.label || '';
  const [visibleLabel, setVisibleLabel] = useState(label);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (reduced || !label) { setVisibleLabel(label); setLeaving(false); return; }
    if (label === visibleLabel) { setLeaving(false); return; }
    setLeaving(true);
    const timer = setTimeout(() => { setVisibleLabel(label); setLeaving(false); }, 200);
    return () => clearTimeout(timer);
  }, [label, reduced, visibleLabel]);
  const [selected, setSelected] = useState(modules[0].id);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const active = modules.find(module => module.id === selected) ?? modules[0];
  const invoke = (action: NotchAction) => {
    if (disabled || action.disabled) return;
    flushSync(() => setOpen(false));
    trigger.current?.focus({ preventScroll: true });
    action.onClick();
  };
  return <section className="g1-board-island-host" aria-label="Organizer status">
    <div className="g1-board-island">
      <div className="g1-board-island-reading" aria-hidden="true"><strong title={title}>{title || 'Your board'}</strong><span>{summary}</span></div>
      <span className="g1-save-state" data-issue={issue} role="status" aria-live="polite" aria-atomic="true">{issue ? '⚠ ' : '● '}{saveLabel}</span>
      <span className="sr-only" id={`${id}-description`}>{description || 'Board tools and status'}{issue ? `. ${saveLabel}` : ''}</span>
      <button ref={trigger} type="button" className="g1-board-island-trigger" aria-describedby={`${id}-description`} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" disabled={disabled} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}>Board actions <span aria-hidden="true">⌄</span></button>
    </div>
    {issue && onReviewIssue && <button type="button" className="g1-island-error" disabled={disabled} onClick={onReviewIssue}>⚠ {saveLabel} · Review and recover</button>}
    {primary && <button type="button" className="g1-next-step" aria-label={`Next: ${primary.label}`} disabled={disabled || primary.disabled || leaving} onClick={() => invoke(primary)}><span>Next</span><strong className="g1-next-label" data-leaving={leaving ? 'true' : undefined} aria-hidden="true">{reduced ? label : visibleLabel}</strong><span aria-hidden="true">→</span></button>}
    <IslandDialog open={open} onClose={() => setOpen(false)} title={title ? `${title} · Board actions` : 'Board actions'} id={id}>
      <div className="g1-island-context"><p>{summary}</p><p>{saveLabel}</p></div>
      <div className="g1-island-tiles" aria-label="Board tasks">
        {primary && <button type="button" className="g1-island-next" aria-label={primary.label} disabled={disabled || primary.disabled} onClick={() => invoke(primary)}><small>Next step</small><strong>{primary.label}</strong></button>}
        {modules.map(module => <button key={module.id} type="button" disabled={disabled} aria-label={module.label} aria-pressed={active.id === module.id} aria-controls={`${id}-detail`} onClick={() => setSelected(module.id)}><strong>{module.label}</strong>{module.reading && <small>{module.reading}</small>}</button>)}
        {destinations.filter(action => action.label !== primary?.label).map(action => <button key={action.id} type="button" aria-label={action.label} aria-description={action.detail} disabled={disabled || action.disabled} onClick={() => invoke(action)}><strong>{action.label}</strong>{action.detail && <small>{action.detail}</small>}</button>)}
      </div>
      <section className="g1-island-detail" id={`${id}-detail`} aria-label={`${active.label} details`}>
        {active.detail}
        <div className="g1-island-detail-actions">{active.actions?.map(action => <button type="button" key={action.label} disabled={disabled || action.disabled} onClick={() => invoke(action)}>{action.label}</button>)}</div>
      </section>
      {secondary?.map(action => <button type="button" className="g1-island-secondary" key={action.label} disabled={disabled || action.disabled} onClick={() => invoke(action)}>{action.label}</button>)}
    </IslandDialog>
  </section>;
}
