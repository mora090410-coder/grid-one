import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useContestEntries } from '../hooks/useContestEntries';
import { OrganizerDashboard } from './OrganizerDashboard';
import { GameState, BoardData, EntryMeta, LiveGameData, ScheduledGame } from '../types';
import { supabase } from '../services/supabase';
import { parseBoardImage } from '../services/geminiService';
import { ScheduledGamePicker } from './ScheduledGamePicker';

import { createCheckoutSession, activateWithEntitlement } from '../services/stripe';
import { useDialogFocus } from '../hooks/useDialogFocus';

export const secureShuffleDigits = () => {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const limit = Math.floor(0x1_0000_0000 / (index + 1)) * (index + 1);
    let sample = 0;
    do sample = crypto.getRandomValues(new Uint32Array(1))[0];
    while (sample >= limit);
    const target = sample % (index + 1);
    [digits[index], digits[target]] = [digits[target], digits[index]];
  }
  return digits;
};

interface AdminPanelProps {
  game: GameState;
  board: BoardData;
  activePoolId: string | null;
  liveData: LiveGameData | null;
  onApply: (game: GameState, board: BoardData) => void;
  onPublish: (currentData: { game: GameState, board: BoardData }) => Promise<string | void>;
  onLogout: () => void;
  isActivated: boolean;
  isPublished: boolean;
  shareCode: string | null;
  initialTab?: 'overview' | 'edit' | 'preview';
  renderPreview?: () => React.ReactNode;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ game, board, activePoolId, liveData, onApply, onPublish, onLogout, isActivated, isPublished, shareCode, initialTab = 'overview', renderPreview }) => {
  const [localGame, setLocalGame] = useState<GameState>(game);
  const [localBoard, setLocalBoard] = useState<BoardData>(board);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const activeAxisQuarter: 'Q1' = 'Q1';
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'preview'>(initialTab);

  // Metadata State (via Hook)
  const { entryMetaByIndex, setEntryMetaByIndex } = useContestEntries(activePoolId);
  const [editingMetaIndex, setEditingMetaIndex] = useState<number | null>(null);

  // Bulk Assign State
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [assignLabel, setAssignLabel] = useState('');
  const [assignPaidDefault, setAssignPaidDefault] = useState<EntryMeta['paid_status']>('unpaid');
  const [selectedCellIndices, setSelectedCellIndices] = useState<Set<number>>(new Set());
  const selectedCellIndicesRef = useRef<Set<number>>(new Set());
  const [isDragAssigning, setIsDragAssigning] = useState(false);
  const isDragAssigningRef = useRef(false);
  const dragAssignedIndicesRef = useRef<Set<number>>(new Set());
  const dragBaseSelectionRef = useRef<Set<number>>(new Set());
  const dragStartCellRef = useRef<number | null>(null);
  const dragHasMovedRef = useRef(false);
  const justFinishedDragRef = useRef(false);
  const isManualApplyRef = useRef(false);

  // Auto-save status: 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showMenu, setShowMenu] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [scoreSaveStatus, setScoreSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [drawPreview, setDrawPreview] = useState<{ side: number[]; top: number[] } | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onPublishRef = useRef(onPublish);
  const latestDraftRef = useRef({ game: localGame, board: localBoard });
  const saveGenerationRef = useRef(0);
  const draftVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const isFirstRender = useRef(true);

  // Keep latest publish handler without making autosave effect depend on callback identity.
  useEffect(() => {
    onPublishRef.current = onPublish;
  }, [onPublish]);

  useEffect(() => {
    latestDraftRef.current = { game: localGame, board: localBoard };
  }, [localGame, localBoard]);

  const persistDraft = async () => {
    const targetVersion = draftVersionRef.current;
    if (targetVersion <= savedVersionRef.current) return;
    const generation = ++saveGenerationRef.current;
    const draft = latestDraftRef.current;
    setSaveStatus('saving');
    try {
      await onPublishRef.current(draft);
      savedVersionRef.current = Math.max(savedVersionRef.current, targetVersion);
      if (generation === saveGenerationRef.current) setSaveStatus('saved');
    } catch (error) {
      if (generation === saveGenerationRef.current) setSaveStatus('error');
      throw error;
    }
  };

  const flushDraftSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await persistDraft();
  };

  const saveEntryMeta = async (meta: EntryMeta) => {
    if (!activePoolId) return;

    // Update local state immediately
    setEntryMetaByIndex(prev => ({ ...prev, [meta.cell_index]: meta }));

    // Upsert to Supabase
    const { error } = await supabase
      .from('contest_entries')
      .upsert({
        contest_id: activePoolId,
        cell_index: meta.cell_index,
        paid_status: meta.paid_status === null ? undefined : meta.paid_status,
        notify_opt_in: meta.notify_opt_in,
        contact_type: meta.contact_type || null,
        contact_value: meta.contact_value || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'contest_id, cell_index' });

    if (error) {
      console.error("Error saving metadata:", error);
      setActionMessage(`Square details were not saved: ${error.message || 'Unknown error'}`);
    }
  };

  // Apply changes locally (for real-time preview)
  useEffect(() => {
    onApply(localGame, localBoard);
  }, [localGame, localBoard, onApply]);

  // Debounced auto-save to backend
  useEffect(() => {
    if (isPublished) return;
    // Skip first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    draftVersionRef.current += 1;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    // Debounce the actual save by 800ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        saveTimeoutRef.current = null;
        await persistDraft();
      } catch (e) {
        console.error('Auto-save failed:', e);
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localGame, localBoard, isPublished]);

  useEffect(() => {
    const warnOnUnsavedExit = (event: BeforeUnloadEvent) => {
      if (!saveTimeoutRef.current && saveStatus === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnOnUnsavedExit);
    return () => window.removeEventListener('beforeunload', warnOnUnsavedExit);
  }, [saveStatus]);

  // Self-healing: Ensure dynamic boards have quarter axes initialized
  useEffect(() => {
    if (localBoard.isDynamic) {
      let changed = false;
      const copy = { ...localBoard };

      if (!copy.bearsAxisByQuarter) {
        copy.bearsAxisByQuarter = {
          Q1: [...copy.bearsAxis],
          Q2: [...copy.bearsAxis],
          Q3: [...copy.bearsAxis],
          Q4: [...copy.bearsAxis]
        };
        changed = true;
      }

      if (!copy.oppAxisByQuarter) {
        copy.oppAxisByQuarter = {
          Q1: [...copy.oppAxis],
          Q2: [...copy.oppAxis],
          Q3: [...copy.oppAxis],
          Q4: [...copy.oppAxis]
        };
        changed = true;
      }

      if (changed) {
        console.log("Repairing missing dynamic axis data...");
        setLocalBoard(copy);
      }
    }
  }, [localBoard.isDynamic, localBoard.bearsAxisByQuarter, localBoard.oppAxisByQuarter]);


  const applyScanResult = (newBoard: BoardData) => {
    if (isPublished) {
      setActionMessage('This board is published. Its assignments and number draw are locked.');
      return;
    }
    setLocalBoard(newBoard);
  };

  const handleClear = async () => {
    if (isPublished) {
      setActionMessage('Published names and axis digits cannot be changed.');
      return;
    }
    if (!clearArmed) {
      setClearArmed(true);
      setActionMessage('Clear is armed. Press “Confirm clear” to remove every purchaser name; axis digits stay in place.');
      window.setTimeout(() => setClearArmed(false), 5000);
      return;
    }
    setClearArmed(false);

    const emptyBoard: BoardData = {
      ...localBoard,
      squares: Array(100).fill(null).map(() => []),
    };

    setLocalBoard(emptyBoard);
    setEntryMetaByIndex({}); // Clear local metadata

    // Clear DB metadata
    if (activePoolId) {
      const { error } = await supabase
        .from('contest_entries')
        .delete()
        .eq('contest_id', activePoolId);

      if (error) console.error("Failed to clear cloud metadata", error);
    }

  };

  // Retry save on error
  const handleRetry = async () => {
    try {
      await flushDraftSave();
    } catch (e) {
      console.error('Retry save failed:', e);
    }
  };

  const updateField = (field: keyof GameState, val: string | number | boolean) => {
    setLocalGame(prev => ({ ...prev, [field]: val }));
  };

  const EMPTY_MANUAL_SCORES = { Q1: { left: 0, top: 0 }, Q2: { left: 0, top: 0 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } };

  const updateManualQuarter = (q: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OT', side: 'left' | 'top', val: number) => {
    setLocalGame(prev => {
      const base = prev.manualQuarterScores ?? EMPTY_MANUAL_SCORES;
      return { ...prev, manualQuarterScores: { ...base, [q]: { ...base[q], [side]: Math.max(0, val) } } };
    });
  };

  const stageNumberDraw = () => {
    if (isPublished) return;
    const unassigned = localBoard.squares.filter((names) => !names.length).length;
    if (unassigned) {
      setActionMessage(`Assign all 100 squares before drawing numbers. ${unassigned} remain.`);
      return;
    }
    setDrawPreview({ side: secureShuffleDigits(), top: secureShuffleDigits() });
  };

  const commitNumberDraw = () => {
    if (!drawPreview || isPublished) return;
    setLocalBoard((current) => ({
      ...current,
      bearsAxis: drawPreview.side,
      oppAxis: drawPreview.top,
      isDynamic: false,
      bearsAxisByQuarter: undefined,
      oppAxisByQuarter: undefined,
    }));
    setDrawPreview(null);
    setActionMessage('Number draw committed to the draft. Publishing will lock these axes.');
  };

  const saveManualScore = async () => {
    if (!activePoolId) return;
    setScoreSaveStatus('saving');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sign in before saving the score.');
      const response = await fetch(`/api/pools/${activePoolId}/score/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quarterScores: localGame.manualQuarterScores ?? EMPTY_MANUAL_SCORES,
          period: localGame.manualGameState === 'post' ? 4 : (localGame.manualPeriod ?? 1),
          state: localGame.manualGameState ?? 'in',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the score.');
      setLocalGame((current) => ({ ...current, useManualScores: true, scoreSnapshot: result.score }));
      setScoreSaveStatus('saved');
      setActionMessage('Manual score is live. Completed-quarter winners were resolved once.');
    } catch (error: any) {
      setScoreSaveStatus('error');
      setActionMessage(error.message || 'Unable to save the score.');
    }
  };

  const enableAutomaticScoring = async () => {
    if (!activePoolId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const response = await fetch(`/api/pools/${activePoolId}/score/manual`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Automatic scoring could not be enabled.');
      }
      setLocalGame((current) => ({ ...current, useManualScores: false, scoreSnapshot: null }));
      setActionMessage('Automatic score checks are enabled.');
    } catch (error: any) {
      setActionMessage(error.message || 'Automatic scoring could not be enabled.');
    }
  };

  const handleScheduledGameChange = (scheduledGame: ScheduledGame) => {
    setLocalGame(prev => ({
      ...prev,
      gameExternalId: scheduledGame.id,
      kickoffAt: scheduledGame.kickoffAt,
      leftAbbr: scheduledGame.awayTeam.abbr,
      leftName: scheduledGame.awayTeam.name,
      topAbbr: scheduledGame.homeTeam.abbr,
      topName: scheduledGame.homeTeam.name,
      dates: scheduledGame.kickoffAt.slice(0, 10),
      scoreSnapshot: null,
      useManualScores: false,
      manualQuarterScores: undefined,
      manualLeftScore: 0,
      manualTopScore: 0,
      manualPeriod: undefined,
      manualGameState: undefined,
    }));
    setActionMessage('Scheduled game changed. Prior score state will be cleared when this draft saves.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isPublished) {
      setActionMessage(isPublished ? 'Published board data cannot be replaced by a scan.' : null);
      return;
    }

    setIsScanning(true);

    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Image processing failed."));
        reader.readAsDataURL(file);
      });
      const newBoardData = await parseBoardImage(base64);
      applyScanResult(newBoardData);
    } catch (err: unknown) {
      console.error("OCR Failure:", err);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Bulk Assign Logic ---
  const toggleCellSelection = (index: number) => {
    setSelectedCellIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  interface BulkEntryMetaUpdate {
    contest_id: string | null;
    cell_index: number;
    paid_status: EntryMeta['paid_status'];
    notify_opt_in: boolean;
    contact_type: EntryMeta['contact_type'] | null;
    contact_value: string | null;
    updated_at: string;
  }

  const applyAssignToIndices = (indices: number[], options?: { keepAssignMode?: boolean; resetLabel?: boolean }) => {
    if (!isManualApplyRef.current) {
      return;
    }
    if (!assignLabel.trim()) {
      setActionMessage('Enter a purchaser or seller label before applying squares.');
      return;
    }
    if (indices.length === 0) return;

    // Check for conflicts
    const conflicts = indices.filter(idx => localBoard.squares[idx] && localBoard.squares[idx].length > 0);

    if (conflicts.length > 0) setActionMessage(`Replaced existing names in ${conflicts.length} selected squares.`);

    const newBoard = {
      ...localBoard,
      squares: [...localBoard.squares] // Ensure shallow copy of array
    };
    const label = assignLabel.trim();

    // Prepare batch metadata updates
    const metaUpdates: BulkEntryMetaUpdate[] = [];
    const newEntryMetaByIndex = { ...entryMetaByIndex };

    indices.forEach(idx => {
      // Update Name
      newBoard.squares[idx] = [label];

      // Update Metadata if specific status selected
      if (assignPaidDefault !== 'unknown') {
        const currentM = entryMetaByIndex[idx];
        const newMeta = {
          contest_id: activePoolId,
          cell_index: idx,
          paid_status: assignPaidDefault,
          notify_opt_in: currentM?.notify_opt_in ?? false,
          contact_type: currentM?.contact_type ?? null,
          contact_value: currentM?.contact_value ?? null,
          updated_at: new Date().toISOString()
        };

        metaUpdates.push(newMeta);
        newEntryMetaByIndex[idx] = newMeta as EntryMeta;
      }
    });

    // 1. Update Local Board State
    setLocalBoard(newBoard);

    // 2. Update Local Metadata State
    if (metaUpdates.length > 0) {
      setEntryMetaByIndex(newEntryMetaByIndex);

      // 3. Batch Upsert to Supabase (Non-blocking)
      if (activePoolId) {
        // Prepare payload with explicit nulls for optional fields
        const payload = metaUpdates.map(m => ({
          contest_id: m.contest_id,
          cell_index: m.cell_index,
          paid_status: m.paid_status,
          notify_opt_in: m.notify_opt_in,
          contact_type: m.contact_type || null,
          contact_value: m.contact_value || null,
          updated_at: m.updated_at
        }));

        supabase
          .from('contest_entries')
          .upsert(payload, { onConflict: 'contest_id, cell_index' })
            .then(({ error }) => {
              if (error) {
                console.error("Batch save failed (non-blocking):", {
                message: error.message,
                details: error.details,
                hint: error.hint,
                  code: error.code
                });
                setActionMessage(`Purchaser payment details were not saved: ${error.message || 'Unknown error'}`);
              } else {
                console.log("Batch metadata saved successfully");
            }
          });
      }
    }

    setSelectedCellIndices(new Set());
    if (!options?.keepAssignMode) {
      setIsAssignMode(false);
    }
    if (options?.resetLabel ?? true) {
      setAssignLabel('');
      setAssignPaidDefault('unpaid');
    }
  };

  const handleBulkApply = () => {
    isManualApplyRef.current = true;
    applyAssignToIndices(Array.from(selectedCellIndicesRef.current), { keepAssignMode: false, resetLabel: true });
    isManualApplyRef.current = false;
  };

  const endDragAssign = () => {
    if (!isDragAssigningRef.current) return;
    isDragAssigningRef.current = false;
    setIsDragAssigning(false);

    const draggedIndices = Array.from(dragAssignedIndicesRef.current);
    dragAssignedIndicesRef.current = new Set();
    dragStartCellRef.current = null;
    const didDragAcrossCells = dragHasMovedRef.current;
    dragHasMovedRef.current = false;

    if (draggedIndices.length === 0) {
      return;
    }

    // Drag adds a range to existing selections. Single-click selection is handled by onClick.
    if (didDragAcrossCells) {
      justFinishedDragRef.current = true;
      setSelectedCellIndices(new Set(selectedCellIndicesRef.current));
      window.setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 0);
      return;
    }
  };

  const beginDragAssign = (index: number) => {
    if (!isAssignMode) return;

    dragStartCellRef.current = index;
    dragHasMovedRef.current = false;
    dragAssignedIndicesRef.current = new Set([index]);
    dragBaseSelectionRef.current = new Set(selectedCellIndicesRef.current);
    isDragAssigningRef.current = true;
    setIsDragAssigning(true);
  };

  const continueDragAssign = (index: number, buttons: number) => {
    if (!isAssignMode || !isDragAssigningRef.current || (buttons & 1) !== 1) return;

    if (!dragAssignedIndicesRef.current.has(index)) {
      dragHasMovedRef.current = true;
      dragAssignedIndicesRef.current.add(index);
      const preview = new Set(dragBaseSelectionRef.current);
      dragAssignedIndicesRef.current.forEach(idx => preview.add(idx));
      setSelectedCellIndices(preview);
    }
  };

  useEffect(() => {
    if (!isDragAssigning) return;

    const handleWindowPointerUp = () => {
      endDragAssign();
    };

    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [isDragAssigning]);

  useEffect(() => {
    if (isAssignMode) return;
    isDragAssigningRef.current = false;
    dragStartCellRef.current = null;
    dragHasMovedRef.current = false;
    justFinishedDragRef.current = false;
    setIsDragAssigning(false);
    dragAssignedIndicesRef.current = new Set();
    dragBaseSelectionRef.current = new Set();
    setSelectedCellIndices(new Set());
  }, [isAssignMode]);

  useEffect(() => {
    selectedCellIndicesRef.current = selectedCellIndices;
  }, [selectedCellIndices]);

  // Axis values to display based on dynamic mode
  const currentOppAxis = localBoard.isDynamic
    ? localBoard.oppAxisByQuarter?.[activeAxisQuarter]
    : localBoard.oppAxis;

  const currentBearsAxis = localBoard.isDynamic
    ? localBoard.bearsAxisByQuarter?.[activeAxisQuarter]
    : localBoard.bearsAxis;

  const handleBoardLifecycleAction = async () => {
    if (!activePoolId) {
      setActionMessage('Save this board before unlocking or publishing.');
      return;
    }
    setShowMenu(false);
    try {
      if (!isPublished) await flushDraftSave();

      if (!isActivated) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in before unlocking this board.');
        try {
          const result = await activateWithEntitlement(activePoolId, session.access_token);
          if (result.activated) {
            setActionMessage('Board unlocked — covered by your season pass.');
            window.location.reload();
            return;
          }
        } catch (error) {
          console.error('Entitlement check failed, falling back to checkout:', error);
        }
        await createCheckoutSession(activePoolId);
        return;
      }

      if (!isPublished) {
        setActionMessage('Checking the latest saved board and publishing the viewer link…');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in before publishing this board.');
        const response = await fetch(`/api/pools/${activePoolId}/publish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The board could not be published.');
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${result.viewerUrl}`);
          setActionMessage('Published. The viewer link is copied.');
        } catch {
          setActionMessage('Published. Copy the viewer link from this menu after the board reloads.');
        }
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }

      if (!shareCode) throw new Error('The published viewer link is unavailable. Reload and try again.');
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/b/${shareCode}`);
        setActionMessage('Viewer link copied.');
      } catch {
        setActionMessage('Could not copy automatically. Open Preview and copy the viewer URL manually.');
      }
    } catch (error: any) {
      console.error('Board lifecycle action failed:', error);
      setActionMessage(error?.message || 'The board action failed. Try again.');
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Header - Apple-clean 3-zone layout */}
      <div className="bg-broadcast-white ring-1 ring-inset ring-ink px-4 md:px-5 py-3 rounded-none flex items-center justify-between gap-2 md:gap-4 duration-500 mb-6">

        {/* LEFT: Brand + Title */}
        <button
          type="button"
          onClick={async () => {
            try {
              await flushDraftSave();
              window.location.href = '/dashboard';
            } catch {
              setActionMessage('The latest changes were not saved. Retry before leaving this board.');
            }
          }}
          className="flex min-h-11 items-center gap-3 min-w-0 group cursor-pointer text-left"
        >
          <div className="w-9 h-9 rounded-none bg-newsprint group-hover:bg-newsprint flex items-center justify-center border border-newsprint hover:border-newsprint transition-all flex-shrink-0 overflow-hidden ring-1 ring-gold/50">
            <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="min-w-0 hidden md:block">
            <h3 className="text-base font-semibold text-ink tracking-tight group-hover:text-gold transition-colors">Organizer</h3>
            <p className="text-xs font-medium text-ink/50 truncate group-hover:text-ink/70 transition-colors">
              {localGame.title || 'Untitled board'}
            </p>
          </div>
        </button>

        {/* CENTER: Tab Navigation — hard segmented control, cardinal active */}
        <div className="flex items-center gap-px bg-ink p-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`oa-slab min-h-11 px-3 md:px-4 py-2 transition-colors ${activeTab === 'overview' ? 'bg-cardinal text-broadcast-white' : 'bg-broadcast-white text-ink/60 hover:bg-newsprint hover:text-ink'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`oa-slab min-h-11 px-3 md:px-4 py-2 transition-colors ${activeTab === 'edit' ? 'bg-cardinal text-broadcast-white' : 'bg-broadcast-white text-ink/60 hover:bg-newsprint hover:text-ink'}`}
          >
            Edit
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`oa-slab min-h-11 px-3 md:px-4 py-2 transition-colors ${activeTab === 'preview' ? 'bg-cardinal text-broadcast-white' : 'bg-broadcast-white text-ink/60 hover:bg-newsprint hover:text-ink'}`}
          >
            Preview
          </button>
        </div>

        {/* RIGHT: Status + Overflow Menu */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Status pill - compact (Hidden on mobile) */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-newsprint border border-newsprint">
            {saveStatus === 'saved' && (
              <>
                <svg className="w-3.5 h-3.5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[13px] font-semibold text-ink/50">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <svg className="w-3.5 h-3.5 text-ink/40 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[13px] font-semibold text-ink/50">Saving…</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <svg className="w-3.5 h-3.5 text-cardinal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[13px] font-semibold text-cardinal">Couldn't save</span>
                <button onClick={handleRetry} className="min-h-11 px-2 text-[11px] font-bold text-ink/70 hover:text-ink underline underline-offset-2 ml-0.5">
                  Retry
                </button>
              </>
            )}
          </div>

          {/* Overflow Menu */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              onClick={() => setShowMenu(!showMenu)}
              onKeyDown={(e) => e.key === 'Escape' && setShowMenu(false)}
              aria-label="More options"
              aria-expanded={showMenu}
              aria-haspopup="true"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-none bg-newsprint hover:bg-newsprint border border-newsprint text-ink/60 hover:text-ink transition-all focus:outline-none focus:ring-2 focus:ring-ink/20"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>

            {showMenu && ReactDOM.createPortal(
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowMenu(false)} />

                {/* Menu dropdown - positioned via ref */}
                <div
                  className="fixed w-56 py-1.5 bg-broadcast-white border border-newsprint rounded-none z-[9999] duration-150"
                  style={{
                    top: menuButtonRef.current ? menuButtonRef.current.getBoundingClientRect().bottom + 8 : 0,
                    right: menuButtonRef.current ? window.innerWidth - menuButtonRef.current.getBoundingClientRect().right : 0,
                  }}
                >
                  {actionMessage && (
                    <p className="mx-3 mb-2 bg-newsprint px-3 py-2 text-xs leading-5 text-ink" role="status">
                      {actionMessage}
                    </p>
                  )}
                  <button
                    onClick={handleBoardLifecycleAction}
                    className={`w-full min-h-11 px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 ${!isActivated || !isPublished ? 'text-ink hover:bg-gold' : 'text-ink/80 hover:bg-newsprint hover:text-ink'}`}
                  >
                    {!isActivated ? (
                      <>
                        <svg className="w-4 h-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Unlock sharing ($4.99 covers 20 boards in 2026)
                      </>
                    ) : !isPublished ? (
                      <>
                        <svg className="w-4 h-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m-7-7h14" />
                        </svg>
                        Publish viewer link
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-ink/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Copy share link
                      </>
                    )}
                  </button>

                  <div className="my-1.5 border-t border-newsprint" />

                  <div className="px-4 py-2.5">
                    <div className="text-[10px] font-bold text-ink/30 uppercase tracking-wider mb-1">Board ID</div>
                    <div className="text-xs font-mono text-ink/50 break-all select-all">
                      {activePoolId || 'Not saved'}
                    </div>
                  </div>

                  <div className="my-1.5 border-t border-newsprint" />

                  <button
                    onClick={async () => {
                      setShowMenu(false);
                      try {
                        await flushDraftSave();
                        onLogout();
                      } catch {
                        setActionMessage('The latest changes were not saved. Retry before logging out.');
                      }
                    }}
                    className="w-full min-h-11 px-4 py-2.5 text-left text-sm font-medium text-ink/60 hover:bg-newsprint hover:text-ink transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>

                  <div className="my-1.5 border-t border-newsprint" />

                  {/* Delete Contest Logic */}
                  <button
                    onClick={async () => {
                      if (!activePoolId) return;
                      if (!deleteArmed) {
                        setDeleteArmed(true);
                        setActionMessage('Delete is armed. Press “Confirm delete board” within five seconds. This cannot be undone.');
                        window.setTimeout(() => setDeleteArmed(false), 5000);
                        return;
                      }
                      setDeleteArmed(false);

                      try {
                        const { error } = await supabase
                          .from('contests')
                          .delete()
                          .eq('id', activePoolId);

                        if (error) throw error;

                        // Force redirect to dashboard
                        window.location.href = '/dashboard';
                      } catch (err) {
                        console.error("Failed to delete contest:", err);
                        setActionMessage('The board could not be deleted. Try again.');
                      }
                    }}
                    className="w-full min-h-11 px-4 py-2.5 text-left text-sm font-medium text-cardinal hover:bg-cardinal-subtle hover:text-cardinal transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {deleteArmed ? 'Confirm delete board' : 'Delete board'}
                  </button>
                </div >
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      {actionMessage && !showMenu && (
        <div className="border border-ink bg-newsprint px-4 py-3 text-sm text-ink" role="status" aria-live="polite">
          {actionMessage}
        </div>
      )}

      {/* Organizer Dashboard */}
      {/* CONTENT AREA */}
      {activeTab === 'overview' ? (
        <OrganizerDashboard
          board={localBoard}
          entryMetaByIndex={entryMetaByIndex}
          liveData={liveData}
          onBulkStatusUpdate={(indices, status) => {
            // Re-using the bulk update logic pattern
            const metaUpdates: any[] = [];
            const newEntryMetaByIndex = { ...entryMetaByIndex };

            indices.forEach(idx => {
              const currentM = entryMetaByIndex[idx];
              const newMeta = {
                contest_id: activePoolId,
                cell_index: idx,
                paid_status: status,
                notify_opt_in: currentM?.notify_opt_in ?? false,
                contact_type: currentM?.contact_type ?? null,
                contact_value: currentM?.contact_value ?? null,
                updated_at: new Date().toISOString()
              };
              metaUpdates.push(newMeta);
              newEntryMetaByIndex[idx] = newMeta as EntryMeta;
            });

            // Update Local State
            setEntryMetaByIndex(newEntryMetaByIndex);

            // Batch Upsert to Supabase
            if (activePoolId) {
              const payload = metaUpdates.map(m => ({
                contest_id: m.contest_id,
                cell_index: m.cell_index,
                paid_status: m.paid_status,
                notify_opt_in: m.notify_opt_in,
                contact_type: m.contact_type || null,
                contact_value: m.contact_value || null,
                updated_at: m.updated_at
              }));

              supabase
                .from('contest_entries')
                .upsert(payload, { onConflict: 'contest_id, cell_index' })
                .then(({ error }) => {
                  if (error) {
                    console.error("Batch status update failed:", error);
                    setActionMessage(`Payment status changes were not saved: ${error.message || 'Unknown error'}`);
                  }
                });
            }
          }}
          gameTitle={localGame.title}
          isActivated={isActivated}
          isPublished={isPublished}
          onOpenEditor={() => setActiveTab('edit')}
        />
      ) : null}

      {/* Edit View Content */}
      {
        activeTab === 'edit' && (
          <>
            {/* Main Settings Area */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column: Board Settings */}
              <div className="bg-broadcast-white ring-1 ring-inset ring-ink p-6 md:p-8 rounded-none space-y-6 h-fit">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-ink">Board Settings</h4>

                  <span className="oa-slab text-[10px] text-ink/50">One fixed draw · locked at publish</span>
                </div>

                <fieldset disabled={isPublished} className="space-y-4 disabled:opacity-60">
                  <div className="space-y-1.5">
                    <label htmlFor="organizer-board-name" className="oa-slab text-ink/60">Board Name</label>
                    <input id="organizer-board-name" maxLength={100} type="text" value={localGame.title} onChange={(e) => updateField('title', e.target.value)} className="w-full oa-input" />
                  </div>

                  <div className="space-y-4">
                    <div className="border border-ink bg-newsprint p-4">
                      <p className="oa-slab text-ink/55 mb-1">
                        {localGame.gameExternalId ? 'Linked NFL game' : 'Legacy matchup'}
                      </p>
                      <p className="font-semibold text-ink">
                        {localGame.leftAbbr || 'Away'} at {localGame.topAbbr || 'Home'}
                      </p>
                      <p className="oa-body text-sm text-ink/60">
                        {localGame.kickoffAt
                          ? new Date(localGame.kickoffAt).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short',
                          })
                          : localGame.dates || 'No verified kickoff'}
                      </p>
                    </div>

                    {isPublished ? (
                      <p className="oa-body text-sm text-ink/60">
                        Published matchups are locked. Legacy published boards remain available with organizer-entered scoring.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="oa-slab text-ink/60">
                          {localGame.gameExternalId ? 'Change scheduled game' : 'Link scheduled game'}
                        </p>
                        <ScheduledGamePicker
                          value={localGame.gameExternalId || null}
                          onChange={handleScheduledGameChange}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <label htmlFor="organizer-board-subtext" className="block text-[10px] text-ink/50 uppercase font-bold tracking-widest mb-2">Location / Subtext</label>
                    <input id="organizer-board-subtext" type="text" value={localGame.meta} onChange={(e) => updateField('meta', e.target.value)} className="w-full oa-input" placeholder="e.g. 'Family Pool' or 'Las Vegas'" />
                  </div>
                </fieldset>

              </div>

              {/* Right Column: Pool Configuration */}
              <div className="flex flex-col space-y-6">
                <div className="bg-broadcast-white ring-1 ring-inset ring-ink p-6 md:p-8 rounded-none flex-1">
                  <h4 className="text-lg font-semibold text-ink mb-6">Payout Configuration</h4>

                  {/* Payout Configuration */}
                  <fieldset disabled={isPublished} className="space-y-5 mb-8 disabled:opacity-60">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="payout-q1" className="oa-slab text-ink/60">Q1 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 text-sm">$</span>
                          <input id="payout-q1" min={0} type="number" value={localGame.payouts?.Q1 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q1: parseInt(e.target.value) || 0, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full oa-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="payout-q2" className="oa-slab text-ink/60">Q2 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 text-sm">$</span>
                          <input id="payout-q2" min={0} type="number" value={localGame.payouts?.Q2 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q2: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full oa-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="payout-q3" className="oa-slab text-ink/60">Q3 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 text-sm">$</span>
                          <input id="payout-q3" min={0} type="number" value={localGame.payouts?.Q3 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q3: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full oa-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="payout-final" className="oa-slab text-ink/60 text-gold">Final Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold text-sm">$</span>
                          <input id="payout-final" min={0} type="number" value={localGame.payouts?.Final ?? 250} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Final: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125 } }))} className="w-full oa-input pl-7 text-gold font-bold border-gold/30 focus:border-gold" />
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  {/* Live Scoring */}
                  <div className="border-t border-newsprint pt-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-xs font-bold text-ink/50 uppercase tracking-widest">Live Scoring</h5>
                      <div className="flex rounded-none bg-newsprint p-1 border border-newsprint">
                        <button
                          onClick={enableAutomaticScoring}
                          className={`min-h-11 px-3 py-2 rounded-none text-[11px] font-bold transition-all ${!localGame.useManualScores ? 'bg-broadcast-white text-ink' : 'text-ink/50 hover:text-ink'}`}
                        >
                          Auto
                        </button>
                        <button
                          onClick={() => updateField('useManualScores', true)}
                          className={`min-h-11 px-3 py-2 rounded-none text-[11px] font-bold transition-all ${localGame.useManualScores ? 'bg-broadcast-white text-ink' : 'text-ink/50 hover:text-ink'}`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {!localGame.useManualScores ? (
                      <p className="text-xs text-ink/50 leading-relaxed">
                        Automatic score checks are a beta convenience and always show their source and freshness. Switch to Manual whenever you want the organizer to be authoritative.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label htmlFor="manual-game-status" className="oa-slab text-ink/60">Game Status</label>
                            <div className="relative">
                              <select
                                id="manual-game-status"
                                value={localGame.manualGameState ?? 'in'}
                                onChange={(e) => updateField('manualGameState', e.target.value)}
                                className="w-full oa-input appearance-none bg-broadcast-white text-ink"
                              >
                                <option value="pre">Scheduled</option>
                                <option value="in">In progress</option>
                                <option value="post">Final</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50">▼</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="manual-current-period" className="oa-slab text-ink/60">Current Period</label>
                            <div className="relative">
                              <select
                                id="manual-current-period"
                                value={localGame.manualPeriod ?? 1}
                                onChange={(e) => updateField('manualPeriod', parseInt(e.target.value))}
                                disabled={(localGame.manualGameState ?? 'in') !== 'in'}
                                className="w-full oa-input appearance-none bg-broadcast-white text-ink disabled:opacity-40"
                              >
                                <option value={1}>Q1</option>
                                <option value={2}>Q2</option>
                                <option value={3}>Q3</option>
                                <option value={4}>Q4</option>
                                <option value={5}>Overtime</option>
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50">▼</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                            <span></span>
                            <span className="text-[10px] font-bold text-ink/50 uppercase tracking-widest text-center">{localGame.leftAbbr}</span>
                            <span className="text-[10px] font-bold text-ink/50 uppercase tracking-widest text-center">{localGame.topAbbr}</span>
                          </div>
                          {(['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const).map((q) => (
                            <div key={q} className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                              <span className="text-xs font-bold text-ink/60">{q}</span>
                              <input
                                type="number"
                                min={0}
                                value={localGame.manualQuarterScores?.[q]?.left ?? 0}
                                onChange={(e) => updateManualQuarter(q, 'left', parseInt(e.target.value) || 0)}
                                className="w-full oa-input text-center"
                              />
                              <input
                                type="number"
                                min={0}
                                value={localGame.manualQuarterScores?.[q]?.top ?? 0}
                                onChange={(e) => updateManualQuarter(q, 'top', parseInt(e.target.value) || 0)}
                                className="w-full oa-input text-center"
                              />
                            </div>
                          ))}
                          <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center pt-1 border-t border-newsprint">
                            <span className="text-xs font-bold text-gold">Total</span>
                            <span className="text-sm font-bold text-ink text-center">
                              {(['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const).reduce((sum, q) => sum + (localGame.manualQuarterScores?.[q]?.left ?? 0), 0)}
                            </span>
                            <span className="text-sm font-bold text-ink text-center">
                              {(['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const).reduce((sum, q) => sum + (localGame.manualQuarterScores?.[q]?.top ?? 0), 0)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-ink/50 leading-relaxed">
                          Enter each quarter's points (not running totals). Save only after the period ends; that resolves its winner and sends verified emails once.
                        </p>
                        <button
                          type="button"
                          onClick={saveManualScore}
                          disabled={scoreSaveStatus === 'saving'}
                          className="oa-btn oa-btn-primary w-full"
                        >
                          {scoreSaveStatus === 'saving' ? 'Publishing score…' : 'Publish manual score'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Board Actions */}
                  <div className="border-t border-newsprint pt-6">
                    <h5 className="text-xs font-bold text-ink/50 uppercase tracking-widest mb-4">Board Actions</h5>
                    {isPublished ? (
                      <p className="oa-body border border-gold bg-gold/20 p-4 text-ink">
                        Published board data is locked. Scanning, clearing names, and editing squares are disabled so winner history stays tied to the exact shared grid.
                      </p>
                    ) : (
                    <div className="flex gap-4">
                      <label className={`flex-1 flex flex-col items-center justify-center gap-2 bg-newsprint border border-newsprint hover:border-newsprint hover:bg-newsprint rounded-none p-4 cursor-pointer transition-all active:scale-[0.98] ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                        <svg className="w-6 h-6 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-xs font-bold text-ink">{isScanning ? 'Processing...' : 'Scan Board'}</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>

                      <button onClick={handleClear} className="flex-1 flex flex-col items-center justify-center gap-2 bg-cardinal-subtle border border-cardinal hover:bg-cardinal-subtle rounded-none p-4 transition-all active:scale-[0.98]">
                        <svg className="w-6 h-6 text-cardinal" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        <span className="text-xs font-bold text-cardinal">{clearArmed ? 'Confirm clear' : 'Clear names'}</span>
                      </button>
                    </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Grid Editor Section */}
            <div className="bg-broadcast-white ring-1 ring-inset ring-ink p-6 md:p-8 rounded-none flex flex-col space-y-6 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-newsprint pb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-ink tracking-tight">Grid Editor</h3>
                  <p className="text-sm font-medium text-ink/60 mt-1">Assign purchaser names, then run one random number draw. Publishing locks both axes.</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Bulk Assign Toggle */}
                  {!isPublished && <button
                    onClick={() => {
                      setIsAssignMode(!isAssignMode);
                      isDragAssigningRef.current = false;
                      dragStartCellRef.current = null;
                      dragHasMovedRef.current = false;
                      justFinishedDragRef.current = false;
                      setIsDragAssigning(false);
                      dragAssignedIndicesRef.current = new Set();
                      dragBaseSelectionRef.current = new Set();
                      setSelectedCellIndices(new Set());
                    }}
                    className={`min-h-11 px-4 py-2 rounded-none text-xs font-bold transition-all ${isAssignMode ? 'bg-cardinal text-broadcast-white  ' : 'bg-newsprint text-ink/70 hover:bg-newsprint'}`}
                  >
                    {isAssignMode ? 'Done' : 'Assign Squares'}
                  </button>}
                </div>
              </div>

              {/* Bulk Assign Panel */}
              {isAssignMode && !isPublished && (
                <div className="bg-cardinal-subtle border border-cardinal rounded-none p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5 space-y-1">
                    <label className="text-[10px] font-bold text-cardinal uppercase tracking-widest">Label to Apply</label>
                    <input
                      type="text"
                      value={assignLabel}
                      onChange={(e) => setAssignLabel(e.target.value)}
                      placeholder="e.g. Mora"
                      className="w-full bg-broadcast-white border border-newsprint rounded-none px-3 py-2 text-sm text-ink focus:border-cardinal outline-none"
                    />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-cardinal uppercase tracking-widest">Payment Status</label>
                    <div className="w-full flex bg-broadcast-white rounded-none p-1 border border-newsprint">
                      {(['unpaid', 'paid'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setAssignPaidDefault(status)}
                          className={`flex-1 min-h-11 px-3 py-2 rounded-none text-xs font-bold capitalize transition-all ${assignPaidDefault === status ? 'bg-cardinal text-broadcast-white' : 'text-ink/50 hover:text-ink'}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    </div>

                    <div className="md:col-span-4 flex items-end justify-start md:justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsAssignMode(false);
                          isDragAssigningRef.current = false;
                          dragStartCellRef.current = null;
                          dragHasMovedRef.current = false;
                          justFinishedDragRef.current = false;
                          setIsDragAssigning(false);
                          dragAssignedIndicesRef.current = new Set();
                          dragBaseSelectionRef.current = new Set();
                          setSelectedCellIndices(new Set());
                        }}
                        className="min-h-11 px-4 py-2 rounded-none text-xs font-bold text-ink/50 hover:bg-newsprint hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkApply}
                        disabled={!assignLabel.trim() || selectedCellIndices.size === 0}
                        className="min-h-11 px-6 py-2 rounded-none text-sm font-bold bg-cardinal text-broadcast-white hover:bg-cardinal-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Apply to {selectedCellIndices.size}
                      </button>
                    </div>

                    <div className="md:col-span-12 text-[11px] text-cardinal">
                      Click cells to toggle selection, or click-drag to select a range. Then press Apply to update all selected squares.
                    </div>
                  </div>
                </div>
              )}

              <section className={`border border-ink ${isPublished ? 'bg-gold text-ink' : 'bg-cardinal text-broadcast-white'}`} aria-labelledby="number-draw-title">
                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="oa-slab text-[11px] opacity-70">Draw phase</p>
                    <h3 id="number-draw-title" className="oa-headline !text-2xl">
                      {isPublished ? 'Axis digits are locked.' : drawPreview ? 'Review the random draw.' : 'Draw both 0–9 axes once.'}
                    </h3>
                    <p className="oa-body mt-2 max-w-2xl opacity-80">
                      {isPublished
                        ? 'The published viewer board and winner history remain tied to this committed draw.'
                        : localBoard.squares.some((names) => !names.length)
                          ? `Assign all 100 squares first. ${localBoard.squares.filter((names) => !names.length).length} remain before the random draw unlocks.`
                          : 'GridOne uses your browser’s cryptographic random generator. You can redraw before committing; publication makes the committed result permanent.'}
                    </p>
                  </div>
                  {!isPublished && !drawPreview && (
                    <button
                      type="button"
                      onClick={stageNumberDraw}
                      disabled={localBoard.squares.some((names) => !names.length)}
                      className="oa-btn bg-gold text-ink border border-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Draw numbers
                    </button>
                  )}
                </div>
                {drawPreview && !isPublished && (
                  <div className="border-t border-ink bg-broadcast-white p-5 text-ink overflow-x-auto">
                    <dl className="min-w-[42rem] grid gap-4">
                      <div className="grid grid-cols-[5rem_repeat(10,minmax(1.8rem,1fr))] items-center gap-px bg-ink">
                        <dt className="oa-slab bg-newsprint p-2">Top</dt>
                        {drawPreview.top.map((digit, index) => <dd key={`top-${index}`} className="oa-data bg-broadcast-white p-2 text-center text-lg">{digit}</dd>)}
                      </div>
                      <div className="grid grid-cols-[5rem_repeat(10,minmax(1.8rem,1fr))] items-center gap-px bg-ink">
                        <dt className="oa-slab bg-newsprint p-2">Side</dt>
                        {drawPreview.side.map((digit, index) => <dd key={`side-${index}`} className="oa-data bg-broadcast-white p-2 text-center text-lg">{digit}</dd>)}
                      </div>
                    </dl>
                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      <button type="button" onClick={() => setDrawPreview(null)} className="oa-btn oa-btn-ghost">Cancel</button>
                      <button type="button" onClick={stageNumberDraw} className="oa-btn oa-btn-ghost">Redraw</button>
                      <button type="button" onClick={commitNumberDraw} className="oa-btn oa-btn-primary">Commit draw</button>
                    </div>
                  </div>
                )}
              </section>

              <div className="overflow-x-auto custom-scrollbar bg-newsprint p-6 rounded-none border border-newsprint">
                <div className="min-w-[800px] space-y-6">

                  {/* Header: Top Team and Axis */}
                  <div className="flex items-end">
                    <div className="w-6"></div> {/* Spacer for vertical label */}
                    <div className="w-16 pr-3 flex flex-col justify-end">
                      {/* Removed top-left abbreviation, now vertical on side */}
                    </div>
                    <div className="flex-1">
                      <div className="text-center text-[10px] font-black text-ink/50 uppercase tracking-widest mb-3">{localGame.topName}</div>
                      <div className="grid grid-cols-10 gap-2">
                        {currentOppAxis?.map((val, idx) => (
                          <div key={idx} className="space-y-1">
                            <output className="oa-data flex h-10 w-full items-center justify-center bg-broadcast-white border border-newsprint text-sm font-bold">
                              {val ?? '—'}
                            </output>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Body: Left Labels and Main Grid */}
                  <div className="flex">
                    {/* Vertical Left Label */}
                    <div className="w-6 flex items-center justify-center">
                      <div className="text-[10px] font-black text-ink/50 uppercase tracking-widest whitespace-nowrap py-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {localGame.leftName}
                      </div>
                    </div>

                    <div className="w-16 flex flex-col gap-2 pr-3 pt-0 border-r border-newsprint">
                      {currentBearsAxis?.map((val, idx) => (
                        <div key={idx} className="flex items-center justify-end gap-1 group h-12 relative">
                          <output className={`oa-data flex h-12 w-10 items-center justify-center bg-broadcast-white border text-sm font-bold ${currentBearsAxis.length > 10 ? 'border-cardinal' : 'border-newsprint'}`}>
                            {val ?? '—'}
                          </output>
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 grid grid-cols-10 gap-2 ml-2 select-none">
                      {[...Array(10)].map((_, r) => (
                        [...Array(10)].map((_, c) => {
                          const cellIdx = (r * 10) + c;
                          const players = localBoard.squares[cellIdx] || [];

                          return (
                            <div key={cellIdx} className="relative group h-12">
                              {/* Unified Click Handler */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isPublished) return;
                                  if (isAssignMode) {
                                    if (justFinishedDragRef.current) return;
                                    toggleCellSelection(cellIdx);
                                    return;
                                  }
                                  setEditingMetaIndex(cellIdx);
                                }}
                                onPointerDown={(e) => {
                                  if (isPublished || !isAssignMode) return;
                                  e.preventDefault();
                                  beginDragAssign(cellIdx);
                                }}
                                onPointerEnter={(e) => {
                                  if (!isPublished) continueDragAssign(cellIdx, e.buttons);
                                }}
                                onPointerOver={(e) => {
                                  if (!isPublished) continueDragAssign(cellIdx, e.buttons);
                                }}
                                onPointerUp={() => {
                                  if (isPublished || !isAssignMode) return;
                                  endDragAssign();
                                }}
                                disabled={isPublished}
                                aria-pressed={isAssignMode ? selectedCellIndices.has(cellIdx) : undefined}
                                aria-label={`Square ${cellIdx + 1}${players[0] ? `, assigned to ${players[0]}` : ', unassigned'}${isAssignMode ? ', toggle selection' : ', edit purchaser details'}`}
                                className={`w-full h-full border rounded-none flex flex-col items-center justify-center p-1 transition-all group ${isPublished ? 'cursor-default' : 'cursor-pointer active:scale-95'} ${isAssignMode && selectedCellIndices.has(cellIdx)
                                  ? 'bg-cardinal-subtle border-cardinal '
                                  : 'bg-newsprint border-newsprint hover:bg-newsprint hover:border-newsprint'
                                  }`}
                              >
                                <span className="oa-board-name font-bold text-ink/90 truncate w-full text-center">
                                  {players[0] || ''}
                                </span>
                                {players.length === 0 && (
                                  <span className="oa-board-name text-ink/30 select-none">
                                    {currentOppAxis?.[c] ?? '?'}-{currentBearsAxis?.[r] ?? '?'}
                                  </span>
                                )}
                              </button>

                              {/* Status Indicator (Paid/Unpaid) */}
                              {entryMetaByIndex[cellIdx]?.paid_status === 'paid' && (
                                <div className="absolute bottom-1 right-1 pointer-events-none">
                                  <svg className="w-3 h-3 text-ink" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                </div>
                              )}
                              {(entryMetaByIndex[cellIdx]?.paid_status === 'unpaid' || (!entryMetaByIndex[cellIdx]?.paid_status && players.length > 0)) && (
                                <div className="absolute bottom-1 right-1 pointer-events-none">
                                  <svg className="w-3 h-3 text-cardinal" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Metadata Edit Modal */}
      {
        editingMetaIndex !== null && !isPublished && (
          <MetadataModal
            cellIndex={editingMetaIndex}
            currentName={localBoard.squares[editingMetaIndex]?.[0] || ''}
            currentMeta={entryMetaByIndex[editingMetaIndex]}
            onSave={(name, meta) => {
              // 1. Update Board Name (triggers debounce save)
              const newBoard = { ...localBoard, squares: [...localBoard.squares] };
              newBoard.squares[editingMetaIndex] = name ? [name] : [];
              setLocalBoard(newBoard);

              // 2. Save Metadata (immediate)
              saveEntryMeta(meta);

              setEditingMetaIndex(null);
            }}
            onClose={() => setEditingMetaIndex(null)}
          />
        )
      }

      {/* PREVIEW TAB CONTENT */}
      {activeTab === 'preview' && renderPreview && (
        <div className="w-full h-full min-h-[calc(100vh-140px)] rounded-none overflow-hidden bg-background border border-newsprint relative">
          {renderPreview()}
        </div>
      )}

    </div>
  );
};

// Internal Modal Component
const MetadataModal: React.FC<{
  cellIndex: number;
  currentName: string;
  currentMeta?: EntryMeta;
  onSave: (name: string, meta: EntryMeta) => void;
  onClose: () => void;
}> = ({ cellIndex, currentName, currentMeta, onSave, onClose }) => {
  const [name, setName] = useState(currentName);
  const [paidStatus, setPaidStatus] = useState<EntryMeta['paid_status']>(currentMeta?.paid_status && currentMeta.paid_status !== 'unknown' ? currentMeta.paid_status : 'unpaid');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, onClose);

  const handleSave = () => {
    onSave(name.trim(), {
      cell_index: cellIndex,
      paid_status: paidStatus,
      notify_opt_in: false,
      contact_type: null,
      contact_value: null
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`square-dialog-title-${cellIndex}`}
        aria-describedby={`square-dialog-description-${cellIndex}`}
        className="relative w-full max-w-sm bg-broadcast-white border border-ink p-6 space-y-4"
      >

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 id={`square-dialog-title-${cellIndex}`} className="text-lg font-semibold text-ink">Edit square {cellIndex + 1}</h3>
          <button onClick={onClose} aria-label="Close square editor" className="min-h-11 min-w-11 p-1 hover:bg-newsprint rounded-none text-ink/50 hover:text-ink">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6">

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink/50 uppercase tracking-widest">Purchaser or seller name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Name"
              className="w-full oa-input"
              autoFocus
            />
          </div>

          {/* Paid Status */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink/50 uppercase tracking-widest">Payment Status</label>
            <div className="flex gap-2">
              {(['unpaid', 'paid'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setPaidStatus(status)}
                  className={`flex-1 min-h-11 py-2 px-3 rounded-none text-xs font-bold capitalize transition-all ${paidStatus === status
                    ? (status === 'paid' ? 'bg-gold text-ink border border-gold-deep' :
                      status === 'unpaid' ? 'bg-cardinal-subtle text-cardinal border border-cardinal' :
                        'bg-broadcast-white text-ink')
                    : 'bg-newsprint text-ink/60 hover:bg-newsprint'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <p id={`square-dialog-description-${cellIndex}`} className="pt-4 border-t border-newsprint text-xs leading-relaxed text-ink/55">
            Viewers can select this name on the published board and verify their own winner email. Organizers never need to collect contact details.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="min-h-11 px-6 py-2 bg-broadcast-white text-ink text-sm font-bold rounded-none hover:bg-newsprint transition-colors"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
