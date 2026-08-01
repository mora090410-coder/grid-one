import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/AdminPanel.tsx'), 'utf8');

describe('organizer payout description editor contract', () => {
  it('uses bounded free text, stays outside the published lock, and has no invented amounts', () => {
    expect(source).toContain('onSavePayoutDescriptions');
    expect(source).toContain('maxLength={120}');
    expect(source).toContain('maxLength={280}');
    expect(source).toContain('Save payout descriptions');
    expect(source).toContain('Winner gets bragging rights');
    expect(source).not.toMatch(/payout[^\n]*(?:125|250)/i);
    expect(source).not.toMatch(/type="number"[^>]*payout|payout[^>]*type="number"/i);
    expect(source).not.toMatch(/<fieldset disabled=\{isPublished\}[^>]*>[\s\S]{0,3000}payout-/i);
  });
});
