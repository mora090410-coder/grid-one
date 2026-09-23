import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const currentPricingCopyFiles = [
  'src/features/homepage/pricing.ts',
  'src/features/homepage/Homepage.tsx',
  'src/features/homepage/sections/PriceAndClose.tsx',
  'src/features/homepage/sections/Hero.tsx',
  'src/features/homepage/sections/OrganizerSection.tsx',
  'src/features/homepage/sections/ScoreSection.tsx',
  'src/features/homepage/sections/Footer.tsx',
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
  });

  it('keeps reviewed Beta import and the money boundary explicit in landing copy', () => {
    const landing = currentPricingCopyFiles
      .filter((path) => path.startsWith('src/features/homepage/'))
      .map(read)
      .join('\n');

    // These are approved disclosures, not exceptions to a vocabulary blacklist.
    expect(landing).toContain('Already have a paper board? Upload a photo and let GridOne help digitize it. (Beta)');
    expect(landing).toContain('Sign in to import, then review every square before publishing.');
    expect(landing).toContain('does not collect square money, hold funds, settle payments, or pay winners');
    expect(landing).not.toMatch(/digitizes it in seconds|(?:perfect|100% accurate) (?:scan|scanning|import)/i);
  });

  it('does not ship invented payout amounts in live board surfaces', () => {
    const payoutSurfaces = [
      read('src/features/organizer/workspace/OrganizerWorkspace.tsx'),
      read('src/features/organizer/workspace/PayoutRulesCard.tsx'),
      read('src/features/viewer/shell/ViewerShell.tsx'),
      read('src/features/viewer/details/BoardDetailsDisclosure.tsx'),
      read('hooks/usePoolData.ts'),
    ].join('\n');

    expect(payoutSurfaces).not.toMatch(/\$(?:125|250)\b/);
    expect(payoutSurfaces).not.toMatch(/payout[^\n]*(?:\?\?|:)\s*(?:125|250)\b/i);
  });
});
