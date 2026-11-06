import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const brand = readFileSync('src/styles/tokens.css', 'utf8');
const semantic = readFileSync('src/design/tokens.css', 'utf8');
const scope = (selector: string) => semantic.slice(semantic.indexOf(selector)).split('}')[0];

describe('approved palette A adoption', () => {
  it('uses matte midnight and muted gold consistently at home, in the workspace and for buyers', () => {
    expect(brand).toContain('--g1-ink: #101B2A;');
    expect(brand).toContain('--g1-gold: #B7A477;');
    for (const selector of ['[data-base="dark"] {', '[data-base="cream"] {']) {
      const base = scope(selector);
      expect(base).toContain('--g-ground: var(--g1-ink);');
      expect(base).toContain('--g-panel: var(--g1-dark-surface);');
      expect(base).toContain('--g-action: var(--g-gold);');
      expect(base).toContain('--g-action-text: var(--g-ink);');
    }
    expect(scope('[data-base].g-editorial {')).toContain('--g-action-text: var(--g-ink);');
  });
});
