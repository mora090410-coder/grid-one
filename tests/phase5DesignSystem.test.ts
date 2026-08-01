import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16) / 255,
  Number.parseInt(hex.slice(3, 5), 16) / 255,
  Number.parseInt(hex.slice(5, 7), 16) / 255,
];

const mix = (front: Rgb, back: Rgb, amount: number): Rgb => front.map(
  (channel, index) => channel * amount + back[index] * (1 - amount),
) as Rgb;

const luminance = (color: Rgb) => {
  const [r, g, b] = color.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (first: Rgb, second: Rgb) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('Phase 5 visual system', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const componentPaths = execFileSync(
    'rg',
    ['--files', 'components', 'pages', '-g', '*.tsx'],
    { cwd: process.cwd(), encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean);
  const componentCorpus = componentPaths.map(
    (path) => readFileSync(resolve(process.cwd(), path), 'utf8'),
  ).join('\n');

  it('keeps one 8/12/0 radius system and a deliberately sharp board', () => {
    expect(css).toContain('--gridone-radius-control: 8px');
    expect(css).toContain('--gridone-radius-surface: 12px');
    expect(css).toContain('--gridone-radius-grid: 0px');
    expect(css).toContain('.gridone-board-grid td');
    expect(`${css}\n${componentCorpus}`).not.toContain('rounded-none');
    expect(css).not.toMatch(/border-radius:\s*0(?:px)?\s*;/);
    expect(css).not.toMatch(/border-radius:\s*(?:999px|50%)/);
  });

  it('uses the single elevation token in exactly three allowed rule blocks', () => {
    expect(css.match(/var\(--gridone-elevation-raised\)/g)).toHaveLength(3);
    expect(css).toMatch(/role="dialog"[\s\S]*var\(--gridone-elevation-raised\)/);
    expect(css).toMatch(/\.gridone-organizer-header[\s\S]*var\(--gridone-elevation-raised\)/);
    expect(css).toMatch(/\.gdh-floating-board-controls[\s\S]*var\(--gridone-elevation-raised\)/);
  });

  it('does not reintroduce gradients, blur, or arbitrary shadow utilities', () => {
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient\(/);
    expect(css).not.toMatch(/backdrop-filter|filter:\s*blur/);
    expect(componentCorpus).not.toMatch(/shadow-\[/);
  });

  it('documents passing input contrast instead of the failing 24% border', () => {
    const ink = rgb('#0E0F12');
    const newsprint = rgb('#DEE0E1');
    const white = rgb('#FFFFFF');
    const cardinal = rgb('#8F1D2C');
    const fill = mix(newsprint, white, 0.4);

    expect(contrast(mix(ink, fill, 0.55), fill)).toBeGreaterThanOrEqual(3);
    expect(contrast(mix(ink, fill, 0.60), fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cardinal, fill)).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain('var(--color-ink) 55%, transparent');
    expect(css).toContain('var(--color-ink) 60%, transparent');
  });
});
