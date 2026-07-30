import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const currentPricingCopyFiles = [
  'components/LandingPage.tsx',
  'pages/Terms.tsx',
  'pages/HowToRunSquares.tsx',
  'pages/RunYourPoolAlternative.tsx',
  'seo/publicRouteMetadata.ts',
  'index.html',
  'public/llms.txt',
  'README.md',
  'PRODUCT.md',
  'docs/marketing/gridone-launch-social-pack-2026-04-19.md',
];

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('launch pricing copy', () => {
  it('keeps current customer copy on the approved three-tier ladder', () => {
    const corpus = currentPricingCopyFiles
      .map((path) => `${path}\n${read(path)}`)
      .join('\n');

    expect(corpus).not.toMatch(/(?:^|[^\d])4\.99(?:[^\d]|$)/i);
    expect(corpus).not.toMatch(/(?:^|[^\d])14\.99(?:[^\d]|$)/i);
    expect(corpus).not.toMatch(/\b20\s+boards?\b/i);
    expect(corpus).not.toMatch(/introductory\s+2026\s+season\s+pass/i);

    expect(read('PRODUCT.md')).toContain('The Free tier includes **1 published board per account per season**.');
    expect(read('PRODUCT.md')).toContain('The **Game Day** tier is **$9.99 once** for up to 5 published boards');
    expect(read('PRODUCT.md')).toContain('The **Organization** tier is **$79 per season** for up to 50 published boards');
    expect(read('components/LandingPage.tsx')).toContain("Your first board is free — build it, share it, run it all game day.");
  });

  it('keeps system vocabulary out of the landing-page sales copy', () => {
    const landing = read('components/LandingPage.tsx');

    expect(landing).not.toMatch(/\b(?:beta|synthetic|fallback|read-only|grounded|native|canonical|provenance|freshness|entitlement)\b/i);
    expect(landing).toContain("'SAMPLE GAME'");
    expect(landing).toContain("'YOUR FIRST BOARD IS FREE'");
  });
});
