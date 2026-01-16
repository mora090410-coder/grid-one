/**
 * useLiveScoring Hook
 * Manages live game data from ESPN API
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LiveGameData } from '../types';

const LIVE_PROXY_URL = 'https://wandering-flower-f1de.anthony-mora13.workers.dev';

const normalizeAbbr = (abbr: string | undefined): string => {
    if (!abbr) return '';
    const a = abbr.toUpperCase().trim();
    if (a === 'WAS' || a === 'WSH') return 'WAS_WSH_ALIAS';
    if (a === 'LAR' || a === 'LA') return 'LAR_LA_ALIAS';
    return a;
};

interface UseLiveScoringReturn {
    liveData: LiveGameData | null;
    liveStatus: string;
    isSynced: boolean;
    isRefreshing: boolean;
    lastUpdated: string;
    fetchLive: () => Promise<void>;
}

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
            const formattedDate = game.dates.replace(/-/g, '');
            const url = `${LIVE_PROXY_URL}?date=${formattedDate}`;
            const res = await fetch(url);

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

            if (!event) {
                setLiveStatus('NO MATCH FOUND');
                setIsSynced(false);
                setLiveData(null);
                return;
            }

            const comp = event.competitions[0];
            const leftTeam = comp.competitors.find((c: any) =>
                normalizeAbbr(c.team?.abbreviation) === targetLeft ||
                (targetLeft === 'WAS_WSH_ALIAS' && (normalizeAbbr(c.team?.abbreviation) === 'WAS' || normalizeAbbr(c.team?.abbreviation) === 'WSH'))
            );
            const topTeam = comp.competitors.find((c: any) =>
                normalizeAbbr(c.team?.abbreviation) === targetTop ||
                (targetTop === 'WAS_WSH_ALIAS' && (normalizeAbbr(c.team?.abbreviation) === 'WAS' || normalizeAbbr(c.team?.abbreviation) === 'WSH'))
            );
            const status = comp.status;

            setLiveData({
                leftScore: Number(leftTeam?.score || 0),
                topScore: Number(topTeam?.score || 0),
                quarterScores: {
                    Q1: { left: Number(leftTeam?.linescores?.[0]?.value || 0), top: Number(topTeam?.linescores?.[0]?.value || 0) },
                    Q2: { left: Number(leftTeam?.linescores?.[1]?.value || 0), top: Number(topTeam?.linescores?.[1]?.value || 0) },
                    Q3: { left: Number(leftTeam?.linescores?.[2]?.value || 0), top: Number(topTeam?.linescores?.[2]?.value || 0) },
                    Q4: { left: Number(leftTeam?.linescores?.[3]?.value || 0), top: Number(topTeam?.linescores?.[3]?.value || 0) },
                    OT: { left: Number(leftTeam?.linescores?.[4]?.value || 0), top: Number(topTeam?.linescores?.[4]?.value || 0) },
                },
                clock: status.displayClock || '',
                period: Number(status.period || 0),
                state: status.type.state as any,
                detail: status.type.detail || '',
                isOvertime: Number(status.period) > 4,
                isManual: false
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
