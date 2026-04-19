import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { WinnerHighlights } from '../types';
import { SAMPLE_BOARD } from '../constants';

// Lazy load heavy components
const AdminPanel = lazy(() => import('./AdminPanel'));
import BoardGrid from './BoardGrid';
import InfoCards from './InfoCards';
import ScenarioPanel from './ScenarioPanel';
import LandingPage from './LandingPage';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';

// Board sub-components
import BoardHeader from './board/BoardHeader';
import JoinModal from './board/JoinModal';
import RecoveryModal from './board/RecoveryModal';
import ShareModal from './board/ShareModal';
import FindSquaresModal from './board/FindSquaresModal';
import PayoutsModal from './board/PayoutsModal';

// Custom Hooks
import { usePoolData, INITIAL_GAME } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';

// Sub-components
import { WizardModal } from './BoardWizard/WizardModal';

const API_URL = `${window.location.origin}/api/pools`;

const BoardViewContent: React.FC<{ demoMode?: boolean }> = ({ demoMode = false }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPoolId = searchParams.get('poolId');
    const forceAdmin = searchParams.get('forceAdmin') === 'true';
    const navigate = useNavigate();

    // 1. Data Hooks
    const poolData = usePoolData();
    const {
        game, setGame, board, setBoard, activePoolId, setActivePoolId,
        ownerId, loadingPool, dataReady, loadPoolData,
        isActivated, isPaid, isLocked
    } = poolData;

    const liveScoring = useLiveScoring(game, dataReady, loadingPool);
    const { liveData, liveStatus, isSynced, lastUpdated } = liveScoring;

    const auth = useAuth();
    const { adminToken, setAdminToken } = auth;

    const requiresAuthForRoute = !demoMode && (forceAdmin || !urlPoolId);

    useEffect(() => {
        if (requiresAuthForRoute && !auth.loading && !auth.user && !loadingPool) {
            const returnUrl = encodeURIComponent(window.location.search);
            navigate(`/login?returnTo=${returnUrl}`);
        }
    }, [auth.loading, auth.user, loadingPool, navigate, requiresAuthForRoute]);

    if (requiresAuthForRoute && !auth.loading && !auth.user) {
        return <FullScreenLoading message="Signing needed to view boards..." />;
    }

    // 2. UI State
    const [showShareModal, setShowShareModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [showAdminView, setShowAdminView] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showFindSquaresModal, setShowFindSquaresModal] = useState(false);
    const [showPayoutsModal, setShowPayoutsModal] = useState(false);

    const [adminStartTab, setAdminStartTab] = useState<'overview' | 'edit'>('overview');
    const [joinInput, setJoinInput] = useState('');
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [activeTab, setActiveTab] = useState<'live' | 'board'>('live');

    const [hasEnteredApp, setHasEnteredApp] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(() => localStorage.getItem('gridone_preview_mode') === 'true');

    const [selectedPlayer, setSelectedPlayer] = useState<string>('');
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);

    // 3. Action Hooks
    const { handlePublish, handleJoinSubmit, isJoining } = useBoardActions({
        game, board, activePoolId, API_URL, setAdminToken, setShowAdminView
    });

    // 4. Derived State
    const showLanding = !demoMode && !activePoolId && !urlPoolId && !loadingPool && !hasEnteredApp && !isInitialized;
    const isOwner = auth.user && ownerId && auth.user.id === ownerId;
    const isCommissionerMode = (showAdminView && !!adminToken && !isPreviewMode) || (isOwner && !isPreviewMode);

    const knownAdminToken = useMemo(() => {
        const targetId = joinInput.trim().toUpperCase() || activePoolId;
        if (!targetId || targetId.length < 4) return null;
        const storedTokens = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
        return storedTokens[targetId] || null;
    }, [joinInput, activePoolId]);

    const isEmptyBoard = !board.squares.some(s => s.length > 0);

    // 5. Effects
    useEffect(() => {
        if (isOwner) setShowAdminView(true);
    }, [isOwner]);

    useEffect(() => {
        if (demoMode) {
            setBoard(SAMPLE_BOARD);
            setGame({ ...INITIAL_GAME, title: 'Demo: Super Bowl LIX', leftAbbr: 'KC', topAbbr: 'SF' });
            setIsInitialized(true);
            setHasEnteredApp(true);
            setActiveTab('board');
        }
    }, [demoMode, setBoard, setGame]);

    useEffect(() => {
        if (urlPoolId) {
            if (forceAdmin) {
                setIsPreviewMode(false);
                setShowAdminView(true);
                localStorage.setItem('gridone_preview_mode', 'false');
            }
            loadPoolData(urlPoolId).then(() => {
                setIsInitialized(true);
                const storedTokens = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
                if (storedTokens[urlPoolId]) setAdminToken(storedTokens[urlPoolId]);
            });
        }
    }, [loadPoolData, setAdminToken, urlPoolId]);

    useEffect(() => {
        if (dataReady && !loadingPool && !isActivated && !isOwner && !demoMode) {
            setActiveTab('board');
        }
    }, [dataReady, loadingPool, isActivated, isOwner, demoMode]);

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
        if (enabled) setShowAdminView(false);
        else setShowAdminView(true);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        const storedTokens = JSON.parse(localStorage.getItem('gridone_tokens') || '{}');
        if (activePoolId) delete storedTokens[activePoolId];
        localStorage.setItem('gridone_tokens', JSON.stringify(storedTokens));
        setAdminToken('');
        setHasEnteredApp(false);
        setActivePoolId(null);
        setIsInitialized(false);
        setShowAdminView(false);
        setIsPreviewMode(false);
        localStorage.removeItem('gridone_preview_mode');
        setBoard(SAMPLE_BOARD);
        navigate('/');
    };

    const handleRecoverySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recoveryEmail || !recoveryEmail.includes('@')) return;
        setIsRecovering(true);
        try {
            const res = await fetch(`${API_URL}/recover-id`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: recoveryEmail })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || "Recovery email sent.");
                setShowRecoveryModal(false);
                setRecoveryEmail('');
            } else {
                alert("Recovery failed: " + (data.error || "Unknown error"));
            }
        } catch {
            alert("Network error during recovery.");
        } finally {
            setIsRecovering(false);
        }
    };

    const highlights = useMemo<WinnerHighlights>(() => {
        if (!liveData) return { quarterWinners: {}, currentLabel: 'NOW' };
        const qw: Record<string, string> = {};
        const { period, state, quarterScores, leftScore, topScore, isManual } = liveData;
        if (isManual) return { quarterWinners: {}, currentLabel: 'NOW' };

        const getWinnerKey = (qIdx: number) => {
            let lSum = 0; let tSum = 0;
            for (let i = 0; i <= qIdx; i++) {
                const qKey = `Q${i + 1}` as keyof typeof quarterScores;
                lSum += (quarterScores[qKey]?.left || 0);
                tSum += (quarterScores[qKey]?.top || 0);
            }
            return `${tSum % 10}-${lSum % 10}`;
        };

        if (period > 1 || state === 'post') qw['Q1'] = getWinnerKey(0);
        if (period > 2 || state === 'post') qw['Q2'] = getWinnerKey(1);
        if (period > 3 || state === 'post') qw['Q3'] = getWinnerKey(2);
        if (state === 'post') qw['Final'] = `${topScore % 10}-${leftScore % 10}`;

        return { quarterWinners: qw, currentLabel: state === 'post' ? 'FINAL' : 'NOW' };
    }, [liveData]);

    const openSetupWizard = () => navigate('/create');
    const shareUrl = activePoolId ? `${window.location.origin}/?poolId=${activePoolId}` : window.location.href;

    const renderMainContent = (previewMode = false) => {
        const effectiveTab = previewMode ? 'live' : activeTab;
        const handleTabChange = previewMode ? undefined : setActiveTab;
        const showLockedOverlay = isLocked && !previewMode;

        return (
            <div className="flex-1 relative overflow-hidden flex flex-col pb-6">
                <div className={`flex-1 flex flex-col h-full overflow-hidden ${isOwner && !isPaid ? 'blur-sm pointer-events-none select-none' : ''}`}>
                    {showLockedOverlay && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/92 backdrop-blur-md p-6">
                            <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/30">
                                    <svg className="h-7 w-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">This board is not live yet</h2>
                                <p className="mt-3 text-sm leading-relaxed text-white/70">
                                    The organizer has created the board, but sharing is still locked until they unlock it for live viewing.
                                </p>
                                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 ring-1 ring-white/10">
                                    Viewers get access once the board is activated
                                </div>
                            </div>
                        </div>
                    )}
                    <InfoCards.LiveStrip game={game} live={liveData} isSynced={isSynced} activeTab={effectiveTab} onTabChange={handleTabChange} />

                    <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                        <div className="max-w-[960px] mx-auto px-4 md:px-6 py-6 space-y-6">
                            {effectiveTab === 'live' && (
                                <div className="relative">
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        {liveStatus === 'NO MATCH FOUND' && (
                                            <div className="p-4 rounded-[20px] bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-4">
                                                <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-500">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold text-yellow-500 mb-1">No game found for selected teams/date</h4>
                                                    <p className="text-xs text-yellow-500/80">
                                                        No matchup found for {game.leftAbbr} vs {game.topAbbr}{game.dates ? ` on ${game.dates}` : ''}. Go to Organizer &gt; Edit to change teams or date.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        <InfoCards.WinningNowHero game={game} board={board} live={liveData} highlights={highlights} />
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <ScenarioPanel.LeftScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                            <ScenarioPanel.TopScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {effectiveTab === 'board' && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <button
                                                onClick={() => setShowFindSquaresModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[13px] font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white transition-all shrink-0"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <span className="hidden sm:inline">Find my squares</span>
                                            </button>
                                            {selectedPlayer && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 animate-in fade-in duration-200 min-w-0">
                                                    <span className="text-xs font-medium text-white truncate">Showing: {selectedPlayer}</span>
                                                    <button
                                                        onClick={() => setSelectedPlayer('')}
                                                        className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
                                                    >
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="relative bg-surface/40 border border-white/[0.08] rounded-[16px] shadow-xl min-h-[500px] overflow-auto">
                                        <div className="p-3 md:p-4 flex items-start justify-center min-h-full">
                                            {isEmptyBoard ? (
                                                <div className="text-center max-w-sm mx-auto p-8 animate-in fade-in zoom-in duration-500">
                                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                                        <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-xl font-semibold text-white mb-2">Board is empty</h3>
                                                    <p className="text-sm text-gray-500 mb-8 leading-relaxed">The organizer hasn't added names yet.</p>
                                                </div>
                                            ) : (
                                                <div className="w-full max-w-[980px] min-w-[620px] sm:min-w-[700px] transition-transform duration-300">
                                                    <BoardGrid
                                                        board={board}
                                                        highlights={highlights}
                                                        live={liveData}
                                                        selectedPlayer={selectedPlayer}
                                                        highlightedCoords={highlightedCoords}
                                                        leftTeamName={game.leftName || game.leftAbbr}
                                                        topTeamName={game.topName || game.topAbbr}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-center mt-8 pb-4 animate-in fade-in duration-500 delay-300">
                                        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all group">
                                            <span className="text-xs text-white/50 font-medium group-hover:text-white/70 transition-colors">Powered by</span>
                                            <div className="flex items-center gap-1.5">
                                                <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                                <span className="text-xs font-bold text-white tracking-tight group-hover:text-gold transition-colors">GridOne</span>
                                            </div>
                                            <div className="w-px h-3 bg-white/10 mx-1" />
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-gold/70 group-hover:text-gold transition-colors">Build yours &rarr;</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 7. Render
    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col font-sans text-white">
            {showRecoveryModal && (
                <RecoveryModal
                    email={recoveryEmail}
                    onEmailChange={setRecoveryEmail}
                    onSubmit={handleRecoverySubmit}
                    onClose={() => setShowRecoveryModal(false)}
                    isRecovering={isRecovering}
                />
            )}

            {showJoinModal && (
                <JoinModal
                    joinInput={joinInput}
                    onJoinInputChange={setJoinInput}
                    onSubmit={handleJoinSubmit}
                    onClose={() => setShowJoinModal(false)}
                    isJoining={isJoining}
                    showCommissionerEntry={!!knownAdminToken}
                />
            )}

            <WizardModal
                isOpen={showWizardModal}
                onClose={() => setShowWizardModal(false)}
                game={game}
                setGame={setGame}
                board={board}
                setBoard={setBoard}
                onPublish={handlePublish}
                API_URL={API_URL}
                onSuccess={(_newId) => {
                    setIsInitialized(true);
                    setIsPreviewMode(false);
                    setShowAdminView(true);
                    setActiveTab('board');
                    setTimeout(() => {
                        setHasEnteredApp(true);
                        setShowWizardModal(false);
                        setShowShareModal(true);
                    }, 1800);
                }}
            />

            {showShareModal && (
                <ShareModal shareUrl={shareUrl} onClose={() => setShowShareModal(false)} />
            )}

            {loadingPool && urlPoolId && <FullScreenLoading />}

            {!loadingPool && showLanding ? (
                <LandingPage onCreate={openSetupWizard} onLogin={() => navigate('/login')} />
            ) : !loadingPool && (
                <div className="flex-1 flex flex-col relative z-50 w-full max-w-6xl mx-auto md:px-6 h-full">
                    <div className="flex-shrink-0 z-50 p-4 md:py-6">
                        <BoardHeader
                            game={game}
                            adminToken={adminToken || ''}
                            isOwner={!!isOwner}
                            activePoolId={activePoolId}
                            isActivated={isActivated}
                            isSynced={isSynced}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            isPreviewMode={isPreviewMode}
                            onTogglePreview={handleTogglePreview}
                            adminStartTab={adminStartTab}
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

            {showPayoutsModal && (
                <PayoutsModal
                    game={game}
                    board={board}
                    live={liveData}
                    liveStatus={liveStatus}
                    lastUpdated={lastUpdated}
                    highlights={highlights}
                    onClose={() => setShowPayoutsModal(false)}
                />
            )}

            {isCommissionerMode && (
                <div className="fixed inset-0 z-[80] bg-background p-0 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 scrollbar-hide">
                    <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Loading Organizer...</div>}>
                        <AdminPanel
                            game={game}
                            board={board}
                            adminToken={adminToken || ''}
                            activePoolId={activePoolId || ''}
                            liveData={liveData}
                            initialTab={adminStartTab}
                            onApply={(g, b) => { setGame(g); setBoard(b); }}
                            onPublish={handlePublish}
                            onLogout={handleLogout}
                            isActivated={isActivated}
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
