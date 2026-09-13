import React, { useEffect, useId, useRef } from 'react';
import { Glass } from './Glass';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: 'auto' | 'full';
  width?: 'default' | 'wide';
  /**
   * Stacking layer. `raised` puts the sheet above a `base` sheet that is already open,
   * regardless of DOM order — the viewer's Share sheet is mounted before the organizer
   * preview sheet but opens on top of it.
   */
  layer?: 'base' | 'raised';
  /** Opaque surface and sticky header for long, scrolling forms. */
  solidSurface?: boolean;
  /** Fixed actions outside the scrolling content. */
  footer?: React.ReactNode;
}

/** Bottom sheet dialog. Springs up from the bottom edge; Escape or backdrop closes it. */
export function Sheet({ open, onClose, title, children, height = 'auto', width = 'default', layer = 'base', solidSurface = false, footer }: SheetProps) {
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Capture the element that had focus before the sheet opened during render, not inside
  // an effect: React commits `autoFocus` on the sheet's own content before any effect
  // runs, so by the time an effect reads document.activeElement it's already the content,
  // not the trigger. Render runs first, while activeElement is still the trigger.
  if (open && openerRef.current === null && typeof document !== 'undefined') {
    openerRef.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const content = contentRef.current;
    const firstInContent = content?.querySelector<HTMLElement>('input, button, [href], textarea, select, [tabindex]:not([tabindex="-1"])');
    (firstInContent ?? panel)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open]);

  // Separate effect, declared after the one above, so its body runs only once `open` has
  // actually settled to false for a commit (not React 18 StrictMode's dev-only synthetic
  // mount->cleanup->mount replay, which never runs a body with `open: false` — it re-runs
  // the effect above with `open` still true). Clearing the ref here — after the restore
  // effect's cleanup has already run for this commit — lets the next real open recapture
  // a fresh trigger without disturbing the restore that just happened.
  useEffect(() => {
    if (!open) openerRef.current = null;
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>('input, button, [href], textarea, select, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const heightClass = height === 'full' ? 'h-[calc(100dvh-24px)]' : 'max-h-[85dvh]';
  const layerClass = layer === 'raised' ? 'z-[60]' : 'z-50';

  return (
    <div className={`fixed inset-0 ${layerClass} flex items-end justify-center`} onKeyDown={onKeyDown}>
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-ink/60 animate-[sheet-fade_var(--g-dur-state)_var(--g-ease-state)]"
        onClick={onClose}
      />
      <Glass
        as="div"
        padding="none"
        // Glass renders a div; cast the ref through the DOM node
        ref={panelRef as unknown as React.Ref<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={solidSurface ? { backgroundColor: 'var(--g-ground)' } : undefined}
        className={`relative w-full ${width === 'wide' ? 'max-w-6xl' : 'max-w-[640px]'} ${heightClass} ${footer ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'} rounded-b-none animate-[sheet-rise_var(--g-dur-spring)_var(--g-ease-state)] outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 shrink-0 flex items-center justify-between px-6 pt-2 pb-2 ${solidSurface ? 'bg-ground' : 'bg-transparent'}`}>
          <h2 id={titleId} className="font-ui text-[17px] font-medium text-fg">{title}</h2>
          <button type="button" onClick={onClose} className="font-ui text-[17px] text-fg-2 hover:text-fg rounded-capsule px-4 h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">Close</button>
        </div>
        <div ref={contentRef} className={`px-6 ${footer ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4' : 'pb-8'}`}>{children}</div>
        {footer && <div className="shrink-0 border-t border-hairline bg-ground px-6 py-3">{footer}</div>}
      </Glass>
    </div>
  );
}
