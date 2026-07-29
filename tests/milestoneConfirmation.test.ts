import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeEspnScoreSummary } from '../functions/_lib/espnNfl';
import { pendingMilestoneConfirmationDue } from '../functions/api/pools/[id]/score';
import { milestoneCorrectionEspnSequence } from './fixtures/espnNfl.fixture';

describe('milestone confirmation recorded fixtures', () => {
  it('normalizes a late extra-point sequence without treating the period flip as settled', () => {
    const observations = milestoneCorrectionEspnSequence.map(({ observedAt, summary }) => ({
      observedAt,
      score: normalizeEspnScoreSummary(summary),
    }));

    expect(observations.map(({ score }) => ({
      state: score.state,
      period: score.period,
      sideQ1: score.awayTeam.quarterScores.Q1,
      topQ1: score.homeTeam.quarterScores.Q1,
    }))).toEqual([
      { state: 'in', period: 2, sideQ1: 7, topQ1: 13 },
      { state: 'in', period: 2, sideQ1: 7, topQ1: 14 },
      { state: 'in', period: 2, sideQ1: 7, topQ1: 14 },
    ]);
    expect(
      new Date(observations[2].observedAt).getTime()
        - new Date(observations[1].observedAt).getTime(),
    ).toBe(45_000);
  });

  it('keeps scoring reads free of provider email sends and handler-side observation', () => {
    const scoreHandler = readFileSync(
      resolve(process.cwd(), 'functions/api/pools/[id]/score.ts'),
      'utf8',
    );
    expect(scoreHandler).not.toContain('api.resend.com');
    expect(scoreHandler).not.toContain('resolveMilestonesAndNotify');
    expect(scoreHandler).not.toContain('observeMilestones');
  });

  it('makes score promotion and milestone observation one database transaction', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/017_milestone_observation_efficiency.sql',
      ),
      'utf8',
    );
    expect(migration).toMatch(
      /gridone_promote_score_snapshot_without_milestones[\s\S]*gridone_observe_milestones/,
    );
    expect(migration).toContain('milestone_observed_snapshot_id');
    expect(migration).toContain('milestones_finalized_at');
    expect(migration).toContain('IS DISTINCT FROM projected_history');
  });

  it('forces the second provider read at 45 seconds even while the score cache is fresh', () => {
    const pending = [{
      milestone: 'Q1',
      lastObservedAt: '2026-09-13T18:00:25.000Z',
    }];
    expect(pendingMilestoneConfirmationDue(
      pending,
      new Date('2026-09-13T18:01:09.999Z').getTime(),
    )).toBe(false);
    expect(pendingMilestoneConfirmationDue(
      pending,
      new Date('2026-09-13T18:01:10.000Z').getTime(),
    )).toBe(true);
  });

  it('renders pending results as provisional and exposes append-only correction consequences', () => {
    const horizon = readFileSync(
      resolve(process.cwd(), 'components/GameDayHorizon.tsx'),
      'utf8',
    );
    const styles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const admin = readFileSync(resolve(process.cwd(), 'components/AdminPanel.tsx'), 'utf8');
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/015_milestone_confirmation.sql'),
      'utf8',
    );

    expect(horizon).toContain('result pending confirmation');
    expect(styles).toMatch(/\.gdh-pending-results[\s\S]*border:\s*1px dashed/);
    expect(admin).toContain('Publish correction and email both people');
    expect(migration).toContain('supersedes_resolution_id');
    expect(migration).toContain('resolution_version');
    expect(migration).not.toContain('ignoreDuplicates');
  });
});
