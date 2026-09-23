import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const liveCopyFiles = [
  'src/features/homepage/Homepage.tsx',
  'src/features/homepage/pricing.ts',
  'src/features/homepage/demoData.ts',
  'src/features/homepage/sections/Hero.tsx',
  'src/features/homepage/sections/Footer.tsx',
  'src/features/homepage/sections/ScoreSection.tsx',
  'src/features/homepage/sections/OrganizerSection.tsx',
  'src/features/homepage/sections/PriceAndClose.tsx',
  'src/features/homepage/renders/organizerDemoData.ts',
  'src/features/site/SiteHeader.tsx',
  'src/features/site/SiteFooter.tsx',
  'src/features/site/SitePage.tsx',
  'src/features/site/ArticleShell.tsx',
  'src/features/viewer/notifications/WinnerEmailDisclosure.tsx',
  'src/features/viewer/scenarios/ScenarioDisclosure.tsx',
  'src/features/viewer/personal/YourSquaresSummary.tsx',
  'src/features/organizer/workspace/OrganizerWorkspace.tsx',
  'src/features/organizer/workspace/WorkspaceHeader.tsx',
  'src/features/organizer/workspace/BoardEditor.tsx',
  'src/features/organizer/workspace/BoardToolsCard.tsx',
  'src/features/organizer/workspace/DrawControl.tsx',
  'src/features/organizer/workspace/OrganizerIsland.tsx',
  'src/features/organizer/workspace/PayoutRulesCard.tsx',
  'src/features/organizer/workspace/PreviewSheet.tsx',
  'src/features/organizer/workspace/PublishSheet.tsx',
  'src/features/organizer/workspace/RangeAssignBar.tsx',
  'src/features/organizer/workspace/PublishedSheet.tsx',
  'src/features/organizer/workspace/ReconcileCard.tsx',
  'src/features/organizer/workspace/SquareSheet.tsx',
  'src/features/organizer/workspace/UpgradeSheet.tsx',
  'src/features/organizer/workspace/entryMetaService.ts',
  'src/features/organizer/workspace/publishBoard.ts',
  'src/features/organizer/workspace/renamePublishedSquare.ts',
  'src/features/organizer/workspace/secureDraw.ts',
  'src/features/organizer/workspace/selection.ts',
  'src/features/organizer/workspace/useWorkspaceDraft.ts',
  'src/features/organizer/workspace/gameday/SharePanel.tsx',
  'src/features/organizer/workspace/gameday/ScoreAuthorityCard.tsx',
  'src/features/organizer/workspace/gameday/CorrectionsCard.tsx',
  'src/features/organizer/workspace/gameday/DeliveryIssuesCard.tsx',
  'src/features/organizer/workspace/gameday/FinalRecordCard.tsx',
  'src/features/organizer/game-day/ManualScoringPanel.tsx',
  'pages/Dashboard.tsx',
  'pages/Login.tsx',
  'pages/NotFound.tsx',
  'pages/Paid.tsx',
  'pages/CreateContest.tsx',
  'pages/Privacy.tsx',
  'pages/Terms.tsx',
  'pages/ArticlesHub.tsx',
  'pages/BoosterClubFootballSquares.tsx',
  'pages/ChurchSchoolFundraiserSquares.tsx',
  'pages/DigitalFootballSquaresBoardVsPaper.tsx',
  'pages/FootballSquaresApp.tsx',
  'pages/FootballSquaresFundraiser.tsx',
  'pages/HowFootballSquaresWork.tsx',
  'pages/HowToRunSquares.tsx',
  'pages/NFLOpeningWeekSquares.tsx',
  'pages/OfficeSuperBowlSquares.tsx',
  'pages/RunYourPoolAlternative.tsx',
  'pages/SuperBowlSquaresIdeas.tsx',
  'pages/YouthSportsFootballSquaresFundraiser.tsx',
  'components/ScheduledGamePicker.tsx',
  'components/ErrorBoundary.tsx',
  'components/loading/FullScreenLoading.tsx',
  'components/board/ShareModal.tsx',
] as const;

const corpus = liveCopyFiles
  .map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'))
  .join('\n');

describe('production-facing copy', () => {
  it('does not present unsupported capabilities or customer evidence as fact', () => {
    // Source checks are narrow regression guards, not a vocabulary policy or
    // a substitute for reviewing rendered claims against verified product truth.
    expect(corpus).not.toMatch(/digitizes it in seconds|(?:perfect|100% accurate) (?:scan|scanning|import)/i);
    expect(corpus).not.toMatch(/trusted by \d|\d[\d,]* (?:happy customers|paying customers)|(?:customers|teams) have raised \$/i);
    expect(corpus).not.toMatch(/· rev \$\{save\.revision\}/);
  });

  it('keeps pricing, no-money, OPEN, and score-trust language exact', () => {
    expect(corpus).toContain('1 published board per account per season');
    expect(corpus).toContain('$9.99 once for up to 5 published boards in the 2026 season');
    expect(corpus).toContain('$79 per season for up to 50 published boards');
    expect(corpus).toContain('does not collect square money, hold funds, settle payments, or pay winners');
    expect(corpus).toContain('OPEN');
    expect(corpus).toContain('source and freshness');
  });
});
