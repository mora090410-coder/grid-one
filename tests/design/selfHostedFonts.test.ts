import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Web fonts are self-hosted from public/fonts/ so the first paint does not wait
 * on a cross-origin Google Fonts stylesheet. These checks keep the three pieces
 * that make that work (the @font-face rules, the preload links, the immutable
 * cache header) pointing at files that actually ship.
 */
const html = readFileSync('index.html', 'utf8');
const tokens = readFileSync('src/design/tokens.css', 'utf8');
const headers = readFileSync('public/_headers', 'utf8');
const shippedFonts = readdirSync('public/fonts').filter((name) => name.endsWith('.woff2'));

const faces = Array.from(tokens.matchAll(/@font-face\s*\{([^}]*)\}/g), (match) => {
  const body = match[1];
  const read = (property: string) => body.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1].trim() ?? '';
  return {
    family: read('font-family').replace(/"/g, ''),
    style: read('font-style'),
    weight: read('font-weight'),
    display: read('font-display'),
    file: body.match(/url\("\/fonts\/([^"]+)"\)/)?.[1] ?? '',
    unicodeRange: read('unicode-range'),
  };
});
const preloads = Array.from(
  html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="\/fonts\/([^"]+)">/g),
  (match) => match[1],
);

describe('self-hosted web fonts', () => {
  it('loads no font or stylesheet from Google Fonts', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(tokens).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
  });

  it('declares every family, weight and style the design uses, with swap', () => {
    const declared = new Set(faces.map((face) => `${face.family} ${face.weight} ${face.style}`));
    for (const expected of [
      'Geist 400 normal', 'Geist 500 normal', 'Geist 600 normal',
      'Geist Mono 400 normal', 'Geist Mono 500 normal',
      'Instrument Serif 400 normal', 'Instrument Serif 400 italic',
    ]) {
      expect(declared, expected).toContain(expected);
    }
    for (const face of faces) {
      expect(face.display, face.file).toBe('swap');
      expect(face.unicodeRange, face.file).not.toBe('');
    }
  });

  it('points every @font-face rule at a woff2 file that ships, and ships no unused file', () => {
    for (const face of faces) {
      expect(existsSync(`public/fonts/${face.file}`), face.file).toBe(true);
    }
    expect(new Set(faces.map((face) => face.file))).toEqual(new Set(shippedFonts));
  });

  it('preloads only the latin hero faces, each one also used by an @font-face rule', () => {
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.length).toBeLessThanOrEqual(2);
    for (const file of preloads) {
      expect(faces.some((face) => face.file === file && face.unicodeRange.startsWith('U+0000-00FF')), file).toBe(true);
    }
  });

  it('caches /fonts/* as immutable and ships the font licenses', () => {
    expect(headers).toMatch(/\/fonts\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
    expect(existsSync('public/fonts/OFL-Geist.txt')).toBe(true);
    expect(existsSync('public/fonts/OFL-InstrumentSerif.txt')).toBe(true);
  });
});
