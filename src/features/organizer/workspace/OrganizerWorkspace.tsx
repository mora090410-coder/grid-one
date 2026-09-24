import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { projectBoardTemplate, type BoardTemplate } from '../repeat/boardTemplateModel';
import { Base, Glass, Eyebrow, CapsuleButton, DigitFlow, Sheet } from '../../../design/primitives';
import type {
  BoardData,
  SquareAvailability,
  EntryMeta,
  GameState,
  LiveGameData,
  NotificationDeliveryIssue,
  PayoutDescriptions,
  WinnerResolution,
  PendingMilestone,
} from '../../../../types';
import { evaluateOrganizerLifecycle } from '../lifecycle/organizerLifecycle';
import {
  blockerMessage,
  canEnterDraw as drawGateOpen,
  draftPrimaryAction,
  gameDayPrimaryAction,
  lifecycleCells,
  publishBlocked as publishGateBlocked,
} from '../lifecycle/workspaceGates';
import { hasValidAxes } from '../../../../utils/boardValidation';
import type { QuarterAxisKey } from '../../../../utils/quarterAxes';
import NumberSetsEditor from './NumberSetsEditor';
import { compressImage } from '../../../../utils/image';
import { parseBoardImage } from '../../../../services/boardImportService';
import { renderBoardPng, shareBoardPng, boardImageFilename } from '../../../../utils/boardImage';
import { useWorkspaceDraft } from './useWorkspaceDraft';
import { useSharedBoardRefresh } from './useSharedBoardRefresh';
import { applyScheduledGame } from './applyScheduledGame';
import { saveEntryMeta, saveEntryMetaBatch, savePaymentStatuses, clearEntryMeta } from './entryMetaService';
import { assignable, type Selection } from './selection';
import {
  availabilityNote,
  boardForPeriod,
  buildDrawPreview,
  drawPreviewForPeriod,
  nextOpenAfter,
  openCountOf,
  rangeEntryMeta,
  withAvailability,
  withCommittedDraw,
  withRangeAssigned,
  withSquareName,
  type DrawPreview,
} from './workspaceBoardModel';
import { usePayoutDraft } from './usePayoutDraft';
import { publishBoard, type PublishResult } from './publishBoard';
import { renamePublishedSquare } from './renamePublishedSquare';
import { useGameDayScoring } from '../game-day/useGameDayScoring';
import { publishedOpenSquaresAreAssignable } from '../services/game-day/publishedOpenSquares';
import WorkspaceHeader from './WorkspaceHeader';
import BoardEditor from './BoardEditor';
import RangeAssignBar, { type RangeAssignInput } from './RangeAssignBar';
import SquareSheet from './SquareSheet';
import AvailabilityControl from './AvailabilityControl';
import FamilyAccessCard from './FamilyAccessCard';
import SellerLinksCard from '../sellers/SellerLinksCard';
import ParticipationCard from './ParticipationCard';
import OrganizerIsland from './OrganizerIsland';
import PaymentsPanel from '../payments/PaymentsPanel';
import { buildPaymentModel } from '../payments/paymentModel';
import { buildViewerScoreModel } from '../../viewer/score/viewerScoreModel';
import DrawControl from './DrawControl';
import ReconcileCard from './ReconcileCard';
import PayoutRulesCard from './PayoutRulesCard';
import BoardToolsCard from './BoardToolsCard';
import PreviewSheet from './PreviewSheet';
import PublishSheet from './PublishSheet';
import UpgradeSheet from './UpgradeSheet';
import PublishedSheet from './PublishedSheet';
import SharePanel from './gameday/SharePanel';
import ScoreAuthorityCard from './gameday/ScoreAuthorityCard';
import CorrectionsCard from './gameday/CorrectionsCard';
import DeliveryIssuesCard from './gameday/DeliveryIssuesCard';
import FinalRecordCard from './gameday/FinalRecordCard';

export interface OrganizerWorkspaceProps {
  game: GameState;
  board: BoardData;
  activePoolId: string | null;
  liveData: LiveGameData | null;
  winnerHistory: WinnerResolution[];
  pendingMilestones?: PendingMilestone[];
  notificationDeliveryIssues: NotificationDeliveryIssue[];
  onApply: (game: GameState, board: BoardData) => void;
  onPublish: (currentData: { game: GameState; board: BoardData }) => Promise<string | void>;
  onSavePayoutDescriptions: (descriptions: PayoutDescriptions) => Promise<PayoutDescriptions>;
  onAssignOpenSquares: (squares: string[][]) => Promise<void>;
  /** `background` asks for a quiet refresh that must not lock or re-render the editor as loading. */
  onReload?: (options?: { background?: boolean }) => Promise<void> | void;
  onOpenViewer?: () => void;
  onRunAnotherBoard?: (template: BoardTemplate) => void;
  onLogout: () => void;
  isActivated: boolean;
  isPublished: boolean;
  isShared?: boolean;
  onShareBoard?: () => Promise<void>;
  shareCode: string | null;
  renderPreview?: () => React.ReactNode;
  /** Server revision from usePoolData; drives the autosave conflict check. */
  revision: number;
  entryMeta: Record<number, EntryMeta>;
  onEntryMetaChange: (meta: EntryMeta) => void;
  billing?: { tier: string; used: number; allowance: number } | null;
  onCheckout?: (tier: 'gameday' | 'org', organizationName?: string) => Promise<void>;
}

type PublishedBoard = Extract<PublishResult, { published: true }>;

const PUBLISH_BLOCKED = 'Publish blocked. Reload or save the latest clean draft before publishing.';
const PUBLISHED_IMMUTABLE = 'Published assignments cannot be changed. Select OPEN squares only.';
const LATE_FILL_CLOSED = 'Open squares can only be filled before kickoff.';
const LATE_FILL_FAILED = 'The OPEN squares could not be assigned. Reload and try again.';
const RENAME_FAILED = 'The name could not be changed. The board still shows the previous name.';
const UNTITLED_WORKSPACE = 'Untitled board workspace';
const SQUARE_META_FAILED = 'Square details were not saved. The name is on the board; try saving the details again.';
const RANGE_ASSIGN_FAILED = 'Could not assign those squares. Nothing changed.';
const RANGE_META_FAILED = 'Squares assigned. Payment notes were not saved.';
const CLEAR_META_FAILED = 'The private notes were not cleared. Try again.';

/**
 * The organizer workspace. Before publishing it composes the status island,
 * the board editor, and the publish sheets over `useWorkspaceDraft`'s
 * autosaving draft. After publishing the same shell hosts the game-day side:
 * the public link, score authority, corrections, and the locked final record.
 */
export default function OrganizerWorkspace({
  game: gameProp,
  board: boardProp,
  activePoolId,
  liveData,
  winnerHistory,
  pendingMilestones = [],
  notificationDeliveryIssues,
  revision,
  entryMeta,
  onEntryMetaChange,
  billing,
  onCheckout,
  onApply,
  onPublish,
  onSavePayoutDescriptions,
  onAssignOpenSquares,
  onReload,
  onOpenViewer,
  onRunAnotherBoard,
  onLogout,
  isActivated,
  isPublished,
  isShared = false,
  onShareBoard,
  shareCode,
  renderPreview,
}: OrganizerWorkspaceProps) {
  const { game, board, setGame, setBoard, saveState, flush, retry, saveExternalGame, reloadLatest } = useWorkspaceDraft({
    game: gameProp,
    board: boardProp,
    revision,
    isPublished,
    onSave: (data) => onPublish(data),
    onApply,
    onReload,
  });

  const [familyBusy, setFamilyBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [drawRequested, setDrawRequested] = useState(false);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);
  const [numberPeriod, setNumberPeriod] = useState<QuarterAxisKey>('Q1');
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [availabilityMode, setAvailabilityMode] = useState(false);
  const [selection, setSelection] = useState<Selection>(() => new Set<number>());
  const [rangeBusy, setRangeBusy] = useState(false);
  const [privateWritesPending, setPrivateWritesPending] = useState(0);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentIssue, setPaymentIssue] = useState<string | null>(null);
  const paymentWriteRef = useRef(false);
  const [organizerTask, setOrganizerTask] = useState<'board' | 'payments'>('board');
  const [locatedSquare, setLocatedSquare] = useState<{ index: number } | null>(null);
  useEffect(() => {
    if (!locatedSquare || paymentsOpen) return;
    const frame = requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLButtonElement>(`#workspace-board [data-cell-index="${locatedSquare.index}"]`);
      cell?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      cell?.focus({ preventScroll: true });
      setLocatedSquare(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [locatedSquare, paymentsOpen]);
  const [privateNotesUncertain, setPrivateNotesUncertain] = useState(false);
  const withPrivateWrite = async (write: () => Promise<void>) => {
    setPrivateWritesPending(count => count + 1);
    try { await write(); }
    catch (error) { setPrivateNotesUncertain(true); throw error; }
    finally { setPrivateWritesPending(count => count - 1); }
  };
  const reloadFamilyState = async () => {
    await reloadLatest();
    setPrivateNotesUncertain(false);
  };
  // Bumped once a range apply settles so BoardEditor can take focus back even
  // when the apply failed and the selection is still standing.
  const [rangeFocusSignal, setRangeFocusSignal] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [upgradeTier, setUpgradeTier] = useState<'gameday' | 'org' | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [published, setPublished] = useState<PublishedBoard | null>(null);
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Late fill closes at kickoff, so the gate has to re-evaluate while the
  // organizer sits on the page rather than only on the next render.
  const [clockNow, setClockNow] = useState(() => Date.now());
  // Failures get their own live region so a blocker note never hides them and
  // a stale failure never outlives the next successful action.
  const [alert, setAlert] = useState<string | null>(null);

  const payouts = usePayoutDraft({
    activePoolId,
    saved: game.payoutDescriptions,
    saveExternalGame,
    onSavePayoutDescriptions,
    onNote: setNote,
    onAlert: setAlert,
  });
  const gameDay = useGameDayScoring({
    activePoolId,
    game,
    setGame,
    liveData,
    winnerHistory,
    onReload,
    onNote: setNote,
    onAlert: setAlert,
  });

  useEffect(() => {
    if (!isPublished) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [isPublished]);

  const openCount = openCountOf(board);
  const assignedCount = 100 - openCount;
  const paymentModel = useMemo(() => buildPaymentModel(board, entryMeta), [board, entryMeta]);
  const { paid: paidCount, unpaid: unpaidCount, unknown: unknownCount } = paymentModel.totals;
  const axesCommitted = hasValidAxes(board);
  const conflicted = saveState.status === 'conflicted';

  const model = useMemo(() => evaluateOrganizerLifecycle({
    board: {
      id: activePoolId || '',
      ownerId: activePoolId ? 'server-owner-known' : '',
      title: game.title,
      scheduledGame: game.gameExternalId && game.kickoffAt ? { id: game.gameExternalId, kickoffAt: game.kickoffAt } : null,
      cells: lifecycleCells(board, entryMeta),
      topAxis: board.topAxis,
      sideAxis: board.leftAxis,
      isDynamic: board.isDynamic,
      topAxisByQuarter: board.topAxisByQuarter,
      leftAxisByQuarter: board.leftAxisByQuarter,
      // Report the honest state; the draw gate below is what excuses it,
      // because DrawControl asks the question inline right before the draw.
      openSquaresAcknowledged: board.allowOpenSquares === true || openCount === 0,
      publishedAt: isPublished ? 'server-published' : null,
    },
    save: saveState,
  }), [activePoolId, board, entryMeta, game, isPublished, saveState]);

  // Stable between renders so the 100-square editor only redraws when the board
  // or the period on screen actually changes, not on every keystroke elsewhere.
  const editorBoard = useMemo(() => boardForPeriod(board, numberPeriod), [board, numberPeriod]);
  const editorDrawPreview = useMemo(() => drawPreviewForPeriod(drawPreview, numberPeriod), [drawPreview, numberPeriod]);

  const viewerPath = published ? published.viewerUrl : shareCode ? `/b/${shareCode}` : null;
  const shareUrl = viewerPath ? `${window.location.origin}${viewerPath}` : '';

  const canAssignOpenSquares = publishedOpenSquaresAreAssignable({
    isPublished,
    openSquareCount: openCount,
    kickoffAt: game.kickoffAt,
    now: clockNow,
  }) && !conflicted;
  const finalRecord = isPublished && liveData?.state === 'post';

  const canEnterDraw = drawGateOpen(model, conflicted);
  const publishBlocked = publishGateBlocked(model);

  const startPreview = useCallback(() => {
    setDrawPreview(buildDrawPreview(board.isDynamic === true));
  }, [board.isDynamic]);

  const requestDraw = () => {
    setDrawRequested(true);
    setNote(null);
    setAlert(null);
    if (openCount > 0 && board.allowOpenSquares !== true) return;
    startPreview();
  };

  const acknowledgeOpenSquares = () => {
    setBoard((current) => ({ ...current, allowOpenSquares: true }));
    startPreview();
  };

  // A square blanked after the draw reopens the open-square question. The
  // organizer answers it in place: no new digits are staged, only the
  // acknowledgement the publish gate is waiting on.
  const acknowledgeOpenSquaresOnly = () => {
    setBoard((current) => ({ ...current, allowOpenSquares: true }));
  };

  const cancelDraw = () => {
    setDrawPreview(null);
    setDrawRequested(false);
  };

  const commitDraw = async () => {
    if (!drawPreview) return;
    const staged = drawPreview;
    setBoard((current) => withCommittedDraw(current, staged, openCount));
    setDrawPreview(null);
    setDrawRequested(false);
    await openPreview();
  };

  // A replacement draw runs the same gate, so a board that still has open
  // squares gets the acknowledgement question instead of a silent redraw.
  const replaceDraw = requestDraw;

  const saveSquare = async (index: number, name: string, meta: EntryMeta, advance: boolean, allocationLabel?: string | null, availability?: SquareAvailability) => {
    const trimmed = name.trim();
    if (trimmed.length > 80) { setAlert('Names must be 80 characters or fewer.'); return; }
    let nextSquares: string[][] = board.squares;
    setBoard((current) => {
      const next = withSquareName(current, index, trimmed, allocationLabel, availability);
      nextSquares = next.squares;
      return next;
    });
    setSelectedSquare(advance ? nextOpenAfter(nextSquares, index) : null);

    if (!activePoolId) return;
    try {
      await withPrivateWrite(() => saveEntryMeta(activePoolId, meta));
      onEntryMetaChange(meta);
      setNote(null);
      setAlert(null);
    } catch {
      setAlert(SQUARE_META_FAILED);
    }
  };

  // Leaving select mode drops the selection: a stale set of squares would be
  // applied to the wrong board state next time the mode is entered.
  const toggleSelectMode = useCallback(() => {
    setRangeFocusSignal(current => current + 1);
    setAvailabilityMode(false);
    setSelectMode((current) => {
      if (current) setSelection(new Set<number>());
      return !current;
    });
  }, []);
  const selectSquare = useCallback((index: number) => { setOrganizerTask('board'); setSelectedSquare(index); }, []);
  const offerAvailability = useCallback(() => {
    setAvailabilityMode(true);
    setSelectMode(true);
    setSelection(new Set());
    setOrganizerTask('board');
    setRangeFocusSignal(current => current + 1);
  }, []);

  const clearSelection = () => setSelection(new Set<number>());
  const enableSharing = async () => {
    if (!onShareBoard || sharePending || saveState.status !== 'clean') return;
    if (!await payouts.saveIfPending()) return;
    setSharePending(true);
    setShareError(null);
    try {
      const saved = await flush();
      if (saved.status !== 'clean') throw new Error('Save your latest changes before sharing. Use Retry or Reload latest board above.');
      await onShareBoard();
      setShareOpen(false);
      setNote('Your board is shared. Keep assigning squares here. Everyone sees updates at the same link.');
    } catch (error) {
      const upgradeTo = (error as { upgradeTo?: 'gameday' | 'org' })?.upgradeTo;
      if (upgradeTo) { setShareOpen(false); setUpgradeTier(upgradeTo); }
      setShareError(error instanceof Error ? error.message : 'Sharing failed. Try again.');
    } finally { setSharePending(false); }
  };

  // How many selected squares an apply would overwrite. The bar warns first.
  const selectedNamedCount = useMemo(() => {
    let count = 0;
    selection.forEach((index) => {
      if ((board.squares[index]?.length ?? 0) > 0) count += 1;
    });
    return count;
  }, [selection, board.squares]);

  /**
   * One name, one seller, and one payment state across every selected square.
   * The payment state is always written -- `unknown` is the honest "not asked
   * yet" record, not an absence.
   */
  const applyRange = async (input: RangeAssignInput) => {
    const indices = [...selection].sort((a, b) => a - b);
    if (!indices.length) return;
    const { ok, blocked } = assignable(indices, board.squares, isPublished);
    if (isPublished && blocked.length) {
      setAlert(PUBLISHED_IMMUTABLE);
      return;
    }
    if (!ok.length) return;

    const name = input.name.trim();
    if (!name || name.length > 80) { setAlert('Enter a name of 1–80 characters.'); return; }
    const previousSquares = board.squares;
    const { squares: nextSquares, allocationLabels: nextAllocations } = withRangeAssigned(board, ok, name);
    const metas = rangeEntryMeta(ok, entryMeta, input);

    const replaced = ok.filter((index) => (previousSquares[index]?.length ?? 0) > 0).length;
    const successNote = replaced === 0
      ? `Assigned ${ok.length} squares to ${name}.`
      : `Assigned ${ok.length} squares to ${name}. Replaced ${replaced} existing names.`;

    setRangeBusy(true);
    setAlert(null);
    try {
      if (isPublished) {
        // onAssignOpenSquares reloads the board itself; a second reload here
        // would only turn a reload failure into "Nothing changed."
        await onAssignOpenSquares(nextSquares);
        if (activePoolId) {
          try {
            await withPrivateWrite(() => saveEntryMetaBatch(activePoolId, metas));
            metas.forEach((meta) => onEntryMetaChange(meta));
          } catch {
            // The names are live on the published board: rolling back is not
            // an option, so say exactly what did and did not save.
            clearSelection();
            setAlert(RANGE_META_FAILED);
            return;
          }
        }
      } else {
        setBoard((current) => ({ ...current, squares: nextSquares, allocationLabels: nextAllocations }));
        if (activePoolId) {
          await withPrivateWrite(() => saveEntryMetaBatch(activePoolId, metas));
          metas.forEach((meta) => onEntryMetaChange(meta));
        }
      }
      clearSelection();
      setNote(successNote);
    } catch {
      // Names may already be autosaved, and another square may have changed
      // while the private-note request was pending. Never roll back the board.
      setAlert(isPublished ? RANGE_ASSIGN_FAILED : RANGE_META_FAILED);
    } finally {
      setRangeBusy(false);
      setRangeFocusSignal((current) => current + 1);
    }
  };

  const clearNames = async () => {
    setBoard((current) => ({ ...current, squares: current.squares.map(() => []) }));
    if (!activePoolId) return;
    try {
      await withPrivateWrite(() => clearEntryMeta(activePoolId));
      setAlert(null);
    } catch {
      setAlert(CLEAR_META_FAILED);
    }
  };

  const importPhoto = async (file: File) => {
    setImporting(true);
    setNote(null);
    setAlert(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error('The photo could not be read.'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(raw);
      const scanned = await parseBoardImage(compressed);
      setBoard((current) => ({ ...current, ...scanned }));
      setNote('Photo values preserved. Review names, team orientation and every number set before finalizing. No numbers were redrawn.');
    } catch (error: any) {
      setAlert(error?.message || 'The photo could not be read.');
    } finally {
      setImporting(false);
    }
  };

  const exportBoard = async (mode: 'owners' | 'sellers') => {
    setExporting(true);
    setNote(null);
    setAlert(null);
    try {
      const sellersByIndex: Record<number, string | null | undefined> = {};
      Object.entries(entryMeta).forEach(([index, meta]) => {
        sellersByIndex[Number(index)] = meta?.seller_label;
      });
      const blob = await renderBoardPng({
        board,
        game,
        quarter: numberPeriod,
        sellersByIndex,
        mode,
        shareUrl: published ? shareUrl : undefined,
      });
      const outcome = await shareBoardPng(
        blob,
        boardImageFilename(game, mode),
        `${game.title || 'Squares board'} — ${game.dates || ''}`.trim(),
      );
      if (outcome === 'downloaded') setNote('Board image saved to your downloads.');
    } catch (error: any) {
      setAlert(error?.message || 'The board image could not be created.');
    } finally {
      setExporting(false);
    }
  };

  const openPreview = async () => {
    if (!await payouts.saveIfPending()) return;
    setPublishError(null);
    setAlert(null);
    await flush();
    setPreviewOpen(true);
  };

  const publish = async () => {
    if (!activePoolId) return;
    if (!await payouts.saveIfPending()) return;
    setPublishError(null);
    setPublishPending(true);
    try {
      // Gate on the state the flush actually left behind, not the one this
      // render captured before the save ran.
      const flushed = await flush();
      if (flushed.status !== 'clean') {
        setPublishError(PUBLISH_BLOCKED);
        return;
      }
      const result = await publishBoard(activePoolId, {
        allowOpenSquares: board.allowOpenSquares === true && openCount > 0,
      });
      if (!result.published) {
        setPublishOpen(false);
        setUpgradeError(result.message || null);
        setUpgradeTier(result.upgradeTo);
        return;
      }
      setPublished(result);
      setPublishOpen(false);
      setPublishedOpen(true);
      setAlert(null);
      // The reload is deferred: it flips this board to published and swaps the
      // surface underneath, which would tear the success sheet off the screen.
    } catch (error: any) {
      const message = error?.message || 'The board could not be published.';
      setPublishError(message);
      setAlert(message);
    } finally {
      setPublishPending(false);
    }
  };

  const copyShareLink = async () => {
    setPublishedOpen(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // The published sheet shows the link and its own copy control.
    }
  };

  const checkout = async () => {
    if (!upgradeTier) return;
    setUpgradeError(null);
    try {
      await onCheckout?.(upgradeTier, upgradeTier === 'org' ? organizationName.trim() : undefined);
    } catch (error: any) {
      setUpgradeError(error?.message || 'Checkout could not be started.');
    }
  };

  /**
   * Published boards take one of two routes out of the square sheet: a late
   * fill on an OPEN cell through the dedicated callback, or an audited rename
   * on an assigned cell. Clearing or overwriting an assignment any other way
   * is refused — the published board is the record families are reading.
   */
  /** Resolves true only when the name actually landed on the board. */
  const lateFillOpenSquare = async (index: number, name: string): Promise<boolean> => {
    const squares = [...board.squares];
    // Never let a late fill touch an occupied cell, whatever route got here.
    if (squares[index]?.length) {
      setAlert(PUBLISHED_IMMUTABLE);
      return false;
    }
    if (!canAssignOpenSquares) {
      setAlert(LATE_FILL_CLOSED);
      return false;
    }
    squares[index] = [name];
    try {
      // Same as the range apply: the callback already reloads.
      await onAssignOpenSquares(squares);
      setAlert(null);
      setNote(`Square ${index + 1} assigned before kickoff.`);
      return true;
    } catch (error: any) {
      setAlert(error?.message || LATE_FILL_FAILED);
      return false;
    }
  };

  /** Resolves true only when the audited rename was accepted. */
  const renameSquare = async (index: number, previous: string, next: string): Promise<boolean> => {
    if (!activePoolId) return false;
    setBoard((current) => {
      const squares = [...current.squares];
      squares[index] = [next];
      return { ...current, squares };
    });
    try {
      await renamePublishedSquare(activePoolId, index, next);
      setAlert(null);
      setNote(`Square ${index + 1} changed from ${previous} to ${next}. The change is in the board history.`);
      return true;
    } catch (error: any) {
      setBoard((current) => {
        const squares = [...current.squares];
        squares[index] = [previous];
        return { ...current, squares };
      });
      setAlert(error?.message || RENAME_FAILED);
      return false;
    }
  };

  const savePublishedSquare = async (index: number, name: string, meta: EntryMeta) => {
    if (name.trim().length > 80) { setAlert('Names must be 80 characters or fewer.'); return; }
    const previous = board.squares[index]?.[0]?.trim() ?? '';
    const next = name.trim();
    setSelectedSquare(null);

    // Private notes follow the name on the board, so they are saved only when
    // the name change (if any) actually landed.
    if (!previous) {
      if (next && !(await lateFillOpenSquare(index, next))) return;
    } else if (!next) {
      setAlert(PUBLISHED_IMMUTABLE);
      return;
    } else if (next !== previous) {
      if (!(await renameSquare(index, previous, next))) return;
    }

    if (!activePoolId) return;
    try {
      await withPrivateWrite(() => saveEntryMeta(activePoolId, meta));
      onEntryMetaChange(meta);
    } catch {
      setAlert(SQUARE_META_FAILED);
    }
  };

  const copyViewerLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setAlert(null);
      setNote('Viewer link copied.');
    } catch {
      setAlert('The link could not be copied. Open the public board panel and copy the address there.');
    }
  };

  const scrollToBoard = () => {
    document.getElementById('workspace-board')?.scrollIntoView({ block: 'start' });
  };

  const firstBlocker = model.hardBlockers[0];
  const islandNote = blockerMessage(firstBlocker) ?? (paymentIssue || note || undefined);
  const openPayments = () => { setOrganizerTask('payments'); setPaymentsOpen(true); };
  const savePayments = async (indices: number[], status: EntryMeta['paid_status']) => {
    if (!activePoolId || familyBusy || privateWritesPending > 0 || paymentWriteRef.current || conflicted) {
      throw new Error('Wait for the current changes to finish before updating payments.');
    }
    const assigned = new Set(paymentModel.groups.flatMap(group => group.squares.map(square => square.index)));
    if (indices.some(index => !assigned.has(index))) throw new Error('These squares changed. Reopen Payments and review your selection.');
    paymentWriteRef.current = true;
    setPaymentBusy(true);
    try {
      await withPrivateWrite(async () => {
        const saved = await savePaymentStatuses(activePoolId, indices, status);
        saved.forEach(onEntryMetaChange);
      });
      setPaymentIssue(null);
    } catch (error) {
      setPaymentIssue('Payment notes did not save. Review Payments and try again.');
      throw error;
    } finally {
      paymentWriteRef.current = false;
      setPaymentBusy(false);
    }
  };
  // Buyers claim squares through seller links while the organizer has this
  // page open. Pull those names in, but only when nothing local is unsaved,
  // mid-save, conflicted, or open in a dialog.
  useSharedBoardRefresh({
    enabled: Boolean(activePoolId && isShared && !isPublished && onReload),
    canRefresh: () => saveState.status === 'clean'
      && !familyBusy && !paymentBusy && !paymentsOpen && !rangeBusy && privateWritesPending === 0 && !privateNotesUncertain
      && !payouts.pending && selectedSquare === null && !drawRequested && !drawPreview
      && !previewOpen && !publishOpen && !shareOpen && upgradeTier === null,
    refresh: async () => { await onReload?.({ background: true }); },
  });

  const paymentsPanel = <PaymentsPanel open={paymentsOpen} onClose={() => { if (!paymentWriteRef.current) { setPaymentsOpen(false); setOrganizerTask('board'); } }} model={paymentModel} busy={paymentBusy} disabled={!activePoolId || familyBusy || (privateWritesPending > 0 && !paymentBusy) || conflicted} onSave={savePayments} onViewSquare={index => {
    setPaymentsOpen(false);
    setOrganizerTask('board');
    setAvailabilityMode(false);
    setSelectMode(false);
    setSelection(new Set());
    setLocatedSquare({ index });
  }} />;
  const liveScoreModel = liveData ? buildViewerScoreModel({ live: liveData, liveStatus: '', isSynced: true }) : null;
  const visitNotchDestination = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView({ block: 'center' });
    target?.focus({ preventScroll: true });
  };
  const islandExtras = {
    unpaid: unpaidCount, unknown: unknownCount,
    saveStatus: paymentBusy || privateWritesPending > 0 ? 'saving' : paymentIssue ? 'save_failed' : saveState.status,
    isShared, isPublished, activeTask: organizerTask,
    hasBlocker: model.hardBlockers.length > 0,
    liveSummary: liveData && liveScoreModel ? `${game.leftAbbr} ${liveData.leftScore} · ${game.topAbbr} ${liveData.topScore} · ${liveScoreModel.periodLabel}` : undefined,
    liveTrust: liveScoreModel ? `${liveScoreModel.authority.label} · ${liveScoreModel.authority.detail}${liveScoreModel.freshness ? ` · ${liveScoreModel.freshness}` : ''}` : undefined,
    isFinal: finalRecord,
    winnerHistory: gameDay.correctionHistory, pendingMilestones,
    leftLabel: game.leftAbbr, topLabel: game.topAbbr,
    onGame: () => visitNotchDestination('organizer-score'),
    onResults: () => visitNotchDestination('organizer-corrections'),
    shareAction: isPublished || isShared
      ? { label: 'View sharing options', onClick: () => visitNotchDestination('organizer-share') }
      : onShareBoard ? { label: 'Share while selling', onClick: () => setShareOpen(true), disabled: sharePending || saveState.status !== 'clean' } : undefined,
    onPayments: openPayments,
    onFindPerson: openPayments,
    onShowUnassigned: openCount > 0 && !isPublished ? () => { setOrganizerTask('board'); setHighlightOpen(true); scrollToBoard(); } : undefined,
    onReviewIssue: () => {
      if (paymentIssue) { openPayments(); return; }
      const target = document.getElementById('organizer-header');
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    },
    pollingText: liveScoreModel?.pollingText,
    disabled: familyBusy || paymentBusy,
  };


  const nextStep = draftPrimaryAction({ justPublished: Boolean(published), assignedCount, axesCommitted, isShared, drawAllowed: canEnterDraw });
  const nextStepHandlers = {
    copy_link: () => void copyShareLink(),
    fill_board: scrollToBoard,
    preview: () => void openPreview(),
    draw: requestDraw,
  } as const;
  const primary = {
    label: nextStep.label,
    onClick: nextStepHandlers[nextStep.id],
    ...(nextStep.id === 'draw' ? { disabled: nextStep.disabled } : {}),
  };

  const secondary = axesCommitted && !published && !isPublished
    ? [{ label: 'Replace draft draw', onClick: replaceDraw, disabled: conflicted }]
    : undefined;

  const leavePublishedSheet = () => {
    setPublishedOpen(false);
    void onReload?.();
  };

  const mainLabel = game.title?.trim() ? `${game.title} workspace` : UNTITLED_WORKSPACE;

  const alertRegion = alert ? (
    <p role="alert" className="mt-4 font-ui text-[15px] text-tone-cardinal">{alert}</p>
  ) : null;

  const header = (
    <div id="organizer-header" tabIndex={-1}><WorkspaceHeader
      game={game}
      saveState={saveState}
      isPublished={isPublished}
      onTitleChange={(title) => setGame((current) => ({ ...current, title }))}
      onGameChange={(scheduled) => setGame((current) => applyScheduledGame(current, scheduled))}
      onRetry={() => void retry()}
      onReload={() => void reloadLatest()}
      onLogout={onLogout}
      actions={<CapsuleButton variant="quiet" onClick={event => { event.currentTarget.focus(); openPayments(); }}>Payments</CapsuleButton>}
    /></div>
  );

  // The sheets live outside the published/unpublished branch: publishing flips
  // `isPublished` under our feet, and the success sheet has to survive it.
  const sheets = (
    <>
      <Sheet open={shareOpen} onClose={() => { if (!sharePending) setShareOpen(false); }} title="Share while selling">
        <div className="flex flex-col gap-4">
          <CapsuleButton variant="quiet" className="self-start" disabled={sharePending} onClick={() => setShareOpen(false)}>Cancel</CapsuleButton>
          <p className="font-ui text-[15px] text-fg-2">Everyone with the link can see buyer names and assigned families. The public link cannot edit. You can separately give a family a private link for its assigned squares. Private payment and contact notes stay private.</p>
          <p className="font-ui text-[15px] text-fg-2">Share now and keep selling. Numbers stay hidden until you lock them. This counts as 1 board for the season, and locking it later doesn’t count again.</p>
          {shareError && <>
            <p role="alert" className="text-tone-cardinal">{shareError}</p>
            {onReload && <CapsuleButton variant="quiet" disabled={sharePending} onClick={() => {
              setShareOpen(false);
              void Promise.resolve(onReload()).catch(() => setAlert('The board could not be reloaded. Try again.'));
            }}>Reload board</CapsuleButton>}
          </>}
          {saveState.status !== 'clean' && <p role="status">Save your latest changes first. Use Retry or Reload latest board above if needed.</p>}
          <CapsuleButton disabled={sharePending || saveState.status !== 'clean'} onClick={() => void enableSharing()}>{sharePending ? 'Sharing…' : 'Enable shared board'}</CapsuleButton>
        </div>
      </Sheet>
      <SquareSheet
        open={selectedSquare !== null}
        index={selectedSquare}
        name={selectedSquare === null ? '' : board.squares[selectedSquare]?.[0] ?? ''}
        allocationLabel={selectedSquare === null ? undefined : board.allocationLabels?.[selectedSquare]}
        availability={selectedSquare === null ? 'unspecified' : board.availability?.[selectedSquare] ?? 'unspecified'}
        meta={selectedSquare === null ? undefined : entryMeta[selectedSquare]}
        isPublished={isPublished}
        hasNextOpen={openCount > 0}
        onSave={(index, name, meta, advance, allocationLabel, availability) => void (isPublished
          ? savePublishedSquare(index, name, meta)
          : saveSquare(index, name, meta, advance, allocationLabel, availability))}
        onClose={() => setSelectedSquare(null)}
      />

      <PreviewSheet
        isShared={isShared}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        canPublish={axesCommitted && !conflicted}
        onReviewPublish={() => {
          setPreviewOpen(false);
          setPublishOpen(true);
        }}
      >
        {renderPreview ? renderPreview() : <p className="font-ui text-[15px] text-fg-2">{isShared ? 'Preview final board' : 'Private preview — sharing is off'}</p>}
      </PreviewSheet>

      <PublishSheet
        isShared={isShared}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        game={game}
        board={board}
        allowance={billing}
        pending={publishPending}
        error={publishError ?? (publishBlocked ? blockerMessage(firstBlocker) ?? null : null)}
        disabled={!axesCommitted || conflicted || publishPending || publishBlocked}
        onPublish={() => void publish()}
      />

      <UpgradeSheet
        open={upgradeTier !== null}
        tier={upgradeTier ?? 'gameday'}
        error={upgradeError}
        organizationName={organizationName}
        onOrganizationNameChange={setOrganizationName}
        onClose={() => setUpgradeTier(null)}
        onCheckout={() => void checkout()}
      />

      <PublishedSheet
        open={publishedOpen && published !== null}
        shareUrl={shareUrl}
        onClose={leavePublishedSheet}
        onOpenViewer={() => onOpenViewer?.()}
        onEnterGameDay={leavePublishedSheet}
      />
    </>
  );

  if (isPublished) {
    const runAnotherBoard = () => onRunAnotherBoard
      ? onRunAnotherBoard(projectBoardTemplate(game))
      : window.location.assign('/create');
    const focusGameSection = (id: string) => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ block: 'center' });
      target?.focus({ preventScroll: true });
    };
    const attention = gameDayPrimaryAction({ scoreFreshness: liveData?.freshness, deliveryIssueCount: notificationDeliveryIssues.length });
    const gameDayPrimary = attention && {
      label: attention.label,
      onClick: () => focusGameSection(attention.id === 'review_score' ? 'organizer-score' : 'organizer-delivery'),
    };

    return (
      <Base kind="cream">
        <OrganizerIsland
          key={activePoolId}
          {...islandExtras}
          filled={paymentModel.totals.assigned}
          paid={paidCount}
          drawn
          phase={model.phase}
          primary={gameDayPrimary}
          shareActions={[{ label: 'Copy link', onClick: () => void copyViewerLink() }, ...(onOpenViewer ? [{ label: 'Open public board', onClick: () => onOpenViewer() }] : [])]}
        />
        <main inert={familyBusy || paymentBusy} aria-label={mainLabel} className="mx-auto max-w-7xl px-4 pt-2 pb-24">
          {header}
          {alertRegion}
          {/* Game-day confirmations stay in the flow: the island collapses, and
              a rename or a late fill is worth reading without expanding it. */}
          {note ? <p role="status" className="mt-4 font-ui text-[15px] text-fg-2">{note}</p> : null}
          <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
            <section id="workspace-board" aria-label="Board" style={{ scrollMarginTop: 100 }} className="flex min-w-0 max-w-full flex-col gap-6">
              {finalRecord && <div id="organizer-results" tabIndex={-1}><FinalRecordCard winnerHistory={gameDay.correctionHistory} onCreateAnotherBoard={runAnotherBoard} /></div>}
              <div id="organizer-share" tabIndex={-1}><SharePanel shareUrl={shareUrl} onOpenViewer={() => onOpenViewer?.()} /></div>
              <div id="organizer-score" tabIndex={-1}><ScoreAuthorityCard
                game={game}
                liveData={liveData}
                scoreSaveStatus={gameDay.scoreSaveStatus}
                isActivated={isActivated}
                onEnableAutomaticScoring={() => void gameDay.enableAutomaticScoring()}
                onEnableManualScoring={() => void gameDay.enableManualScoring()}
                onUpdateManualGameState={gameDay.updateManualGameState}
                onUpdateManualPeriod={gameDay.updateManualPeriod}
                onUpdateManualQuarter={gameDay.updateManualQuarter}
                onSaveManualScore={() => void gameDay.saveManualScore()}
              /></div>
              <NumberSetsEditor board={board} game={game} selected={numberPeriod} onSelect={setNumberPeriod} />
              <BoardEditor
                board={editorBoard}
                entryMeta={entryMeta}
                drawPreview={null}
                highlightOpen={false}
                isPublished
                canAssignOpenSquares={canAssignOpenSquares}
                selectMode={selectMode}
                selection={selection}
                onSelectionChange={setSelection}
                onToggleSelectMode={toggleSelectMode}
                onSelectSquare={selectSquare}
                focusToggleSignal={rangeFocusSignal}
              />
              {selectMode && selection.size > 0 && (
                <RangeAssignBar
                  count={selection.size}
                  namedCount={selectedNamedCount}
                  isPublished
                  busy={rangeBusy}
                  onApply={(input) => void applyRange(input)}
                  onClear={clearSelection}
                  onExitSelectMode={toggleSelectMode}
                />
              )}
            </section>
            <aside className="flex flex-col gap-6">
              <PayoutRulesCard
                descriptions={payouts.descriptions}
                status={payouts.status}
                disabled={!activePoolId || payouts.status === 'saving'}
                onChange={payouts.update}
                onSavePayoutDescriptions={() => void payouts.save()}
              />
              <div id="organizer-corrections" tabIndex={-1}><CorrectionsCard
                winnerHistory={gameDay.correctionHistory}
                draft={gameDay.correctionDraft}
                pending={gameDay.scoreSaveStatus === 'saving'}
                onDraftChange={gameDay.setCorrectionDraft}
                onPublishCorrection={() => void gameDay.publishCorrection()}
              /></div>
              <div id="organizer-delivery" tabIndex={-1}><DeliveryIssuesCard issues={notificationDeliveryIssues} /></div>
              <BoardToolsCard
                isPublished
                exporting={exporting}
                onExport={(mode) => void exportBoard(mode)}
                hasSellers={Object.values(entryMeta).some((meta) => Boolean(meta?.seller_label))}
              />
            </aside>
          </div>
        </main>
        {sheets}
        {paymentsPanel}
      </Base>
    );
  }

  return (
    <Base kind="cream">
      {familyBusy && <p role="status" className="px-5 py-3 text-sm text-fg-2">Updating family access. Board editing will resume when this finishes.</p>}
      <OrganizerIsland
          key={activePoolId}
          {...islandExtras}
        filled={paymentModel.totals.assigned}
        paid={paidCount}
        drawn={axesCommitted}
        phase={model.phase}
        primary={primary}
        secondary={secondary}
        note={islandNote}
      />
      <main inert={familyBusy || paymentBusy} aria-label={mainLabel} className="mx-auto max-w-7xl px-4 pt-2 pb-24">
        {header}
        <Glass id="organizer-share" tabIndex={-1} className="mt-4 flex flex-col gap-3" padding="md">
          <Eyebrow>{axesCommitted ? (isShared ? 'Shared board · Review game numbers' : 'Numbers drawn · Review your board') : isShared ? 'Selling · Shared board' : 'Set up your board'}</Eyebrow>
          <p className="font-ui text-[15px] text-fg-2"><DigitFlow value={paymentModel.totals.assigned} /> assigned · <DigitFlow value={100 - paymentModel.totals.assigned} /> unassigned. {axesCommitted ? 'Review the board before finalizing game numbers.' : 'Allocate squares, then draw game numbers when ready.'}</p>
          <div className="flex flex-wrap gap-2">
            {!drawRequested && !drawPreview && <CapsuleButton onClick={primary.onClick} disabled={'disabled' in primary ? primary.disabled : false}>{primary.label}</CapsuleButton>}
            {isShared && shareUrl ? <>
              <CapsuleButton variant="quiet" onClick={() => void copyViewerLink()}>Copy link</CapsuleButton>
              <a className="inline-flex min-h-11 items-center rounded-capsule px-5 font-ui text-action focus-visible:ring-2 focus-visible:ring-action" href={shareUrl} target="_blank" rel="noreferrer">Open shared board</a>
            </> : onShareBoard && <CapsuleButton variant="quiet" disabled={sharePending || saveState.status !== 'clean'} onClick={() => setShareOpen(true)}>Share while selling</CapsuleButton>}
          </div>
          {onShareBoard && !isShared && saveState.status !== 'clean' && <p className="font-ui text-[14px] text-fg-2">Sharing is available after your latest changes save. Use Retry or Reload latest board above if needed.</p>}
        </Glass>
        {activePoolId && !isPublished && <SellerLinksCard
          boardId={activePoolId}
          boardTitle={game.title || 'our board'}
          shared={isShared}
          labels={board.allocationLabels ?? []}
          squares={board.squares}
          clean={saveState.status === 'clean' && !rangeBusy}
          flush={flush}
        />}
        {alertRegion}
        {/* The island prefers a blocker over its note, and saving is dirty the
            instant a range lands, so the confirmation lives here in the flow. */}
        {note ? <p role="status" className="mt-4 font-ui text-[15px] text-fg-2">{note}</p> : null}
        <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
          <section id="workspace-board" aria-label="Board" style={{ scrollMarginTop: 100 }} className="flex min-w-0 max-w-full flex-col gap-4">
            <NumberSetsEditor board={drawPreview?.topSets ? { ...board, topAxisByQuarter: drawPreview.topSets, leftAxisByQuarter: drawPreview.leftSets } : board} game={game} selected={numberPeriod} onSelect={setNumberPeriod} disabled={conflicted || Boolean(drawPreview)} onChange={next => setBoard(() => next)} />
            {(drawRequested || drawPreview || axesCommitted) && (
              <DrawControl
                openCount={openCount}
                requested={drawRequested}
                acknowledged={board.allowOpenSquares === true}
                drawn={axesCommitted}
                preview={Boolean(drawPreview)}
                disabled={conflicted}
                onAcknowledge={acknowledgeOpenSquares}
                onAcknowledgeWithoutDraw={acknowledgeOpenSquaresOnly}
                onKeepAssigning={() => { cancelDraw(); scrollToBoard(); }}
                onDraw={startPreview}
                onCommit={() => void commitDraw()}
                onAgain={startPreview}
                onReplace={replaceDraw}
                onCancelPreview={cancelDraw}
              />
            )}
            <BoardEditor
              availabilityMode={availabilityMode}
              onOfferAvailability={offerAvailability}
              board={editorBoard}
              entryMeta={entryMeta}
              drawPreview={editorDrawPreview}
              highlightOpen={highlightOpen}
              isPublished={false}
              canAssignOpenSquares={false}
              selectMode={selectMode}
              selection={selection}
              onSelectionChange={setSelection}
              onToggleSelectMode={toggleSelectMode}
              onSelectSquare={selectSquare}
              focusToggleSignal={rangeFocusSignal}
            />
          </section>
          <aside className="flex flex-col gap-6">
            <div className="lg:sticky lg:top-6">
            {availabilityMode && <div id="availability-editor" tabIndex={-1}><AvailabilityControl selectedCount={selection.size} disabled={conflicted || familyBusy} onClose={toggleSelectMode} onChange={status => {
              if (conflicted || selection.size === 0) return;
              setBoard(current => withAvailability(current, selection, status));
              setNote(availabilityNote(selection.size, status));
              setSelection(new Set());
            }} /></div>}
            {selectMode && !availabilityMode && selection.size > 0 && (
              <RangeAssignBar
                count={selection.size}
                namedCount={selectedNamedCount}
                isPublished={false}
                busy={rangeBusy}
                onApply={(input) => void applyRange(input)}
                onClear={clearSelection}
                onExitSelectMode={toggleSelectMode}
              />
            )}
            </div>
            {privateWritesPending > 0 && <p role="status" className="text-sm text-fg-2">Saving private square notes. Family access will resume when this finishes.</p>}
            {privateNotesUncertain && <div role="status" className="text-sm text-fg-2"><p>Refresh private notes before changing family access.</p><CapsuleButton variant="quiet" disabled={privateWritesPending > 0} onClick={() => void reloadFamilyState().catch(() => setAlert('Private notes could not be refreshed. Try again.'))}>Refresh private notes</CapsuleButton></div>}
            {activePoolId && <FamilyAccessCard boardId={activePoolId} labels={board.allocationLabels ?? []} clean={saveState.status === 'clean' && !payouts.pending && privateWritesPending === 0 && !privateNotesUncertain && !rangeBusy} flush={flush} onReload={reloadFamilyState} onBusy={setFamilyBusy} />}
            <ParticipationCard details={board.participation ?? {}} onChange={(participation) => setBoard(current => ({ ...current, participation }))} />
            <div id="organizer-review"><ReconcileCard
              model={model}
              unpaidCount={unpaidCount}
              unknownCount={unknownCount}
              highlightOpen={highlightOpen}
              onToggleHighlightOpen={() => setHighlightOpen((current) => !current)}
            /></div>
            <PayoutRulesCard
              descriptions={payouts.descriptions}
              status={payouts.status}
              disabled={!activePoolId || payouts.status === 'saving'}
              onChange={payouts.update}
              onSavePayoutDescriptions={() => void payouts.save()}
            />
            <BoardToolsCard
              isPublished={false}
              exporting={exporting}
              onExport={(mode) => void exportBoard(mode)}
              hasSellers={Object.values(entryMeta).some((meta) => Boolean(meta?.seller_label))}
              onImportPhoto={(file) => void importPhoto(file)}
              importing={importing}
              onClearNames={() => void clearNames()}
            />
          </aside>
        </div>
      </main>
      {sheets}
        {paymentsPanel}
    </Base>
  );
}
