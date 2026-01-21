
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { GameState } from '../types';
import EmptyState from '../components/empty/EmptyState';

interface Contest {
    id: string;
    title: string;
    created_at: string;
    settings: GameState;
}

const Dashboard: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

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

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">My Contests</h1>
                        <p className="text-gray-400 text-sm">Manage your football squares pools</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/create" className="btn-cardinal px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                            New Contest
                        </Link>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Create New Card (Mobile/Desktop Grid Item) */}
                    <Link to="/create" className="group relative aspect-video bg-[#1c1c1e]/40 border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all hover:bg-[#1c1c1e]/60 flex flex-col items-center justify-center gap-4 cursor-pointer">
                        <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5 group-hover:scale-110 duration-300">
                            <svg className="w-8 h-8 text-white/40 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="text-sm font-bold text-gray-400 group-hover:text-white uppercase tracking-widest">Create New Pool</span>
                    </Link>

                    {contests.length === 0 && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <EmptyState
                                variant="first-time"
                                title="No Contests Yet"
                                description="You haven't created any football squares pools yet. Start a new contest for the big game!"
                                action={{ label: "Create Your First Pool", to: "/create" }}
                                icon={
                                    <svg className="w-8 h-8 text-[#FFC72C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                }
                            />
                        </div>
                    )}

                    {contests.map(contest => (
                        <Link key={contest.id} to={`/?poolId=${contest.id}`} className="group relative aspect-video bg-[#1c1c1e] border border-white/10 rounded-2xl overflow-hidden hover:border-[#9D2235]/50 transition-all hover:shadow-2xl hover:shadow-[#9D2235]/10 flex flex-col">

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
            </div>
        </div>
    );
};

export default Dashboard;
