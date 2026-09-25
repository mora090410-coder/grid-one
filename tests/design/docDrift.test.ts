import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The docs of record must name the values the code actually ships.
 *
 * This guard exists because they did not. Commit 9f2c239 documented a dark
 * ground of `#111318`, tints at 14%, and a 0.55 layer; commit 2b89e03 shipped
 * `#14161D`, 22%, and 0.75 and left every document behind. Nothing failed, so
 * the drift survived a full stage review and reached production, where the
 * written contract described a page nobody could see.
 *
 * Every check below reads the value out of `src/design/tokens.css` and then
 * demands the same value from each document independently. Moving any ONE of
 * the three files alone fails this test. Changing a token is therefore a
 * three-file edit by construction, which is the only thing that keeps the
 * design docs trustworthy.
 */

const css = readFileSync('src/design/tokens.css', 'utf8');
const brandCss = readFileSync('src/styles/tokens.css', 'utf8');

/** Resolve `var(--g1-x)` to the hex the brand tokens ship. */
const brandHex = (value: string): string => {
  const m = value.match(/^var\((--g1-[\w-]+)\)$/);
  if (!m) return value;
  return one(brandCss, m[1], new RegExp(`${m[1]}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
};
const designMd = readFileSync('DESIGN.md', 'utf8');
const tokensMd = readFileSync('docs/DESIGN_TOKENS.md', 'utf8');

/** Pull exactly one capture out of a source, failing loudly if the shape moved. */
function one(source: string, label: string, re: RegExp): string {
  const matches = [...source.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label}, found ${matches.length}. The document shape changed; update this guard deliberately.`);
  }
  return matches[0][1];
}

describe('design docs do not drift from the shipped tokens', () => {
  it('names the same dark ground hex in tokens.css, DESIGN.md, and DESIGN_TOKENS.md', () => {
    const dark = css.slice(css.indexOf('[data-base="dark"]'), css.indexOf('[data-base="cream"]'));
    const shipped = brandHex(one(dark, 'dark --g-ground', /--g-ground:\s*([^;]+);/).trim()).toUpperCase();

    // DESIGN.md carries it twice: once as design-system front matter, once in prose.
    const frontMatter = one(designMd, 'DESIGN.md ground-dark front matter', /ground-dark:\s*"(#[0-9A-Fa-f]{6})"/).toUpperCase();
    const prose = one(designMd, 'DESIGN.md dark-base prose ground', /\*\*Dark\*\*[^\n]*?ground `(#[0-9A-Fa-f]{6})`/).toUpperCase();
    const table = one(tokensMd, 'DESIGN_TOKENS.md page-ground row', /\|\s*Page ground\s*\|[^|]*\|[^|]*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|/).toUpperCase();

    expect(frontMatter, 'DESIGN.md front matter ground-dark').toBe(shipped);
    expect(prose, 'DESIGN.md dark-base prose').toBe(shipped);
    expect(table, 'docs/DESIGN_TOKENS.md page-ground row').toBe(shipped);
  });

  it('names the same ambient-tint percentage everywhere', () => {
    // `transparent N%` in the mix, so the tint's own strength is 100 - N.
    const tints = [...css.matchAll(/--g-tint-(cardinal|live|turf):\s*color-mix\(in srgb,\s*transparent\s*([\d.]+)%/g)];
    expect(tints, 'three ambient tint tokens in tokens.css').toHaveLength(3);
    const strengths = new Set(tints.map(([, , transparent]) => 100 - Number(transparent)));
    expect(strengths.size, 'all three tints share one cap').toBe(1);
    const shipped = [...strengths][0];

    const designCap = Number(one(designMd, 'DESIGN.md tint cap', /Tints are capped at ([\d.]+)% of their brand color/));
    expect(designCap, 'DESIGN.md ambient-tone tint cap').toBe(shipped);

    // The DESIGN_TOKENS table names the cap once per tone, and the paragraph
    // under it names the cap again as the contrast ceiling. All four must move.
    for (const tone of ['cardinal', 'live', 'turf'] as const) {
      const row = Number(one(tokensMd, `DESIGN_TOKENS.md ${tone} tint row`, new RegExp(`\\|\\s*\`--g-tint-${tone}\`\\s*\\|[^|]*\\|\\s*${tone} ([\\d.]+)%\\s*\\|`)));
      expect(row, `docs/DESIGN_TOKENS.md ${tone} tint row`).toBe(shipped);
    }
    const capProse = Number(one(tokensMd, 'DESIGN_TOKENS.md tint cap prose', /^([\d.]+)% is a contrast cap/m));
    expect(capProse, 'docs/DESIGN_TOKENS.md contrast-cap paragraph').toBe(shipped);
  });

  it('names the same raised chyron surface everywhere', () => {
    const shipped = one(css, '--g-chyron', /--g-chyron:\s*(#[0-9A-Fa-f]{6})\s*;/).toUpperCase();
    const frontMatter = one(designMd, 'DESIGN.md surface-dark front matter', /surface-dark:\s*"(#[0-9A-Fa-f]{6})"/).toUpperCase();
    const table = one(tokensMd, 'DESIGN_TOKENS.md chyron row', /\|\s*Island and chyron ground\s*\|[^|]*\|[^|]*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|/).toUpperCase();

    expect(frontMatter, 'DESIGN.md front matter surface-dark').toBe(shipped);
    expect(table, 'docs/DESIGN_TOKENS.md island-and-chyron row').toBe(shipped);
  });

  it('names the same muted-text token on both bases', () => {
    const dark = css.slice(css.indexOf('[data-base="dark"]'), css.indexOf('[data-base="cream"]'));
    const cream = css.slice(css.indexOf('[data-base="cream"]'));
    const muted = (source: string, label: string) => one(source, label, /--g-text-3:\s*var\((--g1-[\w-]+)\)\s*;/);

    const row = one(tokensMd, 'DESIGN_TOKENS.md text-muted row', /\|\s*Text muted\s*\|[^|]*\|[^|]*\|\s*(`[^`]+` \| `[^`]+`)\s*\|/);
    const [darkDoc, creamDoc] = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    expect(darkDoc, 'docs/DESIGN_TOKENS.md text-muted dark').toBe(muted(dark, 'dark --g-text-3'));
    expect(creamDoc, 'docs/DESIGN_TOKENS.md text-muted cream').toBe(muted(cream, 'cream --g-text-3'));
  });
});
