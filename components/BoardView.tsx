
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { GameState, BoardData, WinnerHighlights } from '../types';
import { SAMPLE_BOARD, NFL_TEAMS } from '../constants';

// Lazy load heavy components
const AdminPanel = lazy(() => import('./AdminPanel'));
import BoardGrid from './BoardGrid';
import InfoCards from './InfoCards';
import ScenarioPanel from './ScenarioPanel';
import LockedLiveView from './LockedLiveView';
import PlayerFilter from './PlayerFilter';
import LandingPage from './LandingPage';
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';

// Custom Hooks
import { usePoolData, INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { useBoardActions } from '../hooks/useBoardActions';

// Sub-components
import { WizardModal } from './BoardWizard/WizardModal';

const API_URL = `${window.location.origin}/api/pools`;

/**
 * Get axis for a specific quarter (dynamic boards) or standard axis
 */
const getAxisForQuarter = (
    board: BoardData,
    side: 'left' | 'top',
    quarter?: string
): (number | null)[] => {
    if (!board.isDynamic || !quarter) {
        return side === 'left' ? board.bearsAxis : board.oppAxis;
    }
    const qKey = (quarter === 'Final' ? 'Q4' : quarter) as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    const axes = side === 'left' ? board.bearsAxisByQuarter : board.oppAxisByQuarter;
    return axes?.[qKey] || (side === 'left' ? board.bearsAxis : board.oppAxis);
};

const BoardViewContent: React.FC<{ demoMode?: boolean }> = ({ demoMode = false }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPoolId = searchParams.get('poolId');
    const navigate = useNavigate();

    // 1. Data Hooks
    const poolData = usePoolData();
    const {
        game, setGame, board, setBoard, activePoolId, setActivePoolId,
        ownerId, loadingPool, dataReady, error: poolError, loadPoolData,
        isActivated, isPaid
    } = poolData;

    const liveScoring = useLiveScoring(game, dataReady, loadingPool);
    const { liveData, liveStatus, isSynced, isRefreshing, lastUpdated } = liveScoring;

    const auth = useAuth();
    const { adminToken, setAdminToken, logout: authLogout } = auth;

    // 2. UI State
    const [showShareModal, setShowShareModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [showAdminView, setShowAdminView] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showFindSquaresModal, setShowFindSquaresModal] = useState(false);
    const [showPayoutsModal, setShowPayoutsModal] = useState(false);

    // Admin Tab State
    const [adminStartTab, setAdminStartTab] = useState<'overview' | 'edit'>('overview');

    const [copyFeedback, setCopyFeedback] = useState(false);
    const [joinInput, setJoinInput] = useState('');
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [activeTab, setActiveTab] = useState<'live' | 'board'>('live');
    const [boardZoom, setBoardZoom] = useState<'fit' | '100'>('fit');

    // App State
    const [hasEnteredApp, setHasEnteredApp] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(() => localStorage.getItem('sbxpro_preview_mode') === 'true');

    // Selection State
    const [selectedPlayer, setSelectedPlayer] = useState<string>('');
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);

    // 3. Action Hooks
    const { handlePublish, handleJoinSubmit, isJoining } = useBoardActions({
        game,
        board,
        activePoolId,
        API_URL,
        setAdminToken,
        setShowAdminView,
        setActivePoolId
    });

    // 4. Derived State
    const showLanding = !demoMode && !activePoolId && !urlPoolId && !loadingPool && !hasEnteredApp && !isInitialized;
    const isOwner = auth.user && ownerId && auth.user.id === ownerId;
    const isCommissionerMode = (showAdminView && !!adminToken && !isPreviewMode) || (isOwner && !isPreviewMode);

    // Used for "Enter Commissioner Hub" button text in Join Modal
    const knownAdminToken = useMemo(() => {
        const targetId = joinInput.trim().toUpperCase() || activePoolId;
        if (!targetId || targetId.length < 4) return null;
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
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
            // Check for forceAdmin
            const forceAdmin = searchParams.get('forceAdmin') === 'true';
            if (forceAdmin) {
                setIsPreviewMode(false);
                setShowAdminView(true);
                localStorage.setItem('sbxpro_preview_mode', 'false');
            }

            loadPoolData(urlPoolId).then(() => {
                setIsInitialized(true);
                const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
                if (storedTokens[urlPoolId]) setAdminToken(storedTokens[urlPoolId]);
            });
        }
    }, [loadPoolData, setAdminToken, urlPoolId]);

    // Fallback to 'board' tab if not activated
    useEffect(() => {
        if (dataReady && !loadingPool && !isActivated && !isOwner && !demoMode) {
            setActiveTab('board');
        }
    }, [dataReady, loadingPool, isActivated, isOwner, demoMode]);

    useEffect(() => {
        // FIX: Do NOT overwrite guest draft with loaded pool data.
        // If we are viewing a specific poolId (saved board), we should not touch the local storage drafts.
        if (urlPoolId) return;

        if (!dataReady || loadingPool) return;
        localStorage.setItem('squares_game', JSON.stringify(game));
        localStorage.setItem('squares_board', JSON.stringify(board));
    }, [game, board, dataReady, loadingPool, urlPoolId]);

    // 6. Helpers
    const handleTogglePreview = (enabled: boolean) => {
        setIsPreviewMode(enabled);
        localStorage.setItem('sbxpro_preview_mode', String(enabled));
        if (enabled) setShowAdminView(false);
        else setShowAdminView(true);
    };

    const handleCloseShare = () => setShowShareModal(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
        if (activePoolId) delete storedTokens[activePoolId];
        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
        setAdminToken('');
        setHasEnteredApp(false);
        setActivePoolId(null);
        setIsInitialized(false);
        setShowAdminView(false);
        setIsPreviewMode(false);
        localStorage.removeItem('sbxpro_preview_mode');
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
        } catch (err) {
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

    const renderHeader = () => (
        <div className="flex-shrink-0 z-50 p-4 md:py-6">
            {(adminToken || isOwner) ? (
                /* Admin/Preview Header - Matches AdminPanel Style */
                <div className="premium-glass px-4 md:px-5 py-3 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-2xl border border-white/10 shadow-2xl mb-6">
                    {/* LEFT: Organizer Branding */}
                    <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group cursor-pointer">
                        <div className="w-9 h-9 rounded-xl bg-black/20 group-hover:bg-white/10 flex items-center justify-center shadow-md border border-white/10 hover:border-white/20 transition-all flex-shrink-0 overflow-hidden ring-1 ring-[#FFC72C]/50">
                            <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-gold transition-colors">Organizer</h3>
                            <p className="text-xs font-medium text-white/50 truncate group-hover:text-white/70 transition-colors">
                                {game.title || 'Untitled board'}
                            </p>
                        </div>
                    </Link>

                    {/* CENTER: Tabs (Preview Active) */}
                    <div className="hidden md:flex items-center bg-black/30 p-0.5 rounded-full border border-white/[0.08]">
                        <button
                            onClick={() => { setAdminStartTab('overview'); handleTogglePreview(false); }}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => { setAdminStartTab('edit'); handleTogglePreview(false); }}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                        >
                            Edit
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                        <button
                            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black shadow-sm transition-all"
                        >
                            Preview
                        </button>
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="flex items-center gap-3">
                        {/* Status pill - compact (Static Saved for Preview) */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[13px] font-semibold text-white/50">Saved</span>
                        </div>

                        {activePoolId && isActivated && (
                            <button onClick={() => setShowShareModal(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-white/20" title="Share Board">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </button>
                        )}
                        {/* Mobile: Simple Edit Button */}
                        <button onClick={() => handleTogglePreview(false)} className="md:hidden px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10 hover:bg-white hover:text-black transition-all">
                            Edit
                        </button>
                    </div>
                </div>
            ) : (
                /* Public Header (Original) */
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <a href="/dashboard" className="w-10 h-10 rounded-xl bg-black/20 hover:bg-white/10 flex items-center justify-center shadow-lg border border-white/10 hover:border-white/20 transition-all overflow-hidden cursor-pointer group ring-1 ring-[#FFC72C]/50">
                            <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                        </a>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold leading-none tracking-tight text-white mb-1">{game.title || 'Super Bowl LIX'}</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-white/60 font-medium">
                                    {game.leftAbbr} vs {game.topAbbr} • {game.dates || 'Feb 9, 2025'}
                                </span>
                                {isSynced && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Live Sync Active"></span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white/10 p-0.5 rounded-full border border-white/5">
                            <button onClick={() => setActiveTab('live')} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'live' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}>Live</button>
                            <button onClick={() => setActiveTab('board')} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'board' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}>Board</button>
                        </div>

                        {activePoolId && isActivated && (
                            <button onClick={() => setShowShareModal(true)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    const renderMainContent = (previewMode = false) => {
        const effectiveTab = previewMode ? 'live' : activeTab;
        const handleTabChange = previewMode ? undefined : setActiveTab;

        return (
            <div className="flex-1 relative overflow-hidden flex flex-col pb-6">
                <InfoCards.LiveStrip game={game} live={liveData} isSynced={isSynced} activeTab={effectiveTab} onTabChange={handleTabChange} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                    <div className="max-w-[960px] mx-auto px-4 md:px-6 py-6 space-y-6">
                        {effectiveTab === 'live' && (
                            <div className="relative">
                                {/* Blur Overlay for Players (!isPaid && !isOwner) */}
                                {!isPaid && !isOwner && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center animate-in fade-in duration-500">
                                        <LockedLiveView ownerId={ownerId} variant="overlay" />
                                    </div>
                                )}

                                <div className={`space-y-6 animate-in fade-in duration-300 ${(!isPaid && !isOwner) ? 'blur-xl select-none pointer-events-none opacity-40 transition-all duration-500' : ''}`}>
                                    {isOwner && !isPaid && (
                                        <div className="p-4 rounded-xl bg-gradient-to-r from-red-900/40 to-black border border-red-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-red-500/10 shrink-0"><svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-white">Group Access Locked</h3>
                                                    <p className="text-xs text-white/70">Your players cannot see live winners or scenarios. Pay $9.99 to activate live syncing for everyone.</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowAdminView(true)} className="w-full md:w-auto px-6 py-2.5 bg-[#9D2235] hover:bg-[#b0263b] rounded-lg text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all whitespace-nowrap">Pay $9.99 to Activate</button>
                                        </div>
                                    )}
                                    {liveStatus === 'NO MATCH FOUND' && (
                                        <div className="p-4 rounded-[20px] bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-4">
                                            <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-500">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            </div>
                                            <div><h4 className="text-sm font-semibold text-yellow-500 mb-1">Live scoring unavailable</h4><p className="text-xs text-yellow-500/80">Check your date and teams in settings.</p></div>
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
                                <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <button onClick={() => setShowFindSquaresModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[13px] font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white transition-all shrink-0">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><span className="hidden sm:inline">Find my squares</span>
                                        </button>
                                        {selectedPlayer && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 animate-in fade-in duration-200 min-w-0">
                                                <span className="text-xs font-medium text-white truncate">Showing: {selectedPlayer}</span>
                                                <button onClick={() => setSelectedPlayer('')} className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"><svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="hidden md:flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg border border-white/10">
                                        <button onClick={() => setBoardZoom('fit')} className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${boardZoom === 'fit' ? 'bg-white text-black' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>Fit</button>
                                        <button onClick={() => setBoardZoom('100')} className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${boardZoom === '100' ? 'bg-white text-black' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>100%</button>
                                    </div>
                                </div>

                                <div className={`relative bg-[#1c1c1e]/40 border border-white/[0.08] rounded-[16px] shadow-xl min-h-[500px] ${boardZoom === '100' ? 'overflow-auto' : 'overflow-hidden'}`}>
                                    <div className={`${boardZoom === '100' ? 'p-3' : 'absolute inset-0 overflow-hidden p-3 flex items-center justify-center'}`}>
                                        {isEmptyBoard ? (
                                            <div className="text-center max-w-sm mx-auto p-8 animate-in fade-in zoom-in duration-500">
                                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5"><svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></div>
                                                <h3 className="text-xl font-semibold text-white mb-2">Board is empty</h3>
                                                <p className="text-sm text-gray-500 mb-8 leading-relaxed">The organizer hasn't added names yet.</p>
                                            </div>
                                        ) : (
                                            <div className={`transition-transform duration-300 ${boardZoom === '100' ? 'min-w-[700px]' : 'w-full h-full'}`}>
                                                <BoardGrid board={board} highlights={highlights} live={liveData} selectedPlayer={selectedPlayer} highlightedCoords={highlightedCoords} leftTeamName={game.leftName || game.leftAbbr} topTeamName={game.topName || game.topAbbr} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // 7. Render
    return (
        <div className="h-screen w-full bg-[#050505] overflow-hidden flex flex-col font-sans text-white">
            {/* Modal Wrappers */}

            {showRecoveryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
                        <form onSubmit={handleRecoverySubmit} className="space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Recover Board ID</h3>
                                <button type="button" onClick={() => setShowRecoveryModal(false)} className="text-gray-400 hover:text-white">&times;</button>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-tight">Enter the email you used during setup.</p>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Email Address</label>
                                <input autoFocus type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none" />
                            </div>
                            <button type="submit" disabled={isRecovering} className="w-full btn-secondary py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50">
                                {isRecovering ? 'Sending...' : 'Send Recovery Email'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showJoinModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
                        <form onSubmit={(e) => { e.preventDefault(); handleJoinSubmit(joinInput); }} className="space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Join Game</h3>
                                <button type="button" onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white">&times;</button>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">Enter the Game Code shared by your Commissioner.</p>
                            <input autoFocus type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Game Code"
                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none font-mono uppercase" />
                            <button type="submit" disabled={isJoining} className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50">
                                {isJoining ? 'Verifying...' : (knownAdminToken ? 'Enter Commissioner Hub' : 'Enter Stadium')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Wizard Modal */}
            <WizardModal
                isOpen={showWizardModal}
                onClose={() => setShowWizardModal(false)}
                game={game}
                setGame={setGame}
                board={board}
                setBoard={setBoard}
                onPublish={handlePublish}
                API_URL={API_URL}
                onSuccess={(newId) => {
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

            {showShareModal && (() => {
                const shareUrl = activePoolId ? `${window.location.origin}/?poolId=${activePoolId}` : window.location.href;
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="premium-glass w-full max-w-sm p-6 text-center flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                            <h2 className="text-lg font-semibold text-white tracking-tight">Access Link</h2>
                            <div className="bg-white p-4 rounded-xl shadow-lg"><QRCodeSVG value={shareUrl} size={160} /></div>
                            <div className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center gap-3 w-full">
                                <div className="flex-1 text-xs font-mono text-gray-400 truncate text-left">{shareUrl}</div>
                                <button onClick={handleCopyLink} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white transition-colors">{copyFeedback ? 'Copied' : 'Copy'}</button>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-tight px-4">
                                <span className="font-bold text-white/60">Note:</span> This link gives <span className="text-white/60">read-only access</span> to others. You see edit controls because you are the owner.
                            </p>
                            <button onClick={handleCloseShare} className="w-full btn-secondary text-sm">Close</button>
                        </div>
                    </div>
                );
            })()}

            {loadingPool && urlPoolId && <FullScreenLoading />}

            {!loadingPool && showLanding ? (
                <LandingPage onCreate={openSetupWizard} onDemo={() => navigate('/demo')} onLogin={() => navigate('/login')} />
            ) : !loadingPool && (
                <>
                    <div className="flex-1 flex flex-col relative z-50 w-full max-w-6xl mx-auto md:px-6 h-full">
                        {renderHeader()}

                        {renderMainContent()}
                    </div>
                </>
            )}

            {showFindSquaresModal && (
                <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFindSquaresModal(false)} />
                    <div className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-[#1c1c1e] border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Find my squares</h3>
                                <button onClick={() => setShowFindSquaresModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors"><svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <PlayerFilter board={board} setSelected={(player) => { setSelectedPlayer(player); setShowFindSquaresModal(false); }} selected={selectedPlayer} />
                            {selectedPlayer && <button onClick={() => { setSelectedPlayer(''); setShowFindSquaresModal(false); }} className="w-full mt-4 py-2 text-sm font-medium text-white/50 hover:text-white transition-colors">Clear selection</button>}
                        </div>
                    </div>
                </div>
            )}

            {showPayoutsModal && (
                <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayoutsModal(false)} />
                    <div className="relative w-full max-w-lg mx-4 mb-0 md:mb-0 max-h-[80vh] overflow-y-auto bg-[#1c1c1e] border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                        <div className="sticky top-0 z-10 bg-[#1c1c1e] p-4 border-b border-white/[0.06] flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Payouts</h3>
                            <button onClick={() => setShowPayoutsModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors"><svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-4"><InfoCards.PayoutsAccordion liveStatus={liveStatus} lastUpdated={lastUpdated} highlights={highlights} board={board} live={liveData} game={game} /></div>
                    </div>
                </div>
            )}

            {isCommissionerMode && (
                <div className="fixed inset-0 z-[80] bg-[#050101] p-0 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300 scrollbar-hide">
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
                            onClose={() => handleTogglePreview(true)}
                            onLogout={handleLogout}
                            onPreview={() => handleTogglePreview(true)}
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
