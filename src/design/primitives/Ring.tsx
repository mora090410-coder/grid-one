import React, { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from './motion';

type Tone = 'fg' | 'turf' | 'live' | 'cardinal';
const STROKE: Record<Tone, string> = {
  fg: 'var(--g-text)',
  turf: 'var(--g-tone-turf)',
  live: 'var(--g-live)',
  cardinal: 'var(--g-cardinal)',
};

export interface RingProps {
  /** 0 to 1 */
  value: number;
  label: string;
  caption: string;
  tone?: Tone;
  size?: number;
  /**
   * Opt in to the entry animation: the arc starts empty and grows to `value`
   * the first time the ring scrolls into view. Off by default, so every
   * existing caller renders exactly as it did before.
   */
  growOnEnter?: boolean;
}

/** Small SVG ring gauge with a mono caption beneath. */
export function Ring({ value, label, caption, tone = 'fg', size = 28, growOnEnter = false }: RingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const reduced = useReducedMotion();

  /**
   * Same contract as `Reveal`, including its first-viewport bail: the RESTING
   * state is the finished state, and the ring must reach it on every path.
   *
   * `stroke-dashoffset` is rendered as an attribute holding the real value, so
   * a server render, a no-JS browser, a browser without `IntersectionObserver`,
   * and anyone with `prefers-reduced-motion: reduce` all see the true arc
   * immediately, with nothing to wait for. The empty start is an inline style
   * — which outranks the attribute — applied only here, only when animation is
   * actually allowed, and only ever removed again. `useLayoutEffect` runs
   * before paint, so the arc is never seen full and then emptied.
   *
   * Releasing it is a style REMOVAL, not a second write: the attribute
   * underneath is already correct, so a `value` that changes mid-animation
   * still lands on the right number, and the ring can never be left holding a
   * stale inline value.
   *
   * The OBSERVED element is the wrapping `span`, never the `<circle>`. An SVG
   * child has no CSS box, and observing one is a documented cross-engine
   * hazard (w3c/IntersectionObserver#376, Gecko bug 1492155): an engine may
   * report it as intersecting regardless of position, or never report it at
   * all. The failure is asymmetric — firing early only skips the animation,
   * but never firing would strand the empty inline value forever while the
   * label went on announcing the real number. The `span` is a real HTMLElement
   * with a real box, it is the whole unit a reader sees (arc plus caption),
   * and it is the element `Reveal` would measure.
   *
   * The first-viewport bail is the same rule, for the same two reasons spelled
   * out in `Reveal`: a ring already on screen at load must not be emptied and
   * replayed, because that is a page-load animation, not a scroll effect. It
   * is also what keeps the ring honest when `reduced` flips from true to false
   * after the ring has been scrolled PAST: the effect re-runs against an
   * element now above the viewport, where no future scroll can make an
   * observer fire, and bailing is the only outcome that leaves the arc full.
   *
   * The accessible label and the mono caption always state the real value.
   * Nothing about the number depends on the animation running.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const arc = arcRef.current;
    if (!root || !arc) return;
    const release = () => arc.style.removeProperty('stroke-dashoffset');

    if (!growOnEnter || reduced || typeof IntersectionObserver === 'undefined') {
      release();
      return;
    }

    // Already in (or above) the first viewport: no scroll will ever bring it
    // in. Measured BEFORE the empty value is written, so the arc is never
    // emptied at all — not for a frame, and not permanently if the observer
    // then never fires.
    const viewport = typeof window === 'undefined' ? 0 : window.innerHeight;
    if (root.getBoundingClientRect().top < viewport) {
      release();
      return;
    }

    arc.style.setProperty('stroke-dashoffset', String(c));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            release();
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      release();
    };
  }, [growOnEnter, reduced, c]);

  return (
    <span ref={rootRef} className="inline-flex flex-col items-center gap-1">
      <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--g-hairline)" strokeWidth={stroke} />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset var(--g-dur-spring) var(--g-ease-state)' }}
        />
      </svg>
      <span className="font-mono tabular-nums text-[12px] leading-none text-fg-2">{caption}</span>
    </span>
  );
}
