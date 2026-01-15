
import React, { useState, useEffect, useCallback, useMemo, useRef, ErrorInfo, ReactNode, Component } from 'react';
// @ts-ignore
import { QRCodeSVG } from 'qrcode.react';
import { GameState, BoardData, LiveGameData, WinnerHighlights } from './types';
import { SAMPLE_BOARD, TEAM_THEMES, NFL_TEAMS } from './constants';
import AdminPanel from './components/AdminPanel';
import BoardGrid from './components/BoardGrid';
import InfoCards from './components/InfoCards';
import ScenarioPanel from './components/ScenarioPanel';
import PlayerFilter from './components/PlayerFilter';
import LandingPage from './components/LandingPage';
import { parseBoardImage } from './services/geminiService';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const INITIAL_GAME: GameState = {
  title: '',
  meta: 'Super Bowl Party',
  leftAbbr: 'DAL',
  leftName: 'Dallas Cowboys',
  topAbbr: 'WAS',
  topName: 'Washington Commanders',
  dates: '',
  lockTitle: false,
  lockMeta: false,
  useManualScores: false,
  manualLeftScore: 0,
  manualTopScore: 0,
  coverImage: ''
};

const EMPTY_BOARD: BoardData = {
  bearsAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  oppAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  squares: Array(100).fill(null).map(() => [])
};

async function compressImage(base64Str: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
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

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SBXPRO Application Crash:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;

    if (hasError) {
      return (
        <div className="min-h-screen bg-[#050101] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mb-6 border border-red-500/30">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">Application Encountered an Error</h1>
          <p className="text-gray-400 text-sm max-w-xs mb-8">We've encountered a script error. Try recovering your session below.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-cardinal px-10 py-4 rounded-full text-sm font-black uppercase tracking-widest shadow-xl"
          >
            Recover My Board
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_URL = `${window.location.origin}/api/pools`;
const LIVE_PROXY_URL = 'https://wandering-flower-f1de.anthony-mora13.workers.dev';

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

  const [dataReady, setDataReady] = useState(false);
  const [loadingPool, setLoadingPool] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [activePoolId, setActivePoolId] = useState<string | null>(urlPoolId);
  const [adminToken, setAdminToken] = useState('');

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showAdminView, setShowAdminView] = useState(false);

  const [copyFeedback, setCopyFeedback] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'board'>('live');
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [wizardStep, setWizardStep] = useState(1);
  const [wizardPassword, setWizardPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const wizardFileRef = useRef<HTMLInputElement>(null);

  const [game, setGame] = useState<GameState>(INITIAL_GAME);
  const [board, setBoard] = useState<BoardData>(SAMPLE_BOARD);
  const [liveData, setLiveData] = useState<LiveGameData | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('Initializing...');
  const [isSynced, setIsSynced] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedCoords, setHighlightedCoords] = useState<{ left: number, top: number } | null>(null);

  const showLanding = !activePoolId && !hasEnteredApp && !isInitialized && !wizardSuccess;
  const isCommissionerMode = showAdminView && !!adminToken;

  const knownAdminToken = useMemo(() => {
    const targetId = joinInput.trim().toUpperCase() || activePoolId;
    if (!targetId || targetId.length < 4) return null;
    const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
    return storedTokens[targetId] || null;
  }, [joinInput, activePoolId]);

  useEffect(() => {
    if (!game.leftAbbr || !game.topAbbr) return;
    const resolveKey = (k: string) => {
      if (TEAM_THEMES[k]) return k;
      if (k === 'WSH') return 'WAS';
      if (k === 'LA') return 'LAR';
      return 'DAL';
    };
    const leftTheme = TEAM_THEMES[resolveKey(game.leftAbbr.toUpperCase())] || TEAM_THEMES['DAL'];
    const topTheme = TEAM_THEMES[resolveKey(game.topAbbr.toUpperCase())] || TEAM_THEMES['WAS'];
    const root = document.documentElement.style;

    root.setProperty('--left-primary', leftTheme.primary);
    root.setProperty('--left-secondary', leftTheme.secondary);
    root.setProperty('--left-rgb', hexToRgb(leftTheme.primary));
    root.setProperty('--text-contrast-left', getContrastYIQ(leftTheme.primary));
    root.setProperty('--left-primary-bright', ensureMinLuminance(leftTheme.primary, 0.6));

    root.setProperty('--top-primary', topTheme.primary);
    root.setProperty('--top-secondary', topTheme.secondary);
    root.setProperty('--top-rgb', hexToRgb(topTheme.primary));
    root.setProperty('--text-contrast-top', getContrastYIQ(topTheme.primary));
    root.setProperty('--top-primary-bright', ensureMinLuminance(topTheme.primary, 0.6));
  }, [game.leftAbbr, game.topAbbr]);

  useEffect(() => {
    const loadData = async () => {
      const currentParams = new URLSearchParams(window.location.search);
      const poolId = currentParams.get('poolId');

      if (poolId) {
        setLoadingPool(true);
        try {
          const res = await fetch(`${API_URL}/${poolId}`);
          if (!res.ok) throw new Error('Pool not found');
          const result = await res.json();
          if (result.data) {
            setGame(result.data.game);
            setBoard(result.data.board);
            setActivePoolId(poolId);
            setIsInitialized(true);
            const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
            if (storedTokens[poolId]) {
              setAdminToken(storedTokens[poolId]);
            }
          }
        } catch (err: any) {
          setPoolError(err.message);
        } finally {
          setLoadingPool(false);
        }
      } else {
        const savedGame = localStorage.getItem('squares_game');
        const savedBoard = localStorage.getItem('squares_board');
        if (savedGame) setGame(JSON.parse(savedGame));
        if (savedBoard) setBoard(JSON.parse(savedBoard));
      }
      setDataReady(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!dataReady || loadingPool) return;
    localStorage.setItem('squares_game', JSON.stringify(game));
    localStorage.setItem('squares_board', JSON.stringify(board));
  }, [game, board, dataReady, loadingPool]);

  const fetchLive = useCallback(async () => {
    if (!dataReady || loadingPool) return;
    if (game.useManualScores) {
      setLiveData({
        leftScore: game.manualLeftScore || 0, topScore: game.manualTopScore || 0,
        quarterScores: { Q1: { left: 0, top: 0 }, Q2: { left: 0, top: 0 }, Q3: { left: 0, top: 0 }, Q4: { left: 0, top: 0 }, OT: { left: 0, top: 0 } },
        clock: 'MANUAL', period: 4, state: 'in', detail: 'Manual Control', isOvertime: false, isManual: true
      });
      setLiveStatus('MANUAL OVERRIDE');
      setIsSynced(true);
      setLastUpdated(new Date().toLocaleTimeString());
      return;
    }
    if (!game.dates) {
      setLiveStatus('WAITING FOR DATE');
      setIsSynced(false);
      setLiveData(null);
      return;
    }
    setIsRefreshing(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    try {
      const cleanDates = (game.dates || '').replace(/\D/g, '');
      const res = await fetch(`${LIVE_PROXY_URL}?dates=${cleanDates}`, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.events) throw new Error('No Data');
      const targetLeft = normalizeAbbr(game.leftAbbr);
      const targetTop = normalizeAbbr(game.topAbbr);
      const event = data.events.find((e: any) => {
        const comps = e?.competitions?.[0]?.competitors || [];
        const abbrs: string[] = comps.map((c: any) => normalizeAbbr(c.team?.abbreviation));
        return abbrs.some((a: string) => a === targetLeft || (targetLeft === 'WAS_WSH_ALIAS' && (a === 'WAS' || a === 'WSH'))) &&
          abbrs.some((a: string) => a === targetTop || (targetTop === 'WAS_WSH_ALIAS' && (a === 'WAS' || a === 'WSH')));
      });
      if (!event) { setLiveStatus(`NO MATCH FOUND`); setIsSynced(false); setLiveData(null); return; }
      const comp = event.competitions[0];
      const leftTeam = comp.competitors.find((c: any) => normalizeAbbr(c.team?.abbreviation) === targetLeft || (targetLeft === 'WAS_WSH_ALIAS' && (normalizeAbbr(c.team?.abbreviation) === 'WAS' || normalizeAbbr(c.team?.abbreviation) === 'WSH')));
      const topTeam = comp.competitors.find((c: any) => normalizeAbbr(c.team?.abbreviation) === targetTop || (targetTop === 'WAS_WSH_ALIAS' && (normalizeAbbr(c.team?.abbreviation) === 'WAS' || normalizeAbbr(c.team?.abbreviation) === 'WSH')));
      const status = comp.status;
      setLiveData({
        leftScore: Number(leftTeam?.score || 0), topScore: Number(topTeam?.score || 0),
        quarterScores: {
          Q1: { left: Number(leftTeam?.linescores?.[0]?.value || 0), top: Number(topTeam?.linescores?.[0]?.value || 0) },
          Q2: { left: Number(leftTeam?.linescores?.[1]?.value || 0), top: Number(topTeam?.linescores?.[1]?.value || 0) },
          Q3: { left: Number(leftTeam?.linescores?.[2]?.value || 0), top: Number(topTeam?.linescores?.[2]?.value || 0) },
          Q4: { left: Number(leftTeam?.linescores?.[3]?.value || 0), top: Number(topTeam?.linescores?.[3]?.value || 0) },
          OT: { left: Number(leftTeam?.linescores?.[4]?.value || 0), top: Number(topTeam?.linescores?.[4]?.value || 0) },
        },
        clock: status.displayClock || '', period: Number(status.period || 0), state: status.type.state as any, detail: status.type.detail || '', isOvertime: Number(status.period) > 4, isManual: false
      });
      setLiveStatus(status.type.state === 'post' ? 'FINAL' : 'LIVE');
      setIsSynced(true);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setLiveStatus('OFFLINE');
      setIsSynced(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [game, dataReady, loadingPool]);

  useEffect(() => {
    if (!dataReady) return;
    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, [fetchLive, dataReady]);

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
    const colIdx = board.oppAxis.indexOf(topDigit);
    const rowIdx = board.bearsAxis.indexOf(leftDigit);
    const owners = (colIdx !== -1 && rowIdx !== -1) ? (board.squares[rowIdx * 10 + colIdx] || []) : [];
    return { key: `${topDigit}-${leftDigit}`, owners, state: liveData.state };
  }, [liveData, board]);

  /**
   * SECURITY UPGRADED: Validates token against server before saving or granting access.
   */
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenToVerify = authInput.trim();
    if (!tokenToVerify) return;

    const currentId = activePoolId || joinInput.trim().toUpperCase();
    if (!currentId) {
      alert("No active pool identified. Please join a game first.");
      return;
    }

    setIsAuthenticating(true);
    try {
      // PERFORM HANDSHAKE: Change to POST method for verification.
      const response = await fetch(`${API_URL}/${currentId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        // AUTHENTICATION SUCCESS: Grant access and persist credentials
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
        storedTokens[currentId] = tokenToVerify;
        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));

        setAdminToken(tokenToVerify);
        setAuthInput('');
        setShowAuthModal(false);
        setShowAdminView(true);

        // SYNC URL & STATE
        const newUrl = new URL(window.location.href);
        if (newUrl.searchParams.get('poolId') !== currentId) {
          newUrl.searchParams.set('poolId', currentId);
          window.history.replaceState({ poolId: currentId }, '', newUrl.toString());
        }
        setActivePoolId(currentId);
      } else {
        // AUTHENTICATION FAILURE
        const errorMsg = response.status === 401 ? "Invalid Password" : "Verification Handshake Failed";
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      // SECURITY CLEANUP: Wipe potentially invalid tokens from storage
      const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
      if (currentId) delete storedTokens[currentId];
      localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));

      alert(err.message || "Authentication Error");
      setAuthInput('');
      setAdminToken('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput) return;
    const targetId = joinInput.trim().toUpperCase();
    setIsRefreshing(true);
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
      setIsRefreshing(false);
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

  const handlePublish = async (token: string, currentData?: { game: GameState, board: BoardData }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const g = currentData?.game || game;
      const b = currentData?.board || board;
      const payload = { game: { ...g, title: g.title || "SBXPRO Pool", coverImage: g.coverImage || "" }, board: b };
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

      const newId = await handlePublish(pass, { game: { ...game, title: leagueTitle, coverImage: targetCover }, board: targetBoard });
      if (!newId) throw new Error("Game initialization failed to assign a unique ID.");

      setBoard(targetBoard);
      setGame(prev => ({ ...prev, title: leagueTitle, coverImage: targetCover }));
      setWizardSuccess(true);
      setIsInitialized(true);
      setShowAdminView(false);
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
    setBoard(SAMPLE_BOARD);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('poolId');
    window.history.pushState({}, '', newUrl);
  };

  const openSetupWizard = () => {
    setGame(INITIAL_GAME);
    setBoard(EMPTY_BOARD);
    setWizardPassword('');
    setWizardStep(1);
    setWizardSuccess(false);
    setWizardError(null);
    setShowWizardModal(true);
  };

  const isEmptyBoard = !board.squares.some(s => s.length > 0);

  return (
    <div className="h-screen w-full bg-transparent overflow-hidden flex flex-col font-sans text-white">
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-gold-glass">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Commissioner Access</h3>
                <button type="button" onClick={() => !isAuthenticating && setShowAuthModal(false)} className="text-gray-400 hover:text-white">&times;</button>
              </div>
              <input autoFocus type="password" value={authInput} onChange={(e) => setAuthInput(e.target.value)} placeholder="Enter Password" disabled={isAuthenticating}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-gold-glass outline-none transition-colors disabled:opacity-50" />
              <button type="submit" disabled={isAuthenticating} className="w-full btn-cardinal py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {isAuthenticating ? 'VERIFYING...' : 'Unlock Dashboard'}
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

      {showWizardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="liquid-glass w-full max-w-md overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500 border-gold-glass shadow-[0_0_50px_rgba(157,34,53,0.3)]">
            <div className="p-6 border-b border-white/10 bg-[#9D2235]/10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white italic tracking-tighter">LEAGUE SETUP</h2>
                {!wizardSuccess && <button onClick={() => setShowWizardModal(false)} className="text-gray-400 hover:text-white text-xs uppercase font-bold tracking-widest">CANCEL</button>}
              </div>
              <div className="flex gap-2 mt-4">
                {[1, 2, 3].map(step => (
                  <div key={step} className={`h-1 flex-1 rounded-full transition-all duration-500 ${wizardStep >= step ? 'bg-[#FFC72C]' : 'bg-white/10'}`}></div>
                ))}
              </div>
            </div>
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
              {wizardSuccess ? (
                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-500 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Ready to Launch!</h3>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Redirecting to your Stadium Seats...</p>
                </div>
              ) : wizardError ? (
                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center border border-red-500/30 shadow-lg">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Setup Notice</h3>
                  <p className="text-xs text-gray-400 font-medium max-w-xs">{wizardError}</p>
                  <button onClick={() => setWizardError(null)} className="btn-cardinal px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest">Acknowledge</button>
                </div>
              ) : (
                <>
                  {wizardStep === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-bold text-white">Step 1: Secure Your League</h3>
                      <div className="space-y-1 pt-2">
                        <label className="text-[9px] font-black text-gold uppercase tracking-widest">League Name</label>
                        <input autoFocus type="text" value={game.title} onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-gold-glass outline-none transition-colors" placeholder="e.g. SB LIX Party" />
                      </div>
                      <div className="space-y-1 pt-2">
                        <label className="text-[9px] font-black text-gold uppercase tracking-widest">Admin Password</label>
                        <input type="password" value={wizardPassword} onChange={(e) => setWizardPassword(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-gold-glass outline-none transition-colors" placeholder="Make it strong..." />
                      </div>
                      <div className="pt-4">
                        <button disabled={!wizardPassword || !game.title} onClick={() => setWizardStep(2)}
                          className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">Next: Matchup</button>
                      </div>
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-bold text-white">Step 2: The Matchup</h3>
                      <div className="space-y-1 pt-2">
                        <label className="text-[9px] font-black text-gold uppercase tracking-widest">Game Date</label>
                        <input type="date" value={game.dates} onChange={(e) => setGame(prev => ({ ...prev, dates: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded p-3 text-white text-xs focus:border-gold-glass outline-none transition-colors" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <select value={game.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white">
                          {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                        </select>
                        <select value={game.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white">
                          {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                        </select>
                      </div>
                      <div className="pt-4 flex gap-3">
                        <button onClick={() => setWizardStep(1)} className="flex-1 py-3 bg-white/5 border border-white/10 rounded text-xs font-bold uppercase tracking-widest">BACK</button>
                        <button onClick={() => setWizardStep(3)} className="flex-[2] btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest">Next: Board Cover</button>
                      </div>
                    </div>
                  )}
                  {wizardStep === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-bold text-white">Step 3: Board Cover & Auto-Scan</h3>
                      <div onClick={() => wizardFileRef.current?.click()} className="border-2 border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[160px] relative overflow-hidden group transition-all hover:border-gold-glass">
                        <input type="file" ref={wizardFileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setWizardError(null);
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
                                console.warn("Scan failure:", err);
                                setWizardError("Image processed as cover, but AI scan failed: " + (err.message || "Invalid grid format"));
                              } finally {
                                setIsCreating(false);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }} />
                        {game.coverImage ? (
                          <>
                            <img src={game.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                            <span className="relative z-10 text-xs font-black text-white bg-black/70 px-4 py-2 rounded-full backdrop-blur-md">Change Image</span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-gold transition-colors">Click to Upload Image</span>
                            <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">OCR WILL AUTO-POPULATE GRID</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-500 font-bold text-center uppercase tracking-widest">High quality photos work best. PDF is not supported.</p>
                      <div className="pt-4 space-y-3">
                        <button
                          onClick={() => {
                            if (!game.coverImage) {
                              setWizardError("Please upload an image to use the auto-scanner, or click 'Skip Scan' below to enter names manually.");
                              return;
                            }
                            handleWizardInitialize();
                          }}
                          disabled={isCreating}
                          className={`w-full btn-cardinal py-4 rounded text-sm font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all ${!game.coverImage ? 'opacity-50 grayscale-[0.5]' : ''}`}
                        >
                          {isCreating ? (board.squares.every(s => s.length === 0) ? "SCANNING GRID..." : "INITIALIZING...") : "FINISH & INITIALIZE"}
                        </button>

                        {!isCreating && (
                          <button
                            onClick={() => handleWizardInitialize(EMPTY_BOARD, '')}
                            className="w-full text-center text-[10px] text-[#FFC72C] uppercase font-black tracking-widest hover:underline opacity-80 hover:opacity-100 transition-all py-1"
                          >
                            Skip Scan & Setup Manually
                          </button>
                        )}

                        <button onClick={() => !isCreating && setWizardStep(2)} className="w-full text-center text-[10px] text-gray-500 uppercase font-bold tracking-widest underline">BACK</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showShareModal && (() => {
        const shareUrl = activePoolId ? `${window.location.origin}/?poolId=${activePoolId}` : window.location.href;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="liquid-glass w-full max-w-sm p-6 text-center flex flex-col items-center gap-4">
              <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">BOARD LINK</h2>
              <div className="bg-white p-2 rounded-xl"><QRCodeSVG value={shareUrl} size={140} /></div>
              <div className="bg-black/40 border border-white/10 rounded-lg p-1.5 flex items-center gap-2 w-full">
                <div className="flex-1 px-2 py-2 text-[10px] font-mono text-gray-400 truncate">{shareUrl}</div>
                <button onClick={handleCopyLink} className="px-3 py-1.5 rounded text-[9px] font-black uppercase btn-cardinal">{copyFeedback ? 'COPIED' : 'COPY'}</button>
              </div>
              <button onClick={handleCloseShare} className="w-full py-2 bg-white/5 border border-white/10 text-[10px] font-bold uppercase text-gray-400">CLOSE</button>
            </div>
          </div>
        );
      })()}

      {showLanding ? (
        <LandingPage onCreate={openSetupWizard} />
      ) : (
        <>
          <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/60 backdrop-blur-md z-50">
            <div className="flex flex-col">
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter italic text-white leading-none">SBX<span className="text-team-top-bright">PRO</span></h1>
              <div className="flex items-center gap-2 mt-1">
                {isSynced && <div className="live-indicator w-1.5 h-1.5"></div>}
                <span className={`text-[8px] font-bold uppercase tracking-[0.2em] ${isSynced ? 'text-team-top-bright' : 'text-gray-400'}`}>{liveStatus}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {adminToken && (
                <>
                  <button onClick={() => setShowShareModal(true)} className="p-2 bg-white/5 border border-white/10 rounded-full text-team-top-bright"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                  <button onClick={() => setShowAdminView(!showAdminView)} className={`p-2 rounded-full transition-colors ${showAdminView ? 'bg-[#9D2235] text-white shadow-lg' : 'bg-white/10 text-team-top-bright hover:bg-white/20'}`} title={showAdminView ? "Switch to Player View" : "Open Commissioner Dashboard"}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </header>
          {isCommissionerMode && (
            <div className="absolute inset-0 z-[80] bg-[#050101] p-4 overflow-y-auto">
              <AdminPanel game={game} board={board} adminToken={adminToken} activePoolId={activePoolId} onApply={(g, b) => { setGame(g); setBoard(b); }} onPublish={handlePublish} />
              <div className="flex gap-4 mt-8 pb-12">
                <button onClick={() => setShowAdminView(false)} className="px-6 py-2 bg-white/5 border border-white/10 rounded text-xs text-white font-black uppercase tracking-widest hover:bg-white/10">Return to Board View</button>
                <button onClick={handleLogout} className="px-6 py-2 border border-red-900/40 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-900/10">Log Out & Return to Home</button>
              </div>
            </div>
          )}
          <div className="flex-shrink-0 flex items-center justify-center gap-4 py-3 z-40 relative">
            <button onClick={() => setActiveTab('live')} className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'live' ? 'btn-cardinal shadow-lg' : 'bg-white/5 text-gray-400'}`}>Live Hub</button>
            <button onClick={() => setActiveTab('board')} className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'board' ? 'btn-cardinal shadow-lg' : 'bg-white/5 text-gray-400'}`}>Board</button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar">
            {activeTab === 'live' && (
              <div className="p-4 md:p-6 max-w-lg mx-auto w-full space-y-6 pb-20">
                <InfoCards.Scoreboard game={game} live={liveData} onRefresh={fetchLive} isRefreshing={isRefreshing} liveStatus={liveStatus} />
                <div className="liquid-glass p-5 relative overflow-hidden group glass-top">
                  <div className="text-[10px] font-black text-team-top uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>{currentLiveWinner?.state === 'post' ? 'Final Winner' : 'Live Winner'}</div>
                  <div className="flex items-end justify-between">
                    <div><div className="text-2xl font-black text-white leading-none mb-1">{currentLiveWinner?.owners.length ? currentLiveWinner.owners.join(', ') : (liveData ? 'No Owner' : '—')}</div><div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Square Owner</div></div>
                    <div className="text-right"><div className="text-xl font-black text-team-top font-mono">{currentLiveWinner?.key || '?-?'}</div><div className="text-[9px] font-bold text-gray-500 uppercase">Coord</div></div>
                  </div>
                </div>
                <InfoCards.Payouts liveStatus={liveStatus} lastUpdated={lastUpdated} highlights={highlights} board={board} live={liveData} />
                <div className="space-y-4">
                  <ScenarioPanel.LeftScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                  <ScenarioPanel.TopScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                </div>
              </div>
            )}
            {activeTab === 'board' && (
              <div className="flex flex-col h-full relative">
                <div className="flex-shrink-0 p-2 md:p-4 z-30"><PlayerFilter board={board} selected={selectedPlayer} setSelected={setSelectedPlayer} /></div>
                <div className="flex-1 flex items-center justify-center p-2 min-h-0 relative">
                  <BoardGrid board={board} highlights={highlights} live={liveData} selectedPlayer={selectedPlayer} leftTeamName={game.leftName} topTeamName={game.topName} highlightedCoords={highlightedCoords} />

                  {isEmptyBoard && !!adminToken && (
                    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                      <div className="liquid-glass max-w-sm p-8 text-center space-y-6 border-gold-glass animate-in zoom-in duration-500">
                        <div className="w-16 h-16 bg-[#FFC72C]/10 rounded-full flex items-center justify-center mx-auto text-gold border border-gold-glass">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Empty Board Detected</h3>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Initialize your game by adding player names manually in the Hub.</p>
                        </div>
                        <button
                          onClick={() => setShowAdminView(true)}
                          className="w-full btn-cardinal py-4 rounded-full text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
                        >
                          Open Commissioner Hub
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
