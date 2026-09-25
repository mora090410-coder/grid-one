import React, { useCallback, useId, useRef, useState } from 'react';
import { Ring, type RingProps } from './Ring';

interface IslandProps {
  label: string;
  collapsed: React.ReactNode;
  expanded: React.ReactNode;
  placement?: 'top' | 'corner';
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PLACEMENT = {
  top: 'fixed top-3 left-1/2 -translate-x-1/2',
  corner: 'fixed bottom-6 right-6',
} as const;

/**
 * Expandable capsule that hugs the screen edge. Collapsed shows rings or a score;
 * expanded shows full state and exactly one primary action. Tap toggles, hover opens on pointer devices.
 */
export function Island({ label, collapsed, expanded, placement = 'top', defaultOpen = false, open, onOpenChange }: IslandProps) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlled ? open : internalOpen;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const openedByHover = useRef(false);
  const regionId = useId();

  const hoverCapable = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const setOpen = useCallback((next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      openedByHover.current = false;
      setOpen(false);
      toggleRef.current?.focus();
    }
  };

  return (
    <section
      aria-label={label}
      className={`${PLACEMENT[placement]} z-40 max-w-[calc(100vw-24px)]`}
      onKeyDown={onKeyDown}
      onMouseEnter={() => {
        if (hoverCapable() && !controlled && !isOpen) {
          openedByHover.current = true;
          setOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (hoverCapable() && !controlled && openedByHover.current) {
          openedByHover.current = false;
          setOpen(false);
        }
      }}
    >
      <div
        className="bg-chyron text-broadcast-white rounded-capsule shadow-[var(--g-shadow)] border border-white/10 overflow-hidden transition-[border-radius] duration-[var(--g-dur-spring)] ease-[var(--g-ease-state)]"
        style={{ borderRadius: isOpen ? 'var(--g-radius-card)' : 'var(--g-radius-capsule)' }}
        data-base="dark"
      >
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={isOpen}
          aria-controls={regionId}
          onClick={() => { openedByHover.current = false; setOpen(!isOpen); }}
          className="flex items-center gap-4 h-14 px-5 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-white focus-visible:ring-inset"
        >
          <span className="sr-only">{label}</span>
          {collapsed}
        </button>
        {isOpen ? (
          <div
            id={regionId}
            className="px-5 pb-5 pt-1 animate-[sheet-rise_var(--g-dur-spring)_var(--g-ease-state)]"
          >
            {expanded}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface IslandRingsProps {
  rings: Array<Pick<RingProps, 'value' | 'label' | 'caption' | 'tone'>>;
  /** Forwarded to every ring. Off by default, so the real island is untouched. */
  growOnEnter?: boolean;
}

/** Convenience row of up to three rings for the collapsed slot. */
export function IslandRings({ rings, growOnEnter = false }: IslandRingsProps) {
  return (
    <span className="flex items-center gap-5">
      {rings.slice(0, 3).map((r) => <Ring key={r.label} {...r} growOnEnter={growOnEnter} />)}
    </span>
  );
}
