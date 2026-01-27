import React, { useMemo } from 'react';
import { BoardData, EntryMeta, LiveGameData } from '../types';
import { calculateWinnerHighlights, getAxisForQuarter } from '../utils/winnerLogic';

interface OrganizerDashboardProps {
    board: BoardData;
    entryMetaByIndex: Record<number, EntryMeta>;
    liveData: LiveGameData | null;
    onOpenSquareDetails: (cellIndex: number) => void;
    onBulkStatusUpdate?: (indices: number[], status: 'paid' | 'unpaid') => void;
    gameTitle?: string;
}

const DashboardCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`premium-glass p-5 rounded-3xl flex flex-col ${className}`}>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</h4>
        {children}
    </div>
);

const ProgressBar: React.FC<{ filled: number; total: number; colorClass?: string }> = ({ filled, total, colorClass = 'bg-green-500' }) => {
    const pct = Math.min(100, Math.max(0, (filled / total) * 100));
    return (
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
        </div>
    );
};

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
    board,
    entryMetaByIndex,
    liveData,
    onOpenSquareDetails,
    onBulkStatusUpdate
}) => {
    // 1. Coverage Stats
    const coverage = useMemo(() => {
        let filled = 0;
        const total = 100;
        board.squares.forEach(sq => {
            if (sq && sq.length > 0) filled++;
        });
        return { filled, open: total - filled, pct: filled };
    }, [board]);

    // 2. Payment Stats
    const paymentStats = useMemo(() => {
        let paid = 0;
        let unpaid = 0;

        board.squares.forEach((sq, idx) => {
            if (sq && sq.length > 0) {
                const meta = entryMetaByIndex[idx];
                if (meta?.paid_status === 'paid') {
                    paid++;
                } else {
                    // Treat unknown/undefined as unpaid for stats if occupied
                    unpaid++;
                }
            }
        });

        return { paid, unpaid, needsFollowUp: unpaid };
    }, [board, entryMetaByIndex]);

    // 3. Follow-up Queue (Grouped by Player)
    const workQueue = useMemo(() => {
        const groups: Record<string, { name: string; indices: number[] }> = {};

        board.squares.forEach((names, idx) => {
            if (!names || names.length === 0) return;

            const meta = entryMetaByIndex[idx];
            const isPaid = meta?.paid_status === 'paid';

            // If NOT paid, add to queue
            if (!isPaid) {
                const rawName = names[0];
                const key = rawName.toLowerCase().trim();

                if (!groups[key]) {
                    groups[key] = { name: rawName, indices: [] };
                }
                groups[key].indices.push(idx);
            }
        });

        // Convert to array and sort by count (desc)
        return Object.values(groups)
            .sort((a, b) => b.indices.length - a.indices.length)
            .slice(0, 50); // increased limit since we group
    }, [board, entryMetaByIndex]);

    // 4. Winners Snapshot
    const winnerInfo = useMemo(() => {
        if (!liveData) return null;

        const { quarterWinners } = calculateWinnerHighlights(liveData);
        const results: { label: string; name: string; sq: number }[] = [];

        // Helper to find owner of a score pair
        const findOwner = (scoreKey: string, quarter: string) => {
            const [topDigit, leftDigit] = scoreKey.split('-').map(Number);
            const topAxis = getAxisForQuarter(board, 'top', quarter);
            const leftAxis = getAxisForQuarter(board, 'left', quarter);
            const col = topAxis.indexOf(topDigit);
            const row = leftAxis.indexOf(leftDigit);
            if (col === -1 || row === -1) return { name: 'Unassigned', sq: -1 };
            const idx = row * 10 + col;
            const names = board.squares[idx];
            return { name: names && names.length > 0 ? names[0] : 'Unassigned', sq: idx + 1 };
        };

        if (quarterWinners['Q1']) results.push({ label: 'Q1', ...findOwner(quarterWinners['Q1'], 'Q1') });
        if (quarterWinners['Q2']) results.push({ label: 'Q2', ...findOwner(quarterWinners['Q2'], 'Q2') });
        if (quarterWinners['Q3']) results.push({ label: 'Q3', ...findOwner(quarterWinners['Q3'], 'Q3') });
        if (quarterWinners['Final']) results.push({ label: 'Final', ...findOwner(quarterWinners['Final'], 'Final') });

        return results;
    }, [board, liveData]);

    const handleMarkPaid = (indices: number[]) => {
        if (onBulkStatusUpdate) {
            onBulkStatusUpdate(indices, 'paid');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 animate-in slide-in-from-top-4 duration-700">

            {/* 1. Board Coverage */}
            <DashboardCard title="Board Coverage">
                <div className="flex flex-col h-full justify-between">
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-4xl font-bold text-white">{coverage.filled}</span>
                        <span className="text-sm text-gray-400 mb-1.5">/ 100 Squares Filled</span>
                    </div>
                    <ProgressBar filled={coverage.filled} total={100} colorClass={coverage.filled === 100 ? 'bg-green-500' : 'bg-indigo-500'} />
                    <div className="mt-4 flex justify-between text-xs text-gray-500 font-medium">
                        <span>{coverage.open} Open</span>
                        <span>{coverage.pct}% Complete</span>
                    </div>
                </div>
            </DashboardCard>

            {/* 2. Payment Status */}
            <DashboardCard title="Payment Status">
                <div className="flex gap-4 items-center mb-4">
                    <div className="flex-1">
                        <div className="text-2xl font-bold text-white mb-1">{paymentStats.needsFollowUp}</div>
                        <div className="text-xs text-red-400 font-medium uppercase tracking-wide">Needs Action</div>
                    </div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="flex-1">
                        <div className="text-2xl font-bold text-white mb-1">{paymentStats.paid}</div>
                        <div className="text-xs text-green-400 font-medium uppercase tracking-wide">Paid</div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="flex-1">Unpaid</span>
                        <span className="text-white font-mono">{paymentStats.unpaid}</span>
                    </div>
                </div>
            </DashboardCard>

            {/* 3. Follow-Up Queue (Grouped) */}
            <DashboardCard title="Follow-Up Queue" className="md:col-span-2 lg:col-span-1 row-span-2">
                {workQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-sm text-gray-400">You're all caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-2 pr-1 custom-scrollbar max-h-[400px] overflow-y-auto">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-500 px-2 mb-1">
                            <span>Player</span>
                            <span>Action</span>
                        </div>
                        {workQueue.map((item) => (
                            <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] transition-colors group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-white truncate max-w-[120px]">{item.name}</div>
                                        <div className="text-[10px] text-red-300 font-medium flex items-center gap-1.5">
                                            <span className="bg-red-500/20 px-1.5 rounded text-red-400">
                                                {item.indices.length} squares
                                            </span>
                                            <span className="opacity-50 text-[9px] uppercase tracking-wide">Unpaid</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Mark Paid Button */}
                                    <button
                                        onClick={() => handleMarkPaid(item.indices)}
                                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-900/20"
                                        title="Mark All Paid"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DashboardCard>

            {/* 4. Winners Snapshot */}
            {winnerInfo && winnerInfo.length > 0 && (
                <DashboardCard title="Winners Snapshot" className="md:col-span-2 lg:col-span-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {winnerInfo.map((w) => (
                            <div key={w.label} className="p-3 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/5 flex flex-col items-center text-center">
                                <div className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">{w.label}</div>
                                <div className="text-lg font-bold text-white mb-0.5 truncate w-full">{w.name}</div>
                                <div className="text-xs text-gray-500">Square {w.sq}</div>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            )}

        </div>
    );
};
