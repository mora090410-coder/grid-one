import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import usePoolData from '../hooks/usePoolData';
import { BoardData, GameState, PayoutDescriptions } from '../types';
import { Base, CapsuleButton, CapsuleTag, Eyebrow, Glass, IslandRings, Logo, SquareOne } from '../src/design/primitives';
import { hasBoardActivation } from '../utils/boardActivation';
import { hasValidAxes } from '../utils/boardValidation';
import { ghostLink } from '../src/features/homepage/sections/cta';
import { projectBoardTemplate } from '../src/features/organizer/repeat/boardTemplateModel';

interface Contest {
    id: string;
    title: string;
    created_at: string;
    status: string;
    settings: GameState;
    payout_descriptions?: PayoutDescriptions | null;
    board_data?: BoardData | null;
    published_at?: string | null;
    shared_at?: string | null;
    board_activations?: { id: string } | Array<{ id: string }> | null;
}

interface BillingSummary {
    tier: 'free' | 'gameday' | 'org' | 'legacy';
    allowance: number;
    used: number;
    organizationDisplayName?: string | null;
}

const CAPSULE_LINK = 'inline-flex items-center justify-center gap-2 rounded-capsule bg-action px-5 h-11 font-ui text-[15px] font-semibold leading-none text-action-text transition-[color,background-color,border-color,scale] hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground motion-safe:active:scale-[0.98]';

const tierLabel = (summary: BillingSummary): string =>
    summary.organizationDisplayName
    || (summary.tier === 'org'
        ? 'Organization'
        : summary.tier === 'gameday'
            ? 'Game Day'
            : 'Free');

/** Squares carrying a name. Older rows have no board_data at all. */
const filledCount = (board: BoardData | null | undefined): number => {
    if (!board || !Array.isArray(board.squares)) return 0;
    return board.squares.reduce((total, row) => (
        Array.isArray(row)
            ? total + row.filter((name) => typeof name === 'string' && name.trim().length > 0).length
            : total
    ), 0);
};

/** Digits are drawn once both axes carry numbers. */
const numbersDrawn = (board: BoardData | null | undefined): boolean => {
    return Boolean(board && hasValidAxes(board));
};

const Dashboard: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const { migrateGuestBoard } = usePoolData();
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingGuestBoard, setPendingGuestBoard] = useState<{ game: any, board: any } | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [discardConfirm, setDiscardConfirm] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [dashboardMessage, setDashboardMessage] = useState<string | null>(null);
    const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const [showMigratedToast, setShowMigratedToast] = useState(false);

    // Every deferred state reset is held so an unmount cannot fire it.
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (searchParams.get('migrated') === 'true') {
            setShowMigratedToast(true);
            window.history.replaceState({}, '', '/dashboard');
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setShowMigratedToast(false), 5000);
        }
    }, [searchParams]);

    useEffect(() => {
        const storedGame = localStorage.getItem('squares_game');
        const storedBoard = localStorage.getItem('squares_board');
        if (storedGame && storedBoard) {
            try {
                const g = JSON.parse(storedGame);
                const b = JSON.parse(storedBoard);
                setPendingGuestBoard({ game: g, board: b });
            } catch (e) { console.error("Bad storage", e); }
        }
    }, []);

    useEffect(() => {
        const isAdoptDraftMode = searchParams.get('mode') === 'adopt-draft';
        if (user && pendingGuestBoard && !migrating && isAdoptDraftMode) {
            handleManualMigration();
        }
    }, [user, pendingGuestBoard, searchParams]);

    const handleManualMigration = async () => {
        if (!user || !pendingGuestBoard || migrating) return;

        setMigrating(true);
        try {
            const newId = await migrateGuestBoard(user, pendingGuestBoard);
            localStorage.removeItem('squares_game');
            localStorage.removeItem('squares_board');

            const newParams = new URLSearchParams(searchParams);
            newParams.delete('mode');
            setSearchParams(newParams);

            window.location.href = `/boards/${newId}?migrated=true`;
        } catch (err) {
            console.error("Manual migration failed", err);
            if (err instanceof Error && !err.message.includes('duplicate')) {
                setDashboardMessage('The recovered board could not be saved. Try again.');
            }
            setMigrating(false);
        }
    };

    const handleDiscardDraft = () => {
        if (!discardConfirm) {
            setDiscardConfirm(true);
            if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
            discardTimerRef.current = setTimeout(() => setDiscardConfirm(false), 3000);
            return;
        }
        localStorage.removeItem('squares_game');
        localStorage.removeItem('squares_board');
        setPendingGuestBoard(null);
        setDiscardConfirm(false);
    };

    const fetchContests = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setDashboardLoadError(null);
        try {
            const { data, error } = await supabase
                .from('contests')
                .select('id, title, created_at, settings, payout_descriptions, board_data, status, published_at, shared_at, board_activations(id)')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContests(data || []);
        } catch (err: any) {
            console.error('Error fetching contests:', err);
            setDashboardLoadError(err?.message || 'Your boards could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) void fetchContests();
    }, [user, fetchContests]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        void supabase.auth.getSession().then(async ({ data }) => {
            const token = data.session?.access_token;
            if (!token) return;
            const response = await fetch('/api/billing/status', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!response.ok) return;
            const result = await response.json() as BillingSummary;
            if (!cancelled) setBillingSummary(result);
        }).catch(() => {
            // Board access remains available if the neutral plan summary is unavailable.
        });
        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleDelete = async (e: React.MouseEvent, contestId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (deleteConfirmId !== contestId) {
            setDeleteConfirmId(contestId);
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 3000);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('contests')
                .delete()
                .eq('id', contestId)
                .select('id');

            if (error) throw error;
            if (!data?.some(row => row.id === contestId)) {
                setDashboardMessage('The board could not be deleted. Reload your boards and try again.');
                setDeleteConfirmId(null);
                return;
            }
            setDashboardMessage(null);
            setDeleteConfirmId(null);
            setContests(current => current.filter(c => c.id !== contestId));
        } catch (err) {
            console.error('Error deleting contest:', err);
            setDashboardMessage('The board could not be deleted. Try again.');
        }
    };

    if (authLoading || loading) {
        return (
            <Base kind="cream" className="flex flex-col items-center justify-center gap-5">
                <SquareOne size={88} />
                <p role="status" className="font-ui text-[15px] text-fg-2">Loading your boards…</p>
            </Base>
        );
    }

    if (migrating) {
        return (
            <Base kind="cream" className="flex flex-col items-center justify-center gap-5">
                <SquareOne size={88} />
                <p role="status" className="font-ui text-[15px] text-fg-2">Finalizing your board setup…</p>
            </Base>
        );
    }

    return (
        <Base kind="cream">
            <main aria-label="Your boards" className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 md:px-8 md:py-14">
                <a href="/" className="inline-flex min-h-11 w-fit items-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
                    <Logo variant="horizontal" size={28} />
                </a>

                {dashboardMessage && (
                    <Glass role="alert" className="font-ui text-[15px] text-tone-cardinal">
                        {dashboardMessage}
                    </Glass>
                )}

                {dashboardLoadError && (
                    <Glass role="alert" className="flex flex-wrap items-center justify-between gap-3 font-ui text-[15px] text-tone-cardinal">
                        <span>Your boards could not be loaded. {dashboardLoadError}</span>
                        <CapsuleButton variant="quiet" onClick={() => void fetchContests()}>Retry</CapsuleButton>
                    </Glass>
                )}

                {showMigratedToast && (
                    <Glass role="status" className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <h2 className="font-display text-[22px] leading-none text-fg">Board Saved!</h2>
                            <p className="font-ui text-[14px] text-fg-2">Your guest board has been successfully saved to your account.</p>
                        </div>
                        <CapsuleButton
                            variant="quiet"
                            aria-label="Dismiss board saved message"
                            onClick={() => setShowMigratedToast(false)}
                        >
                            Dismiss
                        </CapsuleButton>
                    </Glass>
                )}

                {pendingGuestBoard && !showMigratedToast && (
                    <Glass className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="font-display text-[22px] leading-none text-fg">Unsaved Board Found</h2>
                            <p className="font-ui text-[14px] text-fg-2">
                                {`We found "${pendingGuestBoard.game.title || 'a board'}" that you started before signing in. Save it to your account or discard it.`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <CapsuleButton variant="ghost" onClick={handleDiscardDraft}>
                                {discardConfirm ? 'CONFIRM DISCARD' : 'Discard'}
                            </CapsuleButton>
                            <CapsuleButton variant="primary" onClick={handleManualMigration}>
                                Save to Account
                            </CapsuleButton>
                        </div>
                    </Glass>
                )}

                <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-3">
                        <Eyebrow>Organizer</Eyebrow>
                        <h1 className="font-display text-[40px] leading-[1] tracking-[-0.01em] text-fg md:text-[52px]">Your boards</h1>
                        {billingSummary && (
                            <CapsuleTag className="self-start">
                                {billingSummary.used} of {billingSummary.allowance} published · {tierLabel(billingSummary)}
                            </CapsuleTag>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/create" className={CAPSULE_LINK}>New board</Link>
                        <CapsuleButton variant="ghost" onClick={() => signOut()}>Log out</CapsuleButton>
                    </div>
                </header>

                {contests.length === 0 ? (
                    <Glass padding="lg" className="flex flex-col items-start gap-4">
                        <SquareOne size={72} />
                        <p className="font-display text-[26px] leading-[1.05] text-fg">No boards yet.</p>
                        <Link to="/create" className={CAPSULE_LINK}>New board</Link>
                    </Glass>
                ) : (
                    <ul role="list" className="flex flex-col gap-3">
                        {contests.map((contest) => {
                            const filled = filledCount(contest.board_data);
                            const drawn = numbersDrawn(contest.board_data);
                            const published = hasBoardActivation(contest.board_activations) || Boolean(contest.published_at);
                            const confirming = deleteConfirmId === contest.id;
                            const boardName = contest.title?.trim() || 'Untitled board';
                            return (
                                <li key={contest.id}>
                                    <Glass className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <Link
                                                to={`/boards/${contest.id}`}
                                                className="font-display text-[22px] leading-[1.1] text-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-ground rounded-control"
                                            >
                                                {boardName}
                                            </Link>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-fg-3">
                                                    {contest.settings?.leftAbbr || 'TBD'} at {contest.settings?.topAbbr || 'TBD'}
                                                </span>
                                                <CapsuleTag tone={published ? 'turf' : 'neutral'}>
                                                    {contest.shared_at && !contest.published_at ? 'Selling squares' : published ? 'Published' : 'Draft'}
                                                </CapsuleTag>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-5">
                                            <Link to={`/boards/${contest.id}`} className={CAPSULE_LINK} aria-label={`Manage ${boardName}`}>Manage board</Link>
                                            <CapsuleButton
                                                variant="quiet"
                                                aria-label={`Run another board using ${boardName}`}
                                                onClick={() => navigate('/create', { state: {
                                                    boardTemplate: projectBoardTemplate({ title: boardName, payoutDescriptions: contest.payout_descriptions }),
                                                } })}
                                            >Run another board</CapsuleButton>
                                            <IslandRings
                                                rings={[
                                                    {
                                                        value: filled / 100,
                                                        caption: `${filled}%`,
                                                        label: `${filled} of 100 squares filled on ${boardName}`,
                                                    },
                                                    {
                                                        value: drawn ? 1 : 0,
                                                        caption: drawn ? 'Drawn' : 'Draw',
                                                        label: drawn
                                                            ? `Numbers drawn on ${boardName}`
                                                            : `Numbers not drawn on ${boardName}`,
                                                        tone: 'turf',
                                                    },
                                                ]}
                                            />
                                            {!contest.shared_at && !contest.published_at && ['draft', 'reconciling', 'ready'].includes(contest.status) ? <CapsuleButton
                                                variant="quiet"
                                                onClick={(e) => void handleDelete(e, contest.id)}
                                                aria-label={confirming ? `Confirm deletion of ${boardName}` : `Delete ${boardName}`}
                                            >
                                                {confirming ? 'Confirm?' : 'Delete'}
                                            </CapsuleButton> : <p className="max-w-64 font-ui text-[13px] text-fg-3">Only private drafts can be deleted. Shared and published boards are kept to preserve their links and records.</p>}
                                        </div>
                                    </Glass>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <footer className="mt-6 flex flex-col gap-3 border-t border-hairline pt-6 font-ui text-[13px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>© {new Date().getFullYear()} GridOne.</span>
                    <span className="flex items-center gap-5">
                        <Link to="/privacy" className={ghostLink}>Privacy</Link>
                        <Link to="/terms" className={ghostLink}>Terms</Link>
                        <a href="mailto:support@getgridone.com" className={ghostLink}>Support</a>
                    </span>
                </footer>
            </main>
        </Base>
    );
};

export default Dashboard;
