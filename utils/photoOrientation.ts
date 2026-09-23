import type { BoardData } from '../types';

/** An organizer decision, never inferred from OCR text or NFL home/away conventions. */
export function photoOrientationResolved(board: Pick<BoardData,'scanReview'>, game?: {topAbbr:string;leftAbbr:string}) {
  if (!board.scanReview) return true;
  const mapping=board.scanReview.orientation;
  return Boolean(mapping && ['unchanged','transposed'].includes(mapping.operation)
    && mapping.topAbbr && mapping.leftAbbr
    && (!game || mapping.topAbbr===game.topAbbr && mapping.leftAbbr===game.leftAbbr));
}

/** Creation-only explicit transpose: no saved assignments, payment notes or square IDs exist yet. */
export function resolvePhotoOrientation(board: BoardData, game: {topAbbr:string;leftAbbr:string}, transpose=false): BoardData {
  if (!board.scanReview || !game.topAbbr || !game.leftAbbr) throw new Error('Choose the game and review photo teams first.');
  if (board.scanReview.orientation && transpose) throw new Error('Photo orientation is already resolved; reimport before another transpose.');
  const cells=<T,>(values:T[]) => Array.from({length:100},(_,i)=>values[(i%10)*10+Math.floor(i/10)]);
  return {
    ...board,
    ...(transpose ? {
      squares:cells(board.squares), leftAxis:board.topAxis, topAxis:board.leftAxis,
      leftAxisByQuarter:board.topAxisByQuarter, topAxisByQuarter:board.leftAxisByQuarter,
      ...(board.allocationLabels ? {allocationLabels:cells(board.allocationLabels)} : {}),
      ...(board.availability ? {availability:cells(board.availability)} : {}),
    } : {}),
    scanReview:{...board.scanReview,orientation:{topAbbr:game.topAbbr,leftAbbr:game.leftAbbr,operation:transpose?'transposed':'unchanged'}},
  };
}
