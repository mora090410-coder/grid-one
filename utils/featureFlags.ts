export const FEATURE_FLAG_NAMES = ['viewer_v2', 'organizer_v2', 'homepage_v2'] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];
export type FeatureFlagState = Record<FeatureFlagName, boolean>;
export type FeatureFlagVariants = Record<FeatureFlagName, `${FeatureFlagName}:on` | `${FeatureFlagName}:off`>;
export type RouteIntent = 'read_only_preview' | 'production_mutation';

export interface FeatureFlagResolutionInput {
  config?: unknown;
  accountId?: string | null;
  boardId?: string | null;
  query?: string | URLSearchParams | Record<string, string | string[] | boolean | null | undefined> | null;
  routeIntent?: RouteIntent;
}

export interface FeatureFlagResolution {
  flags: FeatureFlagState;
  variants: FeatureFlagVariants;
  queryOverridesIgnored: boolean;
}

type FlagConfig = {
  flags?: Record<string, unknown>;
  cohorts?: Record<string, unknown>;
};

type CohortConfig = {
  accounts?: unknown;
  boards?: unknown;
};

const MAX_ALLOWLIST_ENTRIES = 100;
const MAX_IDENTIFIER_LENGTH = 128;
const DEFAULT_FLAGS: FeatureFlagState = {
  viewer_v2: false,
  organizer_v2: false,
  homepage_v2: false,
};

export function isFeatureFlagName(value: string): value is FeatureFlagName {
  return (FEATURE_FLAG_NAMES as readonly string[]).includes(value);
}

export function parseBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

export function getStableVariantLabel(flag: FeatureFlagName, enabled: boolean): `${FeatureFlagName}:on` | `${FeatureFlagName}:off` {
  return `${flag}:${enabled ? 'on' : 'off'}` as `${FeatureFlagName}:on` | `${FeatureFlagName}:off`;
}

export function resolveFeatureFlags(input: FeatureFlagResolutionInput = {}): FeatureFlagResolution {
  const config = normalizeConfig(input.config);
  const flags: FeatureFlagState = { ...DEFAULT_FLAGS };

  for (const flag of FEATURE_FLAG_NAMES) {
    const explicit = parseBooleanFlag(config?.flags?.[flag]);
    if (explicit !== undefined) {
      flags[flag] = explicit;
    }

    if (!flags[flag] && isAllowlisted(getOwn(config?.cohorts, flag), input.accountId, input.boardId)) {
      flags[flag] = true;
    }
  }

  const queryValues = normalizeQuery(input.query);
  const hasQueryOverrides = FEATURE_FLAG_NAMES.some((flag) => queryValues.has(flag));
  const isReadOnlyPreview = input.routeIntent === 'read_only_preview';
  let queryOverridesIgnored = false;

  if (hasQueryOverrides) {
    if (!isReadOnlyPreview) {
      queryOverridesIgnored = true;
    }
    for (const flag of FEATURE_FLAG_NAMES) {
      if (!isReadOnlyPreview) continue;
      const values = queryValues.getAll(flag);
      if (values.length !== 1) {
        queryOverridesIgnored = true;
        continue;
      }
      const override = parseBooleanFlag(values[0]);
      if (override === undefined) continue;

      flags[flag] = override;
    }
  }

  return {
    flags,
    variants: {
      viewer_v2: getStableVariantLabel('viewer_v2', flags.viewer_v2),
      organizer_v2: getStableVariantLabel('organizer_v2', flags.organizer_v2),
      homepage_v2: getStableVariantLabel('homepage_v2', flags.homepage_v2),
    },
    queryOverridesIgnored,
  };
}

function normalizeConfig(config: unknown): FlagConfig | undefined {
  if (!isPlainObject(config)) return undefined;

  const hasFlagsContainer = hasOwn(config, 'flags');
  const flagsContainer = getOwn(config, 'flags');
  if (hasFlagsContainer && !isPlainObject(flagsContainer)) return undefined;

  const flagsSource = isPlainObject(flagsContainer) ? flagsContainer : config;
  const flags = Object.fromEntries(
    FEATURE_FLAG_NAMES.map((flag) => [flag, getOwn(flagsSource, flag)]),
  );
  const cohorts = getOwn(config, 'cohorts');

  return {
    flags,
    cohorts: isPlainObject(cohorts) ? cohorts : undefined,
  };
}

function isAllowlisted(cohort: unknown, accountId?: string | null, boardId?: string | null): boolean {
  if (!isPlainObject(cohort)) return false;

  const config = cohort as CohortConfig;
  const accountAllowlist = normalizeAllowlist(getOwn(config, 'accounts'));
  const boardAllowlist = normalizeAllowlist(getOwn(config, 'boards'));

  return matchesAllowlist(accountAllowlist, accountId) || matchesAllowlist(boardAllowlist, boardId);
}

function normalizeAllowlist(values: unknown): Set<string> {
  if (!Array.isArray(values)) return new Set();

  const bounded = values.slice(0, MAX_ALLOWLIST_ENTRIES);
  return new Set(
    bounded.filter((value): value is string => (
      typeof value === 'string' && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH
    )),
  );
}

function matchesAllowlist(allowlist: Set<string>, identifier?: string | null): boolean {
  return typeof identifier === 'string' && identifier.length > 0 && allowlist.has(identifier);
}

function normalizeQuery(query: FeatureFlagResolutionInput['query']): URLSearchParams {
  if (!query) return new URLSearchParams();
  if (query instanceof URLSearchParams) return query;
  if (typeof query === 'string') return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === 'boolean') {
      params.set(key, String(value));
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  return params;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getOwn(object: unknown, key: string): unknown {
  return isPlainObject(object) && hasOwn(object, key) ? object[key] : undefined;
}
