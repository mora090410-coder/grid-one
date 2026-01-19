
import os

content = r'''
import React, { useState, useEffect, useCallback, useMemo, useRef, ErrorInfo, ReactNode, Component, Suspense, lazy } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { GameState, BoardData, LiveGameData, WinnerHighlights } from './types';
import { SAMPLE_BOARD, TEAM_THEMES, NFL_TEAMS } from './constants';
// Lazy load heavy components for better bundle splitting
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import BoardGrid from './components/BoardGrid';
import InfoCards from './components/InfoCards';
import ScenarioPanel from './components/ScenarioPanel';
import PlayerFilter from './components/PlayerFilter';
import LandingPage from './components/LandingPage';
// Lazy load Gemini service - only needed for image scanning
const loadGeminiService = () => import('./services/geminiService');
// Phase 2 Architecture: Custom Hooks
import { usePoolData, INITIAL_GAME, EMPTY_BOARD } from './hooks/usePoolData';
import { useLiveScoring } from './hooks/useLiveScoring';
import { useAuth } from './hooks/useAuth';

// Basic error boundary component
import ErrorBoundary from './components/ErrorBoundary';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// INITIAL_GAME and EMPTY_BOARD are now imported from hooks/usePoolData

async function compressImage(base64Str: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

export const getContrastYIQ = (hex: string): 'black' | 'white' => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? 'black' : 'white';
};

const ensureMinLuminance = (hex: string, minLum: number = 0.6): string => {
  const cleanHex = hex.replace('#', '');
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  // Simple relative luminance
  const getLum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  let lum = getLum(r, g, b);
  let loopCount = 0;

  // Brighten loop
  while (lum < minLum && loopCount < 20) {
    r = Math.min(255, r + 15);
    g = Math.min(255, g + 15);
    b = Math.min(255, b + 15);
    lum = getLum(r, g, b);
    loopCount++;
  }

  return `rgb(${r}, ${g}, ${b})`;
};


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

const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const AppContent: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const urlPoolId = searchParams.get('poolId');

  // ===== PHASE 2: Custom Hooks =====
  // Pool data hook (replaces game, board, activePoolId, loadingPool, dataReady, poolError)
  const poolData = usePoolData();
  const {
    game, setGame,
    board, setBoard,
    activePoolId, setActivePoolId,
    loadingPool,
    dataReady,
    error: poolError,
    loadPoolData,
    publishPool,
    updatePool,
    clearError: clearPoolError
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showAdminView, setShowAdminView] = useState(false); // Restored
  const [showRecoveryModal, setShowRecoveryModal] = useState(false); // New

  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [authIdInput, setAuthIdInput] = useState(''); // New: For Board ID in login
  const [joinInput, setJoinInput] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState(''); // New: For recovery
  const [activeTab, setActiveTab] = useState<'live' | 'board'>('live');
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginLeagueName, setLoginLeagueName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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

  const showLanding = !activePoolId && !hasEnteredApp && !isInitialized && !wizardSuccess;
  // Commissioner Mode gated by Preview Mode
  const isCommissionerMode = showAdminView && !!adminToken && !isPreviewMode;

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const g = currentData?.game || game;
      const b = currentData?.board || board;
      const payload = {
        game: { ...g, title: g.title || "SBXPRO Pool", coverImage: g.coverImage || "" },
        board: b,
        adminEmail: currentData?.adminEmail
      };
      const method = activePoolId ? 'PUT' : 'POST';
      const url = activePoolId ? `${API_URL}/${activePoolId}` : API_URL;
      const res = await fetch(url, {
        method,
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
          throw new Error('Unauthorized: Admin Session Expired. Please log in again.');
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server Error: ${res.status}`);
      }
      const result = await res.json();
      const newPoolId = activePoolId || result.poolId;
      if (!newPoolId) throw new Error("Pool ID was not returned by server.");
      const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
      storedTokens[newPoolId] = token;
      localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));
      setActivePoolId(newPoolId);
      setAdminToken(token);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('poolId', newPoolId);
      window.history.pushState({ poolId: newPoolId }, '', newUrl.toString());
      return newPoolId;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = err.name === 'AbortError' ? "Server timeout. Cloudflare response was delayed." : (err.message || "Unknown Network Error");
      console.error("Publish Failed:", err);
      alert(`Publish Failed: ${msg}`);
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

  const handleLogout = () => {
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
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('poolId');
    window.history.pushState({}, '', newUrl);
  };
'''

with open("components/BoardView.tsx", "w") as f:
    f.write(content)
