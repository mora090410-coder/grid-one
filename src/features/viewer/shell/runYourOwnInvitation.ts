/**
 * The quiet "run your own board" invitation under a shared board.
 * Every board is seen by many people who are not its organizer, so the
 * invitation shows to all of them. The owner never sees it on their own board.
 */
export interface RunYourOwnInput {
  demoMode: boolean;
  /** The signed-in viewer owns this board. */
  ownsBoard: boolean;
  /** Provider game state, when known. */
  gameState?: 'pre' | 'in' | 'post' | string | null;
}

export function runYourOwnInvitation({ demoMode, ownsBoard, gameState }: RunYourOwnInput): string | null {
  if (demoMode) return 'This is a sample board. Ready to run yours?';
  if (ownsBoard) return null;
  if (gameState === 'post') return 'Bring your next game day together.';
  return 'Running your own pool? Building a board is free.';
}
