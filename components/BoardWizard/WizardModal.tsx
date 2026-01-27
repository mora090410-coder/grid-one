import React, { useState, useRef } from 'react';
import { GameState, BoardData } from '../../types';
import { NFL_TEAMS } from '../../constants';
import { compressImage } from '../../utils/image';
import { parseBoardImage } from '../../services/geminiService'; // Direct import for now, or lazy if needed

interface WizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    game: GameState;
    setGame: React.Dispatch<React.SetStateAction<GameState>>;
    board: BoardData;
    setBoard: React.Dispatch<React.SetStateAction<BoardData>>;
    onPublish: (token: string, data?: { game: GameState, board: BoardData, adminEmail?: string }) => Promise<string | void>;
    onSuccess: (newPoolId: string) => void;
    API_URL: string;
}

export const WizardModal: React.FC<WizardModalProps> = ({
    isOpen,
    onClose,
    game,
    setGame,
    board,
    setBoard,
    onPublish,
    onSuccess,
    API_URL
}) => {
    const [step, setStep] = useState(1);
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleTeamChange = (side: 'left' | 'top', abbr: string) => {
        const team = NFL_TEAMS.find(t => t.abbr === abbr);
        if (!team) return;
        setGame(prev => ({
            ...prev,
            [`${side}Abbr`]: team.abbr,
            [`${side}Name`]: team.name
        }));
    };

    const handleStep1Next = async () => {
        if (!game.title || !password) return;
        setError(null);
        try {
            const res = await fetch(`${API_URL}/check-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueName: game.title })
            });
            const result = await res.json();
            if (!result.available) {
                setError(`A league named "${game.title}" already exists. Please choose a different name.`);
                return;
            }
            setStep(2);
        } catch (err: any) {
            console.error('Name check failed:', err);
            setStep(2); // Proceed anyway on error, backend will catch if needed
        }
    };

    const handleInitialize = async (manualBoard?: BoardData, manualCover?: string) => {
        setError(null);
        setIsCreating(true);
        try {
            const leagueTitle = game.title?.trim();
            const pass = password?.trim();
            if (!leagueTitle || !pass) throw new Error("League Name and Password are required.");

            const targetBoard = manualBoard || board;
            const targetCover = manualCover !== undefined ? manualCover : (game.coverImage || '');

            const newId = await onPublish(pass, {
                game: { ...game, title: leagueTitle, coverImage: targetCover },
                board: targetBoard,
                adminEmail: email
            });

            if (!newId) {
                // Guest flow returns void (redirects), so we stop here
                return;
            }

            // Success Updates
            setBoard(targetBoard);
            setGame(prev => ({ ...prev, title: leagueTitle, coverImage: targetCover }));
            setIsSuccess(true);

            // Notify parent after delay to show success animation
            setTimeout(() => {
                onSuccess(newId);
            }, 1800);

        } catch (e: any) {
            setError(e.message || "Initialization failed.");
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="premium-glass w-full max-w-md overflow-hidden flex flex-col animate-in scale-95 duration-300">
                <div className="p-6 border-b border-white/5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-white tracking-tight">Board Setup</h2>
                        {!isSuccess && <button onClick={onClose} className="text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide">Cancel</button>}
                    </div>
                    <div className="flex gap-2 mt-6">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-white' : 'bg-white/10'}`}></div>
                        ))}
                    </div>
                </div>
                <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-500 text-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white">Ready to Launch</h3>
                            <p className="text-sm text-gray-400">Taking you to your board...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-semibold text-white">Setup Issue</h3>
                            <p className="text-sm text-gray-400 max-w-xs">{error}</p>
                            <button onClick={() => setError(null)} className="btn-secondary text-sm">Dismiss</button>
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                    <h3 className="text-lg font-medium text-white mb-2">Name your board</h3>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-label">Board Name</label>
                                            <input type="text" value={game.title} onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full glass-input" placeholder="e.g. Super Bowl LIX" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-label">Email Address (for recovery)</label>
                                            <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                                className="w-full glass-input" placeholder="commissioner@example.com" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-label">Organizer Passcode</label>
                                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                                className="w-full glass-input" placeholder="Create a secure passcode" />
                                        </div>
                                        <div className="pt-6">
                                            <button disabled={!password || !game.title || !email.includes('@')} onClick={handleStep1Next}
                                                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {step === 2 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                    <h3 className="text-lg font-medium text-white mb-2">Pick the game</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-label">Away Team</label>
                                            <select value={game.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e]">
                                                {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-label">Home Team</label>
                                            <select value={game.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e]">
                                                {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-label">Date (Optional)</label>
                                        <input type="date" value={game.dates} onChange={(e) => setGame(prev => ({ ...prev, dates: e.target.value }))}
                                            className="w-full glass-input" />
                                    </div>
                                    <div className="pt-6 flex gap-3">
                                        <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
                                        <button onClick={() => setStep(3)} className="flex-1 btn-primary">Continue</button>
                                    </div>
                                </div>
                            )}
                            {step === 3 && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                    <h3 className="text-lg font-medium text-white mb-2">Bring your board</h3>
                                    <p className="text-sm text-gray-400">Upload a photo or screenshot. We’ll turn it into an editable grid.</p>

                                    <div onClick={() => fileRef.current?.click()} className="border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer h-[180px] relative overflow-hidden group transition-all hover:bg-white/5 hover:border-white/30">
                                        <input type="file" ref={fileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setError(null);
                                                setIsCreating(true);
                                                const reader = new FileReader();
                                                reader.onload = async (ev) => {
                                                    try {
                                                        const rawBase64 = ev.target!.result as string;
                                                        const compressed = await compressImage(rawBase64);
                                                        setGame(p => ({ ...p, coverImage: compressed }));
                                                        const scannedBoard = await parseBoardImage(compressed);
                                                        setBoard(scannedBoard);
                                                    } catch (err: any) {
                                                        console.warn("Scan failed", err);
                                                        setError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
                                                    } finally {
                                                        setIsCreating(false);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                        {game.coverImage ? (
                                            <>
                                                <img src={game.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm" />
                                                <div className="relative z-10 btn-secondary text-xs">Change Image</div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <span className="text-sm font-medium text-white">Tap to upload</span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-center text-gray-500">Images only (PNG/JPG). PDF not supported.</p>

                                    <div className="pt-4 space-y-3">
                                        <button
                                            onClick={() => {
                                                if (!game.coverImage) {
                                                    setError("Please upload an image to scan.");
                                                    return;
                                                }
                                                handleInitialize();
                                            }}
                                            disabled={isCreating}
                                            className={`w-full btn-primary flex items-center justify-center gap-2 ${!game.coverImage ? 'opacity-50' : ''}`}
                                        >
                                            {isCreating ? "Processing..." : "Launch Board"}
                                        </button>

                                        {!isCreating && (
                                            <button onClick={(e) => { e.preventDefault(); handleInitialize(undefined, ''); }} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
                                                Start with a blank board
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
