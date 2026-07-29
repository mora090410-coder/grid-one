import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const trackedProductCopyFiles = () => execFileSync(
  'git',
  ['ls-files', '-z'],
  { cwd: process.cwd(), encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean)
  .filter((path) => (
    /^(components|pages|public|supabase\/migrations|docs)\//.test(path)
    || ['DESIGN.md', 'PRODUCT.md', 'README.md', 'index.html'].includes(path)
  ))
  .filter((path) => /\.(?:html|md|sql|ts|tsx|txt)$/.test(path));

describe('launch pricing copy', () => {
  it('keeps tracked product copy on the $4.99 one-time, up-to-20-board contract', () => {
    const paths = trackedProductCopyFiles();
    const corpus = paths
      .map((path) => `${path}\n${readFileSync(resolve(process.cwd(), path), 'utf8')}`)
      .join('\n');

    expect(corpus).not.toMatch(/\$?14\.99/i);
    expect(corpus).not.toMatch(/at least\s+20\s+boards/i);

    expect(readFileSync(resolve(process.cwd(), 'PRODUCT.md'), 'utf8'))
      .toContain('The 2026 introductory season pass is **$4.99 once**.');
    expect(readFileSync(resolve(process.cwd(), 'components/LandingPage.tsx'), 'utf8'))
      .toContain('$4.99 introductory 2026 season pass for up to 20 boards');
  });
});
