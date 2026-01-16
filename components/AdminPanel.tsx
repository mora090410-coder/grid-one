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
}

const AdminPanel: React.FC<AdminPanelProps> = ({ game, board, adminToken, activePoolId, onApply, onPublish, onClose, onLogout }) => {
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

  // Update parent state whenever local state changes (reactive update)
  useEffect(() => {
    onApply(localGame, localBoard);
  }, [localGame, localBoard, onApply]);


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
      <div className="premium-glass p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in slide-in-from-top-4 duration-500 mb-8">
        <div>
          <h3 className="text-2xl font-semibold text-white tracking-tight">Commissioner Hub</h3>
          <p className="text-xs font-medium text-gray-400 mt-1">
            {activePoolId ? `Stadium ID: ${activePoolId}` : 'Drafting New Pool'}
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-auto items-center justify-end">
          {scanStatus && (
            <div className={`text-[10px] font-bold uppercase tracking-widest animate-pulse ${scanStatus.includes('SUCCESSFUL') ? 'text-green-400' :
              scanStatus.includes('ANALYZING') ? 'text-orange-500' : 'text-red-500'
              }`}>
              {scanStatus}
            </div>
          )}

          <button onClick={onLogout} className="text-xs text-red-500/80 font-bold uppercase tracking-widest hover:text-red-400 transition-colors px-2 mr-2">
            Log Out
          </button>

          <button
            disabled={isSaving}
            onClick={handlePublishClick}
            className={`px-6 py-3 bg-white text-black rounded-lg text-xs font-bold uppercase tracking-wide shadow-lg hover:bg-gray-200 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {isSaving ? 'Syncing...' : 'Publish to Live'}
          </button>

          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors ml-1" title="Close Panel">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Settings Area */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column: League Settings */}
        <div className="premium-glass p-6 rounded-2xl space-y-5 h-fit">
          <h4 className="text-label mb-2">League Settings</h4>

          {/* Dynamic Board Toggle */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center mb-4">
            <div>
              <div className="text-sm font-medium text-white">Board Type</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {localBoard.isDynamic ? 'Rotating Axes (Different per Quarter)' : 'Standard (Same Axis for All Quarters)'}
              </div>
            </div>
            <button
              onClick={toggleBoardType}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${localBoard.isDynamic
                ? 'bg-white text-black shadow-md'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
              {localBoard.isDynamic ? 'Dynamic' : 'Standard'}
            </button>
          </div>

          <div className="grid gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">League Name</label>
              <input type="text" value={localGame.title} onChange={(e) => updateField('title', e.target.value)} className="w-full glass-input p-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Subtext / Location</label>
              <input type="text" value={localGame.meta} onChange={(e) => updateField('meta', e.target.value)} className="w-full glass-input p-3 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Left Team</label>
              <select value={localGame.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full glass-input p-3 text-sm appearance-none cursor-pointer">
                {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr} className="bg-black">{t.abbr}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Top Team</label>
              <select value={localGame.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full glass-input p-3 text-sm appearance-none cursor-pointer">
                {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr} className="bg-black">{t.abbr}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 ml-1">ESPN Date Override</label>
            <input type="date" value={localGame.dates} onChange={(e) => updateField('dates', e.target.value)} className="w-full glass-input p-3 text-sm" />
          </div>
        </div>

        {/* Right Column: Pool Configuration (Payouts + Actions) */}
        <div className="flex flex-col space-y-6">
          <div className="premium-glass p-6 rounded-2xl flex-1">
            <h4 className="text-label mb-6">Pool Configuration</h4>

            {/* Payout Configuration */}
            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Prize Structure</h5>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Q1</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                    <input type="number" value={localGame.payouts?.Q1 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q1: parseInt(e.target.value) || 0, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-6 p-2 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Q2</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                    <input type="number" value={localGame.payouts?.Q2 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q2: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q3: p.payouts?.Q3 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-6 p-2 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Q3</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                    <input type="number" value={localGame.payouts?.Q3 ?? 125} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Q3: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Final: p.payouts?.Final ?? 250 } }))} className="w-full glass-input pl-6 p-2 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide ml-1">Final</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                    <input type="number" value={localGame.payouts?.Final ?? 250} onChange={(e) => setLocalGame(p => ({ ...p, payouts: { ...p.payouts, Final: parseInt(e.target.value) || 0, Q1: p.payouts?.Q1 ?? 125, Q2: p.payouts?.Q2 ?? 125, Q3: p.payouts?.Q3 ?? 125 } }))} className="w-full glass-input pl-6 p-2 text-sm font-bold text-gold" />
                  </div>
                </div>
              </div>
            </div>

            {/* Board Actions */}
            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1 mb-4">Actions</h5>
            <div className="flex gap-4">
              <label className={`flex-1 text-center text-xs font-bold bg-white/5 text-white border border-white/10 rounded-xl px-4 py-4 cursor-pointer hover:bg-white/10 transition-all shadow-sm active:scale-95 ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                {isScanning ? 'Scanning...' : 'Scan Physical Board'}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
              <button onClick={handleClear} className="flex-1 text-xs font-bold text-red-500/80 border border-red-900/30 bg-red-900/10 hover:bg-red-900/20 rounded-xl px-4 py-4 transition-all active:scale-95">
                Clear Board
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Grid Editor Section */}
      <div className="premium-glass p-6 md:p-8 rounded-2xl flex flex-col space-y-6 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-end pb-4 border-b border-white/5">
          <div>
            <h3 className="text-xl font-semibold text-white tracking-tight">Visual Grid Editor</h3>
            <p className="text-xs font-medium text-gray-400 mt-1">Direct board manipulation & coordinate tuning</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-gray-500 mb-2 block">Editing Controls</span>
            <div className="flex gap-2 justify-end">
              <div className="h-1.5 w-6 rounded-full bg-team-left/80"></div>
              <div className="h-1.5 w-6 rounded-full bg-team-top/80"></div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar bg-[#1c1c1e]/50 p-6 rounded-xl border border-white/5 shadow-inner">
          <div className="min-w-[900px] space-y-6">

            {/* Dynamic Axis Selector */}
            {localBoard.isDynamic && (
              <div className="flex items-center justify-center gap-3 mb-6 bg-white/5 p-2 rounded-xl mx-auto w-fit border border-white/5 px-4">
                <div className="text-xs font-medium text-gray-300 mr-2">Editable Quarter:</div>
                {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setActiveAxisQuarter(q)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeAxisQuarter === q
                      ? 'bg-white text-black shadow-md scale-105'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {q}
                  </button>
                ))}
                <div className="text-xs font-medium text-gray-500 ml-4 pl-4 border-l border-white/10">
                  Adjusting axes for {activeAxisQuarter === 'Q4' ? '4th Quarter & Final' : `${activeAxisQuarter} Score`}
                </div>
              </div>
            )}

            {/* Header: Top Team and Axis */}
            <div className="flex items-end">
              <div className="w-[120px] pr-4 flex flex-col justify-end">
                <div className="text-xs font-bold text-gray-400 text-right pb-2 tracking-wide uppercase">{localGame.leftAbbr}</div>
              </div>
              <div className="flex-1">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{localGame.topName}</div>
                <div className="grid grid-cols-10 gap-2">
                  {currentOppAxis?.map((val, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="text-[9px] font-bold text-gray-600 text-center uppercase">COL {idx}</div>
                      <div className="relative group">
                        <select
                          value={val ?? ''}
                          onChange={(e) => handleAxisChange('oppAxis', idx, e.target.value)}
                          className="w-full h-10 bg-white/5 border border-white/5 rounded-lg text-center text-sm text-white font-bold focus:bg-white/10 outline-none appearance-none cursor-pointer transition-all hover:bg-white/10"
                        >
                          <option value="" className="bg-[#1c1c1e] text-gray-500">?</option>
                          {axisDigits.map(d => <option key={d} value={d} className="bg-[#1c1c1e] text-white font-medium">{d}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body: Left Labels and Main Grid */}
            <div className="flex">
              <div className="w-[120px] flex flex-col gap-2 pr-4 pt-1 border-r border-white/5">
                {currentBearsAxis?.map((val, idx) => (
                  <div key={idx} className="flex items-center justify-end gap-3 group h-12">
                    <span className="text-[9px] font-bold text-gray-600 uppercase text-right group-hover:text-white transition-colors">ROW {idx}</span>
                    <div className="relative w-12">
                      <select
                        value={val ?? ''}
                        onChange={(e) => handleAxisChange('bearsAxis', idx, e.target.value)}
                        className="w-full h-12 bg-white/5 border border-white/5 rounded-lg text-center text-sm text-white font-bold focus:bg-white/10 outline-none appearance-none cursor-pointer transition-all hover:bg-white/10"
                      >
                        <option value="" className="bg-[#1c1c1e] text-gray-500">?</option>
                        {axisDigits.map(d => <option key={d} value={d} className="bg-[#1c1c1e] text-white font-medium">{d}</option>)}
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
                    const cellContrast = getContrastYIQ('#0a0203');

                    return (
                      <div key={cellIdx} className="relative group h-12">
                        <input
                          type="text"
                          value={players.join(', ')}
                          onChange={(e) => handleGridCellChange(cellIdx, e.target.value)}
                          placeholder={`${currentOppAxis?.[c] ?? '?'}-${currentBearsAxis?.[r] ?? '?'}`}
                          className="w-full h-full bg-white/5 border border-white/10 rounded-lg text-[9px] px-2 text-center font-bold focus:border-gold-glass focus:bg-white/10 outline-none transition-all placeholder:opacity-20 placeholder:font-black"
                          style={{
                            color: cellContrast === 'white' ? '#fff' : '#000'
                          }}
                        />
                        {players.length > 0 && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold animate-pulse opacity-50"></div>
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
