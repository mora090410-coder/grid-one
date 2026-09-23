/** Pure rules for the organizer's "Send seller links" card. */
export interface SellerSummary { label: string; total: number; unsold: number }
export interface SellerLink { label: string; code: string; url: string }

/** A seller's square is unsold while its public name is still the seller's own name. */
export const summarizeSellers = (labels: (string | null | undefined)[], squares: string[][]): SellerSummary[] => {
  const byLabel = new Map<string, SellerSummary>();
  labels.forEach((label, index) => {
    if (!label) return;
    const summary = byLabel.get(label) ?? { label, total: 0, unsold: 0 };
    summary.total += 1;
    if ((squares[index]?.[0] ?? '') === label) summary.unsold += 1;
    byLabel.set(label, summary);
  });
  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/** What a seller posts. Written for them, in their voice. */
export const sellerShareText = (boardTitle: string) =>
  `I’m selling football squares for ${boardTitle}. Pick yours here and pay me directly:`;

/** One message the organizer can paste into the team chat. */
export const allLinksMessage = (boardTitle: string, links: SellerLink[]) =>
  [`Here’s everyone’s link for ${boardTitle}. Post yours so people can pick your squares:`, '', ...links.map((link) => `${link.label}: ${link.url}`)].join('\n');

export const parseSellerLinks = (value: unknown): SellerLink[] | null => {
  const links = (value as { links?: unknown } | null)?.links;
  if (!Array.isArray(links)) return null;
  const parsed: SellerLink[] = [];
  for (const item of links) {
    const link = item as Record<string, unknown> | null;
    if (!link || typeof link.label !== 'string' || typeof link.code !== 'string' || !/^[a-f0-9]{16}$/.test(link.code)
      || typeof link.url !== 'string' || !/^https?:\/\/[^\s]+\/s\/[a-f0-9]{16}$/.test(link.url)) return null;
    parsed.push({ label: link.label, code: link.code, url: link.url });
  }
  return parsed;
};
