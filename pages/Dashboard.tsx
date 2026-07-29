import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Trophy, Save, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import usePoolData from '../hooks/usePoolData';
import { GameState } from '../types';
import EmptyState from '../components/empty/EmptyState';
import FullScreenLoading from '../components/loading/FullScreenLoading';

interface Contest {
    id: string;
    title: string;
    created_at: string;
    settings: GameState;
    board_activations?: Array<{ id: string }>;
}

const Dashboard: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const { migrateGuestBoard } = usePoolData();
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingGuestBoard, setPendingGuestBoard] = useState<{ game: any, board: any } | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [dashboardMessage, setDashboardMessage] = useState<string | null>(null);
    const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const [showMigratedToast, setShowMigratedToast] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (searchParams.get('migrated') === 'true') {
            setShowMigratedToast(true);
            window.history.replaceState({}, '', '/dashboard');
            setTimeout(() => setShowMigratedToast(false), 5000);
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
        const isClaimMode = searchParams.get('mode') === 'claim';
        if (user && pendingGuestBoard && !migrating && isClaimMode) {
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

    const fetchContests = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setDashboardLoadError(null);
        try {
            const { data, error } = await supabase
                .from('contests')
                .select('id, title, created_at, settings, board_activations(id)')
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

    const handleDelete = async (e: React.MouseEvent, contestId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (deleteConfirmId !== contestId) {
            setDeleteConfirmId(contestId);
            setTimeout(() => setDeleteConfirmId(null), 3000);
            return;
        }

        try {
            const { error } = await supabase
                .from('contests')
                .delete()
                .eq('id', contestId);

            if (error) throw error;
            setContests(current => current.filter(c => c.id !== contestId));
        } catch (err) {
            console.error('Error deleting contest:', err);
            setDashboardMessage('The board could not be deleted. Try again.');
        }
    };

    if (authLoading || loading) {
        return (
            <div className="oa-root flex items-center justify-center h-screen bg-broadcast-white text-ink">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-control border-4 border-newsprint border-t-cardinal animate-spin"></div>
                    <p className="text-sm text-ink/60 font-medium tracking-wide">LOADING STADIUM...</p>
                </div>
            </div>
        );
    }

    if (migrating) {
        return <FullScreenLoading message="Finalizing your board setup..." />;
    }

    return (
        <div className="oa-root min-h-screen bg-broadcast-white text-ink p-6 relative">
            {dashboardMessage && (
                <div className="max-w-6xl mx-auto mb-6 border border-cardinal bg-cardinal-subtle p-4 text-sm text-cardinal" role="alert">
                    {dashboardMessage}
                </div>
            )}
            {dashboardLoadError && (
                <div className="max-w-6xl mx-auto mb-6 border border-cardinal bg-cardinal-subtle p-4 text-sm text-cardinal flex flex-wrap items-center justify-between gap-3" role="alert">
                    <span>Your boards could not be loaded. {dashboardLoadError}</span>
                    <button type="button" onClick={() => void fetchContests()} className="oa-btn oa-btn-ghost">
                        Retry
                    </button>
                </div>
            )}

            {pendingGuestBoard && !showMigratedToast && (
                <div className="max-w-6xl mx-auto mb-6 duration-500">
                    <div className="bg-cardinal-subtle border border-cardinal rounded-surface p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {migrating ? (
                                <div className="w-12 h-12 rounded-surface bg-cardinal-subtle flex items-center justify-center border border-cardinal">
                                    <div className="w-6 h-6 border-2 border-cardinal border-t-transparent rounded-control animate-spin"></div>
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-surface bg-cardinal-subtle flex items-center justify-center border border-cardinal">
                                    <Save className="w-6 h-6 text-cardinal" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-bold text-ink mb-1">
                                    {migrating ? 'Syncing Board...' : 'Unsaved Board Found'}
                                </h3>
                                <p className="text-sm text-cardinal">
                                    {migrating
                                        ? `Saving "${pendingGuestBoard.game.title}" to your account...`
                                        : `We found "${pendingGuestBoard.game.title || 'a board'}" on this device. Saving it now...`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {!migrating && (
                                <button
                                    onClick={() => {
                                        const btn = document.activeElement as HTMLElement;
                                        if (btn.innerText === "CONFIRM DISCARD") {
                                            localStorage.removeItem('squares_game');
                                            localStorage.removeItem('squares_board');
                                            setPendingGuestBoard(null);
                                        } else {
                                            btn.innerText = "CONFIRM DISCARD";
                                            btn.classList.add("text-cardinal", "bg-cardinal-subtle");
                                            setTimeout(() => {
                                                if (btn && btn.isConnected) {
                                                    btn.innerText = "Discard";
                                                    btn.classList.remove("text-cardinal", "bg-cardinal-subtle");
                                                }
                                            }, 3000);
                                        }
                                    }}
                                    className="px-4 py-2 rounded-control text-xs font-bold uppercase tracking-widest text-cardinal hover:text-ink transition-all"
                                >
                                    Discard
                                </button>
                            )}
                            <button
                                onClick={handleManualMigration}
                                disabled={migrating}
                                className="px-6 py-3 rounded-control bg-cardinal hover:bg-cardinal-deep text-broadcast-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                {migrating ? 'Saving...' : 'Save to Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMigratedToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 duration-300">
                    <div className="bg-gold border border-gold-deep text-ink px-6 py-4 rounded-surface flex items-center gap-4">
                        <div className="w-8 h-8 rounded-surface bg-gold flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-ink">Board Saved!</h3>
                            <p className="text-xs text-ink/80">Your guest board has been successfully saved to your account.</p>
                        </div>
                        <button
                            onClick={() => setShowMigratedToast(false)}
                            className="ml-2 min-h-11 min-w-11 hover:bg-broadcast-white/40 hover:text-ink"
                            aria-label="Dismiss board saved message"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto space-y-8">

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-newsprint pb-6">
                    <div>
                        <h1 className="oa-headline mb-2">My Boards</h1>
                        <p className="oa-body text-ink/60">Create, edit, and unlock share access for your GridOne boards.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {contests.length > 0 && (
                            <Link to="/create" className="oa-btn oa-btn-cardinal flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                New Board
                            </Link>
                        )}
                        <button
                            onClick={() => signOut()}
                            className="min-h-11 min-w-11 p-2 text-ink/60 hover:bg-newsprint hover:text-ink transition-colors"
                            aria-label="Log out"
                            title="Log Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {contests.length > 0 && (
                        <Link to="/create" className="group relative aspect-video bg-broadcast-white border border-newsprint rounded-surface overflow-hidden hover:border-newsprint transition-all hover:bg-broadcast-white flex flex-col items-center justify-center gap-4 cursor-pointer">
                            <div className="w-16 h-16 rounded-surface bg-newsprint group-hover:bg-newsprint flex items-center justify-center transition-colors border border-newsprint duration-300">
                                <Plus className="w-8 h-8 text-ink/40 group-hover:text-ink" strokeWidth={1.5} />
                            </div>
                            <span className="oa-slab text-ink/60 group-hover:text-ink">Create New Board</span>
                        </Link>
                    )}

                    {pendingGuestBoard && !showMigratedToast && (
                        <div
                            onClick={handleManualMigration}
                            className="group relative aspect-video bg-cardinal/10 border border-cardinal/50 border-dashed rounded-surface overflow-hidden hover:bg-cardinal/20 transition-all flex flex-col cursor-pointer"
                        >
                            <div className="absolute top-4 left-4 z-20">
                                <span className="px-2 py-1 rounded-control bg-cardinal text-broadcast-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Save className="w-3 h-3" />
                                    Unsaved Board
                                </span>
                            </div>

                            <div className="flex-1 relative overflow-hidden bg-newsprint">
                                {pendingGuestBoard.game.coverImage ? (
                                    <img src={pendingGuestBoard.game.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500" alt="Cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Trophy className="w-12 h-12 text-cardinal/40" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-newsprint group-hover:bg-transparent transition-colors"></div>

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                    <span className="px-4 py-2 bg-broadcast-white text-cardinal rounded-control text-xs font-black uppercase tracking-widest">
                                        {migrating ? 'Saving...' : 'Click to Save'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 border-t border-cardinal/20 bg-cardinal/5 relative z-10">
                                <h3 className="text-base font-bold text-ink truncate mb-1">{pendingGuestBoard.game.title || 'My New Board'}</h3>
                                <p className="text-xs text-cardinal font-medium">Guest Board Found • 100 Squares</p>
                            </div>
                        </div>
                    )}

                    {contests.length === 0 && !pendingGuestBoard && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <EmptyState
                                variant="first-time"
                                title="No Boards Yet"
                                description="You haven't created a football squares board yet. Start one for the big game."
                                action={{ label: "Create Your First Board", to: "/create" }}
                                icon={<Trophy className="w-8 h-8 text-gold" strokeWidth={1.5} />}
                            />
                        </div>
                    )}

                    {contests.map(contest => (
                        <Link key={contest.id} to={`/boards/${contest.id}`} className="group relative aspect-video bg-broadcast-white border border-newsprint rounded-surface overflow-hidden hover:border-cardinal/50 transition-all flex flex-col">

                            <div className="flex-1 relative overflow-hidden">
                                {contest.settings.coverImage ? (
                                    <img src={contest.settings.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-all duration-700" alt="Cover" />
                                ) : (
                                    <div className="absolute inset-0 bg-cardinal"></div>
                                )}

                                <div className="absolute top-4 left-4 flex items-center gap-2">
                                    <span className="px-2 py-1 rounded-control bg-ink/80 border border-ink text-[10px] font-bold uppercase tracking-wider text-broadcast-white">
                                        {contest.settings.leftAbbr || 'UNK'} vs {contest.settings.topAbbr || 'UNK'}
                                    </span>
                                </div>

                                <button
                                    onClick={(e) => handleDelete(e, contest.id)}
                                    aria-label={deleteConfirmId === contest.id ? `Confirm deletion of ${contest.title}` : `Delete ${contest.title}`}
                                    className={`absolute top-4 right-4 z-20 min-h-11 p-2 rounded-control border transition-all ${deleteConfirmId === contest.id ? 'bg-cardinal text-broadcast-white border-cardinal-deep w-auto px-3' : 'bg-newsprint text-ink/40 border-newsprint hover:bg-cardinal-subtle hover:text-cardinal hover:border-cardinal min-w-11 flex items-center justify-center'}`}
                                >
                                    {deleteConfirmId === contest.id ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Confirm?</span>
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>

                                {!contest.board_activations?.length && (
                                    <div className="absolute bottom-4 left-4 z-20">
                                        <span className="px-2 py-1 rounded-control bg-gold border border-gold-deep text-[10px] font-bold uppercase tracking-wider text-ink flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            Draft · sharing off
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-broadcast-white border-t border-newsprint relative z-10 group-hover:bg-broadcast-white transition-colors">
                                <h3 className="text-base font-bold text-ink truncate mb-1 group-hover:text-cardinal transition-colors">{contest.title}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-ink/50 font-medium">{new Date(contest.created_at).toLocaleDateString()}</span>
                                    <span className="text-[10px] uppercase font-bold text-cardinal opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">Open Board &rarr;</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-8 border-t border-newsprint text-xs text-ink/50">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>© {new Date().getFullYear()} GridOne.</div>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
                            <Link to="/terms" className="hover:text-ink transition-colors">Terms</Link>
                            <a href="mailto:support@getgridone.com" className="hover:text-ink transition-colors">Support</a>
                        </div>
                    </div>
                </footer>
            </div>


        </div>
    );
};

export default Dashboard;
