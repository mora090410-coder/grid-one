import { BoardData, GameState } from '../types';

// Canvas-rendered board export.
//
// We draw the grid directly rather than screenshotting the DOM: the on-screen
// board shows initials sized for a phone viewport, but the exported image is
// read by parents in a group text who need to find their own full name. Drawing
// it here also keeps the export independent of Tailwind/webfont loading.

const PALETTE = {
  ink: '#0E0F12',
  newsprint: '#DEE0E1',
  broadcastWhite: '#EFF0F1',
  cardinal: '#8F1D2C',
  white: '#FFFFFF',
} as const;

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const PAD = 40;
const GUTTER = 76;      // left column holding the side-team digits
const CELL = 104;
const GRID = CELL * 10;
const WIDTH = PAD * 2 + GUTTER + GRID;
const HEADER = 196;
const FOOTER = 92;
const HEIGHT = PAD * 2 + HEADER + GUTTER + GRID + FOOTER;

export interface BoardImageOptions {
  board: BoardData;
  game: GameState;
  /** Optional per-cell seller labels, keyed by cell index. */
  sellersByIndex?: Record<number, string | null | undefined>;
  /** Renders seller names instead of owners — the "who still owes me" view. */
  mode?: 'owners' | 'sellers';
  /** Printed in the footer so a forwarded screenshot can still find the board. */
  shareUrl?: string;
}

const font = (size: number, weight: 'bold' | 'normal' = 'normal') =>
  `${weight} ${size}px ${SANS}`;

/**
 * Largest font size at or below `max` that fits `text` in `maxWidth`, or
 * `min` if even that overflows (the caller truncates in that case).
 */
const fitFontSize = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  weight: 'bold' | 'normal' = 'bold',
): number => {
  for (let size = max; size > min; size -= 1) {
    ctx.font = font(size, weight);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return min;
};

const truncateToWidth = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
};

/** Splits a name across at most two lines, preferring a break at whitespace. */
const layoutName = (
  ctx: CanvasRenderingContext2D,
  name: string,
  maxWidth: number,
): { lines: string[]; size: number } => {
  const oneLine = fitFontSize(ctx, name, maxWidth, 17, 11);
  ctx.font = font(oneLine, 'bold');
  if (ctx.measureText(name).width <= maxWidth) return { lines: [name], size: oneLine };

  const words = name.trim().split(/\s+/);
  if (words.length > 1) {
    // Break at the point that keeps the two halves closest in length.
    let best = 1;
    let bestDelta = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const delta = Math.abs(
        words.slice(0, i).join(' ').length - words.slice(i).join(' ').length,
      );
      if (delta < bestDelta) { bestDelta = delta; best = i; }
    }
    const top = words.slice(0, best).join(' ');
    const bottom = words.slice(best).join(' ');
    const size = Math.min(
      fitFontSize(ctx, top, maxWidth, 15, 10),
      fitFontSize(ctx, bottom, maxWidth, 15, 10),
    );
    ctx.font = font(size, 'bold');
    return { lines: [truncateToWidth(ctx, top, maxWidth), truncateToWidth(ctx, bottom, maxWidth)], size };
  }

  ctx.font = font(oneLine, 'bold');
  return { lines: [truncateToWidth(ctx, name, maxWidth)], size: oneLine };
};

const drawHeader = (ctx: CanvasRenderingContext2D, game: GameState, mode: 'owners' | 'sellers') => {
  const centerX = WIDTH / 2;

  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const title = (game.organizationDisplayName || game.title || 'Football Squares').trim();
  const titleSize = fitFontSize(ctx, title.toUpperCase(), WIDTH - PAD * 2, 46, 24);
  ctx.font = font(titleSize, 'bold');
  ctx.fillText(title.toUpperCase(), centerX, PAD + 48);

  const matchup = `${game.topName || game.topAbbr || 'Away'}  vs  ${game.leftName || game.leftAbbr || 'Home'}`;
  const matchupSize = fitFontSize(ctx, matchup, WIDTH - PAD * 2, 30, 16, 'normal');
  ctx.font = font(matchupSize, 'normal');
  ctx.fillStyle = PALETTE.cardinal;
  ctx.fillText(matchup, centerX, PAD + 96);

  const subtitle = [game.dates, game.meta].filter(Boolean).join('  ·  ');
  if (subtitle) {
    ctx.font = font(20, 'normal');
    ctx.fillStyle = PALETTE.ink;
    ctx.globalAlpha = 0.65;
    ctx.fillText(truncateToWidth(ctx, subtitle, WIDTH - PAD * 2), centerX, PAD + 132);
    ctx.globalAlpha = 1;
  }

  if (mode === 'sellers') {
    ctx.font = font(18, 'bold');
    ctx.fillStyle = PALETTE.cardinal;
    ctx.fillText('SOLD BY', centerX, PAD + 168);
  }
};

const drawAxisLabels = (ctx: CanvasRenderingContext2D, game: GameState) => {
  const gridTop = PAD + HEADER + GUTTER;
  const gridLeft = PAD + GUTTER;

  ctx.fillStyle = PALETTE.ink;
  ctx.font = font(22, 'bold');

  // Top team runs along the columns.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Sits high in its band: the digit row below uses a 34px face, and a tighter
  // gap reads as the label colliding with the numbers.
  ctx.fillText(
    (game.topAbbr || game.topName || '').toUpperCase(),
    gridLeft + GRID / 2,
    PAD + HEADER + 12,
  );

  // Side team runs down the rows, drawn rotated.
  ctx.save();
  ctx.translate(PAD + 24, gridTop + GRID / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText((game.leftAbbr || game.leftName || '').toUpperCase(), 0, 0);
  ctx.restore();
};

const drawDigits = (
  ctx: CanvasRenderingContext2D,
  sideAxis: (number | null)[],
  topAxis: (number | null)[],
) => {
  const gridTop = PAD + HEADER + GUTTER;
  const gridLeft = PAD + GUTTER;

  ctx.font = font(34, 'bold');
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let c = 0; c < 10; c += 1) {
    const digit = topAxis[c];
    ctx.fillText(digit === null || digit === undefined ? '·' : String(digit),
      gridLeft + c * CELL + CELL / 2, gridTop - 26);
  }
  for (let r = 0; r < 10; r += 1) {
    const digit = sideAxis[r];
    ctx.fillText(digit === null || digit === undefined ? '·' : String(digit),
      gridLeft - GUTTER / 2, gridTop + r * CELL + CELL / 2);
  }
};

const drawCells = (
  ctx: CanvasRenderingContext2D,
  board: BoardData,
  sellersByIndex: Record<number, string | null | undefined>,
  mode: 'owners' | 'sellers',
) => {
  const gridTop = PAD + HEADER + GUTTER;
  const gridLeft = PAD + GUTTER;
  const inner = CELL - 14;

  for (let r = 0; r < 10; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      const idx = r * 10 + c;
      const x = gridLeft + c * CELL;
      const y = gridTop + r * CELL;

      const owner = board.squares[idx]?.[0]?.trim() || '';
      const seller = (sellersByIndex[idx] || '').trim();
      const primary = mode === 'sellers' ? seller : owner;
      const secondary = mode === 'sellers' ? '' : (seller && seller !== owner ? seller : '');

      ctx.fillStyle = primary ? PALETTE.white : PALETTE.newsprint;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (!primary) {
        // On the seller view a sold square with no seller recorded is not the
        // same as an unsold one, and labelling both OPEN misreads as unsold.
        const placeholder = mode === 'sellers' && owner ? '—' : 'OPEN';
        ctx.font = font(13, 'bold');
        ctx.fillStyle = PALETTE.ink;
        ctx.globalAlpha = 0.35;
        ctx.fillText(placeholder, x + CELL / 2, y + CELL / 2);
        ctx.globalAlpha = 1;
        continue;
      }

      const { lines, size } = layoutName(ctx, primary, inner);
      ctx.font = font(size, 'bold');
      ctx.fillStyle = PALETTE.ink;

      const blockHeight = lines.length * (size + 3) - 3;
      // Leave room for the seller line so the owner block stays optically centered.
      const centerY = y + CELL / 2 - (secondary ? 8 : 0);
      let lineY = centerY - blockHeight / 2 + size / 2;
      for (const line of lines) {
        ctx.fillText(line, x + CELL / 2, lineY);
        lineY += size + 3;
      }

      if (secondary) {
        ctx.font = font(11, 'normal');
        ctx.fillStyle = PALETTE.cardinal;
        ctx.fillText(truncateToWidth(ctx, secondary, inner), x + CELL / 2, y + CELL - 16);
      }
    }
  }
};

const drawFooter = (ctx: CanvasRenderingContext2D, shareUrl?: string) => {
  const y = HEIGHT - PAD - 30;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(22, 'bold');
  ctx.fillStyle = PALETTE.cardinal;
  ctx.fillText('GridOne', PAD, y);

  if (shareUrl) {
    ctx.textAlign = 'right';
    ctx.font = font(18, 'normal');
    ctx.fillStyle = PALETTE.ink;
    ctx.globalAlpha = 0.7;
    ctx.fillText(truncateToWidth(ctx, shareUrl, WIDTH - PAD * 2 - 160), WIDTH - PAD, y);
    ctx.globalAlpha = 1;
  }
};

/** Renders the board to a PNG blob at 2x for retina-sharp text in a message thread. */
export const renderBoardPng = async (options: BoardImageOptions): Promise<Blob> => {
  const { board, game, sellersByIndex = {}, mode = 'owners', shareUrl } = options;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot render the board image.');
  ctx.scale(scale, scale);

  ctx.fillStyle = PALETTE.broadcastWhite;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sideAxis = (board.bearsAxis || []).slice(0, 10);
  const topAxis = (board.oppAxis || []).slice(0, 10);

  drawHeader(ctx, game, mode);
  drawAxisLabels(ctx, game);
  drawDigits(ctx, sideAxis, topAxis);
  drawCells(ctx, board, sellersByIndex, mode);
  drawFooter(ctx, shareUrl);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The board image could not be created.'))),
      'image/png',
    );
  });
};

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands the image to the OS share sheet when available — on iOS this puts the
 * board straight into a group text, which is the whole point of the feature —
 * and falls back to a download everywhere else.
 */
export const shareBoardPng = async (
  blob: Blob,
  filename: string,
  shareText?: string,
): Promise<ShareOutcome> => {
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return 'shared';
    } catch (error) {
      // The user dismissing the share sheet is a normal outcome, not a failure;
      // anything else falls through to the download path.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return 'downloaded';
};

/** `bears-vs-packers-board.png` — safe on every filesystem and share target. */
export const boardImageFilename = (game: GameState, mode: 'owners' | 'sellers' = 'owners') => {
  const slug = `${game.topAbbr || 'away'}-vs-${game.leftAbbr || 'home'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'squares'}-board${mode === 'sellers' ? '-sellers' : ''}.png`;
};
