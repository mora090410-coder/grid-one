/**
 * useLiveScoring Hook
 * Manages live game data from ESPN API
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LiveGameData } from '../types';

const LIVE_PROXY_URL = import.meta.env.VITE_LIVE_PROXY_URL || 'https://wandering-flower-f1de.anthony-mora13.workers.dev';

const TEAM_ALIAS_MAP: Record<string, string> = {
    WAS: 'WAS',
    WSH: 'WAS',
    LA: 'LAR',
    LAR: 'LAR',
    STL: 'LAR',
    LV: 'LV',
    OAK: 'LV',
    LAC: 'LAC',
    SD: 'LAC',
    ARI: 'ARI',
    ARZ: 'ARI',
    JAX: 'JAX',
    JAC: 'JAX',
    NO: 'NO',
    NOS: 'NO',
    SF: 'SF',
    SFO: 'SF',
    GB: 'GB',
    GNB: 'GB',
    KC: 'KC',
    KCC: 'KC',
    TB: 'TB',
    TAM: 'TB',
    NE: 'NE',
    NWE: 'NE',
};

const normalizeTeamKey = (value: string | undefined): string => {
    if (!value) return '';
    const cleaned = value.toUpperCase().replace(/[^A-Z]/g, '').trim();
    return TEAM_ALIAS_MAP[cleaned] || cleaned;
};

const formatDateKey = (isoDate: string): string => isoDate.replace(/-/g, '');

const shiftIsoDate = (isoDate: string, offsetDays: number): string => {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
};

const getDateCandidates = (isoDate: string): string[] => {
    const center = formatDateKey(isoDate);
    const prev = formatDateKey(shiftIsoDate(isoDate, -1));
    const next = formatDateKey(shiftIsoDate(isoDate, 1));
    return Array.from(new Set([center, prev, next]));
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeGameState = (value: string | undefined): 'pre' | 'in' | 'post' => {
    if (value === 'pre' || value === 'in' || value === 'post') return value;
    return 'pre';
};

interface UseLiveScoringReturn {
    liveData: LiveGameData | null;
    liveStatus: string;
    isSynced: boolean;
    isRefreshing: boolean;
    lastUpdated: string;
    fetchLive: () => Promise<void>;
}

// Basic ESPN API types
interface Competitor {
    score: string;
    team: {
        abbreviation: string;
        shortDisplayName?: string;
        displayName?: string;
        name?: string;
        location?: string;
    };
    linescores?: Array<{ value: number }>;
}

interface Competition {
    competitors: Competitor[];
    status: {
        displayClock: string;
        period: number;
        type: {
            state: string;
            detail: string;
        };
    };
}

interface ESPNEvent {
    competitions: Competition[];
}

const competitorMatchesTeam = (competitor: Competitor, target: string): boolean => {
    if (!target) return false;
    const keys = [
        normalizeTeamKey(competitor.team?.abbreviation),
        normalizeTeamKey(competitor.team?.shortDisplayName),
        normalizeTeamKey(competitor.team?.displayName),
        normalizeTeamKey(competitor.team?.name),
        normalizeTeamKey(competitor.team?.location),
    ];
    return keys.some(k => k === target);
};

const eventMatchScore = (event: ESPNEvent, leftTarget: string, topTarget: string): number => {
    const competitors = event?.competitions?.[0]?.competitors || [];
    let score = 0;
    if (competitors.some(c => competitorMatchesTeam(c, leftTarget))) score += 1;
    if (competitors.some(c => competitorMatchesTeam(c, topTarget))) score += 1;
    return score;
};

export function useLiveScoring(game: GameState, dataReady: boolean, loadingPool: boolean): UseLiveScoringReturn {
    const [liveData, setLiveData] = useState<LiveGameData | null>(null);
    const [liveStatus, setLiveStatus] = useState<string>('Initializing...');
    const [isSynced, setIsSynced] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const fetchLive = useCallback(async () => {
        if (!dataReady || loadingPool || !game.dates) {
            setLiveStatus('WAITING FOR DATA');
            return;
        }

        // Manual scores mode
        if (game.useManualScores) {
            setLiveData({
                leftScore: game.manualLeftScore || 0,
                topScore: game.manualTopScore || 0,
                quarterScores: {
                    Q1: { left: 0, top: 0 },
                    Q2: { left: 0, top: 0 },
                    Q3: { left: game.manualLeftScore || 0, top: game.manualTopScore || 0 },
                    Q4: { left: 0, top: 0 },
                    OT: { left: 0, top: 0 },
                },
                clock: '',
                period: 3,
                state: 'in',
                detail: 'Manual Entry',
                isOvertime: false,
                isManual: true
            });
            setLiveStatus('MANUAL');
            setIsSynced(true);
            setLastUpdated(new Date().toLocaleTimeString());
            return;
        }

        setIsRefreshing(true);

        try {
            const targetLeft = normalizeTeamKey(game.leftAbbr);
            const targetTop = normalizeTeamKey(game.topAbbr);
            const dateCandidates = getDateCandidates(game.dates);

            let event: ESPNEvent | undefined;

            for (const dateKey of dateCandidates) {
                let events: ESPNEvent[] = [];
                let attempt = 0;
                while (attempt < 3) {
                    try {
                        // Send both keys for compatibility with deployed proxy variants.
                        const url = `${LIVE_PROXY_URL}?dates=${dateKey}&date=${dateKey}`;
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        events = Array.isArray(data?.events) ? data.events : [];
                        break;
                    } catch (err) {
                        attempt += 1;
                        if (attempt >= 3) throw err;
                        await sleep(250 * Math.pow(2, attempt - 1));
                    }
                }

                // 1) Strict matchup: both selected teams in one event
                event = events.find((e: ESPNEvent) => eventMatchScore(e, targetLeft, targetTop) === 2);

                // 2) Soft fallback: at least one side matches (helps with API abbreviation drift)
                if (!event) {
                    let bestScore = 0;
                    let bestEvent: ESPNEvent | undefined;
                    for (const candidate of events) {
                        const score = eventMatchScore(candidate, targetLeft, targetTop);
                        if (score > bestScore) {
                            bestScore = score;
                            bestEvent = candidate;
                        }
                    }
                    if (bestScore > 0) event = bestEvent;
                }

                if (event) break;
            }

            if (!event || !event.competitions?.[0]) {
                setLiveStatus('NO MATCH FOUND');
                setIsSynced(false);
                setLiveData(null);
                return;
            }

            const comp = event.competitions[0];
            const leftTeam = comp.competitors.find((c: Competitor) => competitorMatchesTeam(c, targetLeft));
            const topTeam = comp.competitors.find((c: Competitor) => competitorMatchesTeam(c, targetTop));
            const resolvedLeftTeam = leftTeam || comp.competitors.find((c: Competitor) => c !== topTeam);
            const resolvedTopTeam = topTeam || comp.competitors.find((c: Competitor) => c !== resolvedLeftTeam);

            if (!resolvedLeftTeam || !resolvedTopTeam) {
                setLiveStatus('NO MATCH FOUND');
                setIsSynced(false);
                setLiveData(null);
                return;
            }

            const status = comp.status;
            const gameState = normalizeGameState(status?.type?.state);

            setLiveData({
                leftScore: Number(resolvedLeftTeam?.score || 0),
                topScore: Number(resolvedTopTeam?.score || 0),
                quarterScores: {
                    Q1: { left: Number(resolvedLeftTeam?.linescores?.[0]?.value || 0), top: Number(resolvedTopTeam?.linescores?.[0]?.value || 0) },
                    Q2: { left: Number(resolvedLeftTeam?.linescores?.[1]?.value || 0), top: Number(resolvedTopTeam?.linescores?.[1]?.value || 0) },
                    Q3: { left: Number(resolvedLeftTeam?.linescores?.[2]?.value || 0), top: Number(resolvedTopTeam?.linescores?.[2]?.value || 0) },
                    Q4: { left: Number(resolvedLeftTeam?.linescores?.[3]?.value || 0), top: Number(resolvedTopTeam?.linescores?.[3]?.value || 0) },
                    OT: { left: Number(resolvedLeftTeam?.linescores?.[4]?.value || 0), top: Number(resolvedTopTeam?.linescores?.[4]?.value || 0) },
                },
                clock: status.displayClock || '',
                period: Number(status.period || 0),
                state: gameState,
                detail: status.type.detail || '',
                isOvertime: Number(status.period) > 4,
                isManual: false
            });

            setLiveStatus(gameState === 'post' ? 'FINAL' : 'LIVE');
            setIsSynced(true);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (err: unknown) {
            setLiveStatus('OFFLINE');
            setIsSynced(false);
        } finally {
            setIsRefreshing(false);
        }
    }, [game, dataReady, loadingPool]);

    // Auto-polling
    useEffect(() => {
        if (!dataReady) return;

        fetchLive();
        pollRef.current = setInterval(fetchLive, 30000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [dataReady, fetchLive]);

    return {
        liveData,
        liveStatus,
        isSynced,
        isRefreshing,
        lastUpdated,
        fetchLive
    };
}

export default useLiveScoring;
