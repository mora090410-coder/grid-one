
import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Trophy, Save, LogOut } from 'lucide-react'; // Added Save icon
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import usePoolData from '../hooks/usePoolData'; // Added Hook
import { GameState, BoardData } from '../types';
import EmptyState from '../components/empty/EmptyState';
import FullScreenLoading from '../components/loading/FullScreenLoading';

interface Contest {
    id: string;
    title: string;
    created_at: string;
    settings: GameState;
}

const Dashboard: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const { migrateGuestBoard } = usePoolData(); // Use Hook
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingGuestBoard, setPendingGuestBoard] = useState<{ game: any, board: any } | null>(null);
    const [migrating, setMigrating] = useState(false); // Local migrating state
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
            // Clean URL without refresh
            window.history.replaceState({}, '', '/dashboard');
            setTimeout(() => setShowMigratedToast(false), 5000);
        }
    }, [searchParams]);

    useEffect(() => {
        // Check for pending guest board
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

    // Auto-migrate guest board if exists AND mode is 'claim'
    useEffect(() => {
        const isClaimMode = searchParams.get('mode') === 'claim';
        if (user && pendingGuestBoard && !migrating && isClaimMode) {
            handleManualMigration();
        }
    }, [user, pendingGuestBoard, searchParams]);

    const handleManualMigration = async () => {
        if (!user || !pendingGuestBoard || migrating) return;

        // Safety Check: Avoid duplicates if user refreshed or it's already there
        const alreadyExists = contests.some(c => c.title === pendingGuestBoard.game.title);
        if (alreadyExists) {
            console.log("Board already exists in cloud, clearing local storage.");
            localStorage.removeItem('squares_game');
            localStorage.removeItem('squares_board');
            setPendingGuestBoard(null);
            return;
        }

        setMigrating(true);
        try {
            const newId = await migrateGuestBoard(user, pendingGuestBoard);
            // Clear storage
            localStorage.removeItem('squares_game');
            localStorage.removeItem('squares_board');

            // Cleanup URL (remove mode=claim)
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('mode');
            setSearchParams(newParams);

            // Show success and reload
            window.location.href = `/?poolId=${newId}&migrated=true&forceAdmin=true`;
        } catch (err) {
            console.error("Manual migration failed", err);
            // Only alert if it's a real error, not a duplicate key race condition
            if (err instanceof Error && !err.message.includes('duplicate')) {
                alert("Failed to save board. Please try again.");
            }
            setMigrating(false);
        }
    };

    useEffect(() => {
        async function fetchContests() {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('contests')
                    .select('id, title, created_at, settings')
                    .eq('owner_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setContests(data || []);
            } catch (err) {
                console.error('Error fetching contests:', err);
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            fetchContests();
        }
    }, [user]);

    const handleDelete = async (e: React.MouseEvent, contestId: string, contestTitle: string) => {
        e.preventDefault(); // Prevent navigation
        e.stopPropagation();

        if (deleteConfirmId !== contestId) {
            setDeleteConfirmId(contestId);
            setTimeout(() => setDeleteConfirmId(null), 3000);
            return;
        }

        try {
            // 1. Delete from Supabase
            const { error } = await supabase
                .from('contests')
                .delete()
                .eq('id', contestId);

            if (error) throw error;

            // 2. Update local state
            setContests(current => current.filter(c => c.id !== contestId));
        } catch (err) {
            console.error('Error deleting contest:', err);
            alert('Failed to delete contest. Please try again.');
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#050505] text-white">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-[#9D2235] animate-spin"></div>
                    <p className="text-sm text-gray-400 font-medium tracking-wide">LOADING STADIUM...</p>
                </div>
            </div>
        );
    }

    if (migrating) {
        return <FullScreenLoading message="Finalizing your board setup..." />;
    }


    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 font-sans relative">

            {pendingGuestBoard && !showMigratedToast && (
                <div className="max-w-6xl mx-auto mb-6 animate-in slide-in-from-top-4 fade-in duration-500">
                    <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 flex items-center justify-between shadow-lg backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            {migrating ? (
                                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                                    <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                                    <Save className="w-6 h-6 text-indigo-400" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                    {migrating ? 'Syncing Board...' : 'Unsaved Board Found'}
                                </h3>
                                <p className="text-sm text-indigo-200">
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
                                        // Use a temporary state for confirmation to avoid "flash" of native confirm
                                        const btn = document.activeElement as HTMLElement;
                                        if (btn.innerText === "CONFIRM DISCARD") {
                                            localStorage.removeItem('squares_game');
                                            localStorage.removeItem('squares_board');
                                            setPendingGuestBoard(null);
                                        } else {
                                            btn.innerText = "CONFIRM DISCARD";
                                            btn.classList.add("text-red-500", "bg-red-500/10");
                                            setTimeout(() => {
                                                if (btn && btn.isConnected) {
                                                    btn.innerText = "Discard";
                                                    btn.classList.remove("text-red-500", "bg-red-500/10");
                                                }
                                            }, 3000);
                                        }
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-indigo-300 hover:text-white transition-all"
                                >
                                    Discard
                                </button>
                            )}
                            <button
                                onClick={handleManualMigration}
                                disabled={migrating}
                                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                {migrating ? 'Saving...' : 'Save to Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMigratedToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-green-500/10 border border-green-500/20 backdrop-blur-md text-green-400 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Board Saved!</h3>
                            <p className="text-xs text-green-400/80">Your guest board has been successfully saved to your account.</p>
                        </div>
                        <button onClick={() => setShowMigratedToast(false)} className="ml-2 hover:text-white">&times;</button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-display mb-2">My Contests</h1>
                        <p className="text-body-secondary">Manage your football squares contests</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {contests.length > 0 && (
                            <Link to="/create" className="btn-cardinal text-button flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                New Contest
                            </Link>
                        )}
                        <button
                            onClick={() => signOut()}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Log Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Create New Card (Mobile/Desktop Grid Item) - Only show if we have contests, otherwise EmptyState takes over */}
                    {contests.length > 0 && (
                        <Link to="/create" className="group relative aspect-video bg-[#1c1c1e]/40 border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all hover:bg-[#1c1c1e]/60 flex flex-col items-center justify-center gap-4 cursor-pointer">
                            <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5 group-hover:scale-110 duration-300">
                                <Plus className="w-8 h-8 text-white/40 group-hover:text-white" strokeWidth={1.5} />
                            </div>
                            <span className="text-button text-gray-400 group-hover:text-white">Create New Contest</span>
                        </Link>
                    )}

                    {/* Pending Guest Board Card (if exists) */}
                    {pendingGuestBoard && !showMigratedToast && (
                        <div
                            onClick={handleManualMigration}
                            className="group relative aspect-video bg-[#9D2235]/10 border border-[#9D2235]/50 border-dashed rounded-2xl overflow-hidden hover:bg-[#9D2235]/20 transition-all flex flex-col cursor-pointer animate-in fade-in"
                        >
                            {/* Badger for Unsaved */}
                            <div className="absolute top-4 left-4 z-20">
                                <span className="px-2 py-1 rounded bg-[#9D2235] text-white text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1">
                                    <Save className="w-3 h-3" />
                                    Unsaved Board
                                </span>
                            </div>

                            {/* Cover Preview */}
                            <div className="flex-1 relative overflow-hidden bg-black/20">
                                {pendingGuestBoard.game.coverImage ? (
                                    <img src={pendingGuestBoard.game.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-500" alt="Cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Trophy className="w-12 h-12 text-[#9D2235]/40" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>

                                {/* Center Action */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                    <span className="px-4 py-2 bg-white text-[#9D2235] rounded-full text-xs font-black uppercase tracking-widest shadow-xl">
                                        {migrating ? 'Saving...' : 'Click to Save'}
                                    </span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-[#9D2235]/20 bg-[#9D2235]/5 relative z-10">
                                <h3 className="text-base font-bold text-white truncate mb-1">{pendingGuestBoard.game.title || 'My New Board'}</h3>
                                <p className="text-xs text-[#9D2235] font-medium">Guest Board Found • 100 Squares</p>
                            </div>
                        </div>
                    )}

                    {contests.length === 0 && !pendingGuestBoard && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <EmptyState
                                variant="first-time"
                                title="No Contests Yet"
                                description="You haven't created any football squares contests yet. Start a new contest for the big game!"
                                action={{ label: "Create Your First Contest", to: "/create" }}
                                icon={<Trophy className="w-8 h-8 text-gold" strokeWidth={1.5} />}
                            />
                        </div>
                    )}

                    {contests.map(contest => (
                        <Link key={contest.id} to={`/?poolId=${contest.id}&forceAdmin=true`} className="group relative aspect-video bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden hover:border-[#9D2235]/50 transition-all hover:shadow-2xl hover:shadow-[#9D2235]/10 flex flex-col">

                            {/* Cover Image or Gradient */}
                            <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-gray-900 to-black">
                                {contest.settings.coverImage ? (
                                    <img src={contest.settings.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700" alt="Cover" />
                                ) : (
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#9D2235]/20 via-transparent to-transparent"></div>
                                )}

                                {/* Teams Badge */}
                                <div className="absolute top-4 left-4 flex items-center gap-2">
                                    <span className="px-2 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white">
                                        {contest.settings.leftAbbr || 'UNK'} vs {contest.settings.topAbbr || 'UNK'}
                                    </span>
                                </div>

                                {/* Delete Button (Top Right) */}
                                <button
                                    onClick={(e) => handleDelete(e, contest.id, contest.title)}
                                    className={`absolute top-4 right-4 p-2 rounded-full backdrop-blur-sm transition-all z-20 flex items-center gap-2 ${deleteConfirmId === contest.id
                                        ? "bg-red-600 text-white opacity-100 border border-red-500 shadow-xl px-3 w-auto translate-y-0"
                                        : "bg-black/40 text-white/40 hover:bg-red-500/20 hover:text-red-400 border border-white/5 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 w-8 h-8 justify-center"
                                        }`}
                                    title="Delete Contest"
                                >
                                    <Trash2 className="w-4 h-4 min-w-[16px]" strokeWidth={1.5} />
                                    {deleteConfirmId === contest.id && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Confirm?</span>
                                    )}
                                </button>
                            </div>

                            {/* Footer Info */}
                            <div className="p-4 bg-[#1c1c1e] border-t border-white/5 relative z-10 group-hover:bg-[#252527] transition-colors">
                                <h3 className="text-base font-bold text-white truncate mb-1 group-hover:text-[#9D2235] transition-colors">{contest.title}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">{new Date(contest.created_at).toLocaleDateString()}</span>
                                    <span className="text-[10px] uppercase font-bold text-[#9D2235] opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">Open Board &rarr;</span>
                                </div>
                            </div>

                        </Link>
                    ))}
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-8 border-t border-white/10 text-xs text-white/50">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>© {new Date().getFullYear()} GridOne.</div>
                        <div className="flex gap-6">
                            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                            <a href="mailto:support@gridone.app" className="hover:text-white transition-colors">Support</a>
                        </div>
                    </div>
                </footer>
            </div>
            {/* DEBUG OVERLAY */}
            <div className="fixed bottom-4 right-4 p-4 bg-black/80 border border-red-500 rounded z-50 text-xs text-red-300 font-mono pointer-events-none">
                <p>User: {user?.id || 'None'}</p>
                <p>Contests: {contests.length}</p>
                <p>Storage: {localStorage.getItem('squares_game') ? 'Has Game' : 'No Game'}</p>
                <p>Pending: {pendingGuestBoard ? 'Yes' : 'No'}</p>
            </div>
        </div>
    );
};

export default Dashboard;
