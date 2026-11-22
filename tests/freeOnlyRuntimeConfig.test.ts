import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('free-only runtime configuration', () => {
  it.each(['.env.example', 'wrangler.toml'])('omits retired billing settings from %s', (file) => {
    const settings = readFileSync(file, 'utf8');
    const retiredDeclarations = settings.match(/^\s*(?:STRIPE[A-Z0-9_]*|PAID_SIGNUP_ENABLED|CHECKOUT_SMOKE_CONTEST_IDS)\s*=/gm);
    expect(retiredDeclarations).toBeNull();
  });
});
