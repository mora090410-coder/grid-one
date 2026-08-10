
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/image';
import { parseBoardImage } from '../services/boardImportService';
import { GameState, BoardData, ScheduledGame } from '../types';
import { INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';
import ScheduledGamePicker from '../components/ScheduledGamePicker';

const CreateContest: React.FC = () => {
    const { user, session } = useAuth();
    const navigate = useNavigate();
    const requestedScoreTestMode = new URLSearchParams(window.location.search).get('scoreTest') === '1';
    const [scoreTestMode, setScoreTestMode] = useState(false);

    // Wizard State
    const [step, setStep] = useState(1);
    const [game, setGame] = useState<GameState>(() => ({
        ...INITIAL_GAME,
        gameExternalId: undefined,
        kickoffAt: undefined,
        leftAbbr: '',
        leftName: '',
        topAbbr: '',
        topName: '',
        dates: '',
    }));
    const [board, setBoard] = useState<BoardData>(EMPTY_BOARD);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successPoolId, setSuccessPoolId] = useState<string | null>(null);
    const [scanSuccess, setScanSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Restore wizard draft if user was redirected away from /create for auth
    useEffect(() => {
        const savedGame = sessionStorage.getItem('gridone_draft_game');
        const savedBoard = sessionStorage.getItem('gridone_draft_board');
        if (savedGame) {
            try { setGame(JSON.parse(savedGame)); } catch { /* corrupt data */ }
            sessionStorage.removeItem('gridone_draft_game');
        }
        if (savedBoard) {
            try { setBoard(JSON.parse(savedBoard)); } catch { /* corrupt data */ }
            sessionStorage.removeItem('gridone_draft_board');
        }
    }, []); // Run once on mount

    useEffect(() => {
        const accessToken = session?.access_token;
        if (!requestedScoreTestMode || !accessToken) {
            setScoreTestMode(false);
            return;
        }
        const controller = new AbortController();
        void fetch('/api/nfl/games?scope=completed&limit=1', {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${accessToken}` },
        })
            .then(async response => response.ok ? response.json() : null)
            .then(data => setScoreTestMode(data?.scoreTestMode === true))
            .catch(error => {
                if (error instanceof Error && error.name === 'AbortError') return;
                setScoreTestMode(false);
            });
        return () => controller.abort();
    }, [requestedScoreTestMode, session?.access_token]);

    const handleGameChange = (scheduledGame: ScheduledGame) => {
        setGame(prev => ({
            ...prev,
            gameExternalId: scheduledGame.id,
            kickoffAt: scheduledGame.kickoffAt,
            // ESPN's away team is the board's left axis; home is the top axis.
            leftAbbr: scheduledGame.awayTeam.abbr,
            leftName: scheduledGame.awayTeam.name,
            topAbbr: scheduledGame.homeTeam.abbr,
            topName: scheduledGame.homeTeam.name,
            // Legacy read compatibility only. The provider kickoff remains canonical.
            dates: scheduledGame.kickoffAt.slice(0, 10),
        }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setScanSuccess(false);

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawBase64 = ev.target!.result as string;
                const compressed = await compressImage(rawBase64);
                setGame(p => ({ ...p, coverImage: compressed }));

                // Scan with Gemini
                const scannedBoard = await parseBoardImage(compressed);
                setBoard(scannedBoard);
                setScanSuccess(true);
            } catch (err: any) {
                console.warn("Scan failed", err);
                setError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
                setScanSuccess(false);
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
        const finalBoard = manualBoard || board;
        const leagueTitle = game.title?.trim();

        if (!user) {
            try {
                sessionStorage.setItem('gridone_draft_game', JSON.stringify(game));
                sessionStorage.setItem('gridone_draft_board', JSON.stringify(finalBoard));
            } catch {
                // sessionStorage unavailable — user will lose draft state on redirect
            }
            const returnTo = encodeURIComponent(requestedScoreTestMode ? '/create?scoreTest=1' : '/create');
            navigate(`/login?mode=signup&returnTo=${returnTo}`);
            return;
        }

        // Proceed with Supabase Insert
        setIsLoading(true);
        setError(null);

        try {
            if (!leagueTitle) throw new Error("League Name is required.");
            if (!game.gameExternalId) throw new Error("Select an NFL game before creating your board.");
            if (!session?.access_token) throw new Error("You must be logged in to create a board.");

            const response = await fetch('/api/pools', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    scoreTestMode,
                    game: { ...game, title: leagueTitle },
                    board: finalBoard,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || 'Failed to create contest.');
            if (!data.poolId) throw new Error("No data returned from create flow.");

            setSuccessPoolId(data.poolId);
        } catch (err: any) {
            console.error("Publish Error:", err);
            setError(err.message || "Failed to create contest.");
        } finally {
            setIsLoading(false);
        }
    };

    if (successPoolId) {
        return (
            <div className="oa-root min-h-screen bg-broadcast-white text-ink flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-gold border border-ink flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="oa-slab text-cardinal mb-2">Fill phase started</p>
                <h1 className="oa-headline !text-4xl mb-3">Your board is ready to fill.</h1>
                <p className="oa-body text-ink/65 mb-8 max-w-md">Review the matchup, assign all 100 squares, then run the number draw before publishing.</p>
                <div className="flex flex-wrap justify-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="oa-btn oa-btn-ghost">
                        Back to Dashboard
                    </button>
                    <button onClick={() => navigate(`/boards/${successPoolId}`)} className="oa-btn oa-btn-primary">
                        Start assigning
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="oa-root min-h-screen bg-broadcast-white text-ink p-5 md:p-8">
            <div className="max-w-2xl mx-auto pt-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => navigate(-1)} className="oa-slab min-h-11 text-ink/60 hover:text-ink flex items-center gap-2">
                        &larr; Back
                    </button>
                    <div className="flex gap-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1 w-12 ${step >= s ? 'bg-cardinal' : 'bg-newsprint'}`} aria-label={`Step ${s}${step === s ? ', current' : ''}`}></div>
                        ))}
                    </div>
                </div>

                <div className="border border-ink bg-broadcast-white p-6 md:p-9">

                    {error && (
                        <div className="mb-6 bg-cardinal-subtle border border-cardinal p-4 text-cardinal text-sm font-medium flex items-center gap-3" role="alert">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span className="flex-1">{error}</span>
                            {error.includes('overloaded') && (
                                <button
                                    onClick={() => handlePublish()} // Retry the same action
                                    className="oa-btn oa-btn-ghost"
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <p className="oa-slab text-cardinal mb-2">01 · Name</p>
                                <h1 className="oa-headline !text-3xl mb-2">Name your board</h1>
                                <p className="oa-body text-ink/60">This is the title your group will see after you publish.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label htmlFor="board-name" className="oa-slab text-ink/60">Board name</label>
                                    <input
                                        id="board-name"
                                        type="text"
                                        maxLength={100}
                                        value={game.title}
                                        onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full oa-input"
                                        placeholder="e.g. Super Bowl LIX Party"
                                        autoFocus
                                    />
                                </div>
                                <p className="oa-body text-sm text-ink/60">Your GridOne account is the only organizer key. There is no separate board passcode to lose or share.</p>
                            </div>

                            <div className="pt-4">
                                <button
                                    disabled={!game.title.trim()}
                                    onClick={() => setStep(2)}
                                    className="w-full oa-btn oa-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <p className="oa-slab text-cardinal mb-2">02 · Matchup</p>
                                <h1 className="oa-headline !text-3xl mb-2">Pick the game</h1>
                                <p className="oa-body text-ink/60">Choose one scheduled NFL game. The teams and kickoff stay linked so live scoring follows the right event.</p>
                            </div>

                            {scoreTestMode && (
                                <div className="border border-gold bg-gold/20 p-4" role="status">
                                    <p className="oa-slab text-ink mb-1">Completed-game score test</p>
                                    <p className="oa-body text-sm text-ink/65">This hidden test mode shows only the five most recent final games.</p>
                                </div>
                            )}

                            <ScheduledGamePicker
                                value={game.gameExternalId || null}
                                onChange={handleGameChange}
                                scope={scoreTestMode ? 'completed' : 'upcoming'}
                                limit={scoreTestMode ? 5 : undefined}
                                accessToken={scoreTestMode ? session?.access_token : undefined}
                            />

                            <div className="pt-4 flex gap-4">
                                <button onClick={() => setStep(1)} className="oa-btn oa-btn-ghost flex-1">Back</button>
                                <button
                                    disabled={!game.gameExternalId}
                                    onClick={() => setStep(3)}
                                    className="oa-btn oa-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <p className="oa-slab text-cardinal mb-2">03 · Fill</p>
                                <h1 className="oa-headline !text-3xl mb-2">Start your 100 squares</h1>
                                <p className="oa-body text-ink/60">The native GridOne board is the fastest, most reliable starting point. You will assign purchaser names in the organizer view.</p>
                            </div>

                            <button
                                disabled={isLoading}
                                onClick={() => handlePublish(EMPTY_BOARD)}
                                className="w-full oa-btn oa-btn-primary !py-5"
                            >
                                Create blank 10×10 board
                            </button>

                            <div className="border-t border-newsprint pt-6">
                                <p className="oa-slab text-ink/55 mb-2">Optional · paper recovery beta</p>
                                <p className="oa-body text-sm text-ink/60 mb-4">Already started on paper? Import a photo, then review every assignment before publishing.</p>
                            </div>

                            <div
                                role="button"
                                tabIndex={isLoading ? -1 : 0}
                                aria-disabled={isLoading}
                                onClick={() => !isLoading && fileRef.current?.click()}
                                onKeyDown={(event) => {
                                    if (!isLoading && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        fileRef.current?.click();
                                    }
                                }}
                                className={`border border-dashed border-ink h-[220px] relative overflow-hidden group focus-visible:outline focus-visible:outline-4 focus-visible:outline-cardinal ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-newsprint cursor-pointer'} flex flex-col items-center justify-center`}
                            >
                                <input type="file" ref={fileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileUpload} disabled={isLoading} />

                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-8 h-8 border-2 border-newsprint border-t-cardinal animate-spin"></div>
                                        <span className="oa-slab text-ink/50">Scanning board…</span>
                                    </div>
                                ) : game.coverImage ? (
                                    <>
                                        <img src={game.coverImage} className="absolute inset-0 w-full h-full object-contain bg-newsprint" alt="Uploaded paper board preview" />
                                        <div className="absolute inset-0 bg-ink/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="oa-btn bg-broadcast-white text-ink">Change image</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-center p-6">
                                        <div className="w-16 h-16 bg-newsprint flex items-center justify-center border border-ink">
                                            <svg className="w-8 h-8 text-ink/45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <span className="font-bold block mb-1">Choose a board photo</span>
                                            <span className="text-ink/50 text-xs">JPG, PNG, or WebP</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => handlePublish()}
                                    disabled={isLoading || !game.coverImage || !!error || !scanSuccess}
                                    className={`w-full oa-btn oa-btn-ghost ${(!game.coverImage || isLoading || !!error || !scanSuccess) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isLoading ? 'Processing...' : error ? 'Scan Failed' : 'Save scanned board'}
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
