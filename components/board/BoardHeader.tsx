import React from 'react';
import { Link } from 'react-router-dom';
import { GameState } from '../../types';

interface BoardHeaderProps {
    game: GameState;
    adminToken: string;
    isOwner: boolean;
    activePoolId: string | null;
    isActivated: boolean;
    isSynced: boolean;
    activeTab: 'live' | 'board';
    onTabChange: (tab: 'live' | 'board') => void;
    isPreviewMode: boolean;
    onTogglePreview: (enabled: boolean) => void;
    adminStartTab: 'overview' | 'edit';
    onAdminStartTab: (tab: 'overview' | 'edit') => void;
    onShareClick: () => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({
    game,
    adminToken,
    isOwner,
    activePoolId,
    isActivated,
    isSynced,
    activeTab,
    onTabChange,
    isPreviewMode,
    onTogglePreview,
    adminStartTab,
    onAdminStartTab,
    onShareClick,
}) => {
    const showAdminHeader = (adminToken || isOwner) && !isPreviewMode;

    if (showAdminHeader) {
        return (
            <div className="premium-glass px-4 md:px-5 py-3 rounded-2xl flex items-center justify-between gap-4 backdrop-blur-2xl border border-white/10 shadow-2xl mb-6">
                <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-black/20 group-hover:bg-white/10 flex items-center justify-center shadow-md border border-white/10 hover:border-white/20 transition-all flex-shrink-0 overflow-hidden ring-1 ring-gold/50">
                        <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-white tracking-tight group-hover:text-gold transition-colors">Organizer</h3>
                        <p className="text-xs font-medium text-white/50 truncate group-hover:text-white/70 transition-colors">
                            {game.title || 'Untitled board'}
                        </p>
                    </div>
                </Link>

                <div className="hidden md:flex items-center bg-black/30 p-0.5 rounded-full border border-white/[0.08]">
                    <button
                        onClick={() => { onAdminStartTab('overview'); onTogglePreview(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => { onAdminStartTab('edit'); onTogglePreview(false); }}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold text-white/50 hover:text-white transition-colors"
                    >
                        Edit
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black shadow-sm">
                        Preview
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[13px] font-semibold text-white/50">Saved</span>
                    </div>
                    {activePoolId && isActivated && (
                        <button
                            onClick={onShareClick}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all"
                            title="Share Board"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => onTogglePreview(false)}
                        className="md:hidden px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10 hover:bg-white hover:text-black transition-all"
                    >
                        Edit
                    </button>
                </div>
            </div>
        );
    }

    // Public header
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <a href="/dashboard" className="w-10 h-10 rounded-xl bg-black/20 hover:bg-white/10 flex items-center justify-center shadow-lg border border-white/10 hover:border-white/20 transition-all overflow-hidden cursor-pointer group ring-1 ring-gold/50">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                </a>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-none tracking-tight text-white mb-1">{game.title || 'Super Bowl LIX'}</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60 font-medium">
                            {game.leftAbbr} vs {game.topAbbr} • {game.dates || 'Feb 9, 2025'}
                        </span>
                        {isSynced && <span className="w-1.5 h-1.5 rounded-full bg-live shadow-[0_0_8px_var(--color-live)]" title="Live Sync Active" />}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center bg-white/10 p-0.5 rounded-full border border-white/5">
                    <button
                        onClick={() => onTabChange('live')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'live' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                    >
                        Live
                    </button>
                    <button
                        onClick={() => onTabChange('board')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all ${activeTab === 'board' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                    >
                        Board
                    </button>
                </div>
                {activePoolId && isActivated && (
                    <button
                        onClick={onShareClick}
                        className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default BoardHeader;
