
import React, { useState, useEffect, useCallback, useMemo, useRef, ErrorInfo, ReactNode, Component, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { GameState, BoardData, LiveGameData, WinnerHighlights } from '../types';
import { SAMPLE_BOARD, TEAM_THEMES, NFL_TEAMS } from '../constants';
// Lazy load heavy components for better bundle splitting
const AdminPanel = lazy(() => import('./AdminPanel'));
import BoardGrid from './BoardGrid';
import InfoCards from './InfoCards';
import ScenarioPanel from './ScenarioPanel';
import LockedLiveView from './LockedLiveView';
import PlayerFilter from './PlayerFilter';
import LandingPage from './LandingPage';
// Lazy load Gemini service - only needed for image scanning
const loadGeminiService = () => import('../services/geminiService');
// Phase 2 Architecture: Custom Hooks
// Phase 2 Architecture: Custom Hooks
import { usePoolData, INITIAL_GAME, EMPTY_BOARD } from '../hooks/usePoolData';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { useAuth } from '../hooks/useAuth';
import { getContrastYIQ, ensureMinLuminance, hexToRgb } from '../utils/theme';
import { compressImage } from '../utils/image';

// Basic error boundary component
import ErrorBoundary from './ErrorBoundary';
import FullScreenLoading from './loading/FullScreenLoading';

const API_URL = `${window.location.origin}/api/pools`;
const LIVE_PROXY_URL = import.meta.env.VITE_LIVE_PROXY_URL || 'https://wandering-flower-f1de.anthony-mora13.workers.dev';


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
    // Map quarter to axis key (Final uses Q4)
    const qKey = (quarter === 'Final' ? 'Q4' : quarter) as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    const axes = side === 'left' ? board.bearsAxisByQuarter : board.oppAxisByQuarter;
    return axes?.[qKey] || (side === 'left' ? board.bearsAxis : board.oppAxis);
};

const normalizeAbbr = (abbr: string | undefined): string => {
    if (!abbr) return '';
    const a = abbr.toUpperCase().trim();
    if (a === 'WAS' || a === 'WSH') return 'WAS_WSH_ALIAS';
    if (a === 'LAR' || a === 'LA') return 'LAR_LA_ALIAS';
    return a;
};

const BoardViewContent: React.FC<{ demoMode?: boolean }> = ({ demoMode = false }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPoolId = searchParams.get('poolId');

    // ===== PHASE 2: Custom Hooks =====
    const navigate = useNavigate();

    // Pool data hook (replaces game, board, activePoolId, loadingPool, dataReady, poolError)
    const poolData = usePoolData();
    const {
        game, setGame,
        board, setBoard,
        activePoolId, setActivePoolId,
        ownerId,
        loadingPool,
        dataReady,
        error: poolError,
        loadPoolData,
        publishPool,
        updatePool,
        clearError: clearPoolError,
        isActivated,
        isPaid
    } = poolData;

    // Live scoring hook (replaces liveData, liveStatus, isSynced, isRefreshing, lastUpdated)
    const liveScoring = useLiveScoring(game, dataReady, loadingPool);
    const {
        liveData,
        liveStatus,
        isSynced,
        isRefreshing,
        lastUpdated,
        fetchLive
    } = liveScoring;

    // Auth hook (replaces adminToken state)
    const auth = useAuth();
    const {
        adminToken,
        setAdminToken,
        verifyToken,
        login: authLogin,
        logout: authLogout,
        isLoggingIn: authIsLoggingIn,
        authError
    } = auth;

    // ===== UI State (kept local) =====
    // Legacy auth modal removed - using Supabase auth + owner detection
    const [showShareModal, setShowShareModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [showAdminView, setShowAdminView] = useState(false); // Restored
    const [showRecoveryModal, setShowRecoveryModal] = useState(false); // New
    const [showFindSquaresModal, setShowFindSquaresModal] = useState(false);
    const [showPayoutsModal, setShowPayoutsModal] = useState(false);

    const [copyFeedback, setCopyFeedback] = useState(false);
    const [authInput, setAuthInput] = useState('');
    const [authIdInput, setAuthIdInput] = useState(''); // New: For Board ID in login
    const [joinInput, setJoinInput] = useState('');
    const [recoveryEmail, setRecoveryEmail] = useState(''); // New: For recovery
    const [activeTab, setActiveTab] = useState<'live' | 'board'>('board');
    const [boardZoom, setBoardZoom] = useState<'fit' | '100'>('fit');
    const [hasEnteredApp, setHasEnteredApp] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    // Legacy login modal removed - now navigates directly to /login
    const [isRecovering, setIsRecovering] = useState(false); // New state for recovery

    const [wizardStep, setWizardStep] = useState(1);
    const [wizardPassword, setWizardPassword] = useState('');
    const [wizardEmail, setWizardEmail] = useState(''); // New State
    const [isCreating, setIsCreating] = useState(false); // Restored
    const [wizardSuccess, setWizardSuccess] = useState(false); // Restored
    const [wizardMode, setWizardMode] = useState<'blank' | 'mock'>('blank');
    const [setupStep, setSetupStep] = useState(1); // 1: Name/Pass, 2: Teams, 3: Mode
    const [wizardError, setWizardError] = useState<string | null>(null);
    const wizardFileRef = useRef<HTMLInputElement>(null);

    // Preview Mode State (Persisted)
    const [isPreviewMode, setIsPreviewMode] = useState(() => {
        return localStorage.getItem('sbxpro_preview_mode') === 'true';
    });

    const handleTogglePreview = (enabled: boolean) => {
        setIsPreviewMode(enabled);
        localStorage.setItem('sbxpro_preview_mode', String(enabled));
        // If enabling preview, hide the admin view immediately
        if (enabled) {
            setShowAdminView(false);
        } else {
            setShowAdminView(true);
        }
    };

    // Remaining local state
    const [selectedPlayer, setSelectedPlayer] = useState<string>('');
    const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    // Don't show landing if: loading pool data, have a URL poolId, already in app, initialized, or just finished wizard
    // In demo mode, we always bypass landing
    const showLanding = !demoMode && !activePoolId && !urlPoolId && !loadingPool && !hasEnteredApp && !isInitialized && !wizardSuccess;
    // Commissioner Mode gated by Preview Mode
    const isOwner = auth.user && ownerId && auth.user.id === ownerId;
    const isCommissionerMode = (showAdminView && !!adminToken && !isPreviewMode) || (isOwner && !isPreviewMode);

    // Auto-show admin view for owner
    useEffect(() => {
        if (isOwner) setShowAdminView(true);
    }, [isOwner]);

    // Initialize Demo Mode
    useEffect(() => {
        if (demoMode) {
            setBoard(SAMPLE_BOARD);
            setGame({
                ...INITIAL_GAME,
                title: 'Demo: Super Bowl LIX',
                leftAbbr: 'KC',
                topAbbr: 'SF',
            });
            setIsInitialized(true);
            setHasEnteredApp(true);
            setActiveTab('board');
        }
    }, [demoMode, setBoard, setGame]);

    const knownAdminToken = useMemo(() => {
        const targetId = joinInput.trim().toUpperCase() || activePoolId;
        if (!targetId || targetId.length < 4) return null;
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
        return storedTokens[targetId] || null;
    }, [joinInput, activePoolId]);

    useEffect(() => {
        // Phase 3: Team Themes now only apply to specific accents, not global variables.
        // We removed the global root styling override here to preserve the "Apple-clean" dark theme.
    }, [game.leftAbbr, game.topAbbr]);

    // Load pool data using hook when URL has poolId
    useEffect(() => {
        const currentParams = new URLSearchParams(window.location.search);
        const poolId = currentParams.get('poolId');

        if (poolId) {
            loadPoolData(poolId).then(() => {
                setIsInitialized(true);
                // Restore admin token from local storage
                const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
                if (storedTokens[poolId]) {
                    setAdminToken(storedTokens[poolId]);
                }
            });
        }
    }, [loadPoolData, setAdminToken]);

    useEffect(() => {
        if (!dataReady || loadingPool) return;
        localStorage.setItem('squares_game', JSON.stringify(game));
        localStorage.setItem('squares_board', JSON.stringify(board));
    }, [game, board, dataReady, loadingPool]);

    // fetchLive and its polling useEffect are now handled by useLiveScoring hook

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

    const currentLiveWinner = useMemo(() => {
        if (!liveData) return null;
        const topDigit = liveData.topScore % 10;
        const leftDigit = liveData.leftScore % 10;

        // For dynamic boards, determine current quarter for axis lookup
        const currentQuarter = liveData.state === 'post' ? 'Final' :
            liveData.period <= 1 ? 'Q1' :
                liveData.period === 2 ? 'Q2' :
                    liveData.period === 3 ? 'Q3' : 'Q4';

        // Use quarter-specific axes for dynamic boards
        const topAxis = getAxisForQuarter(board, 'top', currentQuarter);
        const leftAxis = getAxisForQuarter(board, 'left', currentQuarter);

        const colIdx = topAxis.indexOf(topDigit);
        const rowIdx = leftAxis.indexOf(leftDigit);
        const owners = (colIdx !== -1 && rowIdx !== -1) ? (board.squares[rowIdx * 10 + colIdx] || []) : [];
        return { key: `${topDigit}-${leftDigit}`, owners, state: liveData.state, quarter: currentQuarter };
    }, [liveData, board]);



    const handleJoinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinInput) return;
        const targetId = joinInput.trim().toUpperCase();
        setIsJoining(true);
        try {
            const res = await fetch(`${API_URL}/${targetId}`);
            if (!res.ok) throw new Error("League Code not found in stadium databases.");
            const result = await res.json();
            const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('poolId', targetId);

            if (storedTokens[targetId]) {
                // Security: We load it into state but don't force auto-login to Hub
                // Subsequent server actions will verify if this token is actually correct.
                setAdminToken(storedTokens[targetId]);
            }
            window.location.href = newUrl.toString();
        } catch (err: any) {
            alert(err.message || "Verification Failed");
        } finally {
            setIsJoining(false);
        }
    };

    const handleTeamChange = (side: 'left' | 'top', abbr: string) => {
        const team = NFL_TEAMS.find(t => t.abbr === abbr);
        if (!team) return;
        setGame(prev => ({
            ...prev,
            [`${side}Abbr`]: team.abbr,
            [`${side}Name`]: team.name
        }));
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const handleCloseShare = () => {
        setShowShareModal(false);
    };

    const handlePublish = async (token: string, currentData?: { game: GameState, board: BoardData, adminEmail?: string }) => {
        try {
            const g = currentData?.game || game;
            const b = currentData?.board || board;

            const currentUser = auth.user;

            // CASE 1: UPDATE EXISTING POOL
            if (activePoolId) {
                // If Owner -> Use Supabase Client (RLS)
                if (isOwner) {
                    const success = await updatePool(activePoolId, { game: g, board: b }, token); // Pass token just in case, though likely unused by RLS
                    if (!success) throw new Error("Failed to save changes to Supabase");
                    console.log("Changes saved to Supabase successfully");
                    return activePoolId;
                }

                // If NOT Owner (Legacy Admin with Password) -> Use API Endpoint
                // This preserves ability for shared-password admins to update specific fields if API allows
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                const payload = {
                    game: { ...g, title: g.title || "SBXPRO Pool", coverImage: g.coverImage || "" },
                    board: b,
                    adminEmail: currentData?.adminEmail
                };
                const res = await fetch(`${API_URL}/${activePoolId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
                        if (activePoolId) delete storedTokens[activePoolId];
                        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
                        setAdminToken('');
                        setShowAdminView(false);
                        throw new Error('Unauthorized: Admin Password Incorrect or Expired.');
                    }
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.message || `Server Error: ${res.status}`);
                }
                const result = await res.json();
                return activePoolId;
            }

            // CASE 2: CREATE NEW POOL
            else {
                // If Logged In -> Create via Supabase
                if (currentUser) {
                    // We use the hook's publishPool which inserts directly
                    const newId = await publishPool(token, { game: g, board: b });
                    if (!newId) throw new Error("Creation failed");

                    // Update URL
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('poolId', newId);
                    window.history.pushState({ poolId: newId }, '', newUrl.toString());

                    return newId;
                }

                // If Guest -> Save to LocalStorage and Redirect
                else {
                    console.log("Guest Creation detected. Saving to local storage and redirecting...");

                    // We save the PASSWORD (token) into the game settings temporarily so it persists after migration
                    // The migration logic will need to hash this or set it up.
                    const guestGameStr = JSON.stringify({ ...g, adminPasscode: token });
                    localStorage.setItem('sbxpro_guest_game', guestGameStr);
                    localStorage.setItem('sbxpro_guest_board', JSON.stringify(b));

                    // Force redirect to login page with signup mode
                    // We throw a specific error to stop the Wizard from showing "Success" state prematurely
                    navigate('/login?mode=signup');
                    // We return void here, but the UI might expect a promise. 
                    // Throwing an error "Redirecting..." is a way to halt execution if needed, 
                    // but cleaner is to return nothing/null if signature allows.
                    // The signature returns string | void.
                    return;
                }
            }
        } catch (err: any) {
            const msg = err.name === 'AbortError' ? "Server timeout. Cloudflare response was delayed." : (err.message || "Unknown Network Error");
            console.error("Publish Failed:", err);
            // Don't alert if we are just redirecting?
            // But we might have thrown above.
            if (msg !== 'Redirecting...') {
                alert(`Publish Failed: ${msg}`);
            }
            throw err;
        }
    };

    const handleWizardInitialize = async (manualBoard?: BoardData, manualCover?: string) => {
        setWizardError(null);
        setIsCreating(true);
        try {
            const leagueTitle = game.title?.trim();
            const pass = wizardPassword?.trim();
            if (!leagueTitle || !pass) throw new Error("League Name and Password are required.");

            const targetBoard = manualBoard || board;
            const targetCover = manualCover !== undefined ? manualCover : (game.coverImage || '');

            // Pass wizardEmail to handlePublish
            const newId = await handlePublish(pass, {
                game: { ...game, title: leagueTitle, coverImage: targetCover },
                board: targetBoard,
                adminEmail: wizardEmail  // Added
            });
            if (!newId) throw new Error("Game initialization failed to assign a unique ID.");

            setBoard(targetBoard);
            setGame(prev => ({ ...prev, title: leagueTitle, coverImage: targetCover }));
            setWizardSuccess(true);
            setIsInitialized(true);
            setIsPreviewMode(false); // Force Edit Mode
            setShowAdminView(true); // Open Admin Panel
            setActiveTab('board');

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('poolId', newId);
            window.history.replaceState({ poolId: newId }, '', newUrl.toString());

            setTimeout(() => {
                setHasEnteredApp(true);
                setShowWizardModal(false);
                setShowShareModal(true);
            }, 1800);
        } catch (e: any) {
            setWizardError(e.message || "Initialization failed. Please check your connection and try again.");
            setIsCreating(false);
        } finally {
            setIsCreating(false);
        }
    };

    const handleLogout = async () => {
        // Sign out of Supabase auth
        await supabase.auth.signOut();

        // Clear legacy admin tokens
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
        if (activePoolId) delete storedTokens[activePoolId];
        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
        setAdminToken('');
        setHasEnteredApp(false);
        setActivePoolId(null);
        setIsInitialized(false);
        setShowAdminView(false);

        // Reset preview mode
        setIsPreviewMode(false);
        localStorage.removeItem('sbxpro_preview_mode');

        // Reset wizard
        setWizardSuccess(false);

        setBoard(SAMPLE_BOARD);

        // Navigate to landing page
        navigate('/');
    };

    const handleCommissionerLogin = () => {
        navigate('/login');
    };

    const handleStep1Next = async () => {
        if (!game.title || !wizardPassword) return;

        setWizardError(null);

        try {
            const res = await fetch(`${API_URL}/check-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueName: game.title })
            });

            const result = await res.json();

            if (!result.available) {
                setWizardError(`A league named "${game.title}" already exists. Please choose a different name.`);
                return;
            }

            // Name is available, proceed to step 2
            setWizardStep(2);

        } catch (err: any) {
            console.error('Name check failed:', err);
            // If check fails, still proceed (backend will catch duplicates)
            setWizardStep(2);
        }
    };

    const openSetupWizard = () => {
        navigate('/create');
    };

    const isEmptyBoard = !board.squares.some(s => s.length > 0);

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

    // Legacy handleAuthSubmit removed - using Supabase auth + owner detection

    return (
        <div className="h-screen w-full bg-[#050505] overflow-hidden flex flex-col font-sans text-white">
            {/* ... (Keep Modal Wrappers) ... */}
            {/* Legacy Commissioner Access modal removed - using Supabase auth + owner detection */}

            {showRecoveryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
                        <form onSubmit={handleRecoverySubmit} className="space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Recover Board ID</h3>
                                <button type="button" onClick={() => setShowRecoveryModal(false)} className="text-gray-400 hover:text-white">&times;</button>
                            </div>

                            <p className="text-[11px] text-gray-400 leading-tight">Enter the email you used during setup. We will send you a list of your Board IDs.</p>

                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Email Address</label>
                                <input autoFocus type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="commissioner@example.com"
                                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none transition-colors" />
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
                        <form onSubmit={handleJoinSubmit} className="space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Join Game</h3>
                                <button type="button" onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white">&times;</button>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">Enter the Game Code shared by your Commissioner.</p>
                            <input autoFocus type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Game Code (e.g. A7X9...)"
                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none transition-colors font-mono uppercase" />
                            <button type="submit" disabled={isRefreshing} className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {isRefreshing ? 'Verifying...' : (knownAdminToken ? 'Enter Commissioner Hub' : 'Enter Stadium')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Legacy login modal removed - navigates directly to /login */}

            {showWizardModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="premium-glass w-full max-w-md overflow-hidden flex flex-col animate-in scale-95 duration-300">
                        <div className="p-6 border-b border-white/5">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-white tracking-tight">Board Setup</h2>
                                {!wizardSuccess && <button onClick={() => setShowWizardModal(false)} className="text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide">Cancel</button>}
                            </div>
                            <div className="flex gap-2 mt-6">
                                {[1, 2, 3].map(step => (
                                    <div key={step} className={`h-1 flex-1 rounded-full transition-all duration-500 ${wizardStep >= step ? 'bg-white' : 'bg-white/10'}`}></div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
                            {wizardSuccess ? (
                                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-500 text-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Ready to Launch</h3>
                                    <p className="text-sm text-gray-400">Taking you to your board...</p>
                                </div>
                            ) : wizardError ? (
                                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300 text-center">
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-semibold text-white">Setup Issue</h3>
                                    <p className="text-sm text-gray-400 max-w-xs">{wizardError}</p>
                                    <button onClick={() => setWizardError(null)} className="btn-secondary text-sm">Dismiss</button>
                                </div>
                            ) : (
                                <>
                                    {wizardStep === 1 && (
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
                                                    <input autoFocus type="email" value={wizardEmail} onChange={(e) => setWizardEmail(e.target.value)}
                                                        className="w-full glass-input" placeholder="commissioner@example.com" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-label">Organizer Passcode</label>
                                                    <input type="password" value={wizardPassword} onChange={(e) => setWizardPassword(e.target.value)}
                                                        className="w-full glass-input" placeholder="Create a secure passcode" />
                                                </div>
                                                <div className="pt-6">
                                                    <button disabled={!wizardPassword || !game.title || !wizardEmail.includes('@')} onClick={handleStep1Next}
                                                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {wizardStep === 2 && (
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
                                                <button onClick={() => setWizardStep(1)} className="btn-secondary">Back</button>
                                                <button onClick={() => setWizardStep(3)} className="flex-1 btn-primary">Continue</button>
                                            </div>
                                        </div>
                                    )}
                                    {wizardStep === 3 && (
                                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                            <h3 className="text-lg font-medium text-white mb-2">Bring your board</h3>
                                            <p className="text-sm text-gray-400">Upload a photo or screenshot. We’ll turn it into an editable grid.</p>

                                            <div onClick={() => wizardFileRef.current?.click()} className="border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer h-[180px] relative overflow-hidden group transition-all hover:bg-white/5 hover:border-white/30">
                                                <input type="file" ref={wizardFileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        // Reset state for new attempt
                                                        setWizardError(null);
                                                        setIsCreating(true);
                                                        const reader = new FileReader();
                                                        reader.onload = async (ev) => {
                                                            try {
                                                                const rawBase64 = ev.target!.result as string;
                                                                const compressed = await compressImage(rawBase64);
                                                                setGame(p => ({ ...p, coverImage: compressed }));
                                                                const { parseBoardImage } = await loadGeminiService();
                                                                const scannedBoard = await parseBoardImage(compressed);
                                                                setBoard(scannedBoard);
                                                            } catch (err: any) {
                                                                console.warn("Scan failed", err);
                                                                setWizardError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
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
                                                            setWizardError("Please upload an image to scan.");
                                                            return;
                                                        }
                                                        handleWizardInitialize();
                                                    }}
                                                    disabled={isCreating}
                                                    className={`w-full btn-primary flex items-center justify-center gap-2 ${!game.coverImage ? 'opacity-50' : ''}`}
                                                >
                                                    {isCreating ? "Processing..." : "Launch Board"}
                                                </button>

                                                {!isCreating && (
                                                    <button onClick={(e) => { e.preventDefault(); handleWizardInitialize(EMPTY_BOARD, ''); }} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
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
            )
            }

            {
                showShareModal && (() => {
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
                })()
            }

            {/* Loading screen when pool data is being fetched */}
            {loadingPool && urlPoolId && <FullScreenLoading />}

            {!loadingPool && showLanding ? (
                <LandingPage onCreate={openSetupWizard} onDemo={() => navigate('/demo')} onLogin={handleCommissionerLogin} />
            ) : !loadingPool && (
                <>
                    <div className="flex-1 flex flex-col relative z-50 w-full max-w-6xl mx-auto md:px-6 h-full">
                        {/* Header / Nav */}
                        <div className="flex-shrink-0 flex items-center justify-between p-4 md:py-6 bg-transparent z-50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shadow-lg border border-white/10 overflow-hidden">
                                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover" />
                                </div>
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
                                {activePoolId && isActivated && (
                                    <button onClick={() => setShowShareModal(true)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    </button>
                                )}

                                {(adminToken || isOwner) ? (
                                    <div className="flex items-center gap-3">
                                        {isPreviewMode && (
                                            <span className="hidden md:inline text-[10px] uppercase font-bold text-gray-500 animate-in fade-in transition-colors">Preview Mode</span>
                                        )}
                                        <div className="flex items-center bg-white/10 p-1 rounded-full border border-white/5 backdrop-blur-md">
                                            <button
                                                onClick={() => handleTogglePreview(false)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${!isPreviewMode ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleTogglePreview(true)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${isPreviewMode ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'
                                                    }`}
                                            >
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Main Content Area - Single Column Focused Layout */}
                        <div className="flex-1 relative overflow-hidden flex flex-col pb-6">

                            {/* Live Strip - Always visible, with integrated toggle */}
                            <InfoCards.LiveStrip
                                game={game}
                                live={liveData}
                                isSynced={isSynced}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            {/* Content Container - Centered max width */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                                <div className="max-w-[960px] mx-auto px-4 md:px-6 py-6 space-y-6">

                                    {/* Live Tab Content */}
                                    {activeTab === 'live' && (
                                        (!isPaid && !isOwner) ? (
                                            <LockedLiveView ownerId={ownerId} />
                                        ) : (
                                            <div className="space-y-6 animate-in fade-in duration-300">

                                                {/* Organizer Banner */}
                                                {isOwner && !isPaid && (
                                                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-900/40 to-black border border-red-500/30 flex items-center justify-between shadow-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-full bg-red-500/10">
                                                                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                            </div>
                                                            <p className="text-sm font-bold text-white">Your group cannot see live winners yet.</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setShowAdminView(true)}
                                                            className="px-4 py-2 bg-[#9D2235] hover:bg-[#b0263b] rounded-lg text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all"
                                                        >
                                                            Activate Now
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Warning if no match */}
                                                {liveStatus === 'NO MATCH FOUND' && (
                                                    <div className="p-4 rounded-[20px] bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-4">
                                                        <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-500">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-yellow-500 mb-1">Live scoring unavailable</h4>
                                                            <p className="text-xs text-yellow-500/80">Check your date and teams in settings.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Hero: Winning Now */}
                                                <InfoCards.WinningNowHero game={game} board={board} live={liveData} highlights={highlights} />

                                                {/* Next Score Scenarios - Side by side on large screens */}
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <ScenarioPanel.LeftScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                                    <ScenarioPanel.TopScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                                                </div>
                                            </div>
                                        )
                                    )}

                                    {/* Board Tab Content */}
                                    {activeTab === 'board' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            {/* Sticky Top Controls */}
                                            <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
                                                {/* Left: Search + Selected chip */}
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

                                                    {/* Selected player chip */}
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

                                                {/* Right: Zoom controls */}
                                                <div className="hidden md:flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg border border-white/10">
                                                    <button
                                                        onClick={() => setBoardZoom('fit')}
                                                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${boardZoom === 'fit'
                                                            ? 'bg-white text-black'
                                                            : 'text-white/60 hover:text-white hover:bg-white/10'
                                                            }`}
                                                    >
                                                        Fit
                                                    </button>
                                                    <button
                                                        onClick={() => setBoardZoom('100')}
                                                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${boardZoom === '100'
                                                            ? 'bg-white text-black'
                                                            : 'text-white/60 hover:text-white hover:bg-white/10'
                                                            }`}
                                                    >
                                                        100%
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Board Grid Container */}
                                            <div className={`relative bg-[#1c1c1e]/40 border border-white/[0.08] rounded-[16px] shadow-xl min-h-[500px] ${boardZoom === '100' ? 'overflow-auto' : 'overflow-hidden'}`}>
                                                <div className={`${boardZoom === '100' ? 'p-3' : 'absolute inset-0 overflow-hidden p-3 flex items-center justify-center'}`}>
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
                                                        <div className={`transition-transform duration-300 ${boardZoom === '100' ? 'min-w-[700px]' : 'w-full h-full'}`}>
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
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Tab Bar - Cleaner */}
                            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex p-1 bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                                <button
                                    onClick={() => setActiveTab('live')}
                                    className={`px-6 py-2.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'live' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Live
                                </button>
                                <button
                                    onClick={() => setActiveTab('board')}
                                    className={`px-6 py-2.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'board' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
                                >
                                    Board
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Find Squares Modal */}
            {showFindSquaresModal && (
                <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowFindSquaresModal(false)}
                    />
                    {/* Modal content */}
                    <div className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-[#1c1c1e] border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Find my squares</h3>
                                <button
                                    onClick={() => setShowFindSquaresModal(false)}
                                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <PlayerFilter board={board} setSelected={(player) => {
                                setSelectedPlayer(player);
                                setShowFindSquaresModal(false);
                            }} selected={selectedPlayer} />
                            {selectedPlayer && (
                                <button
                                    onClick={() => {
                                        setSelectedPlayer('');
                                        setShowFindSquaresModal(false);
                                    }}
                                    className="w-full mt-4 py-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
                                >
                                    Clear selection
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Payouts Modal */}
            {showPayoutsModal && (
                <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowPayoutsModal(false)}
                    />
                    {/* Modal content */}
                    <div className="relative w-full max-w-lg mx-4 mb-0 md:mb-0 max-h-[80vh] overflow-y-auto bg-[#1c1c1e] border border-white/10 rounded-t-[24px] md:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                        <div className="sticky top-0 z-10 bg-[#1c1c1e] p-4 border-b border-white/[0.06] flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Payouts</h3>
                            <button
                                onClick={() => setShowPayoutsModal(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <InfoCards.PayoutsAccordion
                                liveStatus={liveStatus}
                                lastUpdated={lastUpdated}
                                highlights={highlights}
                                board={board}
                                live={liveData}
                                game={game}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Commissioner Overlay */}
            {isCommissionerMode && (
                <div className="fixed inset-0 z-[80] bg-[#050101] p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
                    <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Loading Organizer...</div>}>
                        <AdminPanel
                            game={game}
                            board={board}
                            adminToken={adminToken || ''}
                            activePoolId={activePoolId || ''}
                            liveData={liveData}
                            onApply={(g, b) => { setGame(g); setBoard(b); }}
                            onPublish={handlePublish}
                            onClose={() => handleTogglePreview(true)}
                            onLogout={handleLogout}
                            onPreview={() => handleTogglePreview(true)}
                            isActivated={isActivated}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};

// Use BoardView name directly
const BoardView: React.FC<{ demoMode?: boolean }> = ({ demoMode }) => {
    return (
        <ErrorBoundary>
            <BoardViewContent demoMode={demoMode} />
        </ErrorBoundary>
    );
};

export default BoardView;
