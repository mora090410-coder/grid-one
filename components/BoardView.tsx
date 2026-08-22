/**
 * THESIS: A game-day board is one continuous field of score context, personal outcome, and exact grid—not tabs that split the viewer's questions apart.
 * OWN-WORLD: Ink cyclorama, cardinal team field, gold settled line, live-green status only; precise slabs and a stable 10×10 instrument.
 * STORY: Orient to authority, find my squares, understand who wins now and next, then inspect the board and resolved milestones.
 * FIRST VIEWPORT: Split Stage places live/personal context above the exact board on one horizon; the primary action is Find my squares.
 * FORM: Game-Day Horizon, Composition C Split Stage, chosen staging from stagecraft cyclorama; seed 356916de.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { WinnerHighlights } from '../types';
import { SAMPLE_BOARD } from '../constants';

import AdminPanel from './AdminPanel';
import GameDayHorizon from './GameDayHorizon';
import ViewerShell from '../features/viewer/shell/ViewerShell';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';
import SyntheticScoreTestBanner from './SyntheticScoreTestBanner';

// Board sub-components
import BoardHeader from './board/BoardHeader';
import ShareModal from './board/ShareModal';
import FindSquaresModal from './board/FindSquaresModal';
import { calculateWinnerHighlights } from '../utils/winnerLogic';
import { distinctAssignedNames } from '../utils/playerNameMatching';
import { resolveFeatureFlags } from '../utils/featureFlags';

// Custom Hooks
import { usePoolData, INITIAL_GAME } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';

const envFlagConfig = () => ({
    flags: {
        viewer_v2: import.meta.env.VITE_GRIDONE_VIEWER_V2,
        organizer_v2: import.meta.env.VITE_GRIDONE_ORGANIZER_V2,
        homepage_v2: import.meta.env.VITE_GRIDONE_HOMEPAGE_V2,
    },
});

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
        isActivated, isLocked, isPublished, winnerHistory, pendingMilestones,
        notificationDeliveryIssues, updatePool, updatePayoutDescriptions, updatePublishedOpenSquares, publishPool
    } = poolData;

    const auth = useAuth();
    const isOwner = Boolean(auth.user && ownerId && auth.user.id === ownerId);
    const boardServicesEnabled = Boolean(demoMode || isActivated || !isOwner);
    const scoringBoardRef = routeShareCode || routeBoardId || (auth.user ? activePoolId : null) || shareCode;
    const liveScoring = useLiveScoring(
        game,
        dataReady,
        loadingPool,
        scoringBoardRef,
        winnerHistory,
        boardServicesEnabled,
        pendingMilestones,
    );
    const {
        liveData,
        liveStatus,
        isSynced,
        winnerHistory: liveWinnerHistory,
        pendingMilestones: livePendingMilestones,
    } = liveScoring;

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

    const publicSelectionShareCode = routeShareCode || (!requiresAuthForRoute ? shareCode : null);
    const selectionStorageKey = publicSelectionShareCode
        ? `gridone:find-squares:${publicSelectionShareCode.toUpperCase()}`
        : null;
    const selectionScope = selectionStorageKey || (demoMode ? 'demo' : `board:${urlPoolId || 'local'}`);
    const [playerSelection, setPlayerSelection] = useState({ scope: selectionScope, displayName: '' });
    const hydratedSelectionKey = useRef<string | null>(null);
    const selectedPlayer = playerSelection.scope === selectionScope ? playerSelection.displayName : '';
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);

    // 3. Action Hooks
    const { handlePublish } = useBoardActions({
        game, board, activePoolId, updatePool, publishPool
    });

    // 4. Derived State
    const isCommissionerMode = Boolean(isOwner && !isPreviewMode);
    const isReadOnlyViewerRoute = Boolean(demoMode || (routeShareCode && !forceAdmin));
    const featureFlags = resolveFeatureFlags({
        config: envFlagConfig(),
        accountId: auth.user?.id || null,
        boardId: activePoolId || urlPoolId || null,
        query: window.location.search,
        routeIntent: isReadOnlyViewerRoute ? 'read_only_preview' : 'production_mutation',
    });
    const viewerV2Enabled = featureFlags.flags.viewer_v2;

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

    useEffect(() => {
        if (!selectionStorageKey || !dataReady || loadingPool || poolError) return;
        if (hydratedSelectionKey.current === selectionStorageKey) return;

        let displayName = '';
        try {
            const raw = localStorage.getItem(selectionStorageKey);
            const saved = raw ? JSON.parse(raw) : null;
            const assignedNames = distinctAssignedNames(board.squares);
            if (
                saved?.version === 1
                && typeof saved.displayName === 'string'
                && assignedNames.includes(saved.displayName)
            ) {
                displayName = saved.displayName;
            } else if (raw) {
                localStorage.removeItem(selectionStorageKey);
            }
        } catch {
            // Storage may be unavailable or contain malformed data; selection still works for this visit.
        }

        hydratedSelectionKey.current = selectionStorageKey;
        setPlayerSelection({ scope: selectionScope, displayName });
    }, [board.squares, dataReady, loadingPool, poolError, selectionScope, selectionStorageKey]);

    useEffect(() => {
        if (
            !selectionStorageKey
            || hydratedSelectionKey.current !== selectionStorageKey
            || playerSelection.scope !== selectionScope
        ) return;
        try {
            if (playerSelection.displayName) {
                localStorage.setItem(selectionStorageKey, JSON.stringify({
                    version: 1,
                    displayName: playerSelection.displayName,
                }));
            } else {
                localStorage.removeItem(selectionStorageKey);
            }
        } catch {
            // Storage is an enhancement; keep the in-memory selection when it is unavailable.
        }
    }, [playerSelection, selectionScope, selectionStorageKey]);

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
        <div className="flex-1 min-h-0">
            {isLocked && !previewMode ? (
                <section className="gdh-unavailable" role="status">
                    <span className="gdh-kicker">Viewer link unavailable</span>
                    <h1>This board is not published yet.</h1>
                    <p>The organizer can still preview it. Viewers will see the board here after it is unlocked and published.</p>
                </section>
            ) : viewerV2Enabled ? (
                    <ViewerShell
                        game={game}
                        board={board}
                        live={liveData}
                        liveStatus={liveStatus}
                        isSynced={isSynced}
                        highlights={highlights}
                        winnerHistory={liveWinnerHistory}
                        pendingMilestones={livePendingMilestones}
                        selectedPlayer={selectedPlayer}
                        onClearPlayer={() => setPlayerSelection({ scope: selectionScope, displayName: '' })}
                        onFindSquares={() => setShowFindSquaresModal(true)}
                        highlightedCoords={highlightedCoords}
                        onScenarioFocus={setHighlightedCoords}
                        locked={isLocked}
                        shareCode={routeShareCode || shareCode}
                        servicesEnabled={boardServicesEnabled}
                        organizerPreview={previewMode && isOwner}
                    />
                ) : (
                    <GameDayHorizon
                        game={game}
                        board={board}
                        live={liveData}
                        liveStatus={liveStatus}
                        isSynced={isSynced}
                        highlights={highlights}
                        winnerHistory={liveWinnerHistory}
                        pendingMilestones={livePendingMilestones}
                        selectedPlayer={selectedPlayer}
                        onClearPlayer={() => setPlayerSelection({ scope: selectionScope, displayName: '' })}
                        onFindSquares={() => setShowFindSquaresModal(true)}
                        highlightedCoords={highlightedCoords}
                        onScenarioFocus={setHighlightedCoords}
                        locked={isLocked}
                        shareCode={routeShareCode || shareCode}
                        servicesEnabled={boardServicesEnabled}
                        organizerPreview={previewMode && isOwner}
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
            {game.scoreTestMode && <SyntheticScoreTestBanner />}

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
                    onSelectPlayer={(displayName) => setPlayerSelection({ scope: selectionScope, displayName })}
                    onClose={() => setShowFindSquaresModal(false)}
                />
            )}

            {isCommissionerMode && (
                <div className="oa-root relative z-[80] min-h-[100dvh] w-full bg-broadcast-white p-0 text-ink">
                    <AdminPanel
                        game={game}
                        board={board}
                        activePoolId={activePoolId || ''}
                        liveData={liveData}
                        winnerHistory={liveWinnerHistory}
                        notificationDeliveryIssues={notificationDeliveryIssues}
                        initialTab={adminStartTab}
                        onApply={(g, b) => { setGame(g); setBoard(b); }}
                        onPublish={handlePublish}
                        onSavePayoutDescriptions={(descriptions) => {
                            if (!activePoolId) throw new Error('Save this board before adding payout descriptions.');
                            return updatePayoutDescriptions(activePoolId, descriptions);
                        }}
                        onAssignOpenSquares={async (squares) => {
                            if (!activePoolId) throw new Error('Reload this board before assigning OPEN squares.');
                            await updatePublishedOpenSquares(activePoolId, squares);
                            await loadPoolData(activePoolId);
                        }}
                        onLogout={handleLogout}
                        isActivated={isActivated}
                        isPublished={isPublished}
                        shareCode={shareCode}
                        renderPreview={() => (
                            <div className="relative z-50 flex min-h-[calc(100dvh-6rem)] w-full flex-col">
                                {renderMainContent(true)}
                            </div>
                        )}
                    />
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
