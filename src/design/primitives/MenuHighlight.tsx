import React, { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from './motion';

/** One decorative fill for real buttons. It never selects or activates a task. */
export function MenuHighlight({ container, open }: { container: RefObject<HTMLDivElement | null>; open: boolean }) {
  const layer = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = container.current;
    const fill = layer.current;
    if (!root || !fill || !open) return;
    let active: HTMLButtonElement | null = null;
    let motion: Animation | null = null;
    const buttonAt = (target: EventTarget | null) => {
      const button = target instanceof Element ? target.closest('button') : null;
      return button instanceof HTMLButtonElement && button.parentElement === root && !button.disabled ? button : null;
    };
    const clear = () => {
      motion?.cancel(); motion = null;
      active?.removeAttribute('data-menu-active'); active = null;
      delete fill.dataset.visible;
    };
    const place = (button: HTMLButtonElement | null, animate = true) => {
      if (!button) { clear(); return; }
      const previous = fill.dataset.visible ? fill.getBoundingClientRect() : null;
      const origin = root.getBoundingClientRect();
      const width = button.offsetWidth;
      const height = button.offsetHeight;
      if (!width || !height) { clear(); return; }
      const scaleX = origin.width / root.offsetWidth || 1;
      const scaleY = origin.height / root.offsetHeight || 1;
      motion?.cancel(); motion = null;
      active?.removeAttribute('data-menu-active');
      active = button; active.dataset.menuActive = 'true';
      // Local offsets stay correct even while the ancestor panel is scaling in.
      const x = button.offsetLeft;
      const y = button.offsetTop;
      const end = `translate(${x}px,${y}px)`;
      fill.style.width = `${width}px`;
      fill.style.height = `${height}px`;
      fill.style.transform = end;
      fill.dataset.visible = 'true';
      // FLIP from the currently painted rectangle: rapid reversals do not snap
      // back to the preceding item. Only transform is animated, never layout.
      const instant = reduced || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (previous && !instant && animate && typeof fill.animate === 'function') {
        const start = `translate(${(previous.left - origin.left) / scaleX}px,${(previous.top - origin.top) / scaleY}px) scale(${previous.width / scaleX / width},${previous.height / scaleY / height})`;
        const a = fill.animate([{ transform: start }, { transform: end }], { duration: 420, easing: 'cubic-bezier(.2,.9,.2,1.04)' });
        motion = a;
        void a.finished.then(() => { if (motion === a) { a.cancel(); motion = null; } }).catch(() => {});
      }
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const button = buttonAt(event.target);
      if (button !== active) place(button);
    };
    const focus = (event: FocusEvent) => place(buttonAt(event.target));
    const blur = (event: FocusEvent) => { if (!root.contains(event.relatedTarget as Node | null)) clear(); };
    const leave = () => place(buttonAt(document.activeElement));
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (active) place(active, false); }) : null;
    resize?.observe(root);
    root.addEventListener('pointermove', pointer);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    place(buttonAt(document.activeElement) ?? buttonAt(root.querySelector('button:hover')), false);
    return () => {
      clear(); resize?.disconnect();
      root.removeEventListener('pointermove', pointer);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
    };
  }, [container, open, reduced]);
  return <span ref={layer} className="g1-menu-highlight" aria-hidden="true" />;
}
