import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const homepageCorpus = () => [
  'src/features/homepage/Homepage.tsx',
  'src/features/homepage/pricing.ts',
  ...readdirSync(resolve(process.cwd(), 'src/features/homepage/sections')).map((f) => `src/features/homepage/sections/${f}`),
].map(source).join('\n');

const exactPricing = 'Your first published board is free. Game Day is $9.99 once for up to 5 published boards in the 2026 season. Organization is $79 per season for up to 50 published boards.';
const exactBoundary = 'GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.';

describe('public conversion path', () => {
  it('keeps fallback and demo money disclosures on the exact boundary', () => {
    for (const path of ['index.html', 'App.tsx', 'src/features/viewer/details/BoardDetailsDisclosure.tsx']) {
      expect(source(path), path).toContain(exactBoundary);
    }
    expect(source('components/BoardView.tsx')).toContain('Sample board — not a live game');
  });
  it('answers landing-page objections and closes with a second conversion point', () => {
    const homepage = homepageCorpus();
    for (const copy of [
      'Build your football squares board, share one link, and give your group a clear view of game day.',
      'Viewers open the link without creating an account',
      'Do viewers need an account?',
      'Does GridOne collect square money?',
      'When do I pay?',
      'Who can edit the board?',
      'Ready to build the board?',
      'organization naming, shared dashboard, and one organization receipt',
      exactBoundary,
    ]) expect(homepage).toContain(copy);
  });

  it('keeps create intent through signup and reassures the organizer', () => {
    const requireAuth = source('components/auth/RequireAuth.tsx');
    const login = source('pages/Login.tsx');
    expect(requireAuth).toContain('mode=signup');
    expect(login).toContain('Start the board now. Your first published board is free, and viewers will not need an account.');
    expect(login).toContain('Create account and start board');
  });

  it('turns the demo and article hub into product handoffs', () => {
    const boardView = source('components/BoardView.tsx');
    const hub = source('pages/ArticlesHub.tsx');
    expect(boardView).toContain('This is a sample board. Ready to run yours?');
    expect(boardView).toContain('Create your own board');
    expect(hub).toContain('Football squares guides for organizers');
    expect(hub).toContain('Create your free board');
    expect(hub).not.toContain('capture real football squares search traffic');
  });

  it('removes internal and unsupported article claims while keeping exact pricing', () => {
    const youth = source('pages/YouthSportsFootballSquaresFundraiser.tsx');
    const comparison = source('pages/RunYourPoolAlternative.tsx');
    expect(youth).not.toContain('GTM lane');
    expect(comparison).not.toMatch(/built in 2004|hidden costs|liquid glass|legacy platforms struggle/i);
    expect(comparison).toContain(exactPricing);
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

  it('always offers a next step after checkout and on missing pages', () => {
    expect(source('pages/Paid.tsx')).toContain("state === 'ready' && !contestId");
    const notFound = source('pages/NotFound.tsx');
    expect(notFound).toContain('Create a new board');
    expect(notFound).toContain('See the demo board');
  });
});
