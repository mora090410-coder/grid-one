import { useEffect, type RefObject } from 'react';
import './motion.css';

/** One delegated listener set per active surface, never 100 cell listeners. */
export function useLiquidMotion(root: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const host = root.current;
    if (!enabled || !host) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const effects = new Set<HTMLElement>();
    let frame = 0;
    let lit: HTMLElement | null = null;
    let pressed: HTMLElement | null = null;
    const clear = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lit?.style.setProperty('--sheen', '0');
      lit = null;
      pressed?.classList.remove('is-down');
      pressed = null;
      timers.forEach(clearTimeout); timers.clear();
      effects.forEach(node => node.remove()); effects.clear();
    };
    const down = (event: PointerEvent) => {
      if (reduced?.matches || !(event.target instanceof Element)) return;
      move(event);
      const button = event.target.closest<HTMLElement>('.g1-btn-primary');
      if (!button || button.matches(':disabled,[aria-disabled="true"]')) return;
      // Repeated presses restart one bounded effect instead of growing the DOM.
      clear();
      move(event);
      pressed = button; button.classList.add('is-down');
      const r = button.getBoundingClientRect();
      const x = (event.clientX - r.left) * (button.offsetWidth / (r.width || 1));
      const y = (event.clientY - r.top) * (button.offsetHeight / (r.height || 1));
      for (let i = 0; i < 3; i++) {
        const ring = document.createElement('span');
        ring.className = 'g1-ring'; ring.setAttribute('aria-hidden', 'true');
        ring.style.cssText = `left:${x}px;top:${y}px;animation-delay:${i * 140}ms`;
        button.append(ring); effects.add(ring);
      }
      const dimple = document.createElement('span');
      dimple.className = 'g1-dimple'; dimple.setAttribute('aria-hidden', 'true');
      dimple.style.cssText = `left:${x}px;top:${y}px`;
      button.append(dimple); effects.add(dimple);
      // Optional web haptics are Android-only; never gate an action on support.
      if (/Android/i.test(navigator.userAgent) && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(8); } catch { /* Haptics can be denied by policy. */ }
      }
      const timer = setTimeout(() => { effects.forEach(node => node.remove()); effects.clear(); timers.delete(timer); }, 1400);
      timers.add(timer);
    };
    const up = () => { pressed?.classList.remove('is-down'); pressed = null; };
    const move = (event: PointerEvent) => {
      if (reduced?.matches || !(event.target instanceof Element)) return;
      const card = event.target.closest('.g1-cell,[data-cell-index],.g1-fill-cell') ? null : event.target.closest<HTMLElement>('.g1-sheen');
      if (card !== lit) lit?.style.setProperty('--sheen', '0');
      lit = card;
      if (!card || frame) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (lit !== card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--lx', `${(clientX - r.left) * card.offsetWidth / (r.width || 1)}px`);
        card.style.setProperty('--ly', `${(clientY - r.top) * card.offsetHeight / (r.height || 1)}px`);
        card.style.setProperty('--sheen', '1');
      });
    };
    const leave = () => { lit?.style.setProperty('--sheen', '0'); lit = null; up(); };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', leave);
    window.addEventListener('blur', clear);
    reduced?.addEventListener?.('change', clear);
    return () => {
      clear(); host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', leave); window.removeEventListener('blur', clear);
      reduced?.removeEventListener?.('change', clear);
    };
  }, [enabled, root]);
}
