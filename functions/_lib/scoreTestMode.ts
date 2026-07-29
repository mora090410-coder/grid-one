export interface ScoreTestModeEnv {
  SCORE_TEST_MODE_ENABLED?: string;
  SCORE_TEST_MODE_OWNER_IDS?: string;
}

export const scoreTestModeAllowed = (
  env: ScoreTestModeEnv,
  ownerId: string,
) => {
  if (env.SCORE_TEST_MODE_ENABLED !== 'true') return false;
  const allowlist = new Set(
    String(env.SCORE_TEST_MODE_OWNER_IDS || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowlist.has(ownerId.toLowerCase());
};
