import React, { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from './motion';

export interface EnterProps {
  children: React.ReactNode;
  /** Element to render. Defaults to `div`. */
  as?: React.ElementType;
  /** Stagger, in milliseconds. Becomes `animation-delay`. */
  delay?: number;
  className?: string;
}

/**
 * One-shot page-load entrance. The resting markup has no `data-enter`
 * attribute, so no-JS and reduced-motion renders stay finished.
 *
 * The animation never starts at `opacity: 0`. Above-the-fold copy has to
 * remain painted for Largest Contentful Paint, and focusable controls have
 * to stay visible to the keyboard. See docs/accessibility-contract.md.
 */
export function Enter({ children, as: Tag = 'div', delay = 0, className = '' }: EnterProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.removeAttribute('data-enter');
      return;
    }
    node.setAttribute('data-enter', 'run');
  }, [reduced]);

  const Element = Tag as React.ElementType;
  return (
    <Element
      ref={ref as React.Ref<never>}
      className={className || undefined}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Element>
  );
}
