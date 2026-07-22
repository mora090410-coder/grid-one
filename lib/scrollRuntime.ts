import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis?: Lenis;
    __ready?: boolean;
    __heroProgress?: number;
    __heroScrollTo?: (progress: number) => void;
  }
}

type GridOneWindow = Window & typeof globalThis & { lenis?: Lenis };

const getRuntimeWindow = () => window as GridOneWindow;

export const getLenis = () => getRuntimeWindow().lenis;

interface ScrollRuntime {
  destroy: () => void;
}

export function startScrollRuntime(): ScrollRuntime {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposeLenis: (() => void) | undefined;

  const stopLenis = () => {
    disposeLenis?.();
    disposeLenis = undefined;
  };

  const startLenis = () => {
    stopLenis();

    if (reducedMotion.matches) {
      Reflect.deleteProperty(getRuntimeWindow(), 'lenis');
      delete window.__lenis;
      return;
    }

    const lenis = new Lenis({ duration: 1.1 });
    const root = document.documentElement;
    const updateGlow = ({ velocity }: { velocity: number }) => {
      root.style.setProperty('--ne-glow', (0.4 + Math.min(Math.abs(velocity) / 40, 1) * 0.6).toFixed(3));
    };
    const raf = (time: number) => lenis.raf(time * 1000);
    const offTriggerUpdate = lenis.on('scroll', ScrollTrigger.update);
    const offGlowUpdate = lenis.on('scroll', updateGlow);

    getRuntimeWindow().lenis = lenis;
    window.__lenis = lenis;
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    disposeLenis = () => {
      offTriggerUpdate();
      offGlowUpdate();
      gsap.ticker.remove(raf);
      lenis.destroy();
      if (getRuntimeWindow().lenis === lenis) Reflect.deleteProperty(getRuntimeWindow(), 'lenis');
      if (window.__lenis === lenis) delete window.__lenis;
    };
  };

  startLenis();
  reducedMotion.addEventListener('change', startLenis);

  return {
    destroy: () => {
      reducedMotion.removeEventListener('change', startLenis);
      stopLenis();
    },
  };
}
