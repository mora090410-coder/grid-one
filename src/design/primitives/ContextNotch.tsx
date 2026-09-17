import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { springTo } from './notchMotion';
import { useNotchGeometry } from './useNotchGeometry';
import './contextNotch.css';

export interface NotchAction { label: string; onClick: () => void; disabled?: boolean }
export interface NotchModule {
  id: string;
  label: string;
  reading?: React.ReactNode;
  medallion?: React.ReactNode;
  detail: React.ReactNode;
  actions?: NotchAction[];
}
interface ContextNotchProps {
  label: string;
  summary: React.ReactNode;
  modules: NotchModule[];
  primary?: NotchAction | null;
  secondary?: NotchAction[];
  disabled?: boolean;
  requested?: boolean;
  placement?: 'fixed' | 'strip';
}
type Mode = 'collapsed' | 'preview' | 'open' | 'pinned';

/** One physical, nonmodal surface. Public/private contents are supplied by separate adapters. */
export function ContextNotch({ label, summary, modules, primary, secondary, disabled, requested = true, placement = 'strip' }: ContextNotchProps) {
  const [mode, setMode] = useState<Mode>('collapsed');
  const [selected, setSelected] = useState(modules[0].id);
  const [focused, setFocused] = useState(false);
  const [returnLease, setReturnLease] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const contents = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdX = useRef(0);
  const holdY = useRef(0);
  const suppressClick = useRef(false);
  const id = useId();
  const open = mode !== 'collapsed';
  const active = modules.find(module => module.id === selected) ?? modules[0];
  const present = requested || open || focused || returnLease;
  useNotchGeometry(root, open, present, active.id);
  const close = () => { setMode('collapsed'); };
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => cancelHold, []);
  const fineHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

  useEffect(() => {
    const outside = (event: Event) => {
      if (!(event.target instanceof Node) || root.current?.contains(event.target)) return;
      if (mode !== 'pinned') close();
    };
    const focus = (event: FocusEvent) => {
      const inside = event.target instanceof Node && Boolean(root.current?.contains(event.target));
      setFocused(inside);
      // StrictMode replays a newly mounted Sheet's effect: its temporary cleanup
      // focuses the opener while the dialog still exists. Do not retire that lease.
      if (inside && !document.querySelector('[role="dialog"][aria-modal="true"]')) setReturnLease(false);
      else if (!inside) {
        if (!(event.target instanceof Element && event.target.closest('[role="dialog"]'))) setReturnLease(false);
        outside(event);
        // A pinned nonmodal surface must not hide the next focused page control.
        const target = event.target;
        if (target instanceof HTMLElement && !target.closest('[role="dialog"]')) requestAnimationFrame(() => {
          const surface = root.current?.querySelector('.context-notch')?.getBoundingClientRect();
          const box = target.getBoundingClientRect();
          if (surface && box.bottom > 0 && box.top < surface.bottom && box.right > surface.left && box.left < surface.right) {
            window.scrollBy({ top: box.top - surface.bottom - 16, behavior: 'instant' });
          }
        });
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !open || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      close();
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', escape);
    };
  }, [mode, open]);

  useLayoutEffect(() => {
    if (!open || !contents.current) return;
    const animations = Array.from(contents.current.querySelectorAll<HTMLElement>('[data-notch-cell]')).map((cell, index) =>
      springTo(cell, 'contents', progress => ({ opacity: Math.min(1, progress), transform: `translateY(${(1 - progress) * -28}px)` }), Math.min(index * 45, 180)));
    return () => animations.forEach(animation => animation?.cancel());
  }, [open]);


  const invoke = (action: NotchAction) => {
    if (disabled || action.disabled) return;
    trigger.current?.focus({ preventScroll: true });
    flushSync(() => { setReturnLease(true); close(); });
    flushSync(() => action.onClick());
    // A synchronous sheet captures the trigger; navigation instead moves focus.
    queueMicrotask(() => {
      if (!document.querySelector('[role="dialog"][aria-modal="true"]')) setReturnLease(false);
    });
  };
  const actionButton = (action: NotchAction, primaryAction = false) => <button key={action.label} type="button" className={primaryAction ? 'context-notch-primary' : ''} disabled={disabled || action.disabled} onClick={() => invoke(action)}>{action.label}</button>;

  return <section ref={root} hidden={!present} className={`context-notch-host context-notch-${placement}`} aria-label={label}
    onMouseEnter={() => { if (fineHover() && mode === 'collapsed' && !disabled) setMode('preview'); }}
    onMouseLeave={() => { cancelHold(); if (mode === 'preview' && !root.current?.contains(document.activeElement)) close(); }}>
    <span className="context-notch-measure" data-notch-measure="expanded" aria-hidden="true" />
    <span className="context-notch-measure" data-notch-measure="compact" aria-hidden="true" />
    <div className={`context-notch${placement === 'strip' ? ' organizer-island' : ''}`} data-base="dark" data-open={open} data-mode={mode}>
      <button ref={trigger} type="button" className="context-notch-toggle" aria-label={label} aria-describedby={`${id}-summary`} aria-expanded={open} aria-controls={id} disabled={disabled}
        onPointerDown={event => {
          cancelHold(); suppressClick.current = false;
          if (event.pointerType !== 'touch' || open || disabled) return;
          holdX.current = event.clientX; holdY.current = event.clientY;
          hold.current = setTimeout(() => { suppressClick.current = true; setMode('open'); }, 450);
        }}
        onPointerMove={event => { if (Math.hypot(event.clientX - holdX.current, event.clientY - holdY.current) > 10) cancelHold(); }}
        onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          setMode(mode === 'preview' ? 'pinned' : open ? 'collapsed' : 'open');
        }}>
        <span id={`${id}-summary`} className="context-notch-summary">{summary}</span><span aria-hidden="true">⌄</span>
      </button>
      <div className="context-notch-reveal" inert={!open} aria-hidden={!open}>
        {present && <div ref={contents} id={id} className="context-notch-contents">
          <div className="context-notch-rail" aria-label="Board companion modules">
            {modules.map(module => <button data-notch-cell key={module.id} type="button" aria-label={module.label} aria-pressed={active.id === module.id} aria-controls={`${id}-detail`} onClick={() => setSelected(module.id)}>
              <span className="context-notch-medallion" aria-hidden="true">{module.medallion ?? <NotchIcon id={module.id} />}</span>
              <span className="context-notch-cell-label">{module.label}</span>{module.reading && <span className="context-notch-reading">{module.reading}</span>}
            </button>)}
          </div>
          <div className="context-notch-detail-track">
            <span className="context-notch-connector" aria-hidden="true" />
            <div id={`${id}-detail`} role="region" aria-label={`${active.label} details`} className="context-notch-detail">
              <div className="context-notch-detail-body">
                {active.detail}
                <div className="context-notch-actions">{active.actions?.map(action => actionButton(action))}</div>
              </div>
            </div>
          </div>
          {primary && actionButton(primary, true)}
          {secondary?.map(action => actionButton(action))}
          <div className="context-notch-controls" data-notch-cell>
            <button type="button" aria-pressed={mode === 'pinned'} onClick={() => setMode(mode === 'pinned' ? 'open' : 'pinned')}>{mode === 'pinned' ? 'Unpin' : 'Keep open'}</button>
            <button type="button" onClick={() => { close(); trigger.current?.focus({ preventScroll: true }); }}>Close</button>
          </div>
        </div>}
      </div>
    </div>
  </section>;
}

/** Original, deliberately simple symbols; no third-party provider assets. */
function NotchIcon({ id }: { id: string }) {
  const paths: Record<string, React.ReactNode> = {
    game: <><rect x="3" y="5" width="26" height="21" rx="3" /><path d="M3 11h26M16 11v15M7 16h5v5H7zM20 16h5v5h-5zM11 3v4M21 3v4" /></>,
    results: <path d="M10 5h12v8a6 6 0 0 1-12 0V5ZM10 7H5v4a5 5 0 0 0 6 5M22 7h5v4a5 5 0 0 1-6 5M16 19v7M10 27h12" />,
    payments: <><rect x="3" y="6" width="26" height="20" rx="3" /><path d="M3 12h26M7 20h6M22 18v5M19.5 20.5h5" /></>,
    share: <path d="M16 21V3M10 9l6-6 6 6M9 16H5v12h22V16h-4" />,
  };
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id] ?? <><rect x="4" y="4" width="24" height="24" rx="2" /><path d="M12 4v24M20 4v24M4 12h24M4 20h24" /></>}</svg>;
}

/** A measured assignment fraction, never payment completion or win probability. */
export function AssignmentRing({ assigned }: { assigned: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const value = Math.min(100, Math.max(0, assigned));
  const previous = useRef(value);
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (!arc.current || from === value) return;
    const animation = springTo(arc.current, 'reading', progress => ({ strokeDashoffset: `${100 - (from + (value - from) * progress)}` }));
    return () => animation?.cancel();
  }, [value]);
  return <svg className="context-notch-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100" /><circle ref={arc} cx="20" cy="20" r="16" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - value} /></svg>;
}
