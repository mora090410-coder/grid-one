/**
 * THESIS: A game-day board is one continuous field of score context, personal outcome, and exact grid—not tabs that split the viewer's questions apart.
 * OWN-WORLD: Ink cyclorama, cardinal team field, gold settled line, live-green status only; precise slabs and a stable 10×10 instrument.
 * STORY: Orient to authority, find my squares, understand who wins now and next, then inspect the board and resolved milestones.
 * FIRST VIEWPORT: Split Stage places live/personal context above the exact board on one horizon; the primary action is Find my squares.
 * FORM: Game-Day Horizon, Composition C Split Stage, chosen staging from stagecraft cyclorama; seed 356916de.
 */
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { WinnerHighlights } from '../types';
import { SAMPLE_BOARD } from '../constants';

// Lazy load heavy components
const AdminPanel = lazy(() => import('./AdminPanel'));
import GameDayHorizon from './GameDayHorizon';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';

// Board sub-components
import BoardHeader from './board/BoardHeader';
import ShareModal from './board/ShareModal';
import FindSquaresModal from './board/FindSquaresModal';
import { calculateWinnerHighlights } from '../utils/winnerLogic';

// Custom Hooks
import { usePoolData, INITIAL_GAME } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';

const BoardViewContent: React.FC<{ demoMode?: boolean }> = ({ demoMode = false }) => {
    const { shareCode: routeShareCode, boardId: routeBoardId } = useParams<{ shareCode?: string; boardId?: string }>();
    const searchParams = new URLSearchParams(window.location.search);
    const legacyPoolId = searchParams.get('poolId');
    const urlPoolId = routeBoardId || routeShareCode || legacyPoolId;
    const forceAdmin = searchParams.get('forceAdmin') === 'true';
    const navigate = useNavigate();

    // 1. Data Hooks
    const poolData = usePoolData();
    const {
        game, setGame, board, setBoard, activePoolId, setActivePoolId, shareCode,
        ownerId, loadingPool, dataReady, loadPoolData, error: poolError,
        isActivated, isPaid, isLocked, isPublished, winnerHistory, updatePool, publishPool
    } = poolData;

    const auth = useAuth();
    const scoringBoardRef = routeShareCode || routeBoardId || (auth.user ? activePoolId : null) || shareCode;
    const liveScoring = useLiveScoring(game, dataReady, loadingPool, scoringBoardRef, winnerHistory);
    const { liveData, liveStatus, isSynced, winnerHistory: liveWinnerHistory } = liveScoring;

    const requiresAuthForRoute = !demoMode && Boolean(
        routeBoardId || forceAdmin || (legacyPoolId && legacyPoolId.length > 8),
    );

    useEffect(() => {
        if (requiresAuthForRoute && !auth.loading && !auth.user && !loadingPool) {
            const returnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
            navigate(`/login?returnTo=${returnUrl}`);
        }
    }, [auth.loading, auth.user, loadingPool, navigate, requiresAuthForRoute]);

    // 2. UI State
    const [showShareModal, setShowShareModal] = useState(false);
    const [showFindSquaresModal, setShowFindSquaresModal] = useState(false);

    const [adminStartTab, setAdminStartTab] = useState<'overview' | 'edit'>('overview');
    const [isPreviewMode, setIsPreviewMode] = useState(() => localStorage.getItem('gridone_preview_mode') === 'true');

    const [selectedPlayer, setSelectedPlayer] = useState<string>('');
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);

    // 3. Action Hooks
    const { handlePublish } = useBoardActions({
        game, board, activePoolId, updatePool, publishPool
    });

    // 4. Derived State
    const isOwner = auth.user && ownerId && auth.user.id === ownerId;
    const isCommissionerMode = Boolean(isOwner && !isPreviewMode);

    // 5. Effects
    useEffect(() => {
        if (demoMode) {
            setBoard(SAMPLE_BOARD);
            setGame({
                ...INITIAL_GAME,
                title: 'Demo: Super Bowl LIX',
                leftAbbr: 'KC',
                leftName: 'Kansas City Chiefs',
                topAbbr: 'PHI',
                topName: 'Philadelphia Eagles',
                scoreSnapshot: {
                    leftScore: 17,
                    topScore: 24,
                    quarterScores: {
                        Q1: { left: 3, top: 7 },
                        Q2: { left: 7, top: 7 },
                        Q3: { left: 7, top: 3 },
                        Q4: { left: 0, top: 7 },
                        OT: { left: 0, top: 0 },
                    },
                    clock: '2:31',
                    period: 4,
                    state: 'in',
                    detail: 'Synthetic demonstration score',
                    isOvertime: false,
                    sourceName: 'Demonstration fixture',
                    retrievedAt: new Date().toISOString(),
                    staleAfter: new Date(Date.now() + 3_600_000).toISOString(),
                    freshness: 'fresh',
                },
            });
        }
    }, [demoMode, setBoard, setGame]);

    useEffect(() => {
        if (urlPoolId) {
            if (forceAdmin || routeBoardId) {
                setIsPreviewMode(false);
                localStorage.setItem('gridone_preview_mode', 'false');
            }
            void loadPoolData(urlPoolId);
        }
    }, [forceAdmin, loadPoolData, routeBoardId, urlPoolId]);

    useEffect(() => {
        if (urlPoolId) return;
        if (!dataReady || loadingPool) return;
        localStorage.setItem('squares_game', JSON.stringify(game));
        localStorage.setItem('squares_board', JSON.stringify(board));
    }, [game, board, dataReady, loadingPool, urlPoolId]);

    // 6. Helpers
    const handleTogglePreview = (enabled: boolean) => {
        setIsPreviewMode(enabled);
        localStorage.setItem('gridone_preview_mode', String(enabled));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setActivePoolId(null);
        setIsPreviewMode(false);
        localStorage.removeItem('gridone_preview_mode');
        setBoard(SAMPLE_BOARD);
        navigate('/');
    };

    const highlights = useMemo<WinnerHighlights>(() => calculateWinnerHighlights(liveData), [liveData]);

    const shareUrl = shareCode ? `${window.location.origin}/b/${shareCode}` : window.location.href;

    const renderMainContent = (previewMode = false) => (
        <div className={`flex-1 min-h-0 overflow-y-auto ${isOwner && !isPaid ? 'pointer-events-none select-none opacity-50' : ''}`}>
            {isLocked && !previewMode ? (
                <section className="gdh-unavailable" role="status">
                    <span className="gdh-kicker">Viewer link unavailable</span>
                    <h1>This board is not published yet.</h1>
                    <p>The organizer can still preview it. Viewers will see the board here after it is unlocked and published.</p>
                </section>
            ) : (
                <GameDayHorizon
                    game={game}
                    board={board}
                    live={liveData}
                    liveStatus={liveStatus}
                    isSynced={isSynced}
                    highlights={highlights}
                    winnerHistory={liveWinnerHistory}
                    selectedPlayer={selectedPlayer}
                    onClearPlayer={() => setSelectedPlayer('')}
                    onFindSquares={() => setShowFindSquaresModal(true)}
                    highlightedCoords={highlightedCoords}
                    onScenarioFocus={setHighlightedCoords}
                    locked={isLocked}
                    shareCode={routeShareCode || shareCode}
                />
            )}
        </div>
    );

    // 7. Render
    if (requiresAuthForRoute && !auth.loading && !auth.user) {
        return <FullScreenLoading message="Sign in to view your boards..." />;
    }

    if (!loadingPool && urlPoolId && poolError) {
        return (
            <main className="oa-root gdh-root min-h-[100dvh] bg-ink text-broadcast-white grid place-items-center px-5">
                <section className="gdh-unavailable max-w-2xl" role="alert">
                    <span className="gdh-kicker">Board unavailable</span>
                    <h1>This link does not open a published GridOne board.</h1>
                    <p>{poolError}</p>
                    <button type="button" className="oa-btn oa-btn-primary mt-6" onClick={() => navigate('/')}>Go to GridOne</button>
                </section>
            </main>
        );
    }

    return (
        <div className="oa-root gdh-root min-h-[100dvh] w-full bg-ink flex flex-col text-broadcast-white">
            {showShareModal && (
                <ShareModal shareUrl={shareUrl} onClose={() => setShowShareModal(false)} />
            )}

            {loadingPool && urlPoolId && <FullScreenLoading />}

            {/* Demo mode never loads a pool, so loadingPool stays true there */}
            {(demoMode || !loadingPool) && !isCommissionerMode && (
                <div className="flex-1 flex flex-col relative z-50 w-full max-w-[1440px] mx-auto min-h-0">
                    <div className="flex-shrink-0 z-50 p-4 md:py-6">
                        <BoardHeader
                            game={game}
                            isOwner={!!isOwner}
                            activePoolId={activePoolId}
                            isActivated={isActivated}
                            isSynced={isSynced}
                            isPreviewMode={isPreviewMode}
                            onTogglePreview={handleTogglePreview}
                            onAdminStartTab={setAdminStartTab}
                            onShareClick={() => setShowShareModal(true)}
                        />
                    </div>
                    {renderMainContent()}
                </div>
            )}

            {showFindSquaresModal && (
                <FindSquaresModal
                    board={board}
                    selectedPlayer={selectedPlayer}
                    onSelectPlayer={setSelectedPlayer}
                    onClose={() => setShowFindSquaresModal(false)}
                />
            )}

            {isCommissionerMode && (
                <div className="oa-root fixed inset-0 z-[80] bg-broadcast-white p-0 overflow-y-auto scrollbar-hide">
                    <Suspense fallback={<div className="oa-slab flex items-center justify-center h-full text-ink/50">Loading Organizer...</div>}>
                        <AdminPanel
                            game={game}
                            board={board}
                            activePoolId={activePoolId || ''}
                            liveData={liveData}
                            initialTab={adminStartTab}
                            onApply={(g, b) => { setGame(g); setBoard(b); }}
                            onPublish={handlePublish}
                            onLogout={handleLogout}
                            isActivated={isActivated}
                            isPublished={isPublished}
                            shareCode={shareCode}
                            renderPreview={() => (
                                <div className="flex-1 flex flex-col relative z-50 w-full h-full">
                                    {renderMainContent(true)}
                                </div>
                            )}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};

const BoardView: React.FC<{ demoMode?: boolean }> = ({ demoMode }) => (
    <ErrorBoundary>
        <BoardViewContent demoMode={demoMode} />
    </ErrorBoundary>
);

export default BoardView;
