import { useEffect, useState } from 'react';

export const EASE_STATE = 'cubic-bezier(0.2, 0, 0, 1)';
export const DUR_STATE = 200;
export const DUR_SPRING = 450;
export const DUR_REDUCED = 120;

/** GSAP config for the soft spring. power3.out has no overshoot. */
export const SPRING = { duration: DUR_SPRING / 1000, ease: 'power3.out' } as const;

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export function durations(reduced: boolean): { state: number; spring: number } {
  return reduced ? { state: DUR_REDUCED, spring: DUR_REDUCED } : { state: DUR_STATE, spring: DUR_SPRING };
}

/** Board pans stay instant when motion is reduced. `instant` overrides a page-level smooth scroll. */
export function scrollBehavior(reduced: boolean): ScrollBehavior {
  return reduced ? 'instant' : 'smooth';
}
