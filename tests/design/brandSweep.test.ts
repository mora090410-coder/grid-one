import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Corner Square rebrand guards. Gold means winner: it may fill the logo
 * corner and winning squares, and nothing else. The name is always GridOne.
 */
const filesUnder = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? filesUnder(path) : [path];
});
const source = [...filesUnder('src'), ...filesUnder('components'), ...filesUnder('pages'), 'App.tsx', 'index.html']
  .filter((path) => /\.(tsx?|css|html)$/.test(path) && !path.startsWith('src/assets/'));

describe('brand sweep', () => {
  it('never uses gold for text, edges, rings, outlines, or strokes', () => {
    const offenders = source.flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      const hits = [
        ...text.matchAll(/\b(?:text|border|ring|outline|decoration|stroke|shadow)-(?:tone-)?gold\b(?!-deep)/g),
        ...text.matchAll(/(?:^|[;{\s])(?:color|outline(?:-color)?|stroke|border(?:-color)?):[^;]*var\(--g-gold\)/g),
      ];
      return hits.map((hit) => `${path}: ${hit[0].trim()}`);
    });
    expect(offenders).toEqual([]);
  });

  it('fills with gold only on winning squares and the winner mark', () => {
    const allowed = new Set([
      'src/features/viewer/board/ViewerBoardGrid.tsx',
      'src/features/viewer/personal/YourSquaresSummary.tsx',
      'src/index.css',
      'src/design/tokens.css',
    ]);
    const offenders = source.filter((path) => /\bbg-gold\b|background(?:-color)?:[^;]*var\(--g-gold\)/.test(readFileSync(path, 'utf8')) && !allowed.has(path));
    expect(offenders).toEqual([]);
  });

  it('spells the name GridOne in user-facing copy', () => {
    const offenders = source.flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/\b(?:Grid One|Grid-One|Gridone|GRIDONE|Grid one)\b(?!_)/g)].map((m) => `${path}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });
});
