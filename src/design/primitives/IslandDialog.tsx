import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './boardActions.css';
import { useLiquidMotion } from '../liquid/useLiquidMotion';

/** Native top-layer modality supplies background inertness and focus containment.
 * Children stay mounted while closed: navigating never discards a form draft. */
export function IslandDialog({ open, onClose, title, id, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; id?: string;
  children: React.ReactNode; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLiquidMotion(dialog, open);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useId();
  if (open && !opener.current && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!open) { if (node.open) { if (node.close) node.close(); else node.open = false; } opener.current = null; return; }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!node.open) { if (node.showModal) node.showModal(); else node.open = true; }
    node.querySelector<HTMLElement>('[data-dialog-close]')?.focus();
    return () => {
      if (node.open) { if (node.close) node.close(); else node.open = false; }
      document.body.style.overflow = overflow;
      opener.current?.focus({ preventScroll: true });
    };
  }, [open]);
  return createPortal(<div data-g1-theme="liquid" className="g1-page g1-organizer-page">
    <dialog ref={dialog} id={id} aria-labelledby={heading} aria-modal={open ? true : undefined} data-base="dark"
      className={`g1-task-dialog${wide ? ' g1-task-dialog--wide' : ''}`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose();
      }}>
      <header className="g1-task-dialog-header"><h2 id={heading}>{title}</h2><button type="button" data-dialog-close onClick={onClose}>Close</button></header>
      <div className="g1-task-dialog-body">{children}</div>
    </dialog>
  </div>, document.body);
}
