import { describe, expect, it } from 'vitest';
import {
  FEATURE_FLAG_NAMES,
  getStableVariantLabel,
  isFeatureFlagName,
  parseBooleanFlag,
  resolveFeatureFlags,
} from '../utils/featureFlags';

describe('GridOne Slice 3 feature flags', () => {
  it('exposes exactly the reversible v2 feature names', () => {
    expect(FEATURE_FLAG_NAMES).toEqual(['viewer_v2', 'organizer_v2', 'homepage_v2']);
    expect(isFeatureFlagName('viewer_v2')).toBe(true);
    expect(isFeatureFlagName('organizer_v2')).toBe(true);
    expect(isFeatureFlagName('homepage_v2')).toBe(true);
    expect(isFeatureFlagName('payments_v2')).toBe(false);
  });

  it('defaults every flag off for absent or malformed config', () => {
    expect(resolveFeatureFlags().flags).toEqual({ viewer_v2: false, organizer_v2: false, homepage_v2: false });
    expect(resolveFeatureFlags({ config: null }).flags).toEqual({ viewer_v2: false, organizer_v2: false, homepage_v2: false });
    expect(resolveFeatureFlags({ config: 'viewer_v2=true' }).flags).toEqual({ viewer_v2: false, organizer_v2: false, homepage_v2: false });
    expect(resolveFeatureFlags({ config: { viewer_v2: 'yes', organizer_v2: 1, homepage_v2: {} } }).flags).toEqual({
      viewer_v2: false,
      organizer_v2: false,
      homepage_v2: false,
    });
    expect(resolveFeatureFlags({ config: { flags: 'malformed', viewer_v2: true } }).flags).toEqual({
      viewer_v2: false,
      organizer_v2: false,
      homepage_v2: false,
    });

    const inherited = Object.create({ viewer_v2: true });
    expect(resolveFeatureFlags({ config: inherited }).flags.viewer_v2).toBe(false);
    expect(resolveFeatureFlags({ config: new Date() }).flags.viewer_v2).toBe(false);
  });

  it('parses only explicit boolean values and safe boolean strings', () => {
    expect(parseBooleanFlag(true)).toBe(true);
    expect(parseBooleanFlag(false)).toBe(false);
    expect(parseBooleanFlag('true')).toBe(true);
    expect(parseBooleanFlag(' false ')).toBe(false);
    expect(parseBooleanFlag('TRUE')).toBe(true);
    expect(parseBooleanFlag('1')).toBeUndefined();
    expect(parseBooleanFlag('on')).toBeUndefined();
    expect(parseBooleanFlag(0)).toBeUndefined();
  });

  it('resolves direct explicit booleans without leaking identifiers into labels', () => {
    const resolved = resolveFeatureFlags({
      config: { flags: { viewer_v2: true, organizer_v2: 'false', homepage_v2: 'true' } },
      accountId: 'acct-secret-123',
      boardId: 'board-secret-456',
    });

    expect(resolved.flags).toEqual({ viewer_v2: true, organizer_v2: false, homepage_v2: true });
    expect(resolved.variants).toEqual({ viewer_v2: 'viewer_v2:on', organizer_v2: 'organizer_v2:off', homepage_v2: 'homepage_v2:on' });
    expect(JSON.stringify(resolved)).not.toContain('acct-secret-123');
    expect(JSON.stringify(resolved)).not.toContain('board-secret-456');
  });

  it('supports bounded account and board allowlists without exposing public identifiers', () => {
    const config = {
      flags: { viewer_v2: false, organizer_v2: false, homepage_v2: false },
      cohorts: {
        viewer_v2: { accounts: ['acct-allowed'], boards: ['board-allowed'] },
        organizer_v2: { accounts: Array.from({ length: 105 }, (_, index) => `acct-${index}`) },
        homepage_v2: { accounts: ['acct-home'] },
      },
    };

    expect(resolveFeatureFlags({ config, accountId: 'acct-allowed' }).flags.viewer_v2).toBe(true);
    expect(resolveFeatureFlags({ config, boardId: 'board-allowed' }).flags.viewer_v2).toBe(true);
    expect(resolveFeatureFlags({ config, accountId: 'acct-104' }).flags.organizer_v2).toBe(false);
    expect(resolveFeatureFlags({ config, accountId: 'acct-home' }).flags.homepage_v2).toBe(true);

    const resolved = resolveFeatureFlags({ config, accountId: 'acct-allowed', boardId: 'board-allowed' });
    expect(JSON.stringify(resolved)).not.toContain('acct-allowed');
    expect(JSON.stringify(resolved)).not.toContain('board-allowed');
  });

  it('never lets query parameters enable production mutation paths', () => {
    const config = { flags: { viewer_v2: false, organizer_v2: false, homepage_v2: false } };

    const productionMutation = resolveFeatureFlags({
      config,
      query: '?viewer_v2=true&organizer_v2=true&homepage_v2=true',
      routeIntent: 'production_mutation',
    });

    expect(productionMutation.flags).toEqual({ viewer_v2: false, organizer_v2: false, homepage_v2: false });
    expect(productionMutation.queryOverridesIgnored).toBe(true);

    const readOnlyPreview = resolveFeatureFlags({
      config,
      query: '?viewer_v2=true&organizer_v2=true&homepage_v2=true',
      routeIntent: 'read_only_preview',
    });

    expect(readOnlyPreview.flags).toEqual({ viewer_v2: true, organizer_v2: true, homepage_v2: true });

    const productionDowngrade = resolveFeatureFlags({
      config: { flags: { viewer_v2: true, organizer_v2: true, homepage_v2: true } },
      query: '?viewer_v2=false&organizer_v2=false&homepage_v2=false',
      routeIntent: 'production_mutation',
    });
    expect(productionDowngrade.flags).toEqual({ viewer_v2: true, organizer_v2: true, homepage_v2: true });
    expect(productionDowngrade.queryOverridesIgnored).toBe(true);

    const duplicatePreview = resolveFeatureFlags({
      config,
      query: '?viewer_v2=false&viewer_v2=true',
      routeIntent: 'read_only_preview',
    });
    expect(duplicatePreview.flags.viewer_v2).toBe(false);
    expect(duplicatePreview.queryOverridesIgnored).toBe(true);
  });

  it('keeps stable privacy-minimal support labels', () => {
    expect(getStableVariantLabel('viewer_v2', true)).toBe('viewer_v2:on');
    expect(getStableVariantLabel('viewer_v2', false)).toBe('viewer_v2:off');
    expect(resolveFeatureFlags({ config: { flags: { viewer_v2: true } } }).variants.viewer_v2).toBe('viewer_v2:on');
  });

  it('ignores Object.prototype pollution in flags, cohorts, and allowlists', () => {
    Object.defineProperties(Object.prototype, {
      viewer_v2: { value: true, configurable: true },
      cohorts: { value: { organizer_v2: { accounts: ['polluted-account'] } }, configurable: true },
      accounts: { value: ['polluted-account'], configurable: true },
    });

    try {
      const resolved = resolveFeatureFlags({
        config: { cohorts: { organizer_v2: {} } },
        accountId: 'polluted-account',
      });
      expect(resolved.flags).toEqual({ viewer_v2: false, organizer_v2: false, homepage_v2: false });
    } finally {
      delete (Object.prototype as Record<string, unknown>).viewer_v2;
      delete (Object.prototype as Record<string, unknown>).cohorts;
      delete (Object.prototype as Record<string, unknown>).accounts;
    }
  });
});
