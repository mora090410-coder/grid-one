
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { compressImage } from '../utils/image';
import { parseBoardImage } from '../services/geminiService';
import { NFL_TEAMS, SAMPLE_BOARD } from '../constants';
import { GameState, BoardData } from '../types';
import { INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';

const CreateContest: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Wizard State
    const [step, setStep] = useState(1);
    const [game, setGame] = useState<GameState>(INITIAL_GAME);
    const [board, setBoard] = useState<BoardData>(EMPTY_BOARD);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successPoolId, setSuccessPoolId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        console.log("CreateContest: user=", user, "authLoading=", authLoading); // Debug
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

    const handleTeamChange = (side: 'left' | 'top', abbr: string) => {
        const team = NFL_TEAMS.find(t => t.abbr === abbr);
        if (!team) return;
        setGame(prev => ({
            ...prev,
            [`${side}Abbr`]: team.abbr,
            [`${side}Name`]: team.name
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawBase64 = ev.target!.result as string;
                const compressed = await compressImage(rawBase64);
                setGame(p => ({ ...p, coverImage: compressed }));

                // Scan with Gemini
                const scannedBoard = await parseBoardImage(compressed);
                setBoard(scannedBoard);
            } catch (err: any) {
                console.warn("Scan failed", err);
                setError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read file.");
            setIsLoading(false);
        };
        reader.readAsDataURL(file);
    };

    const handlePublish = async (manualBoard?: BoardData) => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const finalBoard = manualBoard || board;
            const leagueTitle = game.title?.trim();
            if (!leagueTitle) throw new Error("League Name is required.");

            // Create payload matching Supabase schema
            const payload = {
                owner_id: user.id,
                title: leagueTitle,
                settings: { ...game, title: leagueTitle }, // GameState goes into settings
                board_data: finalBoard,
                // We might want to store passcode somewhere safe, or hashing it. 
                // For now, sticking to the existing pattern (maybe in settings or separate?)
                // The `contests` table schema doesn't have a `passcode` column.
                // The legacy `API_URL` publish likely stored it. 
                // We'll store it in `settings` for now as "adminPasscode" (security risk, but consistent with quick prototype)
                // OR we rely on RLS (owner_id) to edit, and passcode for "public" admin actions?
                // Given `BoardView` uses handshake with passcode, we need to persist it.
                // storing custom field in settings jsonb:
                created_at: new Date().toISOString()
            };

            // Add passcode to settings for legacy compat (handshake)
            // Ideally this should be a hashed column, but following "Wrapper Strategy" constraints.
            // (payload.settings as any).adminPasscode = "auth-owner";

            const { data, error } = await supabase
                .from('contests')
                .insert([payload])
                .select('id')
                .single();

            if (error) throw error;
            if (!data) throw new Error("No data returned from insert.");

            // Store token locally for immediate access
            const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
            storedTokens[data.id] = "auth-owner";
            localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));

            setSuccessPoolId(data.id);
        } catch (err: any) {
            console.error("Publish Error:", err);
            setError(err.message || "Failed to create contest.");
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    if (successPoolId) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Contest Ready!</h1>
                <p className="text-gray-400 mb-8 max-w-md">Your board has been created and is ready for players.</p>
                <div className="flex gap-4">
                    <button onClick={() => navigate('/dashboard')} className="btn-secondary px-8 py-3 rounded-full uppercase font-bold text-xs tracking-widest">
                        Back to Dashboard
                    </button>
                    <button onClick={() => navigate(`/?poolId=${successPoolId}`)} className="btn-cardinal px-8 py-3 rounded-full uppercase font-bold text-xs tracking-widest shadow-lg">
                        Open Board
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
            <div className="max-w-2xl mx-auto pt-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors">
                        &larr; Back
                    </button>
                    <div className="flex gap-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`w-2 h-2 rounded-full transition-colors ${step >= s ? 'bg-[#9D2235]' : 'bg-white/10'}`}></div>
                        ))}
                    </div>
                </div>

                <div className="premium-glass p-8 rounded-3xl animate-in slide-in-from-bottom-8 duration-500">

                    {error && (
                        <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm font-medium flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Name your board</h1>
                                <p className="text-gray-400 text-sm">Give your contest a catchy name.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-label">Board Name</label>
                                    <input
                                        type="text"
                                        value={game.title}
                                        onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full glass-input"
                                        placeholder="e.g. Super Bowl LIX Party"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    disabled={!game.title}
                                    onClick={() => setStep(2)}
                                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Pick the game</h1>
                                <p className="text-gray-400 text-sm">Select teams and date.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-label">Away Team (Left)</label>
                                    <div className="relative">
                                        <select value={game.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e] text-white">
                                            {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr} - {t.name}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-label">Home Team (Top)</label>
                                    <div className="relative">
                                        <select value={game.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e] text-white">
                                            {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr} - {t.name}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-label">Date (Optional)</label>
                                <input type="date" value={game.dates} onChange={(e) => setGame(prev => ({ ...prev, dates: e.target.value }))}
                                    className="w-full glass-input [color-scheme:dark]" />
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                                <button onClick={() => setStep(3)} className="btn-primary flex-1">Continue</button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Bring your board</h1>
                                <p className="text-gray-400 text-sm">Upload a photo to scan, or start fresh.</p>
                            </div>

                            <div onClick={() => !isLoading && fileRef.current?.click()} className={`border border-dashed border-white/20 rounded-2xl h-[240px] relative overflow-hidden group transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:border-white/30 cursor-pointer'} flex flex-col items-center justify-center`}>
                                <input type="file" ref={fileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileUpload} disabled={isLoading} />

                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-white/50">Scanning Board...</span>
                                    </div>
                                ) : game.coverImage ? (
                                    <>
                                        <img src={game.coverImage} className="absolute inset-0 w-full h-full object-contain bg-black/50" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="btn-secondary text-xs">Change Image</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-center p-6">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <span className="text-white font-bold block mb-1">Click to Upload Image</span>
                                            <span className="text-gray-500 text-xs">JPG or PNG. We'll scan the grid for you.</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => handlePublish()}
                                    disabled={isLoading || !game.coverImage}
                                    className={`w-full btn-cardinal py-3 rounded-xl uppercase font-black text-sm tracking-widest shadow-lg ${(!game.coverImage || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95 transition-all'}`}
                                >
                                    {isLoading ? 'Processing...' : 'Launch Scanned Board'}
                                </button>

                                <button
                                    disabled={isLoading}
                                    onClick={() => handlePublish(EMPTY_BOARD)}
                                    className="w-full text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors py-2"
                                >
                                    Skip & Start with Blank Board
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default CreateContest;
