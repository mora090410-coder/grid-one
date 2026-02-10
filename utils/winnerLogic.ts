import { BoardData, LiveGameData, WinnerHighlights } from '../types';

/**
 * Get axis for a specific quarter (dynamic boards) or standard axis
 */
export const getAxisForQuarter = (
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

export const calculateWinnerHighlights = (liveData: LiveGameData | null): WinnerHighlights => {
    if (!liveData) return { quarterWinners: {}, currentLabel: 'NOW' };

    const qw: Record<string, string> = {};
    const { period, state, quarterScores, leftScore, topScore, isManual } = liveData;

    if (isManual) return { quarterWinners: {}, currentLabel: 'NOW' };

    const getWinnerKey = (qIdx: number) => {
        let lSum = 0; let tSum = 0;
        for (let i = 0; i <= qIdx; i++) {
            const qKey = `Q${i + 1}` as keyof typeof quarterScores;
            // @ts-ignore
            lSum += (quarterScores[qKey]?.left || 0);
            // @ts-ignore
            tSum += (quarterScores[qKey]?.top || 0);
        }
        return `${tSum % 10}-${lSum % 10}`;
    };

    if (period > 1 || state === 'post') qw['Q1'] = getWinnerKey(0);
    if (period > 2 || state === 'post') qw['Q2'] = getWinnerKey(1);
    if (period > 3 || state === 'post') qw['Q3'] = getWinnerKey(2);
    if (state === 'post') qw['Final'] = `${topScore % 10}-${leftScore % 10}`;

    return { quarterWinners: qw, currentLabel: state === 'post' ? 'FINAL' : 'NOW' };
};

export const calculateCurrentWinner = (liveData: LiveGameData | null, board: BoardData) => {
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

    return { key: `${topDigit}-${leftDigit}`, owners, state: liveData.state, quarter: currentQuarter, squareIndex: (colIdx !== -1 && rowIdx !== -1) ? rowIdx * 10 + colIdx : -1 };
};
