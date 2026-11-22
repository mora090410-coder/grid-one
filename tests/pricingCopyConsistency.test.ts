import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const currentCopyFiles = [
  'src/features/homepage/disclosures.ts',
  'src/features/homepage/Homepage.tsx',
  'src/features/homepage/sections/FreeAccessClose.tsx',
  'src/features/homepage/cinematic/CinematicHomepage.tsx',
  'src/features/homepage/cinematic/cinematicModel.ts',
  'src/features/homepage/sections/TrySampleSection.tsx',
  'src/features/homepage/sections/Footer.tsx',
  'src/features/homepage/sections/FundraiserSection.tsx',
  'src/features/homepage/sections/CompareSection.tsx',
  'pages/Terms.tsx',
  'pages/Privacy.tsx',
  'pages/Login.tsx',
  'pages/ArticlesHub.tsx',
  'pages/HowToRunSquares.tsx',
  'pages/RunYourPoolAlternative.tsx',
  'seo/publicRouteMetadata.ts',
  'index.html',
  'public/llms.txt',
];

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('free-only public copy', () => {
  it('does not advertise retired prices, plan tiers, or payment processing', () => {
    for (const path of currentCopyFiles) {
      expect(read(path), path).not.toMatch(/\$9\.99|\$79\b|\$69\.01|season (?:plan|pass)|first (?:published )?board is free|Stripe checkout|processed securely via Stripe/i);
    }
  });

  it('keeps reviewed Beta import and the money boundary explicit in landing copy', () => {
    const landing = currentCopyFiles
      .filter((path) => path.startsWith('src/features/homepage/'))
      .map(read)
      .join('\n');

    // These are approved disclosures, not exceptions to a vocabulary blacklist.
    expect(landing).toContain('Already have a paper board?');
    expect(landing).toContain('Upload a photo to import it (Beta). Sign in, then review every square before publishing.');
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
