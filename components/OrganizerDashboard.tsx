/**
 * THESIS: Board setup is a finite sequence of confidence states, not a dashboard of equal choices.
 * OWN-WORLD: Working daylight advances toward cardinal draw, ink preview/live, and gold settlement along one named cue line.
 * STORY: Fill, reconcile, draw, preview, and publish with one dominant artifact and one next action per phase.
 * FIRST VIEWPORT: Current phase and blocker sit on the horizon above the board inventory; the primary phase action remains adjacent.
 * FORM: Game-Day Horizon organizer sequence, joined to approved Composition C Split Stage; seed 356916de.
 */
import React, { useMemo } from 'react';
import { BoardData, EntryMeta, LiveGameData } from '../types';
import { calculateWinnerHighlights, getAxisForQuarter } from '../utils/winnerLogic';
import { getOrganizerProgress, OrganizerDestination } from '../utils/organizerFlow';

interface OrganizerDashboardProps {
    board: BoardData;
    entryMetaByIndex: Record<number, EntryMeta>;
    liveData: LiveGameData | null;
    onBulkStatusUpdate?: (indices: number[], status: 'paid' | 'unpaid') => void;
    gameTitle?: string;
    isActivated?: boolean;
    isPublished?: boolean;
    onNavigate?: (destination: OrganizerDestination) => void;
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
    board,
    entryMetaByIndex,
    liveData,
    onBulkStatusUpdate,
    isActivated = false,
    isPublished = false,
    onNavigate,
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

    const progress = useMemo(() => getOrganizerProgress({
        board,
        entryMetaByIndex,
        isPublished,
    }), [board, entryMetaByIndex, isPublished]);
    const activePhase = progress.phase === 'fill'
        ? 0
        : progress.phase === 'draw'
            ? 2
            : progress.phase === 'preview'
                ? 3
                : 4;
    const phases = [
        { name: 'Fill', fact: `${coverage.open} squares open`, destination: 'assign' as const },
        { name: 'Reconcile', fact: `${paymentStats.needsFollowUp} need payment review`, destination: 'reconcile' as const },
        { name: 'Draw', fact: progress.axesReady ? 'Digits locked in' : 'Axis digits needed', destination: 'draw' as const },
        { name: 'Preview', fact: isActivated ? 'Ready to verify' : 'Free private preview', destination: 'preview' as const },
        { name: 'Go live', fact: isPublished ? 'Viewer link published' : 'Sharing is off', destination: 'scoring' as const },
    ];
    const completedPhases = [
        coverage.filled === 100,
        paymentStats.needsFollowUp === 0,
        progress.axesReady,
        isPublished,
        false,
    ];

    return (
        <section className="mb-8 bg-broadcast-white text-ink" aria-labelledby="organizer-phase-title">
            <div className="overflow-x-auto border-b border-ink">
                <ol className="flex min-w-[680px]">
                    {phases.map((phase, index) => (
                        <li
                            key={phase.name}
                            className={`flex-1 border-r border-ink last:border-r-0 ${
                                index === activePhase
                                    ? 'bg-cardinal text-broadcast-white'
                                    : completedPhases[index]
                                        ? 'bg-gold text-ink'
                                        : 'bg-newsprint text-ink/50'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onNavigate?.(phase.destination)}
                                className="min-h-16 w-full px-4 py-4 text-left"
                            >
                                <span className="oa-slab block mb-1">{phase.name}</span>
                                <span className="oa-data block text-[11px] leading-4">{phase.fact}</span>
                            </button>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
                <div className="p-6 md:p-9 border-b lg:border-b-0 lg:border-r border-ink">
                    <p className="oa-slab text-cardinal mb-3">Current phase · {phases[activePhase].name}</p>
                    <h2 id="organizer-phase-title" className="oa-headline !text-3xl md:!text-5xl text-ink">
                        {progress.phase === 'fill' && `${coverage.open} squares left to assign.`}
                        {progress.phase === 'draw' && 'The board is ready for its number draw.'}
                        {progress.phase === 'preview' && 'Verify the exact board experience.'}
                        {progress.phase === 'live' && 'The board is running game day.'}
                    </h2>
                    <p className="oa-body mt-4 max-w-[62ch] text-ink/70">
                        {progress.phase === 'fill' && 'Select one or many squares, enter the purchaser or seller label your group recognizes, and keep moving.'}
                        {progress.phase === 'draw' && 'Randomize one fixed set of 0–9 digits for each axis. Payment review stays private and never blocks the draw.'}
                        {progress.phase === 'preview' && (isActivated ? 'Preview the phone experience, then publish the short viewer link.' : 'The complete board remains editable and previewable for free. Unlock only when you are ready to share it live.')}
                        {progress.phase === 'live' && 'Use manual score mode whenever the automatic beta source is stale or cannot confirm the matchup.'}
                    </p>
                    {onNavigate && (
                        <button type="button" onClick={() => onNavigate(progress.destination)} className="oa-btn oa-btn-primary mt-6">
                            {progress.actionLabel}
                        </button>
                    )}
                </div>

                <div className="p-6 md:p-9 bg-newsprint">
                    <p className="oa-slab text-ink/60 mb-5">Board inventory</p>
                    <div className="flex items-baseline gap-2">
                        <strong className="oa-data text-5xl">{coverage.filled}</strong>
                        <span className="oa-data text-ink/60">/ 100 assigned</span>
                    </div>
                    <div className="h-2 mt-5 bg-broadcast-white" aria-label={`${coverage.pct}% assigned`}>
                        <div className={`h-full ${coverage.filled === 100 ? 'bg-gold' : 'bg-cardinal'}`} style={{ width: `${coverage.pct}%` }} />
                    </div>
                    <dl className="grid grid-cols-2 gap-px mt-6 bg-ink">
                        <div className="bg-broadcast-white p-4"><dt className="oa-slab text-ink/50">Paid</dt><dd className="oa-data text-2xl mt-2">{paymentStats.paid}</dd></div>
                        <div className="bg-broadcast-white p-4"><dt className="oa-slab text-ink/50">Review</dt><dd className="oa-data text-2xl mt-2">{paymentStats.unpaid}</dd></div>
                    </dl>
                </div>
            </div>

            <div id="payment-review" className="scroll-mt-28 border-t border-ink p-6 md:p-9">
                <h3 tabIndex={-1} className="oa-headline !text-2xl text-ink mb-2 outline-none">Payment follow-up</h3>
                <p className="oa-body mb-5 text-sm text-ink/60">Private organizer notes only. Review them when useful; they do not block assignment, drawing, or Preview.</p>
                {workQueue.length === 0 ? (
                    <p className="border border-gold bg-gold/20 p-4 text-sm font-semibold text-ink">No assigned squares need payment review.</p>
                ) : (
                    <div className="space-y-2 pr-1 custom-scrollbar max-h-[400px] overflow-y-auto">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-ink/50 px-2 mb-1">
                            <span>Player</span>
                            <span>Action</span>
                        </div>
                        {workQueue.map((item) => (
                            <div key={item.name} className="flex items-center justify-between p-3 rounded-none bg-newsprint border border-newsprint hover:bg-newsprint transition-colors group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-ink truncate max-w-[120px]">{item.name}</div>
                                        <div className="text-[10px] text-cardinal font-medium flex items-center gap-1.5">
                                            <span className="bg-cardinal-subtle px-1.5 rounded-none text-cardinal">
                                                {item.indices.length} squares
                                            </span>
                                            <span className="opacity-50 oa-slab">Unpaid</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Mark Paid Button */}
                                    <button
                                        onClick={() => handleMarkPaid(item.indices)}
                                        className="min-w-11 min-h-11 p-2 rounded-none bg-gold text-ink hover:bg-gold-deep transition-colors"
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
            </div>

            {winnerInfo && winnerInfo.length > 0 && (
                <div className="border-t border-ink p-6 md:p-9">
                    <h3 className="oa-headline !text-2xl text-ink mb-5">Resolved winners</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {winnerInfo.map((w) => (
                            <div key={w.label} className="p-3 rounded-none bg-newsprint ] border border-newsprint flex flex-col items-center text-center">
                                <div className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">{w.label}</div>
                                <div className="text-lg font-bold text-ink mb-0.5 truncate w-full">{w.name}</div>
                                <div className="text-xs text-ink/50">Square {w.sq}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
