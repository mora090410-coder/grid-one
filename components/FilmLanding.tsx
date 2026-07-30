/**
 * GridOne scroll-film landing — "Paper Had a Good Run."
 * One continuous 5-chapter film scrubbed by scroll (canvas + pre-extracted
 * frames, ImageBitmap sliding window), copy beats over the film, then the
 * content bands. Frames live in /public/film/frames (301 JPEGs).
 * Replaces the previous LandingPage at the root route; LandingPage.tsx is
 * retained in the tree as reference.
 */
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import { PageMetadata } from './seo/PageMetadata';
import './filmLanding.css';

interface FilmLandingProps {
  onCreate: () => void;
  onLogin: () => void;
}

const FRAME_COUNT = 301;
const framePath = (i: number) => `/film/frames/f${String(i + 1).padStart(4, '0')}.jpg`;

const CHAPTERS: Array<[number, string]> = [
  [0.0, 'THE BOARD'],
  [0.2, 'GAME NIGHT'],
  [0.4, 'THE CRUMPLE'],
  [0.6, 'THE SPIRAL'],
  [0.8, 'GAME DAY'],
];

const FilmLanding: React.FC<FilmLandingProps> = ({ onCreate, onLogin }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const filmRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const endfadeRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const hdrRef = useRef<HTMLElement | null>(null);
  const readoutRef = useRef<HTMLDivElement | null>(null);
  const chLabelRef = useRef<HTMLDivElement | null>(null);
  const chBarRef = useRef<HTMLElement | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const loadbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const film = filmRef.current;
    const cv = cvRef.current;
    if (!root || !film || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    let vh = window.innerHeight;
    let raf = 0;
    let disposed = false;

    const size = () => {
      vh = window.innerHeight;
      cv.width = Math.round(window.innerWidth * DPR);
      cv.height = Math.round(vh * DPR);
    };
    size();

    /* frame store */
    const images: Array<HTMLImageElement | undefined> = new Array(FRAME_COUNT);
    let loadedCount = 0;

    /* ImageBitmap sliding window */
    const bitmaps = new Map<number, ImageBitmap>();
    const decoding = new Set<number>();
    const B_AHEAD = 18;
    const B_KEEP = 28;
    let bmpCenter = -999;
    let displayed = -1;

    const nearestFrame = (i: number): number => {
      if (images[i]) return i;
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (images[i - d]) return i - d;
        if (images[i + d]) return i + d;
      }
      return -1;
    };

    const drawFrame = (idx: number, force?: boolean) => {
      if (idx === displayed && !force) return;
      const use = nearestFrame(idx);
      if (use < 0) return;
      const src: CanvasImageSource = bitmaps.get(use) ?? (images[use] as HTMLImageElement);
      const iw = src instanceof ImageBitmap ? src.width : (src as HTMLImageElement).naturalWidth;
      const ih = src instanceof ImageBitmap ? src.height : (src as HTMLImageElement).naturalHeight;
      if (!iw || !ih) return;
      const s = Math.max(cv.width / iw, cv.height / ih);
      const dw = iw * s;
      const dh = ih * s;
      ctx.drawImage(src, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      displayed = idx;
    };

    const ensureBitmaps = (center: number) => {
      if (Math.abs(center - bmpCenter) < 3) return;
      bmpCenter = center;
      const lo = Math.max(0, center - B_AHEAD);
      const hi = Math.min(FRAME_COUNT - 1, center + B_AHEAD);
      for (let i = lo; i <= hi; i++) {
        const img = images[i];
        if (bitmaps.has(i) || decoding.has(i) || !img) continue;
        decoding.add(i);
        createImageBitmap(img)
          .then((b) => {
            decoding.delete(i);
            if (disposed || Math.abs(i - bmpCenter) > B_KEEP) {
              b.close();
              return;
            }
            bitmaps.set(i, b);
            if (i === displayed) drawFrame(i, true);
          })
          .catch(() => decoding.delete(i));
      }
      for (const k of Array.from(bitmaps.keys())) {
        if (k < center - B_KEEP || k > center + B_KEEP) {
          bitmaps.get(k)?.close();
          bitmaps.delete(k);
        }
      }
    };

    /* static grain tile */
    const grain = grainRef.current;
    if (grain) {
      const g = grain.getContext('2d');
      if (g) {
        grain.width = 220;
        grain.height = 220;
        const d = g.createImageData(220, 220);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = 100 + Math.floor(Math.random() * 90);
          d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
          d.data[i + 3] = 255;
        }
        g.putImageData(d, 0, 0);
      }
    }

    /* beats */
    interface Beat { el: HTMLElement; tIn: number; peak: number; tOut: number; }
    const beats: Beat[] = Array.from(root.querySelectorAll<HTMLElement>('.fl-beat')).map((el) => ({
      el,
      tIn: Number(el.dataset.in),
      peak: Number(el.dataset.peak),
      tOut: Number(el.dataset.out),
    }));
    const finaleEl = root.querySelector<HTMLElement>('.fl-finale');
    const beatAlpha = (b: Beat, p: number): number => {
      if (p < b.tIn || p > b.tOut) return 0;
      if (p < b.peak) return (p - b.tIn) / Math.max(1e-4, b.peak - b.tIn);
      if (b.tOut > 1.5) return 1;
      return 1 - (p - b.peak) / Math.max(1e-4, b.tOut - b.peak);
    };

    /* adaptive header luminance sampling */
    const lumCv = document.createElement('canvas');
    lumCv.width = 16;
    lumCv.height = 4;
    const lumCtx = lumCv.getContext('2d', { willReadFrequently: true });
    let lastLum = 0;
    const sampleHeader = (now: number) => {
      if (!lumCtx || now - lastLum < 180 || displayed < 0) return;
      lastLum = now;
      const use = nearestFrame(displayed);
      const img = use >= 0 ? images[use] : undefined;
      if (!img) return;
      try {
        lumCtx.drawImage(img, 0, 0, 16, 4);
        const d = lumCtx.getImageData(0, 0, 16, 4).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const on = sum / (d.length / 4) > 138;
        hdrRef.current?.classList.toggle('fl-on-light', on);
        readoutRef.current?.classList.toggle('fl-on-light', on);
      } catch {
        /* canvas tainting cannot occur for same-origin frames; ignore */
      }
    };

    const progress = (): number => {
      const r = film.getBoundingClientRect();
      return Math.max(0, Math.min(1, -r.top / (r.height - vh)));
    };

    let target = 0;
    let current = 0;
    let lenis: Lenis | null = null;

    const tick = (now: number) => {
      if (disposed) return;
      lenis?.raf(now);

      const p = progress();
      target = p * (FRAME_COUNT - 1);
      current += (target - current) * (reduce ? 1 : 0.14);
      if (Math.abs(target - current) < 0.5) current = target;
      const idx = Math.round(current);
      ensureBitmaps(idx);
      drawFrame(idx);
      sampleHeader(now);

      for (const b of beats) {
        const a = beatAlpha(b, p);
        b.el.style.opacity = a.toFixed(3);
        if (b.el !== finaleEl) {
          const dir = p < b.peak ? 1 : -1;
          const off = (1 - a) * 26 * dir;
          const base = b.el.classList.contains('fl-b-center')
            ? 'translate(-50%,-50%)'
            : b.el.classList.contains('fl-b-left')
              ? 'translateY(-50%)'
              : '';
          b.el.style.transform = `${base} translateY(${off.toFixed(1)}px)`;
        }
      }
      finaleEl?.classList.toggle('fl-live', p > 0.86);

      const pastFilm = p >= 1 && film.getBoundingClientRect().bottom <= vh * 0.2;
      hdrRef.current?.classList.toggle('fl-solid', pastFilm);
      if (pastFilm) hdrRef.current?.classList.remove('fl-on-light');

      let ci = 0;
      for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i][0]) ci = i;
      if (chLabelRef.current && chLabelRef.current.textContent !== CHAPTERS[ci][1]) {
        chLabelRef.current.textContent = CHAPTERS[ci][1];
      }
      if (chBarRef.current) chBarRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      readoutRef.current?.classList.toggle('fl-gone', p >= 1);

      const endRamp = Math.max(0, (p - 0.92) / 0.08);
      if (endfadeRef.current) endfadeRef.current.style.opacity = (endRamp * 0.55).toFixed(3);
      if (vignetteRef.current) vignetteRef.current.style.opacity = (1 - endRamp).toFixed(3);
      if (grain) grain.style.opacity = (0.07 * (1 - endRamp)).toFixed(3);

      raf = requestAnimationFrame(tick);
    };

    const loadFrame = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          if (img.complete && img.naturalWidth) images[i] = img;
          loadedCount++;
          if (loadbarRef.current) {
            loadbarRef.current.style.width = `${((loadedCount / FRAME_COUNT) * 100).toFixed(1)}%`;
          }
          resolve();
        };
        img.src = framePath(i);
      });

    const pump = async (concurrency = 10) => {
      let next = 0;
      const workers = new Array(Math.min(concurrency, FRAME_COUNT)).fill(0).map(async () => {
        while (next < FRAME_COUNT && !disposed) {
          const i = next++;
          if (!images[i]) await loadFrame(i);
        }
      });
      await Promise.all(workers);
    };

    const onResize = () => {
      size();
      drawFrame(displayed, true);
    };
    window.addEventListener('resize', onResize);

    const boot = async () => {
      if (reduce) {
        await loadFrame(FRAME_COUNT - 1);
        drawFrame(FRAME_COUNT - 1, true);
        loaderRef.current?.classList.add('fl-done');
        raf = requestAnimationFrame(tick);
        return;
      }
      await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(loadFrame));
      if (disposed) return;
      ensureBitmaps(0);
      drawFrame(0, true);
      loaderRef.current?.classList.add('fl-done');
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      window.__lenis = lenis;
      raf = requestAnimationFrame(tick);
      void pump();
    };
    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      lenis?.destroy();
      if (window.__lenis === lenis) delete window.__lenis;
      for (const b of bitmaps.values()) b.close();
      bitmaps.clear();
    };
  }, []);

  const title = 'GridOne — Live Football Squares Boards With Automatic Score Tracking';
  const description =
    'Football squares for booster clubs, offices, and game-day crews. Build your board in minutes, share one link — and everyone watches their squares hit, live, all game.';

  return (
    <div ref={rootRef} className="fl-root">
      <PageMetadata
        title={title}
        description={description}
        path="/"
        type="website"
        schema={[
          { '@type': 'WebSite', name: 'GridOne', url: 'https://www.getgridone.com/' },
          {
            '@type': 'SoftwareApplication',
            name: 'GridOne',
            applicationCategory: 'SportsApplication',
            operatingSystem: 'Any',
            description,
            offers: [
              { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'First published board free every season' },
              { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', description: 'Game Day — up to 5 boards for the 2026 season' },
              { '@type': 'Offer', price: '79', priceCurrency: 'USD', description: 'Organization — up to 50 boards per season' },
            ],
          },
        ]}
      />

      <div ref={loaderRef} className="fl-loader" aria-hidden="true">
        <div className="fl-loader-wm">GRID<b>ONE</b></div>
        <div className="fl-loadbar"><i ref={(el) => { loadbarRef.current = el; }} /></div>
        <small>LOADING THE FILM</small>
      </div>

      <header ref={hdrRef} className="fl-hdr">
        <Link className="fl-wordmark" to="/">GRID<b>ONE</b></Link>
        <nav className="fl-hdr-right">
          <button type="button" className="fl-signin" onClick={onLogin}>Sign in</button>
          <button type="button" className="fl-btn fl-btn-primary" onClick={onCreate}>Create board</button>
        </nav>
      </header>

      <div ref={readoutRef} className="fl-readout" aria-hidden="true">
        <div className="fl-readout-label" ref={chLabelRef}>THE BOARD</div>
        <div className="fl-readout-bar"><i ref={(el) => { chBarRef.current = el; }} /></div>
      </div>

      {/* ── THE FILM ── */}
      <div ref={filmRef} className="fl-film">
        <div className="fl-stage">
          <canvas ref={cvRef} className="fl-cv" />
          <div ref={vignetteRef} className="fl-vignette" />
          <canvas ref={grainRef} className="fl-grain" />
          <div ref={endfadeRef} className="fl-endfade" />

          <div className="fl-beat fl-b-low fl-beat-ink" data-in="-0.1" data-peak="0.02" data-out="0.13">
            <span className="fl-beat-eyebrow">EVERY SEASON STARTS THE SAME</span>
            <h2>Somebody draws the grid.<br />Somebody sells the squares.</h2>
          </div>

          <div className="fl-beat fl-b-left" data-in="0.18" data-peak="0.26" data-out="0.34">
            <h2>Then the game starts.</h2>
            <p>And the paper starts working against you.</p>
          </div>

          <div className="fl-beat fl-b-center" data-in="0.42" data-peak="0.50" data-out="0.58">
            <h2>Paper had<br />a good run.</h2>
          </div>

          <div className="fl-beat fl-b-left" data-in="0.63" data-peak="0.71" data-out="0.79">
            <h2>This season, the board<br />watches the game.</h2>
          </div>

          <div className="fl-beat fl-b-left fl-finale" data-in="0.86" data-peak="0.93" data-out="2">
            <span className="fl-beat-eyebrow">GRIDONE</span>
            <h2>The board watches<br />the game</h2>
            <p>
              Football squares for booster clubs, offices, and game-day crews. Build your board in
              minutes, share one link — and everyone watches their squares hit, live, all game.
            </p>
            <div className="fl-chips" aria-label="Highlights">
              <span>FREE TO START</span>
              <span>ONE LINK, NO APP</span>
              <span>LIVE SCORES &amp; WINNERS</span>
              <span>YOU STAY IN CONTROL</span>
            </div>
            <div className="fl-ctas">
              <button type="button" className="fl-btn fl-btn-primary" onClick={onCreate}>
                Build your board — free
              </button>
              <Link className="fl-btn fl-btn-ghost" to="/demo">See a live board</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── AFTER THE FILM ── */}
      <div className="fl-landingzone" aria-hidden="true" />

      <section className="fl-band fl-band-light" id="how">
        <h3>How it works</h3>
        <ol className="fl-steps">
          <li>
            <span className="fl-num fl-mono">01</span>
            <div>
              <h4>Build your board</h4>
              <p>
                Type names straight in, or snap a photo of the paper board you already have and fix
                it up. Ten minutes, start to finish.
              </p>
            </div>
          </li>
          <li>
            <span className="fl-num fl-mono">02</span>
            <div>
              <h4>Share one link</h4>
              <p>
                Text it. Post it in the group chat. Tape the QR code to the concession stand.
                Everyone sees the same live board — nobody needs an account or an app.
              </p>
            </div>
          </li>
          <li>
            <span className="fl-num fl-mono">03</span>
            <div>
              <h4>Enjoy the game</h4>
              <p>
                Scores update on their own. Winners light up each quarter and get an email. No more
                &ldquo;wait, who won Q3?&rdquo; texts at halftime.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="fl-band fl-band-news" id="pricing">
        <h3>What it costs</h3>
        <div className="fl-pricing">
          <div className="fl-tier">
            <div className="fl-t-name">FIRST BOARD</div>
            <div className="fl-t-price">Free</div>
            <div className="fl-t-per">every season</div>
            <p>Build it, share it, run it all game day. The whole thing — live scores, winners, the works.</p>
          </div>
          <div className="fl-tier fl-tier-hot">
            <div className="fl-t-name">GAME DAY</div>
            <div className="fl-t-price">$9.99</div>
            <div className="fl-t-per">once · up to 5 boards · 2026 season</div>
            <p>For the regular. Regular season, playoffs, and the big game included.</p>
          </div>
          <div className="fl-tier">
            <div className="fl-t-name">ORGANIZATION</div>
            <div className="fl-t-price">$79</div>
            <div className="fl-t-per">per season · up to 50 boards</div>
            <p>Your club&rsquo;s name on every board, all of them on one dashboard, one clean receipt for the treasurer.</p>
          </div>
        </div>
      </section>

      <section className="fl-band fl-band-cardinal">
        <div className="fl-goldrule" />
        <div className="fl-close">
          <div>
            <h3>Kickoff is closer<br />than you think</h3>
            <p>Your first published board is free. Upgrade only when you need another.</p>
          </div>
          <div className="fl-ctas">
            <button type="button" className="fl-btn fl-btn-primary" onClick={onCreate}>Build a board</button>
            <Link className="fl-btn fl-btn-ghost" to="/articles">Read the guides</Link>
          </div>
        </div>
      </section>

      <footer className="fl-footer">
        <div className="fl-wordmark">GRID<b>ONE</b></div>
        <p>
          GridOne tracks the board. It never touches the money — squares and payouts stay between
          you and your group.
        </p>
        <div className="fl-footer-meta">© 2026 GRIDONE</div>
      </footer>
    </div>
  );
};

export default FilmLanding;
