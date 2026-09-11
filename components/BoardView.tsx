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

import ViewerShell from '../src/features/viewer/shell/ViewerShell';
import SalesBoardViewer from '../src/features/viewer/sales/SalesBoardViewer';
import OrganizerWorkspace from '../src/features/organizer/workspace/OrganizerWorkspace';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';
import SyntheticScoreTestBanner from './SyntheticScoreTestBanner';

// Board sub-components
import ShareModal from './board/ShareModal';
import FindSquaresModal from './board/FindSquaresModal';
import { calculateWinnerHighlights } from '../utils/winnerLogic';
import { distinctAssignedNames } from '../utils/playerNameMatching';
import { createCheckoutSession } from '../services/stripe';
import { Base, CapsuleButton, Eyebrow } from '../src/design/primitives';

// Custom Hooks
import { usePoolData, INITIAL_GAME } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';
import { useContestEntries } from '../hooks/useContestEntries';

type BillingSummary = { tier: string; used: number; allowance: number };

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
        ownerId, loadingPool, dataReady, loadPoolData, error: poolError, revision,
        isActivated, isLocked, isPublished, isShared, updatedAt, refreshing, refreshError, shareBoard, winnerHistory, pendingMilestones,
        notificationDeliveryIssues, updatePool, updatePayoutDescriptions, updatePublishedOpenSquares, publishPool
    } = poolData;

    const auth = useAuth();
    const isOwner = Boolean(auth.user && ownerId && auth.user.id === ownerId);
    const boardServicesEnabled = Boolean(demoMode || (isPublished && (isActivated || !isOwner)));
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

    const [isPreviewMode, setIsPreviewMode] = useState(() => localStorage.getItem('gridone_preview_mode') === 'true');
    useEffect(() => { try { localStorage.removeItem('gridone_preview_mode'); } catch {} setIsPreviewMode(false); }, []);

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

    // Owner-only data never loads on a public viewer route.
    const ownerDataPoolId = isCommissionerMode ? activePoolId : null;
    const { entryMetaByIndex, setEntryMetaByIndex, reloadEntries, hasLoadedEntries, isLoading: entriesLoading, error: entriesError } = useContestEntries(ownerDataPoolId);
    const [billing, setBilling] = useState<BillingSummary | null>(null);
    const [ownedPublicBoardId, setOwnedPublicBoardId] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        setOwnedPublicBoardId(null);
        if (!routeShareCode || !auth.user) return;
        void (async () => {
            const { data, error } = await supabase.from('contests').select('id')
                .eq('share_code', routeShareCode.toUpperCase()).eq('owner_id', auth.user!.id).maybeSingle();
            if (!cancelled && !error) setOwnedPublicBoardId(data?.id || null);
        })().catch(() => {});
        return () => { cancelled = true; };
    }, [routeShareCode, auth.user?.id]);

    // Poll only the public sales record. Owner edits never get replaced by a timer.
    useEffect(() => {
        if (!routeShareCode || !isShared || isPublished || isCommissionerMode) return;
        const refresh = () => {
            if (document.visibilityState === 'visible') void loadPoolData(routeShareCode, { background: true });
        };
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener('focus', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, [routeShareCode, isShared, isPublished, isCommissionerMode, loadPoolData]);

    // 5. Effects
    useEffect(() => {
        if (demoMode) {
            setBoard(SAMPLE_BOARD);
            setGame({
                ...INITIAL_GAME,
                title: 'Demo: Super Bowl LIX',
                dates: '2025-02-09',
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
                    detail: 'Sample score',
                    isOvertime: false,
                    sourceName: 'Sample score',
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
        let cancelled = false;
        setBilling(null);
        // The plan summary is an organizer-only fact; public viewers never ask for it.
        if (!ownerDataPoolId) return;
        void supabase.auth.getSession().then(async ({ data }) => {
            const token = data.session?.access_token;
            if (!token) {
                if (!cancelled) setBilling(null);
                return;
            }
            const response = await fetch('/api/billing/status', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!response.ok) {
                if (!cancelled) setBilling(null);
                return;
            }
            const result = await response.json() as BillingSummary;
            if (!cancelled) setBilling(result);
        }).catch(() => {
            // The board stays usable when the neutral plan summary is unavailable.
        });
        return () => { cancelled = true; };
    }, [ownerDataPoolId]);

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
            {isShared && !isPublished && !previewMode ? (
                <SalesBoardViewer game={game} board={board} updatedAt={updatedAt}
                    onRefresh={() => urlPoolId && void loadPoolData(urlPoolId, { background: true })}
                    refreshing={refreshing} error={refreshError ? `Showing the last saved board. ${refreshError}` : null}
                    organizerHref={ownedPublicBoardId ? `/boards/${ownedPublicBoardId}` : undefined} />
            ) : isLocked && !previewMode ? (
                <Base kind="dark"><main className="mx-auto max-w-[640px] px-6 py-20 flex flex-col gap-4" role="status">
                    <Eyebrow>Viewer link unavailable</Eyebrow>
                    <h1 className="font-display text-[34px] leading-[1.05] text-fg">This board is not published yet.</h1>
                    <p className="font-ui text-[17px] text-fg-2">The organizer can still preview it. Viewers will see the board here after it is unlocked and published.</p>
                </main></Base>
            ) : (
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
                        organizerHref={!previewMode && ownedPublicBoardId ? `/boards/${ownedPublicBoardId}` : undefined}
                        onShare={activePoolId && isActivated ? () => setShowShareModal(true) : undefined}
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
            <Base kind="dark"><main className="mx-auto max-w-[640px] px-6 py-20 flex flex-col gap-4" role="alert">
                <Eyebrow>Board unavailable</Eyebrow>
                <h1 className="font-display text-[34px] leading-[1.05] text-fg">This GridOne board is unavailable.</h1>
                <p className="font-ui text-[17px] text-fg-2">{poolError}</p>
                <CapsuleButton onClick={() => urlPoolId && void loadPoolData(urlPoolId)}>Try again</CapsuleButton>
                <CapsuleButton variant="quiet" onClick={() => navigate('/')}>Go to GridOne</CapsuleButton>
            </main></Base>
        );
    }

    return (
        <div className="min-h-[100dvh] w-full flex flex-col bg-ground text-fg" data-base="dark">
            {game.scoreTestMode && <SyntheticScoreTestBanner />}

            {loadingPool && urlPoolId && <FullScreenLoading />}

            {/* Demo mode never loads a pool, so loadingPool stays true there */}
            {(demoMode || !loadingPool) && !isCommissionerMode && (
                <div className="flex-1 flex flex-col relative z-50 w-full max-w-[1440px] mx-auto min-h-0">
                    {demoMode && <p className="mx-4 mt-20 font-ui text-sm text-fg-2"><span>Sample board — not a live game</span><br />Sample game · February 9, 2025</p>}
                    {renderMainContent()}
                    {(demoMode || liveData?.state === 'post') && <aside aria-label="Run your own board" className="mx-4 my-8 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
                        <p className="font-ui text-base text-fg-2">{demoMode ? 'This is a sample board. Ready to run yours?' : 'Bring your next game day together.'}</p>
                        <CapsuleButton variant="quiet" onClick={() => navigate('/create')}>Create your own board</CapsuleButton>
                    </aside>}
                </div>
            )}

            {showShareModal && (
                <ShareModal shareUrl={shareUrl} onClose={() => setShowShareModal(false)} />
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
                <>
                {(entriesLoading || (!hasLoadedEntries && !entriesError)) && <p role="status" className="px-5 py-3 text-sm text-fg-2">Refreshing private square notes…</p>}
                {entriesError && <div role="alert" className="px-5 py-3 text-sm text-fg"><p>{entriesError}</p><CapsuleButton onClick={() => void reloadEntries().catch(() => undefined)}>Reload private notes</CapsuleButton></div>}
                <div inert={entriesLoading || Boolean(entriesError)}>
                {hasLoadedEntries && <OrganizerWorkspace
                    game={game}
                    board={board}
                    activePoolId={activePoolId || ''}
                    liveData={liveData}
                    winnerHistory={liveWinnerHistory}
                    notificationDeliveryIssues={notificationDeliveryIssues}
                    revision={revision ?? 0}
                    entryMeta={entryMetaByIndex}
                    onEntryMetaChange={(meta) => setEntryMetaByIndex((current) => ({
                        ...current,
                        [meta.cell_index]: meta,
                    }))}
                    billing={billing}
                    onCheckout={(tier, organizationName) => {
                        if (!activePoolId) throw new Error('Save this board before upgrading.');
                        return createCheckoutSession(activePoolId, tier, organizationName);
                    }}
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
                    onReload={async () => {
                        if (!activePoolId) return;
                        await loadPoolData(activePoolId, { background: true });
                        await reloadEntries();
                    }}
                    onRunAnotherBoard={(template) => navigate('/create', { state: { boardTemplate: template } })}
                    onOpenViewer={() => {
                        if (shareCode) window.open(`/b/${shareCode}`, '_blank', 'noopener,noreferrer');
                    }}
                    onLogout={handleLogout}
                    isActivated={isActivated}
                    isPublished={isPublished}
                    isShared={isShared}
                    onShareBoard={() => shareBoard(activePoolId || '')}
                    shareCode={shareCode}
                    renderPreview={() => (
                        <div className="relative z-50 flex min-h-[calc(100dvh-6rem)] w-full flex-col">
                            {renderMainContent(true)}
                        </div>
                    )}
                />}
                </div>
                </>
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
