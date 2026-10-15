import { BoardData, LiveGameData, WinnerHighlights } from '../types';
import { quarterAxisKey } from './quarterAxes';

/**
 * Get axis for a specific quarter (dynamic boards) or standard axis
 */
export const getAxisForQuarter = (
    board: BoardData,
    side: 'left' | 'top',
    quarter?: string
): (number | null)[] => {
    if (!board.isDynamic) {
        return (side === 'left' ? board.leftAxis : board.topAxis) ?? Array(10).fill(null);
    }
    // Map quarter to axis key (Final uses Q4)
    const qKey = quarterAxisKey(quarter);
    const axes = side === 'left' ? board.leftAxisByQuarter : board.topAxisByQuarter;
    return (qKey && axes?.[qKey]) || Array(10).fill(null);
};

export const calculateWinnerHighlights = (liveData: LiveGameData | null): WinnerHighlights => {
    if (!liveData) return { quarterWinners: {}, currentLabel: 'NOW' };

    const qw: Record<string, string> = {};
    const { period, state, quarterScores, leftScore, topScore } = liveData;

    const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
    const getWinnerKey = (qIdx: number) => {
        let lSum = 0; let tSum = 0;
        for (const qKey of QUARTERS.slice(0, qIdx + 1)) {
            lSum += quarterScores[qKey]?.left || 0;
            tSum += quarterScores[qKey]?.top || 0;
        }
        return `${tSum % 10}-${lSum % 10}`;
    };

    // Same rule as the database (migration 028): Q2 is decided at an explicit
    // halftime, not only once the third quarter starts.
    const atHalftime = period === 2 && state === 'in' && (liveData.detail || '').trim().toLowerCase() === 'halftime';
    const entered = (key: 'Q1' | 'Q2' | 'Q3' | 'Q4') => !liveData.unenteredQuarters?.includes(key);

    if ((period > 1 || state === 'post') && entered('Q1')) qw['Q1'] = getWinnerKey(0);
    if ((period > 2 || state === 'post' || atHalftime) && entered('Q1') && entered('Q2')) qw['Q2'] = getWinnerKey(1);
    if ((period > 3 || state === 'post') && entered('Q1') && entered('Q2') && entered('Q3')) qw['Q3'] = getWinnerKey(2);
    if (state === 'post') qw['Final'] = `${topScore % 10}-${leftScore % 10}`;

    return { quarterWinners: qw, currentLabel: state === 'post' ? 'FINAL' : 'NOW' };
};
