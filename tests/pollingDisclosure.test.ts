import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('launch polling decision', () => {
  it('documents minute polling instead of promising realtime delivery', () => {
    const product = source('PRODUCT.md');
    const design = source('DESIGN.md');

    expect(product).toContain('Viewer score updates about every three minutes');
    expect(product).not.toContain('- Realtime viewer updates');
    expect(design).toContain('viewer updates arrive about every three minutes');
  });

  it('discloses the polling cadence on the viewer score surface', () => {
    const scoreModel = source('src/features/viewer/score/viewerScoreModel.ts');
    const comparison = source('pages/RunYourPoolAlternative.tsx');

    expect(scoreModel).toContain('Score updates about every three minutes');
    expect(comparison).toContain('Updates about every three minutes with source and freshness shown');
    expect(comparison).not.toContain('Updates instantly on every device');
    expect(comparison).not.toContain('The Real-Time Scenario Engine');
  });
});
