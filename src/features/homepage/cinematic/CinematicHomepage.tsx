import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../../site/SiteHeader';
import { quietLink, trackViewDemo } from '../sections/cta';
import { PrimaryCtaLink } from '../sections/PrimaryCtaLink';
import { CHAPTERS, NOW_SQUARE, RESULTS, cardVisibility, pickAnswer, progressFromScroll, railIndex, smooth, clamp, type PickAnswer } from './cinematicModel';
import type { BoardScene } from './boardScene';
import './cinematic.css';

const DEMO_LABEL = 'Sample board — not a live game';

/** Can this visitor get the 3D film? Reduced motion and missing WebGL keep the static page. */
function canAnimate() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function PickCard({ answer }: { answer: PickAnswer | null }) {
  const shown = answer ?? pickAnswer(NOW_SQUARE);
  return (
    <div className="cine-pick" aria-live="polite">
      <span className={`cine-pick-square${shown.matchesNow ? ' is-now' : ''}`} aria-hidden="true">{String(shown.square).padStart(2, '0')}</span>
      <span className="cine-pick-who">{shown.name}<span>{answer ? shown.coordinate : 'KC 17 · PHI 14 · Q3 · sample'}</span></span>
      <span className="cine-pick-answer">{answer ? shown.answer : <>Matching right now. <strong>Tap any square</strong> to see the score that wins it.</>}</span>
    </div>
  );
}

/** Static stand-in for the board when the 3D film is off. */
function StaticBoard() {
  const gold = new Set([RESULTS.Q3]);
  return <div className="cine-static-board" aria-hidden="true">{Array.from({ length: 100 }, (_, index) => <i key={index} className={gold.has(index) ? 'is-gold' : undefined} />)}</div>;
}

export function CinematicHomepage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const railRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [mode, setMode] = useState<'static' | 'cinematic'>('static');
  const [answer, setAnswer] = useState<PickAnswer | null>(null);
  // True once the page has decided between the 3D film and the static page, so layout won't change again.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!canAnimate()) { setSettled(true); return; }
    let disposed = false, scene: BoardScene | null = null, raf = 0;
    const state = { warm: 0, s: 0, target: 0, px: 0, py: 0, tx: 0, ty: 0, hover: -1, pick: -1, dirty: true, visible: true, layout: { stageTop: 0, filmTop: 1, filmEnd: 2 }, phone: false, lastBackdrop: '' };
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    // A device that can't draw the film smoothly gets the static page instead.
    const frameCosts: number[] = [];
    const SLOW_FRAME_MS = 45, SAMPLE_FRAMES = 8;
    // ?film=on skips the speed check, for reviewing the film on slow test machines.
    const forceFilm = new URLSearchParams(window.location.search).get('film') === 'on';
    const giveUp = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      teardown();
      scene?.dispose(); scene = null;
      const inFilm = filmRef.current ? filmRef.current.getBoundingClientRect().top < 0 : false;
      setMode('static');
      setSettled(true);
      // Keep a reader who was already inside the film at the chapters, not somewhere below them.
      if (inFilm) requestAnimationFrame(() => filmRef.current?.scrollIntoView({ block: 'start' }));
    };

    const measure = () => {
      const root = rootRef.current, film = filmRef.current, canvas = canvasRef.current;
      if (!root || !film || !canvas || !scene) return;
      const y = window.scrollY, filmBox = film.getBoundingClientRect(), rootBox = root.getBoundingClientRect();
      state.layout = { stageTop: rootBox.top + y, filmTop: filmBox.top + y, filmEnd: filmBox.top + y + filmBox.height - window.innerHeight };
      state.phone = window.innerWidth <= 900;
      scene.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      state.dirty = true;
    };

    const draw = () => {
      if (!scene) return;
      const s = state.s;
      const backdrop = scene.render({ s, phone: state.phone, pointerX: state.px, pointerY: state.py, hover: state.hover, pick: state.pick });
      const key = `${backdrop.top}|${backdrop.bottom}|${backdrop.beam.toFixed(2)}|${backdrop.bands.toFixed(2)}`;
      if (key !== state.lastBackdrop && backdropRef.current) {
        state.lastBackdrop = key;
        const style = backdropRef.current.style, light = backdrop.bottom[0] > 140;
        style.backgroundImage = `linear-gradient(180deg, rgb(${backdrop.top}), rgb(${backdrop.bottom}))`;
        style.setProperty('--cine-beam', backdrop.beam.toFixed(3));
        style.setProperty('--cine-bands', backdrop.bands.toFixed(3));
        style.setProperty('--cine-band', light ? '70,100,135' : '196,222,255');
        rootRef.current?.style.setProperty('--cine-rail-on', light ? '#13212E' : '#F6F7F5');
      }
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const { opacity, offset } = cardVisibility(s, index + 1);
        card.style.opacity = opacity.toFixed(3);
        card.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
        card.style.setProperty('--cine-shift', `${(offset * (state.phone ? 36 : 48)).toFixed(1)}px`);
      });
      const on = railIndex(s);
      railRefs.current.forEach((item, index) => item?.classList.toggle('is-on', index === on));
      if (pickRef.current) pickRef.current.style.opacity = (1 - smooth(clamp(s / 0.25))).toFixed(3);
    };

    let lastDrawAt = 0, gapsSeen = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!state.visible || document.hidden) { lastDrawAt = 0; return; }
      state.target = progressFromScroll(window.scrollY, state.layout);
      const ds = state.target - state.s, dp = Math.abs(state.tx - state.px) + Math.abs(state.ty - state.py);
      // Warm-up: draw a few frames at load so a slow device is found before anyone scrolls.
      if (state.warm > 0) { state.warm--; state.dirty = true; }
      if (!state.dirty && Math.abs(ds) < 0.0004 && dp < 0.002) return;
      // Long jumps (links, keyboard, scroll restoration) land directly instead of replaying every frame.
      state.s = Math.abs(ds) < 0.0004 || Math.abs(ds) > 1.5 ? state.target : state.s + ds * 0.16;
      state.px += (state.tx - state.px) * 0.08; state.py += (state.ty - state.py) * 0.08;
      state.dirty = state.warm > 0 || Math.abs(state.target - state.s) > 0.0004 || dp > 0.002 || state.hover >= 0 || state.pick >= 0;
      // Time between back-to-back drawn frames includes the GPU work that render() hands off.
      // The first two gaps include shader compiling and texture upload, so they don't count toward the
      // median, but one that takes over 1.5 seconds already says this device can't run the film.
      if (lastDrawAt && gapsSeen < 2 && now - lastDrawAt > 1500 && !forceFilm) { giveUp(); return; }
      if (lastDrawAt && frameCosts.length < SAMPLE_FRAMES && ++gapsSeen > 2) {
        frameCosts.push(now - lastDrawAt);
        if (frameCosts.length === SAMPLE_FRAMES) {
          if (!forceFilm && [...frameCosts].sort((a, b) => a - b)[SAMPLE_FRAMES >> 1] > SLOW_FRAME_MS) { giveUp(); return; }
          setSettled(true);
        }
      }
      draw();
      lastDrawAt = state.dirty ? now : 0;
    };

    const overInterface = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('a, button, summary, input, .cine-pick, header'));
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') { state.tx = event.clientX / window.innerWidth * 2 - 1; state.ty = event.clientY / window.innerHeight * 2 - 1; }
      if (scene && state.s < 0.2 && event.pointerType === 'mouse') {
        const hit = overInterface(event.target) ? -1 : scene.hit(event.clientX, event.clientY);
        if (hit !== state.hover) { state.hover = hit; state.dirty = true; }
      }
    };
    const onClick = (event: MouseEvent) => {
      if (!scene || state.s > 0.2 || overInterface(event.target)) return;
      const hit = scene.hit(event.clientX, event.clientY);
      if (hit < 0) return;
      state.pick = hit; state.dirty = true;
      setAnswer(pickAnswer(hit));
    };
    const onScroll = () => { state.dirty = true; };

    const observer = new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      state.dirty = true;
    });

    // Load the 3D code only after fonts and first paint, so it never competes with the page itself.
    const whenIdle = () => new Promise<void>(resolve => {
      const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
      if (idle) idle(() => resolve(), { timeout: 1500 }); else window.setTimeout(resolve, 300);
    });
    Promise.resolve(document.fonts?.ready).then(whenIdle).then(() => (disposed ? Promise.reject(new Error('unmounted')) : import('./boardScene'))).then(({ createBoardScene }) => {
      if (disposed || !canvasRef.current) return;
      try {
        scene = createBoardScene(canvasRef.current, { coarse });
      } catch {
        setSettled(true);
        return; // WebGL failed after all: keep the static page.
      }
      setMode('cinematic');
      requestAnimationFrame(() => {
        if (disposed) return;
        measure();
        state.warm = SAMPLE_FRAMES + 4;
        if (rootRef.current) observer.observe(rootRef.current);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('click', onClick);
        document.fonts?.ready.then(() => { if (!disposed && scene) { scene.redrawText(); measure(); } });
        raf = requestAnimationFrame(frame);
      });
    }).catch(() => { if (!disposed) setSettled(true); });

    function teardown() {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('click', onClick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      teardown();
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className="cine" data-mode={mode} data-settled={settled ? 'true' : 'false'}>
      <div className="cine-stage" aria-hidden="true">
        <div ref={backdropRef} className="cine-backdrop" />
        <canvas ref={canvasRef} className="cine-canvas" />
        <div className="cine-grain" />
      </div>

      <section ref={heroRef} data-testid="homepage-first-viewport" className="cine-hero" aria-labelledby="homepage-title">
        <SiteHeader />
        <div className="cine-hero-layout">
          <div className="cine-hero-copy">
            <p className="cine-label">Football squares. For the team behind the team.</p>
            <h1 id="homepage-title" className="cine-title studio-hero-title">Your team. <br />One board. <br /><span>Less chasing.</span></h1>
            <p className="cine-lede studio-hero-description">The football-squares fundraiser for busy team organizers. One viewer link for your group to find their squares and follow game day.</p>
            <div className="cine-actions">
              <PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink>
              <Link to="/demo" onClick={trackViewDemo} className={quietLink}>Try the demo</Link>
            </div>
            <ul className="cine-reassurance"><li>First published board free each season</li><li>No card required · Sign up when you save</li><li>No account needed to view</li></ul>
            <p className="cine-boundary">For watch parties, office pools, friends, and fundraisers.</p>
          </div>
          <div className="cine-hero-visual">
            <StaticBoard />
            <p className="cine-caption">{DEMO_LABEL}</p>
          </div>
        </div>
        <div ref={pickRef} className="cine-pick-wrap"><PickCard answer={answer} /></div>
      </section>

      <section ref={filmRef} id="how" className="cine-film" aria-labelledby="cine-film-title">
        <h2 id="cine-film-title" className="sr-only">How a game day plays out</h2>
        <div className="cine-film-sticky">
          {CHAPTERS.map((chapter, index) => (
            <article key={chapter.id} ref={element => { cardRefs.current[index] = element; }} className={`cine-card is-${chapter.tone}`} aria-labelledby={`cine-${chapter.id}`}>
              <span className="cine-card-number">{chapter.number}</span>
              <h3 id={`cine-${chapter.id}`}>{chapter.title}</h3>
              <p>{chapter.body}</p>
              <p className="cine-card-fine">{chapter.fine}</p>
              <p className="cine-card-tele">{chapter.tele.map(item => <span key={item}>{item}</span>)}</p>
            </article>
          ))}
          <div className="cine-rail" aria-hidden="true">{CHAPTERS.map((chapter, index) => <span key={chapter.id} ref={element => { railRefs.current[index] = element; }}>{chapter.rail}</span>)}</div>
          <p className="cine-illustration" aria-hidden="true">Illustration · sample board, not a live game</p>
        </div>
      </section>
    </div>
  );
}
