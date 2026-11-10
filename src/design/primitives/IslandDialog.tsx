import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './boardActions.css';
import { useLiquidMotion } from '../liquid/useLiquidMotion';
import { useReducedMotion } from './motion';

// Task handoffs may briefly overlap. One closing sheet must not unlock the page
// or steal focus from the next native modal.
let modalLocks = 0;
let savedOverflow = '';

/** Native top-layer modality supplies background inertness and focus containment.
 * Children stay mounted while closed: navigating never discards a form draft. */
export function IslandDialog({ open, onClose, title, id, children, wide = false, notch = false }: {
  open: boolean; onClose: () => void; title: string; id?: string;
  children: React.ReactNode; wide?: boolean; notch?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const animation = useRef<Animation | null>(null);
  const locked = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const exitRequested = useRef(false);
  const requestClose = () => { exitRequested.current = true; onClose(); };
  useLiquidMotion(dialog, open);
  const heading = useId();
  const release = () => {
    if (!locked.current) return;
    locked.current = false;
    if (--modalLocks === 0) document.body.style.overflow = savedOverflow;
  };
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    // Start from the currently rendered state when the user reverses direction.
    const current = getComputedStyle(node);
    const from = { opacity: current.opacity, transform: current.transform };
    animation.current?.cancel(); animation.current = null;
    const finishClose = () => {
      if (node.open) { if (node.close) node.close(); else node.open = false; }
      node.dataset.state = 'closed'; release();
      if (!document.querySelector('dialog[open]')) opener.current?.focus({ preventScroll: true });
      opener.current = null;
    };
    const phone = window.matchMedia?.(notch ? '(max-width: 639px)' : '(max-width: 699px)').matches;
    const closed = { opacity: phone ? 1 : 0, transform: phone ? 'translateY(100%)' : 'translateY(-6px) scale(.96)' };
    if (open) {
      exitRequested.current = false;
      const wasOpen = node.open;
      if (!wasOpen) opener.current = document.activeElement as HTMLElement;
      if (!locked.current) {
        if (modalLocks++ === 0) savedOverflow = document.body.style.overflow;
        locked.current = true; document.body.style.overflow = 'hidden';
      }
      // Anchor the desktop entrance to the labelled pill, without moving a task
      // outside the viewport on long pages or at enlarged text sizes.
      const island = opener.current?.closest('.g1-board-island')?.getBoundingClientRect();
      node.style.setProperty('--island-top', `${Math.min(Math.max(24, (island?.bottom ?? 84) + 12), window.innerHeight * .28)}px`);
      if (!node.open) { if (node.showModal) node.showModal(); else node.open = true; }
      node.dataset.state = 'open';
      node.querySelector<HTMLElement>('[data-dialog-close]')?.focus();
      if (!reduced && typeof node.animate === 'function') {
        const a = node.animate([wasOpen ? from : closed, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.2,1.04)', fill: 'both' });
        animation.current = a;
        void a.finished.then(() => { if (animation.current === a) { a.cancel(); animation.current = null; } }).catch(() => {});
      }
    } else if (node.open) {
      node.dataset.state = 'closing';
      if (!exitRequested.current || reduced || typeof node.animate !== 'function') { finishClose(); return; }
      const a = node.animate([from, closed], { duration: 280, easing: 'ease-in', fill: 'both' });
      animation.current = a;
      void a.finished.then(() => { if (animation.current === a) { finishClose(); a.cancel(); animation.current = null; } }).catch(() => {});
    }
  }, [open, reduced, notch]);
  useEffect(() => () => {
    animation.current?.cancel();
    const node = dialog.current;
    if (node?.open) { if (node.close) node.close(); else node.open = false; }
    release();
  }, []);
  return createPortal(<div data-g1-theme="liquid" className="g1-page g1-organizer-page">
    <dialog ref={dialog} id={id} aria-labelledby={heading} aria-modal="true" data-base="dark"
      className={`g1-task-dialog g1-sheen${wide ? ' g1-task-dialog--wide' : ''}${notch ? ' g1-task-dialog--notch' : ''}`}
      onCancel={event => { event.preventDefault(); requestClose(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); }
        if (notch && event.key === 'Tab') {
          const node = event.currentTarget;
          const controls = [...node.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')]
            .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0);
          if (!controls.length) { event.preventDefault(); return; }
          const active = document.activeElement;
          const current = controls.indexOf(active as HTMLElement);
          const step = event.shiftKey ? -1 : 1;
          // A summary section may hold programmatic focus (tabIndex -1). Its
          // next control is still determined by document order, not the header.
          const following = active && node.contains(active) && current < 0
            ? (event.shiftKey ? [...controls].reverse() : controls).find(el => Boolean(active.compareDocumentPosition(el) & (event.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING)))
            : null;
          const index = current >= 0 ? (current + step + controls.length) % controls.length : event.shiftKey ? controls.length - 1 : 0;
          const next = following ?? controls[index];
          event.preventDefault(); next.focus();
        }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) requestClose();
      }}>
      <header className="g1-task-dialog-header"><h2 id={heading}>{title}</h2><button type="button" data-dialog-close onClick={requestClose}>Close</button></header>
      <div className="g1-task-dialog-body">{children}</div>
    </dialog>
  </div>, document.body);
}
