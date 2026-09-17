import { useLayoutEffect, useRef, type RefObject } from 'react';
import { notchAnimate, springTo } from './notchMotion';

type Dimensions = Partial<Record<'width' | 'height' | 'left', number>>;
type Motion = 'unfold' | 'glide' | 'merge';
interface Target { dimensions: Dimensions; animation?: Animation }

/** Measured geometry, not cell-index offsets. Content keeps its destination
 * layout while the outer shell clips it (the same separation as NotchRootView).
 * Only changed destinations retarget a spring. Observer deliveries caused by
 * animation itself therefore cannot restart the height on every frame. */
export function useNotchGeometry(root: RefObject<HTMLElement | null>, open: boolean, present: boolean, selected: string) {
  const targets = useRef(new Map<HTMLElement, Target>());
  const previous = useRef({ open: false, selected });

  useLayoutEffect(() => {
    const host = root.current;
    const surface = host?.querySelector<HTMLElement>('.context-notch');
    const clip = host?.querySelector<HTMLElement>('.context-notch-reveal');
    const contents = host?.querySelector<HTMLElement>('.context-notch-contents');
    const track = host?.querySelector<HTMLElement>('.context-notch-detail-track');
    const card = host?.querySelector<HTMLElement>('.context-notch-detail');
    const body = host?.querySelector<HTMLElement>('.context-notch-detail-body');
    const connector = host?.querySelector<HTMLElement>('.context-notch-connector');
    const expandedProbe = host?.querySelector<HTMLElement>('[data-notch-measure="expanded"]');
    const compactProbe = host?.querySelector<HTMLElement>('[data-notch-measure="compact"]');
    const trigger = host?.querySelector<HTMLElement>('.context-notch-toggle');
    if (!host || !surface || !clip || !contents || !track || !card || !body || !connector || !expandedProbe || !compactProbe || !trigger || !present) return;
    const opening = open && !previous.current.open;
    const switching = selected !== previous.current.selected;
    previous.current = { open, selected };

    const move = (element: HTMLElement, dimensions: Dimensions, motion: Motion, instant = false) => {
      const prior = targets.current.get(element);
      const keys = Object.keys(dimensions) as (keyof Dimensions)[];
      if (prior && keys.every(key => Math.abs((prior.dimensions[key] ?? NaN) - dimensions[key]!) < 0.1)) return;
      // Sample BEFORE cancel/cleanup or changing resting styles, even if paused.
      const painted = getComputedStyle(element);
      const from = Object.fromEntries(keys.map(key => [key, parseFloat(painted[key]) || 0])) as Dimensions;
      prior?.animation?.cancel();
      for (const key of keys) element.style[key] = `${dimensions[key]}px`;
      const target: Target = { dimensions };
      targets.current.set(element, target);
      if (instant || keys.every(key => Math.abs(from[key]! - dimensions[key]!) < 0.1)) return;
      const frame = (progress: number): Keyframe => Object.fromEntries(keys.map(key => [key, `${from[key]! + (dimensions[key]! - from[key]!) * progress}px`]));
      target.animation = motion === 'merge'
        ? notchAnimate(element, [frame(0), frame(1)], { duration: 200, easing: 'ease-in' })
        : springTo(element, motion, frame);
    };

    const measure = () => {
      const expanded = expandedProbe.getBoundingClientRect().width;
      const compact = compactProbe.getBoundingClientRect().width;
      if (!expanded || !compact) return;
      // Contents must not reflow once per animated surface-width frame.
      contents.style.width = `${expanded}px`;
      const available = track.getBoundingClientRect().width;
      const cap = parseFloat(getComputedStyle(card).maxWidth) || available;
      const cardWidth = Math.min(available, cap);
      const border = parseFloat(getComputedStyle(card).borderLeftWidth) + parseFloat(getComputedStyle(card).borderRightWidth);
      body.style.width = `${Math.max(0, cardWidth - border)}px`;
      const cardHeight = body.getBoundingClientRect().height + border;
      const trackBox = track.getBoundingClientRect();
      const cell = host.querySelector<HTMLElement>('[data-notch-cell][aria-pressed="true"]')?.getBoundingClientRect();
      const center = cell ? cell.left + cell.width / 2 - trackBox.left : available / 2;
      const cardLeft = Math.max(0, Math.min(available - cardWidth, center - cardWidth / 2));
      const connectorHeight = parseFloat(getComputedStyle(card).top) || 0;
      // The track reserves the DESTINATION height. Animated card geometry is
      // absolute inside it and cannot feed back into reveal measurements.
      track.style.height = `${cardHeight + connectorHeight}px`;
      move(card, { width: cardWidth, height: cardHeight, left: cardLeft }, 'glide', !open || opening);
      move(connector, { left: center }, 'glide', !open || opening);
      move(surface, { width: open ? expanded : compact }, open ? 'unfold' : 'merge', !targets.current.has(surface));
      move(clip, { height: open ? contents.getBoundingClientRect().height : 0 }, open ? opening ? 'unfold' : 'glide' : 'merge');
      const safeTop = parseFloat(getComputedStyle(surface).paddingTop) || 0;
      host.style.minHeight = `${trigger.getBoundingClientRect().height + safeTop + 16}px`;
    };
    measure();
    if (switching && open) notchAnimate(body, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-in-out' });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    // Observe stable layout/inputs, NEVER the animated surface or card box.
    [expandedProbe, compactProbe, body, contents].forEach(node => observer?.observe(node));
    // The trigger's width follows the shell on every frame. Its observer must
    // not remeasure the whole card/rail merely because that width is animating.
    let triggerHeight = trigger.getBoundingClientRect().height;
    const safeTop = parseFloat(getComputedStyle(surface).paddingTop) || 0;
    const triggerObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      const height = trigger.getBoundingClientRect().height;
      if (height === triggerHeight) return;
      triggerHeight = height;
      host.style.minHeight = `${height + safeTop + 16}px`;
    }) : null;
    triggerObserver?.observe(trigger);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); triggerObserver?.disconnect(); window.removeEventListener('resize', measure); };
  }, [open, present, selected, root]);

  // No selected/open effect cleanup may cancel before the next painted sample.
  useLayoutEffect(() => () => {
    targets.current.forEach(target => target.animation?.cancel());
    targets.current.clear();
  }, []);
}
