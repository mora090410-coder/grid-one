import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/image';
import { parseBoardImage } from '../services/boardImportService';
import { GameState, BoardData, ScheduledGame } from '../types';
import { matchupFromScheduledGame } from '../utils/scheduledGame';
import { INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';
import ScheduledGamePicker from '../components/ScheduledGamePicker';
import { Base, CapsuleButton, CrossfadeText, Eyebrow, Glass, CapsuleInput } from '../src/design/primitives';

import { projectBoardTemplate } from '../src/features/organizer/repeat/boardTemplateModel';
import { readCreateDraft, writeCreateDraft, clearCreateDraft } from '../src/features/organizer/create/createDraft';
import '../src/features/organizer/create/previewStage.css';
import NumberSetsEditor from '../src/features/organizer/workspace/NumberSetsEditor';

const CAPSULE_LINK = 'inline-flex items-center justify-center gap-2 rounded-capsule bg-panel border border-hairline px-5 h-11 font-ui text-[15px] font-semibold leading-none text-fg transition-[color,background-color,border-color,scale] hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground motion-safe:active:scale-[0.98]';

const CreateContest: React.FC = () => {
    const { user, session, signOut } = useAuth();
    const navigate = useNavigate();
    const requestedScoreTestMode = new URLSearchParams(window.location.search).get('scoreTest') === '1';
    const [scoreTestMode, setScoreTestMode] = useState(false);

    const location = useLocation();
    const [restored] = useState(() => {
        try { return readCreateDraft(sessionStorage); } catch { return { issue: 'unavailable' as const }; }
    });
    const [game, setGame] = useState<GameState>(() => {
        const template = location.state?.boardTemplate ? projectBoardTemplate(location.state.boardTemplate) : null;
        if (template) return { ...INITIAL_GAME, title: template.title, payoutDescriptions: template.payoutDescriptions };
        return restored.draft?.game || { ...INITIAL_GAME };
    });
    const [board, setBoard] = useState<BoardData>(() => location.state?.boardTemplate ? EMPTY_BOARD : restored.draft?.board || EMPTY_BOARD);
    const [storageUnavailable, setStorageUnavailable] = useState(restored.issue === 'unavailable');
    const submitting = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanSuccess, setScanSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Keep the preview through refresh and authentication; consume only after server success.
    useEffect(() => {
        let saved = false;
        try { saved = writeCreateDraft(sessionStorage, { game, board }); } catch { /* blocked storage getter */ }
        setStorageUnavailable(!saved);
    }, [game, board]);

    useEffect(() => {
        if (location.state?.boardTemplate) navigate(location.pathname + location.search, { replace: true, state: null });
    }, []);

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
        setGame(prev => ({ ...prev, ...matchupFromScheduledGame(scheduledGame) }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        setError(null);
        setScanSuccess(false);

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawBase64 = ev.target!.result as string;
                const compressed = await compressImage(rawBase64);
                setGame(p => ({ ...p, coverImage: compressed }));

                const scannedBoard = await parseBoardImage(compressed);
                setBoard(scannedBoard);
                setScanSuccess(true);
            } catch (err: any) {
                console.warn("Scan failed", err);
                setError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
                setScanSuccess(false);
            } finally {
                setIsScanning(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read file.");
            setIsScanning(false);
        };
        reader.readAsDataURL(file);
    };

    const createBoard = async (manualBoard?: BoardData) => {
        const finalBoard = manualBoard || board;
        const leagueTitle = game.title?.trim();

        if (submitting.current) return;
        if (!user) {
            let saved = false;
            try { saved = writeCreateDraft(sessionStorage, { game, board: finalBoard }); } catch { /* blocked storage getter */ }
            if (!saved) { setStorageUnavailable(true); return; }
            const returnTo = encodeURIComponent(requestedScoreTestMode ? '/create?scoreTest=1' : '/create');
            navigate(`/login?mode=signup&returnTo=${returnTo}`);
            return;
        }
        submitting.current = true;
        setIsLoading(true);
        setError(null);

        try {
            if (!leagueTitle) throw new Error("Board name is required.");
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
            if (!response.ok) throw new Error(data.message || data.error || 'Could not create the board.');
            if (!data.poolId) throw new Error("No data returned from create flow.");

            clearCreateDraft();
            navigate(`/boards/${data.poolId}`);
        } catch (err: any) {
            console.error("Publish Error:", err);
            setError(err.message || "Could not create the board.");
        } finally {
            submitting.current = false;
            setIsLoading(false);
        }
    };

    const canCreate = Boolean(game.title?.trim()) && Boolean(game.gameExternalId);

    return (
        <Base kind="cream">
            <main aria-label="New board" className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 md:px-8 md:py-14">

                <header className="flex items-center justify-between gap-4">
                    <Link to={user ? "/dashboard" : "/"} className={CAPSULE_LINK}>{user ? "Your boards" : "GridOne"}</Link>
                    {user && <CapsuleButton variant="ghost" onClick={() => void signOut?.()}>Log out</CapsuleButton>}
                </header>

                {storageUnavailable && (
                    <Glass role="status" className="flex flex-col gap-3 font-ui text-[14px] text-fg-2">
                        <p>This preview is only on this page. Your browser could not save it for refresh or sign-in.</p>
                        {!user && <a className={CAPSULE_LINK} href="/login?returnTo=%2Fdashboard" target="_blank" rel="noopener noreferrer">Sign in in a new tab</a>}
                        {!user && <p>Keep this tab open. After signing in, return here and continue with your preview.</p>}
                    </Glass>
                )}
                {(restored.issue === 'expired' || restored.issue === 'invalid') && (
                    <p role="status" className="font-ui text-[14px] text-fg-2">{restored.issue === 'expired' ? 'The previous preview expired after 24 hours.' : 'The previous preview could not be recovered.'} Start a new preview below.</p>
                )}
                {error && (
                    <Glass role="alert" className="flex flex-wrap items-center justify-between gap-3 font-ui text-[15px] text-tone-cardinal">
                        <span className="min-w-0">{error}</span>
                        {error.includes('overloaded') && (
                            <CapsuleButton variant="quiet" onClick={() => void createBoard()}>Retry</CapsuleButton>
                        )}
                    </Glass>
                )}

                <div className="flex flex-col gap-3">
                    <Eyebrow>New board</Eyebrow>
                    <h1 className="font-display text-[40px] leading-[1] tracking-[-0.01em] text-fg md:text-[52px]">Your next great game day.</h1>
                    <p className="font-ui text-[15px] text-fg-2">Name your board and see it take shape. Nothing is shared until you choose to share it.</p>
                </div>

                <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
                <div className="flex min-w-0 flex-col gap-6">
                <CapsuleInput
                    id="board-name"
                    label="Board name"
                    type="text"
                    maxLength={100}
                    value={game.title}
                    onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Lincoln Softball Booster Board"
                    autoFocus
                />

                <section aria-labelledby="pick-the-game" className="flex flex-col gap-4">
                    <h2 id="pick-the-game" className="font-display text-[26px] leading-[1.05] text-fg">Pick the game</h2>

                    {scoreTestMode && (
                        <Glass role="status" className="flex flex-col gap-1">
                            <p className="font-ui text-[15px] font-semibold text-fg">Completed-game score test</p>
                            <p className="font-ui text-[14px] text-fg-2">This test mode shows only the five most recent final games.</p>
                        </Glass>
                    )}

                    <ScheduledGamePicker
                        compactSelection
                        value={game.gameExternalId || null}
                        onChange={handleGameChange}
                        scope={scoreTestMode ? 'completed' : 'upcoming'}
                        limit={scoreTestMode ? 5 : undefined}
                        accessToken={scoreTestMode ? session?.access_token : undefined}
                    />
                </section>

                <CapsuleButton
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={!canCreate || isLoading || isScanning}
                    onClick={() => void createBoard()}
                >
                    {isLoading ? 'Creating board…' : isScanning ? 'Scanning photo…' : user ? 'Create board' : 'Save and continue'}
                </CapsuleButton>

                <p className="font-ui text-[14px] text-fg-2">Choose a scheduled NFL game to save your board. If your game is not listed yet, keep this preview and return when it is available.</p>

                </div>
                <section aria-label="Board preview" data-base="dark" data-selected={game.gameExternalId ? 'true' : 'false'} className="create-preview-stage">
                    <div className="create-preview-light" aria-hidden="true" />
                    <div className="create-preview-frame g-float flex min-w-0 flex-col gap-4">
                    <Eyebrow>Preview · Not shared</Eyebrow>
                    <h2 className="break-words font-display text-[32px] leading-tight text-fg">{game.title.trim() || 'Your board'}</h2>
                    <p className="g-pill font-ui text-[14px]"><CrossfadeText value={game.gameExternalId ? `${game.leftAbbr} at ${game.topAbbr}` : 'Choose your game above'} /></p>
                    <p className="font-ui text-[14px] text-fg-2">100 squares · Numbers drawn later</p>
                    <div aria-hidden="true" className="create-preview-grid grid grid-cols-10 gap-1">
                        {board.squares.map((names, index) => <div key={index} className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-cell border border-hairline bg-ground font-mono text-[11px] text-fg-2" title={names.join(', ')}>{index + 1}</div>)}
                    </div>
                    <p className="font-ui text-[14px] text-fg-2">After saving, add names, share your board, then draw the numbers before the game. Square payments happen outside GridOne.</p>
                    </div>
                    {board.scanReview && <NumberSetsEditor board={board} game={game} onChange={setBoard} disabled={isLoading || isScanning} allowPhotoTranspose />}
                </section>

                </div>
                {user && <section aria-labelledby="paper-import" className="flex flex-col gap-3 border-t border-hairline pt-6">
                    <h2 id="paper-import" className="font-ui text-[17px] font-semibold text-fg">Import a paper board photo</h2>
                    <p className="font-ui text-[14px] text-fg-2">Already started on paper? Add a photo and the names are read into the board. You review every square before publishing.</p>
                    <label htmlFor="board-photo" className="font-ui text-[14px] text-fg-2">Board photo (JPG, PNG, or WebP)</label>
                    <input
                        id="board-photo"
                        type="file"
                        ref={fileRef}
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleFileUpload}
                        disabled={isScanning || isLoading}
                        className="min-h-11 w-full rounded-control border border-hairline bg-panel px-4 py-3 font-ui text-[15px] text-fg file:mr-4 file:h-11 file:rounded-capsule file:border-0 file:bg-action file:px-4 file:font-ui file:text-[14px] file:font-semibold file:text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground"
                    />
                    {isScanning && (
                        <p role="status" className="font-ui text-[14px] text-fg-2">Reading the board photo…</p>
                    )}
                    {scanSuccess && !isScanning && (
                        <p role="status" className="font-ui text-[14px] text-fg-2">Names read from the photo. Create the board to review them.</p>
                    )}
                </section>}
            </main>
        </Base>
    );
};

export default CreateContest;
