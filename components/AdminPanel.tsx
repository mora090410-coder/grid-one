import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GameState, BoardData } from '../types';
import { NFL_TEAMS } from '../constants';
import { parseBoardImage } from '../services/geminiService';
import { getContrastYIQ } from '../App';

interface AdminPanelProps {
  game: GameState;
  board: BoardData;
  adminToken: string;
  activePoolId: string | null;
  onApply: (game: GameState, board: BoardData) => void;
  onPublish: (token: string, currentData: { game: GameState, board: BoardData }) => Promise<string | void>;
  onClose: () => void;
  onLogout: () => void;
  onPreview: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ game, board, adminToken, activePoolId, onApply, onPublish, onClose, onLogout, onPreview }) => {
  const [localGame, setLocalGame] = useState<GameState>(game);
  const [localBoard, setLocalBoard] = useState<BoardData>(board);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeAxisQuarter, setActiveAxisQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // Sync with props ONLY when not editing (simple check)
  // Ideally this would be more robust, but assuming simple session edits
  useEffect(() => {
    // Only resync if we haven't started editing extensively? 
    // For now, let's just respect the initial load or explicit resets.
    // We won't auto-reset on every prop change to avoid losing work.
  }, []);

  useEffect(() => {
    onApply(localGame, localBoard);
  }, [localGame, localBoard, onApply]);

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

  const handleClear = () => {
    if (!confirm("Are you sure you want to clear all names from the board?")) return;
    const emptyBoard: BoardData = {
      bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      squares: Array(100).fill(null).map(() => []),
      isDynamic: false
    };
    setLocalBoard(emptyBoard);
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

  const handlePublishClick = async () => {
    try {
      setIsSaving(true);
      await onPublish(adminToken, {
        game: localGame,
        board: localBoard
      });
      console.log("Board successfully published to live stadium!");
    } catch (e: unknown) {
      console.error("Publishing Error:", e);
      const errMsg = e instanceof Error ? e.message : "Network Error";
      alert(`Publish Failed: ${errMsg}`);
    } finally {
      setIsSaving(false);
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
      setScanStatus(`Scan Failed: ${errMsg}`);
      setTimeout(() => setScanStatus(null), 6000);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Manual Grid Editor Sync Functions ---

  const handleGridCellChange = (cellIndex: number, value: string) => {
    const newBoard = { ...localBoard };
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

      {/* Top Header & Navigation */}
      <div className="premium-glass p-5 md:p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in slide-in-from-top-4 duration-500 mb-8 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Organizer</h3>
            <p className="text-sm font-medium text-gray-400">
              {activePoolId ? `Board ID: ${activePoolId}` : 'Setup Mode'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto items-center justify-end">
          {scanStatus && (
            <div className={`px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-bold uppercase tracking-wide animate-pulse ${scanStatus.includes('SUCCESSFUL') ? 'text-green-400' :
              scanStatus.includes('ANALYZING') ? 'text-orange-500' : 'text-red-500'
              }`}>
              {scanStatus}
            </div>
          )}

          <div className="flex items-center bg-black/20 p-1 rounded-full border border-white/5 mx-2">
            <button
              disabled
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-white text-black shadow-lg"
            >
              Edit
            </button>
            <button
              onClick={onPreview}
              className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-white transition-colors"
            >
              Preview
            </button>
          </div>

          <button onClick={onLogout} className="btn-secondary text-xs text-red-400 hover:text-red-300">
            Log Out
          </button>

          <button
            disabled={isSaving}
            onClick={handlePublishClick}
            className={`btn-primary px-6 py-2.5 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? 'Syncing...' : 'Sync Changes'}
          </button>

          <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors ml-2" title="Close Panel">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

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
          <div>
            <h3 className="text-xl font-semibold text-white tracking-tight">Grid Editor</h3>
            <p className="text-sm font-medium text-gray-400 mt-1">Tap any cell or axis to edit names and numbers manually.</p>
          </div>

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
        </div>

        <div className="overflow-x-auto custom-scrollbar bg-black/20 p-6 rounded-2xl border border-white/5">
          <div className="min-w-[800px] space-y-6">

            {/* Header: Top Team and Axis */}
            <div className="flex items-end">
              <div className="w-[100px] pr-4 flex flex-col justify-end">
                <div className="text-[10px] font-black text-gray-500 text-right pb-3 tracking-widest uppercase">{localGame.leftAbbr}</div>
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
              <div className="w-[100px] flex flex-col gap-2 pr-4 pt-0 border-r border-white/5">
                {currentBearsAxis?.map((val, idx) => (
                  <div key={idx} className="flex items-center justify-end gap-3 group h-12">
                    <div className="relative w-10">
                      <select
                        value={val ?? ''}
                        onChange={(e) => handleAxisChange('bearsAxis', idx, e.target.value)}
                        className="w-full h-12 bg-[#1c1c1e] border border-white/10 rounded-lg text-center text-sm text-white font-bold focus:border-white/30 outline-none appearance-none cursor-pointer transition-all hover:bg-white/5"
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
                        <input
                          type="text"
                          value={players.join(', ')}
                          onChange={(e) => handleGridCellChange(cellIdx, e.target.value)}
                          placeholder={`${currentOppAxis?.[c] ?? '?'}-${currentBearsAxis?.[r] ?? '?'}`}
                          className="w-full h-full bg-white/5 border border-white/5 rounded-lg text-[10px] px-1 text-center font-medium text-white/90 focus:border-gold/50 focus:bg-white/10 outline-none transition-all placeholder:text-white/10"
                        />
                        {players.length > 0 && (
                          <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-gold/50"></div>
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
    </div>
  );
};

export default AdminPanel;
