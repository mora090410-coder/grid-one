import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/design/tokens.css', 'utf8');
const brand = readFileSync('src/styles/tokens.css', 'utf8');
const indexCss = readFileSync('src/index.css', 'utf8');

const dark = tokens.slice(tokens.indexOf('[data-base="dark"]'), tokens.indexOf('[data-base="cream"]'));
const cream = tokens.slice(tokens.indexOf('[data-base="cream"]'));

describe('brand tokens (Corner Square kit)', () => {
  it('ships the kit palette, type, and shape as --g1-* tokens', () => {
    for (const [name, value] of [
      ['--g1-ink', '#13212E'],
      ['--g1-chalk', '#F6F7F5'],
      ['--g1-gold', '#E3A91C'],
      ['--g1-turf', '#1E5A3C'],
      ['--g1-stone', '#5B6670'],
      ['--g1-line', '#D9DDD8'],
      ['--g1-cell', 'rgba(19, 33, 46, 0.08)'],
      ['--g1-surface', '#FFFFFF'],
      ['--g1-dark-bg', '#0C151E'],
      ['--g1-dark-surface', '#13212E'],
      ['--g1-dark-text', '#EEF1EE'],
      ['--g1-dark-stone', '#9AA7B2'],
      ['--g1-dark-line', '#24374A'],
      ['--g1-dark-cell', 'rgba(246, 247, 245, 0.10)'],
      ['--g1-tracking-tight', '-0.03em'],
      ['--g1-radius-sm', '6px'],
      ['--g1-radius', '12px'],
      ['--g1-radius-lg', '18px'],
    ]) {
      expect(brand, name).toContain(`${name}: ${value};`);
    }
    expect(brand).toMatch(/--g1-font:\s*"Archivo",/);
  });

  it('is imported once, at the app root, before the semantic tokens', () => {
    const imports = [...indexCss.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((path) => path === './styles/tokens.css')).toHaveLength(1);
    expect(imports.indexOf('./styles/tokens.css')).toBeLessThan(imports.indexOf('./design/tokens.css'));
  });

  it('loads no remote font stylesheet and ignores the OS color scheme', () => {
    expect(brand).not.toMatch(/@import|googleapis/);
    expect(brand).not.toContain('prefers-color-scheme');
  });
});

describe('design tokens', () => {
  it('builds the core palette from the brand tokens', () => {
    expect(tokens).toMatch(/--g-ink:\s*var\(--g1-ink\);/);
    expect(tokens).toMatch(/--g-white:\s*var\(--g1-chalk\);/);
    expect(tokens).toMatch(/--g-gold:\s*var\(--g1-gold\);/);
    expect(tokens).toMatch(/--g-turf:\s*var\(--g1-turf\);/);
    expect(tokens).toMatch(/--g-newsprint:\s*var\(--g1-line\);/);
    expect(tokens).toMatch(/--g-stage:\s*var\(--g1-ink\);/);
  });

  it('keeps cardinal for errors and destructive confirmations only', () => {
    expect(tokens).toContain('--g-cardinal: #8F1D2C;');
    expect(tokens).toContain('--g-cardinal-deep: #6E1622;');
  });

  it('keeps live green for an in-progress NFL game', () => {
    expect(tokens).toContain('--g-live: #22C55E;');
  });

  it('sets the dark base on brand ink with brand text', () => {
    expect(dark).toMatch(/--g-ground:\s*var\(--g1-ink\)/);
    expect(dark).toMatch(/--g-text:\s*var\(--g1-dark-text\)/);
    expect(dark).toMatch(/--g-text-2:\s*var\(--g1-dark-stone\)/);
    expect(dark).toMatch(/--g-panel:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
    expect(dark).toMatch(/--g-panel-hover:\s*rgba\(255,\s*255,\s*255,\s*0\.10\)/);
    expect(dark).toMatch(/--g-hairline:\s*rgba\(255,\s*255,\s*255,\s*0\.12\)/);
  });

  it('sets the light (cream) base on brand chalk with white cards and line edges', () => {
    expect(cream).toMatch(/--g-ground:\s*var\(--g1-chalk\)/);
    expect(cream).toMatch(/--g-panel:\s*var\(--g1-surface\)/);
    expect(cream).toMatch(/--g-hairline:\s*var\(--g1-line\)/);
    expect(cream).toMatch(/--g-text:\s*var\(--g-ink\)/);
    expect(cream).toMatch(/--g-text-2:\s*var\(--g1-stone\)/);
  });

  it('uses ink for actions and never gold', () => {
    expect(cream).toMatch(/--g-action:\s*var\(--g-ink\)/);
    expect(cream).toMatch(/--g-action-text:\s*var\(--g-white\)/);
    // On the dark base the ink action inverts to chalk with ink text.
    expect(dark).toMatch(/--g-action:\s*var\(--g-white\)/);
    expect(dark).toMatch(/--g-action-text:\s*var\(--g-ink\)/);
    for (const block of [dark, cream]) {
      expect(block).not.toMatch(/--g-action[\w-]*:\s*var\(--g-gold/);
    }
  });

  it('keeps gold out of every glow, tint, tone, and focus token', () => {
    const nonWinner = tokens.replace(/--g-gold(-deep)?:[^;]+;/g, '');
    const offenders = [...nonWinner.matchAll(/^\s*(--g-[\w-]+):[^;]*--g-gold[^;]*;/gm)].map((m) => m[1]);
    expect(offenders).toEqual([]);
    expect(tokens).not.toMatch(/--g-(tone|tint)-gold/);
  });

  it('derives the three ambient tints from brand colors with color-mix, at 20%', () => {
    for (const [name, source] of [
      ['--g-tint-cardinal', '--g-cardinal'],
      ['--g-tint-live', '--g-live'],
      ['--g-tint-turf', '--g-turf'],
    ] as const) {
      const re = new RegExp(`${name}:\\s*color-mix\\(in srgb, transparent 80%, var\\(${source}\\)\\);`);
      expect(tokens, name).toMatch(re);
    }
  });

  it('introduces no hue outside the brand ink, gold, turf, live, and cardinal', () => {
    // ink 209, gold 42.5, live 142.1, turf 150, cardinal 352.1
    const BRAND_HUES = [209, 42.5, 142.1, 150, 352.1];
    const literals: [number, number, number][] = [];
    for (const source of [tokens, brand]) {
      for (const m of source.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        const h = m[1];
        literals.push([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
      }
      for (const m of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        literals.push([Number(m[1]), Number(m[2]), Number(m[3])]);
      }
    }
    expect(literals.length).toBeGreaterThan(0);

    for (const [r, g, b] of literals) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      if (chroma <= 12) continue; // neutral: no hue to police
      let hue: number;
      if (max === r) hue = 60 * (((g - b) / chroma + 6) % 6);
      else if (max === g) hue = 60 * ((b - r) / chroma + 2);
      else hue = 60 * ((r - g) / chroma + 4);
      const nearest = Math.min(...BRAND_HUES.map((h) => {
        const d = Math.abs(hue - h);
        return Math.min(d, 360 - d);
      }));
      expect(nearest, `rgb(${r}, ${g}, ${b}) hue ${hue.toFixed(1)} is outside the brand palette`).toBeLessThanOrEqual(10);
    }
  });

  it('builds the radius scale from the brand shape tokens', () => {
    expect(tokens).toMatch(/--g-radius-control:\s*var\(--g1-radius\)/);
    expect(tokens).toMatch(/--g-radius-card:\s*var\(--g1-radius-lg\)/);
    expect(tokens).toMatch(/--g-radius-capsule:\s*999px/);
    expect(tokens).toMatch(/--g-radius-cell:\s*4px/);
  });

  it('sets display and interface type in Archivo with tight headings', () => {
    expect(tokens).toMatch(/--g-font-display:\s*var\(--g1-font\)/);
    expect(tokens).toMatch(/--g-font-ui:\s*var\(--g1-font\)/);
    expect(tokens).toMatch(/--g-tracking-display:\s*var\(--g1-tracking-tight\)/);
    expect(tokens).not.toMatch(/Instrument Serif|"Geist"/);
  });

  it('defines the two motion curves and reduced-motion override', () => {
    expect(tokens).toMatch(/--g-ease-state:\s*cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/);
    expect(tokens).toMatch(/--g-dur-state:\s*200ms/);
    expect(tokens).toMatch(/--g-dur-spring:\s*450ms/);
    expect(tokens).toContain('prefers-reduced-motion: reduce');
  });
});
