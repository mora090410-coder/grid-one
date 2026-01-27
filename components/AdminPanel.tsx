import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { useContestEntries } from '../hooks/useContestEntries';
import { OrganizerDashboard } from './OrganizerDashboard';
import { GameState, BoardData, EntryMeta, LiveGameData } from '../types';
import { supabase } from '../services/supabase';
import { NFL_TEAMS } from '../constants';
import { parseBoardImage } from '../services/geminiService';
import { getContrastYIQ } from '../utils/theme';
import { calculateWinnerHighlights } from '../utils/winnerLogic';

import { createCheckoutSession } from '../services/stripe';

interface AdminPanelProps {
  game: GameState;
  board: BoardData;
  adminToken: string;
  activePoolId: string | null;
  liveData: LiveGameData | null;
  onApply: (game: GameState, board: BoardData) => void;
  onPublish: (token: string, currentData: { game: GameState, board: BoardData }) => Promise<string | void>;
  onClose: () => void;
  onLogout: () => void;
  onPreview: () => void;
  isActivated: boolean;
  initialTab?: 'overview' | 'edit' | 'preview';
  renderPreview?: () => React.ReactNode;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ game, board, adminToken, activePoolId, liveData, onApply, onPublish, onClose, onLogout, onPreview, isActivated, initialTab = 'overview', renderPreview }) => {
  const [localGame, setLocalGame] = useState<GameState>(game);
  const [localBoard, setLocalBoard] = useState<BoardData>(board);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [activeAxisQuarter, setActiveAxisQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'preview'>(initialTab);

  // Metadata State (via Hook)
  const { entryMetaByIndex, setEntryMetaByIndex } = useContestEntries(activePoolId);
  const [editingMetaIndex, setEditingMetaIndex] = useState<number | null>(null);

  // Bulk Assign State
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [assignLabel, setAssignLabel] = useState('');
  const [assignPaidDefault, setAssignPaidDefault] = useState<EntryMeta['paid_status']>('unpaid');
  const [selectedCellIndices, setSelectedCellIndices] = useState<Set<number>>(new Set());

  // Auto-save status: 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showMenu, setShowMenu] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

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
      alert(`Failed to save metadata: ${error.message || 'Unknown error'}`);
    }
  };

  // Apply changes locally (for real-time preview)
  useEffect(() => {
    onApply(localGame, localBoard);
  }, [localGame, localBoard, onApply]);

  // Debounced auto-save to backend
  useEffect(() => {
    // Skip first render (initial load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set status to saving immediately
    setSaveStatus('saving');

    // Debounce the actual save by 800ms
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onPublish(adminToken, {
          game: localGame,
          board: localBoard
        });
        setSaveStatus('saved');
      } catch (e) {
        console.error('Auto-save failed:', e);
        setSaveStatus('error');
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localGame, localBoard, adminToken, onPublish]);

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
    setLocalBoard(newBoard);
    setScanStatus("SCAN SUCCESSFUL: GRID MAPPED");
    setTimeout(() => setScanStatus(null), 5000);
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all names from the board?")) return;

    const emptyBoard: BoardData = {
      bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      squares: Array(100).fill(null).map(() => []),
      isDynamic: false
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

    setScanStatus("Board Cleared");
    setTimeout(() => setScanStatus(null), 3000);
  };

  const toggleBoardType = () => {
    const newBoard = { ...localBoard };
    newBoard.isDynamic = !newBoard.isDynamic;

    // Initialize quarter axes if switching to dynamic and missing
    if (newBoard.isDynamic) {
      if (!newBoard.bearsAxisByQuarter) {
        newBoard.bearsAxisByQuarter = {
          Q1: [...newBoard.bearsAxis],
          Q2: [...newBoard.bearsAxis],
          Q3: [...newBoard.bearsAxis],
          Q4: [...newBoard.bearsAxis]
        };
      }
      if (!newBoard.oppAxisByQuarter) {
        newBoard.oppAxisByQuarter = {
          Q1: [...newBoard.oppAxis],
          Q2: [...newBoard.oppAxis],
          Q3: [...newBoard.oppAxis],
          Q4: [...newBoard.oppAxis]
        };
      }
    }
    setLocalBoard(newBoard);
  };

  // Retry save on error
  const handleRetry = async () => {
    setSaveStatus('saving');
    try {
      await onPublish(adminToken, {
        game: localGame,
        board: localBoard
      });
      setSaveStatus('saved');
    } catch (e) {
      console.error('Retry save failed:', e);
      setSaveStatus('error');
    }
  };

  const updateField = (field: keyof GameState, val: string | number | boolean) => {
    setLocalGame(prev => ({ ...prev, [field]: val }));
  };

  const handleTeamChange = (side: 'left' | 'top', abbr: string) => {
    const team = NFL_TEAMS.find(t => t.abbr === abbr);
    setLocalGame(prev => ({
      ...prev,
      [`${side}Abbr`]: abbr,
      [`${side}Name`]: team ? team.name : abbr
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatus("AI ANALYZING GRID...");

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
      const errMsg = err instanceof Error ? err.message : "Check API Key";
      setScanStatus(errMsg.includes('overloaded') ? "AI Overloaded. Trying again..." : `Scan Failed: ${errMsg}`);
      setTimeout(() => setScanStatus(null), 6000);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Bulk Assign Logic ---
  const toggleCellSelection = (index: number) => {
    const newSet = new Set(selectedCellIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedCellIndices(newSet);
  };

  const handleBulkApply = () => {
    if (!assignLabel.trim()) {
      alert("Please enter a label.");
      return;
    }
    if (selectedCellIndices.size === 0) return;

    // Check for conflicts
    const indices = Array.from(selectedCellIndices);
    const conflicts = indices.filter(idx => localBoard.squares[idx] && localBoard.squares[idx].length > 0);

    if (conflicts.length > 0) {
      if (!confirm(`Replace names in ${conflicts.length} squares?`)) {
        return;
      }
    }

    const newBoard = {
      ...localBoard,
      squares: [...localBoard.squares] // Ensure shallow copy of array
    };
    const label = assignLabel.trim();

    // Prepare batch metadata updates
    const metaUpdates: any[] = [];
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
              // No alert shown to user to keep flow smooth
            } else {
              console.log("Batch metadata saved successfully");
            }
          });
      }
    }

    setSelectedCellIndices(new Set());
    setIsAssignMode(false);
    setAssignLabel('');
    setAssignPaidDefault('unpaid');
  };

  // --- Manual Grid Editor Sync Functions ---

  const handleGridCellChange = (cellIndex: number, value: string) => {
    const newBoard = { ...localBoard, squares: [...localBoard.squares] };
    const names = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    newBoard.squares[cellIndex] = names;
    setLocalBoard(newBoard);
  };

  const handleAxisChange = (axis: 'bearsAxis' | 'oppAxis', index: number, value: string) => {
    const newBoard = { ...localBoard };
    const num = parseInt(value);

    if (!isNaN(num)) {
      if (newBoard.isDynamic) {
        // Update specific quarter axis
        const axisKey = axis === 'bearsAxis' ? 'bearsAxisByQuarter' : 'oppAxisByQuarter';
        if (newBoard[axisKey]) {
          newBoard[axisKey]![activeAxisQuarter][index] = num;
        }
      } else {
        // Update standard axis
        newBoard[axis][index] = num;
      }
      setLocalBoard(newBoard);
    }
  };

  const axisDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Axis values to display based on dynamic mode
  const currentOppAxis = localBoard.isDynamic
    ? localBoard.oppAxisByQuarter?.[activeAxisQuarter]
    : localBoard.oppAxis;

  const currentBearsAxis = localBoard.isDynamic
    ? localBoard.bearsAxisByQuarter?.[activeAxisQuarter]
    : localBoard.bearsAxis;

  return (
    <div className="space-y-6">

      {/* Top Header - Apple-clean 3-zone layout */}
      <div className="premium-glass px-4 md:px-5 py-3 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 mb-6 backdrop-blur-2xl">

        {/* LEFT: Brand + Title */}
        <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-black/20 group-hover:bg-white/10 flex items-center justify-center shadow-md border border-white/10 hover:border-white/20 transition-all flex-shrink-0 overflow-hidden ring-1 ring-[#FFC72C]/50">
            <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-gold transition-colors">Organizer</h3>
            <p className="text-xs font-medium text-white/50 truncate group-hover:text-white/70 transition-colors">
              {localGame.title || 'Untitled board'}
            </p>
          </div>
        </Link>

        {/* CENTER: Tab Navigation */}
        <div className="flex items-center bg-black/30 p-0.5 rounded-full border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'edit' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
          >
            Edit
          </button>
          <div className="w-px h-3 bg-white/10 mx-1"></div>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'preview' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
          >
            Preview
          </button>
        </div>

        {/* RIGHT: Status + Overflow Menu */}
        <div className="flex items-center gap-3">
          {/* Status pill - compact */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
            {saveStatus === 'saved' && (
              <>
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[13px] font-semibold text-white/50">Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <svg className="w-3.5 h-3.5 text-white/40 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[13px] font-semibold text-white/50">Saving…</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[13px] font-semibold text-red-400">Couldn't save</span>
                <button onClick={handleRetry} className="text-[11px] font-bold text-white/70 hover:text-white underline underline-offset-2 ml-0.5">
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
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
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
                  className="fixed w-56 py-1.5 bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
                  style={{
                    top: menuButtonRef.current ? menuButtonRef.current.getBoundingClientRect().bottom + 8 : 0,
                    right: menuButtonRef.current ? window.innerWidth - menuButtonRef.current.getBoundingClientRect().right : 0,
                  }}
                >
                  <button
                    onClick={async () => {
                      if (!isActivated && activePoolId) {
                        await createCheckoutSession(activePoolId);
                      } else {
                        navigator.clipboard.writeText(`${window.location.origin}/?poolId=${activePoolId}`);
                        setShowMenu(false);
                      }
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-3 ${!isActivated ? 'text-green-400 hover:bg-green-500/10' : 'text-white/80 hover:bg-white/[0.08] hover:text-white'}`}
                  >
                    {!isActivated ? (
                      <>
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Activate Board ($9.99)
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Copy share link
                      </>
                    )}
                  </button>

                  <div className="my-1.5 border-t border-white/[0.08]" />

                  <div className="px-4 py-2.5">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Board ID</div>
                    <div className="text-xs font-mono text-white/50 break-all select-all">
                      {activePoolId || 'Not saved'}
                    </div>
                  </div>

                  <div className="my-1.5 border-t border-white/[0.08]" />

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onLogout();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>

                  <div className="my-1.5 border-t border-white/[0.08]" />

                  {/* Delete Contest Logic */}
                  <button
                    onClick={async () => {
                      if (!activePoolId) return;
                      if (!confirm(`Are you sure you want to delete this contest?\nThis action cannot be undone.`)) {
                        setShowMenu(false);
                        return;
                      }

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
                        alert("Failed to delete contest");
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Contest
                  </button>
                </div >
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Organizer Dashboard */}
      {/* CONTENT AREA */}
      {activeTab === 'overview' ? (
        <OrganizerDashboard
          board={localBoard}
          entryMetaByIndex={entryMetaByIndex}
          liveData={liveData}
          onOpenSquareDetails={(idx) => setEditingMetaIndex(idx)}
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
                  if (error) console.error("Batch status update failed:", error);
                });
            }
          }}
          gameTitle={localGame.title}
        />
      ) : null}

      {/* Edit View Content */}
      {
        activeTab === 'edit' && (
          <>
            {/* Main Settings Area */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column: Board Settings */}
              <div className="premium-glass p-6 md:p-8 rounded-3xl space-y-6 h-fit">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-white">Board Settings</h4>

                  {/* Dynamic Board Toggle */}
                  <div className="flex items-center gap-1 bg-black/20 p-1 rounded-full border border-white/5">
                    <button
                      onClick={() => localBoard.isDynamic && toggleBoardType()}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${!localBoard.isDynamic ? 'bg-white text-black shadow-md' : 'text-gray-500 hover:text-white'}`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => !localBoard.isDynamic && toggleBoardType()}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${localBoard.isDynamic ? 'bg-white text-black shadow-md' : 'text-gray-500 hover:text-white'}`}
                    >
                      Dynamic
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-label">Board Name</label>
                    <input type="text" value={localGame.title} onChange={(e) => updateField('title', e.target.value)} className="w-full glass-input" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-label">Away Team (Left)</label>
                      <div className="relative">
                        <select value={localGame.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full glass-input appearance-none cursor-pointer">
                          {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr} className="bg-[#1c1c1e]">{t.abbr}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-label">Home Team (Top)</label>
                      <div className="relative">
                        <select value={localGame.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full glass-input appearance-none cursor-pointer">
                          {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr} className="bg-[#1c1c1e]">{t.abbr}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-label whitespace-nowrap">Game Date</label>
                    <input type="date" value={localGame.dates} onChange={(e) => updateField('dates', e.target.value)} className="w-full glass-input" />
                  </div>

                  <div className="pt-2">
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Location / Subtext</div>
                    <input type="text" value={localGame.meta} onChange={(e) => updateField('meta', e.target.value)} className="w-full glass-input" placeholder="e.g. 'Family Pool' or 'Las Vegas'" />
                  </div>
                </div>

              </div>

              {/* Right Column: Pool Configuration */}
              <div className="flex flex-col space-y-6">
                <div className="premium-glass p-6 md:p-8 rounded-3xl flex-1">
                  <h4 className="text-lg font-semibold text-white mb-6">Payout Configuration</h4>

                  {/* Payout Configuration */}
                  <div className="space-y-5 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-label">Q1 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input type="number" value={localGame.payouts?.Q1 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q1: parseInt(e.target.value) || 0, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-label">Q2 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input type="number" value={localGame.payouts?.Q2 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q2: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-label">Q3 Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                          <input type="number" value={localGame.payouts?.Q3 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q3: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-label text-gold">Final Payout</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold text-sm">$</span>
                          <input type="number" value={localGame.payouts?.Final ?? 250} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Final: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125 } }))} className="w-full glass-input pl-7 text-gold font-bold border-gold/30 focus:border-gold" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Board Actions */}
                  <div className="border-t border-white/5 pt-6">
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Board Actions</h5>
                    <div className="flex gap-4">
                      <label className={`flex-1 flex flex-col items-center justify-center gap-2 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.98] ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-xs font-bold text-white">{isScanning ? 'Processing...' : 'Scan Board'}</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>

                      <button onClick={handleClear} className="flex-1 flex flex-col items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-2xl p-4 transition-all active:scale-[0.98]">
                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        <span className="text-xs font-bold text-red-400">Clear Board</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Grid Editor Section */}
            <div className="premium-glass p-6 md:p-8 rounded-3xl flex flex-col space-y-6 animate-in slide-in-from-bottom-4 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white tracking-tight">Grid Editor</h3>
                  <p className="text-sm font-medium text-gray-400 mt-1">Tap any cell or axis to edit names and numbers manually.</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Dynamic Axis Selector */}
                  {localBoard.isDynamic && (
                    <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/5">
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                        <button
                          key={q}
                          onClick={() => setActiveAxisQuarter(q)}
                          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeAxisQuarter === q
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                          {q === 'Q4' ? 'Final' : q}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bulk Assign Toggle */}
                  <button
                    onClick={() => {
                      setIsAssignMode(!isAssignMode);
                      setSelectedCellIndices(new Set());
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isAssignMode ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                  >
                    {isAssignMode ? 'Done' : 'Assign Squares'}
                  </button>
                </div>
              </div>

              {/* Bulk Assign Panel */}
              {isAssignMode && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center animate-in slide-in-from-top-2">
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Label to Apply</label>
                    <input
                      type="text"
                      value={assignLabel}
                      onChange={(e) => setAssignLabel(e.target.value)}
                      placeholder="e.g. Mora"
                      className="w-full bg-[#1c1c1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="w-full md:w-auto space-y-1">
                    <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Payment Status</label>
                    <div className="flex bg-[#1c1c1e] rounded-lg p-1 border border-white/10">
                      {(['unpaid', 'paid'] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setAssignPaidDefault(status)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${assignPaidDefault === status ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end gap-2 w-full md:w-auto pt-4 md:pt-0">
                    <button
                      onClick={() => setIsAssignMode(false)}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkApply}
                      disabled={!assignLabel.trim() || selectedCellIndices.size === 0}
                      className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Apply to {selectedCellIndices.size}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto custom-scrollbar bg-black/20 p-6 rounded-2xl border border-white/5">
                <div className="min-w-[800px] space-y-6">

                  {/* Header: Top Team and Axis */}
                  <div className="flex items-end">
                    <div className="w-6"></div> {/* Spacer for vertical label */}
                    <div className="w-16 pr-3 flex flex-col justify-end">
                      {/* Removed top-left abbreviation, now vertical on side */}
                    </div>
                    <div className="flex-1">
                      <div className="text-center text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">{localGame.topName}</div>
                      <div className="grid grid-cols-10 gap-2">
                        {currentOppAxis?.map((val, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="relative group">
                              <select
                                value={val ?? ''}
                                onChange={(e) => handleAxisChange('oppAxis', idx, e.target.value)}
                                className="w-full h-10 bg-[#1c1c1e] border border-white/10 rounded-lg text-center text-sm text-white font-bold focus:border-white/30 outline-none appearance-none cursor-pointer transition-all hover:bg-white/5"
                              >
                                <option value="" className="text-gray-500">?</option>
                                {axisDigits.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Body: Left Labels and Main Grid */}
                  <div className="flex">
                    {/* Vertical Left Label */}
                    <div className="w-6 flex items-center justify-center">
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap py-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {localGame.leftName}
                      </div>
                    </div>

                    <div className="w-16 flex flex-col gap-2 pr-3 pt-0 border-r border-white/5">
                      {currentBearsAxis?.map((val, idx) => (
                        <div key={idx} className="flex items-center justify-end gap-1 group h-12 relative">
                          {/* Delete Button for Extra Rows */}
                          {currentBearsAxis.length > 10 && (
                            <button
                              onClick={() => {
                                if (confirm('Remove this row and its squares?')) {
                                  // Remove axis item
                                  const newAxis = [...currentBearsAxis];
                                  newAxis.splice(idx, 1);

                                  // Remove corresponding squares (10 items per row)
                                  // Note: If columns are also messed up (>10), this logic might be imperfect but sufficient for row deletion
                                  const colCount = currentOppAxis?.length || 10;
                                  const newSquares = [...localBoard.squares];
                                  newSquares.splice(idx * colCount, colCount);

                                  const newBoard = { ...localBoard };
                                  if (newBoard.isDynamic) {
                                    // Update quarter specific if dynamic
                                    if (!newBoard.bearsAxisByQuarter) newBoard.bearsAxisByQuarter = { Q1: [], Q2: [], Q3: [], Q4: [] };
                                    newBoard.bearsAxisByQuarter[activeAxisQuarter] = newAxis;
                                  } else {
                                    newBoard.bearsAxis = newAxis;
                                  }
                                  newBoard.squares = newSquares;
                                  setLocalBoard(newBoard);
                                }
                              }}
                              className="absolute -left-6 opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                              title="Delete extra row"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                          <div className="relative w-10">
                            <select
                              value={val ?? ''}
                              onChange={(e) => handleAxisChange('bearsAxis', idx, e.target.value)}
                              className={`w-full h-12 bg-[#1c1c1e] border rounded-lg text-center text-sm text-white font-bold focus:border-white/30 outline-none appearance-none cursor-pointer transition-all hover:bg-white/5 ${currentBearsAxis.length > 10 ? 'border-red-500/50' : 'border-white/10'}`}
                            >
                              <option value="" className="text-gray-500">?</option>
                              {axisDigits.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 grid grid-cols-10 gap-2 ml-2">
                      {[...Array(10)].map((_, r) => (
                        [...Array(10)].map((_, c) => {
                          const cellIdx = (r * 10) + c;
                          const players = localBoard.squares[cellIdx] || [];

                          return (
                            <div key={cellIdx} className="relative group h-12">
                              {/* Unified Click Handler */}
                              <div
                                onClick={() => {
                                  if (isAssignMode) {
                                    toggleCellSelection(cellIdx);
                                  } else {
                                    setEditingMetaIndex(cellIdx);
                                  }
                                }}
                                className={`w-full h-full border rounded-lg flex flex-col items-center justify-center p-1 cursor-pointer transition-all group active:scale-95 ${isAssignMode && selectedCellIndices.has(cellIdx)
                                  ? 'bg-indigo-500/30 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                  }`}
                              >
                                <span className="text-[10px] font-medium text-white/90 truncate w-full text-center">
                                  {players[0] || ''}
                                </span>
                                {players.length === 0 && (
                                  <span className="text-[9px] text-white/20 select-none">
                                    {currentOppAxis?.[c] ?? '?'}-{currentBearsAxis?.[r] ?? '?'}
                                  </span>
                                )}
                              </div>

                              {/* Status Indicator (Paid/Unpaid) */}
                              {entryMetaByIndex[cellIdx]?.paid_status === 'paid' && (
                                <div className="absolute bottom-1 right-1 pointer-events-none">
                                  <svg className="w-3 h-3 text-green-400 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                </div>
                              )}
                              {(entryMetaByIndex[cellIdx]?.paid_status === 'unpaid' || (!entryMetaByIndex[cellIdx]?.paid_status && players.length > 0)) && (
                                <div className="absolute bottom-1 right-1 pointer-events-none">
                                  <svg className="w-3 h-3 text-red-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
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
        editingMetaIndex !== null && (
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
        <div className="w-full h-full min-h-[calc(100vh-140px)] rounded-2xl overflow-hidden bg-[#09090b] border border-white/10 relative shadow-2xl">
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
  const [notifyOptIn, setNotifyOptIn] = useState(currentMeta?.notify_opt_in || false);
  const [contactType, setContactType] = useState<EntryMeta['contact_type']>(currentMeta?.contact_type || 'email');
  const [contactValue, setContactValue] = useState(currentMeta?.contact_value || '');

  const handleSave = () => {
    if (notifyOptIn && !contactValue.trim()) {
      alert("Please provide contact details or disable notifications.");
      return;
    }

    onSave(name.trim(), {
      cell_index: cellIndex,
      paid_status: paidStatus,
      notify_opt_in: notifyOptIn,
      contact_type: notifyOptIn ? contactType : null,
      contact_value: notifyOptIn ? contactValue : null
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Edit Square</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6">

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Player Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Name"
              className="w-full glass-input"
              autoFocus
            />
          </div>

          {/* Paid Status */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Payment Status</label>
            <div className="flex gap-2">
              {(['unpaid', 'paid'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setPaidStatus(status)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold capitalize transition-all ${paidStatus === status
                    ? (status === 'paid' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                      status === 'unpaid' ? 'bg-red-500/20 text-red-500 border border-red-500/50' :
                        'bg-white text-black')
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${notifyOptIn ? 'bg-green-500' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifyOptIn ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-white group-hover:text-white/80">Notify Winner</span>
            </label>

            {notifyOptIn && (
              <div className="space-y-3 pl-2 animate-in slide-in-from-top-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setContactType('email')}
                    className={`px-3 py-1 rounded-md text-xs font-bold ${contactType === 'email' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => setContactType('sms')}
                    className={`px-3 py-1 rounded-md text-xs font-bold ${contactType === 'sms' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                  >
                    SMS
                  </button>
                </div>
                <input
                  type={contactType === 'email' ? 'email' : 'tel'}
                  value={contactValue || ''}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={contactType === 'email' ? 'name@example.com' : '555-0199'}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/30 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-colors"
          >
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
