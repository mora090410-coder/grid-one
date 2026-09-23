import type { BoardData, QuarterAxes } from '../../types';
import { QUARTER_KEYS } from '../../utils/quarterAxes';

export const BOARD_SCAN_PROMPT = `Read this football squares photo literally. One permanent 10 by 10 ownership grid; do not make four ownership grids. Return JSON only:
{"isDynamic":boolean,"leftAxis":[10 digits or null],"topAxis":[10 digits or null],"leftAxisByQuarter":{"Q1":[],"Q2":[],"Q3":[],"Q4":[]},"topAxisByQuarter":{"Q1":[],"Q2":[],"Q3":[],"Q4":[]},"topTeamText":"literal top team label","leftTeamText":"literal side team label","squaresGrid":[10 rows of 10 strings]}
Top is columns left to right. Left is rows top to bottom. Preserve the photographed orientation, not home/away conventions. If the photo has four number sets, isDynamic=true and read each set independently; Q2 is halftime and Q4 is Final. Do not duplicate Q1 into missing quarters. For a fixed board omit ByQuarter fields. Never enforce unique digits while reading: repeated digits are real input, not an error to repair. Preserve every legible digit exactly where written. Use null for unreadable or absent digits, never infer a missing digit. Use empty strings for blank squares and ??? for unreadable names. Never invent names, team labels, payouts, or rules. Do not change payouts.`;

/** Provider-contract parser, not proof that an image was successfully scanned. */
export function parseScannedBoard(parsed: any): BoardData {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.isDynamic !== 'boolean' && parsed.isDynamic !== undefined) throw new Error('The scan returned an invalid number mode.');
  if (!Array.isArray(parsed.squaresGrid) || parsed.squaresGrid.length !== 10) throw new Error('The 10 by 10 grid could not be read reliably.');
  const squares: string[][] = [];
  for (const row of parsed.squaresGrid) {
    if (!Array.isArray(row) || row.length !== 10) throw new Error('The 10 by 10 grid could not be read reliably.');
    for (const cell of row) {
      const name = typeof cell === 'string' ? cell.trim().slice(0,80) : '???';
      squares.push(name ? [name] : []);
    }
  }
  // Do not normalize positional or mode contradictions into a publishable permutation.
  const maps = [parsed.leftAxisByQuarter, parsed.topAxisByQuarter];
  const hasMaps = maps.some(value => value !== undefined);
  if (parsed.isDynamic === false && hasMaps) throw new Error('Scan needs review: fixed mode contradicts quarter maps. Retry or enter the board manually.');
  for (const value of maps) {
    if (value === undefined) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Scan needs review: quarter maps must be objects.');
    if (Object.keys(value).some(key => !QUARTER_KEYS.includes(key as any))) throw new Error('Scan needs review: unsupported quarter key.');
  }
  const axes = [parsed.leftAxis, parsed.topAxis, ...maps.flatMap(value => value ? Object.values(value) : [])];
  if (axes.some(value => value !== undefined && value !== null && (!Array.isArray(value) || value.length > 10))) {
    throw new Error('Scan needs review: ambiguous axis positions. Retry or enter the board manually; no extra digits were discarded.');
  }
  const axis = (value: unknown): (number | null)[] => Array.from({length:10}, (_, index) => {
    const digit = Array.isArray(value) ? value[index] : null;
    return typeof digit === 'number' && Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
  });
  const isDynamic = parsed.isDynamic === true || Boolean(parsed.topAxisByQuarter || parsed.leftAxisByQuarter);
  const sets = (value: any) => Object.fromEntries(QUARTER_KEYS.map(key => [key, axis(value?.[key])])) as unknown as QuarterAxes;
  return {
    squares, isDynamic, leftAxis: axis(parsed.leftAxis), topAxis: axis(parsed.topAxis),
    ...(isDynamic ? { leftAxisByQuarter: sets(parsed.leftAxisByQuarter), topAxisByQuarter: sets(parsed.topAxisByQuarter) } : {}),
    scanReview: {
      topTeamText: typeof parsed.topTeamText === 'string' ? parsed.topTeamText.slice(0,100) : '',
      leftTeamText: typeof parsed.leftTeamText === 'string' ? parsed.leftTeamText.slice(0,100) : '',
      literalAxes: JSON.stringify({ leftAxis: parsed.leftAxis, topAxis: parsed.topAxis, leftAxisByQuarter: parsed.leftAxisByQuarter, topAxisByQuarter: parsed.topAxisByQuarter }).slice(0,12000),
    },
  };
}
