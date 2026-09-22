import React, { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from './motion';

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Element to render. Defaults to `div`. */
  as?: React.ElementType;
  /** Stagger, in milliseconds. Becomes `transition-delay`. */
  delay?: number;
  className?: string;
  /**
   * Rise without dropping opacity. Use this when the region contains
   * focusable controls, so Tab never lands on invisible content.
   */
  keepVisible?: boolean;
}

/**
 * Rise-and-fade on scroll entry, with a VISIBLE resting state.
 *
 * The rendered markup carries no `data-reveal` attribute, so the CSS in
 * `tokens.css` gives it no transition, no transform, and no opacity change.
 * That is the state a server render, a no-JS browser, and a browser without
 * `IntersectionObserver` all see: finished content, immediately.
 *
 * The hidden `pending` state is applied only from `useLayoutEffect`, which runs
 * before paint, and only when `prefers-reduced-motion` is not `reduce` and an
 * observer exists. So there is no flash of hidden content and no flash of
 * content that then hides. The reduced-motion CSS block neutralizes `pending`
 * as a second guard, in case the preference flips after the attribute is set.
 *
 * Content that already intersects the FIRST viewport never animates. It is
 * measured before the attribute is set and left in the visible resting state.
 * Two reasons, both hard requirements rather than taste:
 *
 *  1. Largest Contentful Paint. Chrome does not count an element at
 *     `opacity: 0` as painted, so a reveal wrapped around above-the-fold copy
 *     BECOMES the LCP element and pushes it out by the observer callback plus
 *     `transition-delay` plus part of the spring — roughly doubling landing
 *     page LCP.
 *  2. Focus. A `Reveal` must never gate anything focusable that Tab can reach
 *     before the reveal fires (`docs/accessibility-contract.md`). The hero CTAs
 *     sit in a delayed reveal, so without this they were focusable at zero
 *     opacity for the whole delay-plus-spring window.
 *
 * Nothing is lost visually: a reveal on content that is already on screen is
 * not a scroll effect, it is a page-load animation. Only elements that start
 * below the fold animate, which is exactly where the effect is perceivable.
 */
export function Reveal({ children, as: Tag = 'div', delay = 0, className = '', keepVisible = false, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No motion allowed, or no observer to drive it: stay in the visible
    // resting state and carry no attribute at all.
    if (reduced || typeof IntersectionObserver === 'undefined') {
      node.removeAttribute('data-reveal');
      return;
    }

    // Already in (or above) the first viewport: no scroll will ever bring it
    // in, so there is nothing to reveal. Stay visible and carry no attribute.
    // Measured BEFORE `pending` is set, so the element is never hidden — not
    // for a frame, not for the LCP, not for the first Tab press.
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    if (node.getBoundingClientRect().top < viewport) {
      node.removeAttribute('data-reveal');
      return;
    }

    node.setAttribute('data-reveal', keepVisible ? 'shift' : 'pending');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.setAttribute('data-reveal', 'in');
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [keepVisible, reduced]);

  const Element = Tag as React.ElementType;
  return (
    <Element
      {...rest}
      ref={ref as React.Ref<never>}
      className={className || undefined}
      style={delay > 0 ? { ...style, transitionDelay: `${delay}ms` } : style}
    >
      {children}
    </Element>
  );
}
