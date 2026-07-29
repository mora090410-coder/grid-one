import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('launch polling decision', () => {
  it('documents minute polling instead of promising realtime delivery', () => {
    const product = source('PRODUCT.md');
    const design = source('DESIGN.md');
    const tasks = source('tasks/todo.md');

    expect(product).toContain('Viewer score updates about every minute');
    expect(product).not.toContain('- Realtime viewer updates');
    expect(design).toContain('viewer updates arrive about every minute');
    expect(tasks).not.toContain('[ ] Add realtime publication/policies');
    expect(tasks).not.toContain('[ ] Broadcast persisted score changes');
  });

  it('discloses the polling cadence on the viewer score surface', () => {
    const horizon = source('components/GameDayHorizon.tsx');
    const comparison = source('pages/RunYourPoolAlternative.tsx');

    expect(horizon).toContain('Score updates about every minute');
    expect(comparison).toContain('Updates about every minute on every device');
    expect(comparison).not.toContain('Updates instantly on every device');
    expect(comparison).not.toContain('The Real-Time Scenario Engine');
  });
});
