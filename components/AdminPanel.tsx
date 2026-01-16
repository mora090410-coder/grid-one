
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
}

const AdminPanel: React.FC<AdminPanelProps> = ({ game, board, adminToken, activePoolId, onApply, onPublish }) => {
  const [localGame, setLocalGame] = useState<GameState>(game);
  const [boardText, setBoardText] = useState(JSON.stringify(board, null, 2));
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeAxisQuarter, setActiveAxisQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // Sync with prop changes when not scanning or saving
  useEffect(() => {
    if (!isScanning && !isSaving) {
      setLocalGame(game);
      setBoardText(JSON.stringify(board, null, 2));
    }
  }, [game, board, isScanning, isSaving]);

  const parsedBoardData = useMemo(() => {
    try {
      const data = JSON.parse(boardText) as BoardData;
      // Safety check for empty or malformed squares array
      if (!Array.isArray(data.squares) || data.squares.length !== 100) {
        data.squares = Array(100).fill(null).map(() => []);
      }
      return data;
    } catch (e) {
      return null;
    }
  }, [boardText]);

  const applyScanResult = (newBoard: BoardData) => {
    const freshJson = JSON.stringify(newBoard, null, 2);
    setBoardText(freshJson);
    onApply(localGame, newBoard);
    setScanStatus("SCAN SUCCESSFUL: GRID MAPPED");
    setTimeout(() => setScanStatus(null), 5000);
  };

  const handleApply = () => {
    if (!parsedBoardData) {
      alert("Invalid JSON structure in Board Data.");
      return;
    }
    onApply(localGame, parsedBoardData);
    setScanStatus("Applied Locally");
    setTimeout(() => setScanStatus(null), 3000);
  };

  const handleClear = () => {
    if (!confirm("Are you sure you want to clear all names from the board?")) return;
    const emptyBoard: BoardData = {
      bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      squares: Array(100).fill(null).map(() => []),
      isDynamic: false
    };
    setBoardText(JSON.stringify(emptyBoard, null, 2));
    onApply(localGame, emptyBoard);
    setScanStatus("Board Cleared");
    setTimeout(() => setScanStatus(null), 3000);
  };

  const toggleBoardType = () => {
    if (!parsedBoardData) return;
    const newBoard = { ...parsedBoardData };
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

    setBoardText(JSON.stringify(newBoard, null, 2));
  };

  const handlePublishClick = async () => {
    if (!parsedBoardData) {
      alert("Cannot publish: JSON transcription is invalid.");
      return;
    }
    try {
      setIsSaving(true);
      await onPublish(adminToken, {
        game: localGame,
        board: parsedBoardData
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
    if (!parsedBoardData) return;
    const newBoard = { ...parsedBoardData };
    const names = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    newBoard.squares[cellIndex] = names;
    setBoardText(JSON.stringify(newBoard, null, 2));
  };

  const handleAxisChange = (axis: 'bearsAxis' | 'oppAxis', index: number, value: string) => {
    if (!parsedBoardData) return;
    const newBoard = { ...parsedBoardData };
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
      setBoardText(JSON.stringify(newBoard, null, 2));
    }
  };

  const isEmptyBoard = !board.squares.some(s => s.length > 0);
  const axisDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Axis values to display based on dynamic mode
  const currentOppAxis = parsedBoardData?.isDynamic
    ? parsedBoardData.oppAxisByQuarter?.[activeAxisQuarter]
    : parsedBoardData?.oppAxis;

  const currentBearsAxis = parsedBoardData?.isDynamic
    ? parsedBoardData.bearsAxisByQuarter?.[activeAxisQuarter]
    : parsedBoardData?.bearsAxis;

  return (
    <div className="space-y-6">
      {/* Starting Manual Setup Notification */}
      {isEmptyBoard && (
        <div className="bg-gold/10 border border-gold-glass p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-tight">Starting manual setup.</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Use the Visual Grid Editor below to add players and assign axis values.</p>
          </div>
        </div>
      )}

      {/* Top Header & Publish */}
      {/* Top Header & Publish */}
      <div className="premium-glass p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in slide-in-from-top-4 duration-500 mb-8">
        <div>
          <h3 className="text-2xl font-semibold text-white tracking-tight">Commissioner Hub</h3>
          <p className="text-xs font-medium text-gray-400 mt-1">
            {activePoolId ? `Stadium ID: ${activePoolId}` : 'Drafting New Pool'}
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto items-center">
          {scanStatus && (
            <div className={`mr-4 text-[10px] font-bold uppercase tracking-widest animate-pulse ${scanStatus.includes('SUCCESSFUL') ? 'text-green-400' :
              scanStatus.includes('ANALYZING') ? 'text-orange-500' : 'text-red-500'
              }`}>
              {scanStatus}
            </div>
          )}
          <button
            disabled={isSaving}
            onClick={handlePublishClick}
            className={`flex-1 md:flex-none px-6 py-3 bg-white text-black rounded-lg text-xs font-bold uppercase tracking-wide shadow-lg hover:bg-gray-200 transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {isSaving ? 'Syncing...' : 'Publish to Live'}
          </button>
        </div>
      </div>

      {/* Main Settings Area */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="premium-glass p-6 rounded-2xl space-y-5">
            <h4 className="text-label mb-2">League Settings</h4>

            {/* Dynamic Board Toggle */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center mb-4">
              <div>
                <div className="text-sm font-medium text-white">Board Type</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {parsedBoardData?.isDynamic ? 'Rotating Axes (Different per Quarter)' : 'Standard (Same Axis for All Quarters)'}
                </div>
              </div>
              <button
                onClick={toggleBoardType}
                className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${parsedBoardData?.isDynamic
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
              >
                {parsedBoardData?.isDynamic ? 'Dynamic' : 'Standard'}
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

          <div className="premium-glass p-6 rounded-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h4 className="text-label">Score Controls</h4>
              <label className="flex items-center gap-3 cursor-pointer group">
                <span className="text-xs text-gray-400 font-medium group-hover:text-white transition-colors">Enable Manual Overrides</span>
                <input type="checkbox" checked={localGame.useManualScores} onChange={(e) => updateField('useManualScores', e.target.checked)} className="accent-white scale-125" />
              </label>
            </div>
            {localGame.useManualScores && (
              <div className="grid grid-cols-2 gap-5 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">{localGame.leftAbbr} Score</label>
                  <input type="number" value={localGame.manualLeftScore} onChange={(e) => updateField('manualLeftScore', parseInt(e.target.value) || 0)} className="w-full glass-input p-3 text-sm font-semibold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">{localGame.topAbbr} Score</label>
                  <input type="number" value={localGame.manualTopScore} onChange={(e) => updateField('manualTopScore', parseInt(e.target.value) || 0)} className="w-full glass-input p-3 text-sm font-semibold" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="premium-glass flex-1 flex flex-col min-h-[400px] overflow-hidden shadow-inner relative rounded-2xl">
            <div className="p-4 flex justify-between items-center border-b border-white/5 bg-white/5">
              <span className="text-label pl-2">Board Transcription (JSON)</span>
              <div className="flex gap-3">
                <button onClick={handleClear} className="text-xs font-semibold text-gray-400 hover:text-white px-2 transition-colors">Clear Board</button>
                <label className={`text-xs font-semibold bg-white/10 text-white border border-white/10 rounded-lg px-4 py-2 cursor-pointer hover:bg-white/20 transition-all shadow-lg ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isScanning ? 'Mapping...' : 'Scan Physical Board'}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>
            </div>
            <textarea
              value={boardText}
              onChange={(e) => setBoardText(e.target.value)}
              className={`flex-1 w-full bg-transparent p-6 text-xs font-mono text-gray-300 focus:outline-none resize-none custom-scrollbar transition-opacity leading-relaxed ${isScanning ? 'opacity-50' : 'opacity-100'}`}
              spellCheck={false}
              placeholder="Paste custom JSON or use the scanner above..."
            />
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-md">
                <div className="bg-[#1c1c1e] px-8 py-6 rounded-2xl border border-white/10 text-white font-bold uppercase tracking-widest text-xs shadow-2xl animate-pulse text-center">
                  Intelligent OCR Mapping...<br />
                  <span className="text-[10px] font-medium text-gray-500 lowercase mt-2 block">Processing 100-cell player matrix</span>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleApply} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md active:scale-[0.99]">
            Refresh Visual UI
          </button>
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

        {!parsedBoardData ? (
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-xl text-center space-y-2">
            <p className="text-sm text-red-400 font-bold uppercase tracking-wide">Visual Editor Locked</p>
            <p className="text-xs text-gray-500">Resolve JSON syntax errors in the Transcription panel to unlock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar bg-[#1c1c1e]/50 p-6 rounded-xl border border-white/5 shadow-inner">
            <div className="min-w-[900px] space-y-6">

              {/* Dynamic Axis Selector */}
              {parsedBoardData.isDynamic && (
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
                      const players = parsedBoardData.squares[cellIdx] || [];
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
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
