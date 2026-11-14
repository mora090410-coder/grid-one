import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../../site/SiteHeader';
import { quietLink, trackViewDemo } from '../sections/cta';
import { PrimaryCtaLink } from '../sections/PrimaryCtaLink';
import { CHAPTERS, NOW_SQUARE, SQUARES, initials, pickAnswer, clamp } from './cinematicModel';
import type { BoardScene } from './boardScene';
import './cinematic.css';

/** A compact, user-directed film. The canvas never owns scrolling or essential content. */
export function CinematicHomepage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chapter, setChapter] = useState(2);
  const [picked, setPicked] = useState(NOW_SQUARE);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [mode, setMode] = useState<'static' | 'cinematic'>('static');
  const [settled, setSettled] = useState(false);
  const inputRef = useRef({ chapter, picked });
  const requestFrame = useRef<() => void>(() => {});
  inputRef.current = { chapter, picked };
  const selected = CHAPTERS[chapter];
  const answer = pickAnswer(picked);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setMotionAllowed(!preference.matches); if (preference.matches) setSettled(true); };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!motionAllowed) { setMode('static'); return; }
    let disposed = false, scene: BoardScene | null = null, raf = 0, observer: IntersectionObserver | null = null;
    const state = { s: CHAPTERS[inputRef.current.chapter].sceneProgress, px: 0, py: 0, tx: 0, ty: 0, hover: -1, visible: true, phone: false, warm: 12 };
    const frameCosts: number[] = [];
    let lastFrame = 0;
    const forceFilm = new URLSearchParams(window.location.search).get('film') === 'on';
    const schedule = () => { if (!disposed && !raf && state.visible && !document.hidden) raf = requestAnimationFrame(draw); };
    const fallback = () => {
      cancelAnimationFrame(raf); raf = 0;
      scene?.dispose(); scene = null;
      setMode('static'); setSettled(true);
    };
    function draw(now: number) {
      raf = 0;
      if (!scene || disposed || !state.visible || document.hidden) return;
      const target = CHAPTERS[inputRef.current.chapter].sceneProgress;
      const delta = target - state.s;
      // A short camera/material transition, interruptible by the next choice.
      state.s = Math.abs(delta) < 0.001 ? target : state.s + delta * Math.min(1, (lastFrame ? now - lastFrame : 16) / 140);
      state.px += (state.tx - state.px) * .18; state.py += (state.ty - state.py) * .18;
      scene.render({ s: state.s, phone: state.phone, pointerX: state.px, pointerY: state.py, hover: state.hover, pick: inputRef.current.chapter === 2 ? inputRef.current.picked : -1 });
      if (state.warm > 0) {
        if (lastFrame && state.warm < 10) frameCosts.push(now - lastFrame);
        state.warm--;
        if (!state.warm) {
          if (!forceFilm && frameCosts.sort((a, b) => a - b)[Math.floor(frameCosts.length / 2)] > 60) { fallback(); return; }
          setSettled(true);
        }
      }
      const moving = state.warm > 0 || Math.abs(target - state.s) > .001 || Math.abs(state.tx - state.px) + Math.abs(state.ty - state.py) > .002;
      lastFrame = moving ? now : 0;
      if (moving) schedule();
    }
    const measure = () => {
      const box = stageRef.current?.getBoundingClientRect();
      if (!box || !scene || !box.width || !box.height) return;
      state.phone = box.width < 600;
      scene.resize(box.width, box.height, window.devicePixelRatio);
      schedule();
    };
    const point = (event: PointerEvent | MouseEvent) => {
      const box = canvasRef.current!.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top, width: box.width, height: box.height };
    };
    const onMove = (event: PointerEvent) => {
      if (!scene || event.pointerType !== 'mouse') return;
      const p = point(event);
      state.tx = p.x / p.width * 2 - 1; state.ty = p.y / p.height * 2 - 1;
      state.hover = inputRef.current.chapter === 2 ? scene.hit(p.x, p.y) : -1;
      schedule();
    };
    const onLeave = () => { state.tx = 0; state.ty = 0; state.hover = -1; schedule(); };
    const onClick = (event: MouseEvent) => {
      if (!scene || inputRef.current.chapter !== 2) return;
      const p = point(event), hit = scene.hit(p.x, p.y);
      if (hit >= 0) { setPicked(hit); schedule(); }
    };
    const onContextLost = (event: Event) => { event.preventDefault(); fallback(); };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const canvas = canvasRef.current;
    const whenIdle = () => new Promise<void>(resolve => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 1000 });
      else setTimeout(resolve, 150);
    });
    Promise.resolve(document.fonts?.ready).then(whenIdle).then(async () => {
      if (disposed || !canvas) return;
      const { createBoardScene } = await import('./boardScene');
      if (disposed) return;
      try { scene = createBoardScene(canvas, { coarse: window.matchMedia('(pointer: coarse)').matches }); }
      catch { setSettled(true); return; }
      setMode('cinematic');
      if (stageRef.current) {
        resizeObserver?.observe(stageRef.current);
        if (typeof IntersectionObserver !== 'undefined') {
          observer = new IntersectionObserver(entries => {
            state.visible = entries.some(entry => entry.isIntersecting);
            if (state.visible) { lastFrame = 0; schedule(); }
          });
          observer.observe(stageRef.current);
        }
      }
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('webglcontextlost', onContextLost);
      window.addEventListener('resize', measure);
      document.addEventListener('visibilitychange', schedule);
      requestFrame.current = schedule;
      measure();
    }).catch(() => { if (!disposed) { setMode('static'); setSettled(true); } });
    return () => {
      disposed = true; cancelAnimationFrame(raf);
      requestFrame.current = () => {};
      observer?.disconnect(); resizeObserver?.disconnect();
      canvas?.removeEventListener('pointermove', onMove); canvas?.removeEventListener('pointerleave', onLeave);
      canvas?.removeEventListener('click', onClick); canvas?.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('resize', measure); document.removeEventListener('visibilitychange', schedule);
      scene?.dispose();
    };
  }, [motionAllowed]);

  useEffect(() => { requestFrame.current(); }, [chapter, picked]);

  return (
    <section className="cine" data-mode={mode} data-settled={settled ? 'true' : 'false'} data-testid="homepage-first-viewport" aria-labelledby="homepage-title">
      <SiteHeader />
      <div className="cine-hero-layout">
        <div className="cine-hero-copy">
          <p className="cine-label">Football squares for team fundraisers</p>
          <h1 id="homepage-title" className="cine-title studio-hero-title">Your team. <br />One board. <br /><span>Less chasing.</span></h1>
          <p className="cine-lede">Give your team one board to share. Know what’s filled before kickoff.</p>
          <div className="cine-actions"><PrimaryCtaLink to="/create" trackCreate>Create your free board</PrimaryCtaLink><Link to="/demo" onClick={trackViewDemo} className={quietLink}>Try the demo</Link></div>
          <p className="cine-reassurance">First published board free each season</p>
          <p className="cine-fine">No card required</p>
        </div>
        <section className="cine-film" id="how" aria-label="Board film">
          <p className="cine-film-header">Sample game</p>
          <div className="cine-stage" ref={stageRef}>
            <canvas ref={canvasRef} className="cine-canvas" aria-hidden="true" />
            <div className="cine-static-board" aria-hidden="true">{SQUARES.map((name, index) => <i key={index} className={chapter === 2 && index === NOW_SQUARE ? 'is-gold' : ''}><span>{chapter === 0 ? index + 1 : initials(name)}</span></i>)}</div>
          </div>
          <div className="cine-controls" role="group" aria-label="Board film chapters">{CHAPTERS.map((item, index) => <button type="button" key={item.id} aria-pressed={chapter === index} aria-controls="cine-chapter" onClick={() => setChapter(index)}>{item.rail}</button>)}</div>
          <article id="cine-chapter" className="cine-chapter" aria-labelledby="cine-chapter-title">
            <h2 id="cine-chapter-title">{selected.title}</h2><p>{selected.body}</p>{selected.fine && <p className="cine-fine">{selected.fine}</p>}
            {chapter === 2 && <div className="cine-inspector" aria-label="Inspect sample squares">
              <p className="cine-pick" aria-live="polite" aria-atomic="true"><strong>Square {answer.square} · {answer.name}</strong><span>{answer.coordinate}. {answer.answer}</span></p>
              <div className="cine-inspect-actions"><button type="button" disabled={picked === 0} onClick={() => setPicked(value => clamp(value - 1, 0, 99))}>Previous square</button><button type="button" disabled={picked === 99} onClick={() => setPicked(value => clamp(value + 1, 0, 99))}>Next square</button></div>
            </div>}
          </article>
        </section>
      </div>
    </section>
  );
}
