import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTE_METADATA } from '../seo/publicRouteMetadata';

const source = (path: string) => readFileSync(path, 'utf8');

describe('free-only organizer experience', () => {
  it('does not connect organizer screens to billing and checkout', () => {
    for (const path of ['App.tsx', 'components/BoardView.tsx', 'pages/Dashboard.tsx', 'src/features/organizer/workspace/OrganizerWorkspace.tsx', 'src/features/organizer/workspace/PublishSheet.tsx']) {
      expect(source(path), path).not.toMatch(/\/api\/billing|\/api\/stripe|Checkout|UpgradeSheet|Season plans|season allowance|path="\/paid"/i);
    }
  });

  it('advertises free boards without retired plan prices in metadata and first paint', () => {
    const home = PUBLIC_ROUTE_METADATA.find(entry => entry.path === '/');
    expect(home?.description).toContain('Create and publish boards for free');
    expect(JSON.stringify(home?.schema)).not.toMatch(/9\.99|\b79\b|Game Day|Organization plan/);
    expect(PUBLIC_ROUTE_METADATA.some(entry => entry.path === '/paid')).toBe(false);
    expect(source('index.html')).not.toMatch(/first published board|free each season/i);
  });
});
