import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const homepageCorpus = () => [
  'src/features/homepage/Homepage.tsx',
  'src/features/homepage/disclosures.ts',
  'src/features/homepage/cinematic/CinematicHomepage.tsx',
  'src/features/homepage/cinematic/cinematicModel.ts',
  'src/features/homepage/sections/CompactWorkflow.tsx',
  'src/features/homepage/sections/FreeAccessClose.tsx',
  'src/features/homepage/sections/Footer.tsx',
].map(source).join('\n');

const freeAccess = 'Create and publish boards for free.';
const exactBoundary = 'GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.';

describe('public conversion path', () => {
  it('keeps fallback and demo money disclosures on the exact boundary', () => {
    for (const path of ['index.html', 'App.tsx', 'src/features/viewer/details/BoardDetailsDisclosure.tsx']) {
      expect(source(path), path).toContain(exactBoundary);
    }
    expect(source('src/features/viewer/score/ScoreInstrument.tsx')).toContain('Sample board — not a live game');
  });
  it('answers landing-page objections and closes with a second conversion point', () => {
    const homepage = homepageCorpus();
    for (const copy of [
      'Football squares for team fundraisers.',
      'Viewers open the link without creating an account',
      'Do viewers need an account?',
      'Does GridOne collect square money?',
      'Is GridOne free?',
      'Public viewer link: viewing only.',
      'that seller’s unsold squares by name until the numbers lock',
      'Private family editing links are separate; payment notes stay private.',
      'Every board is free.',
      exactBoundary,
    ]) expect(homepage).toContain(copy);
    // The second conversion point must be rendered beside the free-access message, not just
    // survive in an unused legacy section included by a directory-wide scan.
    expect(source('src/features/homepage/Homepage.tsx')).toContain('<FreeAccessClose />');
    expect(source('src/features/homepage/sections/FreeAccessClose.tsx')).toMatch(/<PrimaryCtaLink to="\/create" trackCreate>Create your free board<\/PrimaryCtaLink>/);
  });

  it('keeps create intent through signup and reassures the organizer', () => {
    const requireAuth = source('components/auth/RequireAuth.tsx');
    const login = source('pages/Login.tsx');
    expect(requireAuth).toContain('mode=signup');
    expect(login).toContain('Start the board now. Publishing is free, and viewers will not need an account.');
    expect(login).toContain('Create account and start board');
  });

  it('turns the demo and article hub into product handoffs', () => {
    const boardView = source('components/BoardView.tsx');
    const hub = source('pages/ArticlesHub.tsx');
    expect(boardView).toContain('runYourOwnInvitation(');
    expect(source('src/features/viewer/shell/runYourOwnInvitation.ts')).toContain('This is a sample board. Ready to run yours?');
    expect(boardView).toContain('Create your own board');
    expect(hub).toContain('Football squares guides for organizers');
    expect(hub).toContain('Create your free board');
    expect(hub).not.toContain('capture real football squares search traffic');
  });

  it('removes internal and unsupported article claims while keeping free access clear', () => {
    const youth = source('pages/YouthSportsFootballSquaresFundraiser.tsx');
    const comparison = source('pages/RunYourPoolAlternative.tsx');
    expect(youth).not.toContain('GTM lane');
    expect(comparison).not.toMatch(/built in 2004|hidden costs|liquid glass|legacy platforms struggle/i);
    expect(comparison).toContain(freeAccess);
  });

  it('gives high-intent fundraiser articles a primary create-board CTA', () => {
    for (const path of [
      'pages/YouthSportsFootballSquaresFundraiser.tsx',
      'pages/BoosterClubFootballSquares.tsx',
      'pages/FootballSquaresFundraiser.tsx',
      'pages/ChurchSchoolFundraiserSquares.tsx',
      'pages/FootballSquaresApp.tsx',
    ]) {
      const article = source(path);
      expect(article, path).toContain('title="Build a fundraiser board"');
      expect(article, path).toMatch(/to: '\/create', label: 'Create your free board', primary: true/);
    }
  });

  it('offers a next step on missing pages', () => {
    const notFound = source('pages/NotFound.tsx');
    expect(notFound).toContain('Create a new board');
    expect(notFound).toContain('See the demo board');
  });
});
