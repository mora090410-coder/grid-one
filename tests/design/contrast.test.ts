import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/design/tokens.css', 'utf8');
const brandCss = readFileSync('src/styles/tokens.css', 'utf8');

/** Pull `--name: value;` out of a specific `selector { ... }` block. */
function block(selector: string, source = css): string {
  const re = new RegExp(`^${selector}\\s*\\{([^}]*)\\}`, "m");
  const match = source.match(re);
  if (!match) throw new Error(`Could not find block for ${selector}`);
  return match[1];
}

function readVar(source: string, name: string): string {
  const re = new RegExp(`${name}:\\s*([^;]+);`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not find ${name} in block`);
  return match[1].trim();
}

// The semantic :root tokens are built from the brand :root tokens.
const rootBlock = `${block(':root', brandCss)}\n${block(':root')}`;
const darkBlock = block('\\[data-base="dark"\\]');
const creamBlock = block('\\[data-base="cream"\\]');

/** Resolve a value that may be `var(--x)`, through any number of indirections, against a base block then :root. */
function resolveVar(value: string, scope = ''): string {
  const m = value.match(/^var\((--[\w-]+)\)$/);
  if (!m) return value;
  const inScope = scope.match(new RegExp(`${m[1]}:\\s*([^;]+);`));
  return resolveVar(inScope ? inScope[1].trim() : readVar(rootBlock, m[1]), scope);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function parseRgba(value: string): { rgb: [number, number, number]; alpha: number } {
  const hexMatch = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) return { rgb: hexToRgb(value), alpha: 1 };
  const rgbaMatch = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (rgbaMatch) {
    return {
      rgb: [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])],
      alpha: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  throw new Error(`Could not parse color: ${value}`);
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

/** Contrast of a (possibly translucent) token value against a ground, both raw strings from tokens.css. */
function contrastAgainstGround(rawValue: string, groundValue: string, scope = ''): number {
  const ground = parseRgba(resolveVar(groundValue, scope)).rgb;
  const { rgb, alpha } = parseRgba(resolveVar(rawValue, scope));
  const composited = alpha < 1 ? composite(rgb, alpha, ground) : rgb;
  return contrastRatio(composited, ground);
}

const darkGround = readVar(darkBlock, '--g-ground');
const creamGround = readVar(creamBlock, '--g-ground');

describe('token contrast (WCAG 2.x, ratio >= 4.5)', () => {
  it('dark base text-2 and text-3 pass on dark ground', () => {
    const t2 = contrastAgainstGround(readVar(darkBlock, '--g-text-2'), darkGround);
    const t3 = contrastAgainstGround(readVar(darkBlock, '--g-text-3'), darkGround);
    expect(t2).toBeGreaterThanOrEqual(4.5);
    expect(t3).toBeGreaterThanOrEqual(4.5);
  });

  it('cream base text-2 and text-3 pass on cream ground', () => {
    const t2 = contrastAgainstGround(readVar(creamBlock, '--g-text-2'), creamGround);
    const t3 = contrastAgainstGround(readVar(creamBlock, '--g-text-3'), creamGround);
    expect(t2).toBeGreaterThanOrEqual(4.5);
    expect(t3).toBeGreaterThanOrEqual(4.5);
  });

  it('dark base tone colors pass on dark ground', () => {
    for (const name of ['--g-tone-turf', '--g-tone-live', '--g-tone-cardinal']) {
      const c = contrastAgainstGround(readVar(darkBlock, name), darkGround);
      expect(c, `${name} on dark ground`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('cream base tone colors pass on cream ground', () => {
    for (const name of ['--g-tone-turf', '--g-tone-live', '--g-tone-cardinal']) {
      const c = contrastAgainstGround(readVar(creamBlock, name), creamGround);
      expect(c, `${name} on cream ground`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/** Resolve `color-mix(in srgb, transparent N%, var(--brand))` to an rgba pair. */
function parseTint(value: string): { rgb: [number, number, number]; alpha: number } {
  const m = value.match(/^color-mix\(in srgb,\s*transparent\s*([\d.]+)%,\s*var\((--[\w-]+)\)\)$/);
  if (!m) throw new Error(`Not a transparent color-mix: ${value}`);
  return { rgb: parseRgba(resolveVar(readVar(rootBlock, m[2]))).rgb, alpha: (100 - Number(m[1])) / 100 };
}

describe('brand ink dark ground', () => {
  const ground = parseRgba(resolveVar(darkGround)).rgb;

  it('is brand ink #13212E and clears AA for all three dark text tokens', () => {
    expect(ground).toEqual([19, 33, 46]);
    for (const name of ['--g-text', '--g-text-2', '--g-text-3']) {
      const c = contrastAgainstGround(readVar(darkBlock, name), darkGround);
      expect(c, `${name} on the ink ground`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the raised chyron visibly above the ink ground', () => {
    expect(contrastAgainstGround(readVar(rootBlock, '--g-chyron'), darkGround)).toBeGreaterThanOrEqual(1.25);
  });
});

describe('brand pairs (WCAG AA)', () => {
  const rgb = (name: string) => parseRgba(resolveVar(`var(${name})`)).rgb;

  it('ink on chalk and chalk on ink pass AA', () => {
    expect(contrastRatio(rgb('--g1-ink'), rgb('--g1-chalk'))).toBeGreaterThanOrEqual(4.5);
  });

  it('action text passes AA on its action fill on both bases', () => {
    for (const scope of [darkBlock, creamBlock]) {
      const fill = parseRgba(resolveVar(readVar(scope, '--g-action'), scope)).rgb;
      const text = parseRgba(resolveVar(readVar(scope, '--g-action-text'), scope)).rgb;
      expect(contrastRatio(fill, text)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ink text passes AA on a gold winning square', () => {
    expect(contrastRatio(rgb('--g1-ink'), rgb('--g1-gold'))).toBeGreaterThanOrEqual(4.5);
  });

  it('secondary stone text passes AA on chalk and on white cards', () => {
    expect(contrastRatio(rgb('--g1-stone'), rgb('--g1-chalk'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rgb('--g1-stone'), rgb('--g1-surface'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('ambient tints keep text at AA', () => {
  const ground = parseRgba(resolveVar(darkGround)).rgb;
  const TINTS = ['--g-tint-cardinal', '--g-tint-live', '--g-tint-turf'] as const;

  it('caps every tint so the smallest text token still passes over it', () => {
    for (const tintName of TINTS) {
      const { rgb, alpha } = parseTint(readVar(rootBlock, tintName));
      // Worst case: the tint at its FULL token alpha, ignoring SectionTone's
      // 0.75 layer opacity and its radial falloff, so the assertion is stricter
      // than anything that can render.
      const tinted = composite(rgb, alpha, ground);
      for (const textName of ['--g-text', '--g-text-2', '--g-text-3']) {
        const { rgb: textRgb, alpha: textAlpha } = parseRgba(resolveVar(readVar(darkBlock, textName)));
        const text = textAlpha < 1 ? composite(textRgb, textAlpha, tinted) : textRgb;
        const c = contrastRatio(text, tinted);
        expect(c, `${textName} over ${tintName} over the ink ground`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('holds every tint at or below 20% of its brand color', () => {
    for (const tintName of TINTS) {
      expect(parseTint(readVar(rootBlock, tintName)).alpha, tintName).toBeLessThanOrEqual(0.20);
    }
  });
});
