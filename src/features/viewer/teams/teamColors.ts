/**
 * NFL team colors for a thin, decorative stripe beside a team's name.
 *
 * Colors only. GridOne never shows NFL or club logos, and a stripe never
 * carries meaning on its own: the team name or abbreviation is always
 * printed next to it.
 *
 * Gold means winner on the board, so a gold or yellow team color is never
 * chosen. A color that would disappear against the dark viewer ground is
 * skipped for the team's next color, and a team with no usable color gets no
 * stripe rather than a made-up one.
 */

/**
 * Each team's published colors in preference order. Where a team's first
 * color is nearly the viewer ground (Bears navy, Raiders black), its brighter
 * color leads.
 */
const TEAM_PALETTES: Record<string, readonly string[]> = {
  ARI: ['#97233F', '#000000', '#FFB612'],
  ATL: ['#A71930', '#000000', '#A5ACAF'],
  BAL: ['#241773', '#000000', '#9E7C0C'],
  BUF: ['#00338D', '#C60C30'],
  CAR: ['#0085CA', '#101820', '#BFC0BF'],
  CHI: ['#C83803', '#0B162A'],
  CIN: ['#FB4F14', '#000000'],
  CLE: ['#311D00', '#FF3C00'],
  DAL: ['#003594', '#041E42', '#869397'],
  DEN: ['#FB4F14', '#002244'],
  DET: ['#0076B6', '#B0B7BC'],
  GB: ['#203731', '#FFB612'],
  HOU: ['#03202F', '#A71930'],
  IND: ['#002C5F', '#A2AAAD'],
  JAX: ['#101820', '#D7A22A', '#006778'],
  KC: ['#E31837', '#FFB81C'],
  LV: ['#A5ACAF', '#000000'],
  LAC: ['#0080C6', '#FFC20E'],
  LAR: ['#003594', '#FFA300', '#FFD100'],
  MIA: ['#008E97', '#FC4C02'],
  MIN: ['#4F2683', '#FFC62F'],
  NE: ['#002244', '#C60C30', '#B0B7BC'],
  NO: ['#D3BC8D', '#101820'],
  NYG: ['#0B2265', '#A71930', '#A5ACAF'],
  NYJ: ['#125740', '#000000'],
  PHI: ['#004C54', '#A5ACAF'],
  PIT: ['#FFB612', '#101820'],
  SF: ['#AA0000', '#B3995D'],
  SEA: ['#002244', '#69BE28', '#A5ACAF'],
  TB: ['#D50A0A', '#FF7900', '#B1BABF'],
  TEN: ['#0C2340', '#4B92DB', '#C8102E'],
  WAS: ['#5A1414', '#FFB612'],
};

/** Other abbreviations the score provider or organizers use. */
const ALIASES: Record<string, string> = {
  WSH: 'WAS',
  JAC: 'JAX',
  LA: 'LAR',
  OAK: 'LV',
  SD: 'LAC',
  STL: 'LAR',
  GNB: 'GB',
  KAN: 'KC',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
};

/**
 * The viewer ground. The stripe always carries a light hairline, so it only
 * has to be distinguishable from the ground, not meet text contrast. Near
 * black team colors fall below this and are skipped.
 */
export const STRIPE_SURFACE = '#13212E';
export const MIN_STRIPE_CONTRAST = 1.1;

const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;

const luminance = (hex: string) => {
  const linear = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(channel(hex, 1)) + 0.7152 * linear(channel(hex, 3)) + 0.0722 * linear(channel(hex, 5));
};

export const contrastRatio = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** True for gold, amber, and yellow: the colors reserved for winners. */
export const isGoldLike = (hex: string) => {
  const r = channel(hex, 1);
  const g = channel(hex, 3);
  const b = channel(hex, 5);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return false;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 30 && hue <= 65 && saturation >= 0.3 && lightness >= 0.3;
};

const visibleOnViewer = (hex: string) => contrastRatio(hex, STRIPE_SURFACE) >= MIN_STRIPE_CONTRAST;

export const canonicalTeamAbbr = (abbr: string | undefined | null): string | null => {
  const key = (abbr || '').trim().toUpperCase();
  if (!key) return null;
  if (TEAM_PALETTES[key]) return key;
  return ALIASES[key] ?? null;
};

/** The stripe color for a team, or null when the team is unknown or has no usable color. */
export const teamStripeColor = (abbr: string | undefined | null): string | null => {
  const team = canonicalTeamAbbr(abbr);
  if (!team) return null;
  return TEAM_PALETTES[team].find((hex) => !isGoldLike(hex) && visibleOnViewer(hex)) ?? null;
};

export const KNOWN_TEAM_ABBRS = Object.keys(TEAM_PALETTES);
