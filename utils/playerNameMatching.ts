export type PlayerNameMatchTier = 'exact' | 'token' | 'substring' | 'none';

export interface PlayerNameMatchResult {
  tier: PlayerNameMatchTier;
  candidates: string[];
  autoSelect: string | null;
}

export const normalizePlayerName = (value: string): string => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(/\p{P}/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

export const distinctAssignedNames = (squares: string[][]): string[] => {
  const names = new Set<string>();
  squares.forEach((square) => {
    square.forEach((name) => {
      const trimmed = name.trim();
      if (trimmed) names.add(trimmed);
    });
  });
  return Array.from(names).sort((left, right) => left.localeCompare(right));
};

export const matchPlayerNames = (
  query: string,
  names: string[],
  minPartialLength = 2,
): PlayerNameMatchResult => {
  const normalizedQuery = normalizePlayerName(query);
  if (!normalizedQuery) return { tier: 'none', candidates: [], autoSelect: null };

  const normalizedNames = names.map((name) => ({ name, normalized: normalizePlayerName(name) }));
  const exact = normalizedNames
    .filter((candidate) => candidate.normalized === normalizedQuery)
    .map((candidate) => candidate.name);
  if (exact.length) {
    return {
      tier: 'exact',
      candidates: exact,
      autoSelect: exact.length === 1 ? exact[0] : null,
    };
  }

  if (normalizedQuery.length < minPartialLength) {
    return { tier: 'none', candidates: [], autoSelect: null };
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const token = normalizedNames
    .filter((candidate) => {
      const candidateTokens = candidate.normalized.split(' ').filter(Boolean);
      return queryTokens.some((queryToken) => candidateTokens.includes(queryToken));
    })
    .map((candidate) => candidate.name);
  if (token.length) return { tier: 'token', candidates: token, autoSelect: null };

  const substring = normalizedNames
    .filter((candidate) => candidate.normalized.includes(normalizedQuery))
    .map((candidate) => candidate.name);
  if (substring.length) return { tier: 'substring', candidates: substring, autoSelect: null };

  return { tier: 'none', candidates: [], autoSelect: null };
};
