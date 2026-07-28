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
            <div className="bg-broadcast-white ring-[3px] ring-ink px-4 md:px-5 py-3 flex items-center justify-between gap-4 mb-6">
                <Link to="/dashboard" className="flex min-h-11 items-center gap-3 min-w-0 group cursor-pointer">
                    <div className="w-9 h-9 bg-ink flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="oa-slab text-ink group-hover:text-cardinal transition-colors">Organizer</h3>
                        <p className="oa-data text-xs text-ink/50 truncate">
                            {game.title || 'Untitled board'}
                        </p>
                    </div>
                </Link>

                <div className="hidden md:flex items-center gap-px bg-ink p-px">
                    <button
                        onClick={() => { onAdminStartTab('overview'); onTogglePreview(false); }}
                        className="oa-slab min-h-11 px-4 py-2 bg-broadcast-white text-ink/60 hover:text-ink hover:bg-newsprint transition-colors"
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => { onAdminStartTab('edit'); onTogglePreview(false); }}
                        className="oa-slab min-h-11 px-4 py-2 bg-broadcast-white text-ink/60 hover:text-ink hover:bg-newsprint transition-colors"
                    >
                        Edit
                    </button>
                    <button className="oa-slab min-h-11 px-4 py-2 bg-cardinal text-broadcast-white">
                        Preview
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-newsprint">
                        <svg className="w-3.5 h-3.5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="oa-slab text-ink/60">Saved</span>
                    </div>
                    {activePoolId && isActivated && (
                        <button
                            onClick={onShareClick}
                            className="min-w-11 min-h-11 flex items-center justify-center bg-broadcast-white ring-1 ring-inset ring-ink text-ink hover:bg-newsprint transition-colors"
                            aria-label="Share board"
                            title="Share Board"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => onTogglePreview(false)}
                        className="oa-slab min-h-11 md:hidden px-4 py-2 bg-cardinal text-broadcast-white hover:bg-cardinal-deep transition-colors"
                    >
                        Edit
                    </button>
                </div>
            </div>
        );
    }

    // Public header: one continuous Split Stage, no Live/Board mode switch.
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <a href="/" className="w-11 h-11 bg-ink flex items-center justify-center overflow-hidden cursor-pointer" aria-label="GridOne home">
                    <img src="/icons/gridone-icon-256.png" alt="GridOne" className="w-full h-full object-cover" />
                </a>
                <div className="flex flex-col">
                    <h1 className="oa-headline !text-xl text-ink mb-1">{game.title || 'Football squares board'}</h1>
                    <div className="flex items-center gap-2">
                        <span className="oa-data text-xs text-ink/60">
                            {game.leftAbbr} vs {game.topAbbr}{game.dates ? ` · ${game.dates}` : ''}
                        </span>
                        {isSynced && game.scoreSnapshot?.state === 'in' && (
                            <span className="oa-slab text-live">Live</span>
                        )}
                    </div>
                </div>
            </div>

            {activePoolId && isActivated && (
                <button
                    onClick={onShareClick}
                    className="min-w-11 min-h-11 p-2.5 bg-broadcast-white ring-1 ring-inset ring-ink text-ink hover:bg-newsprint transition-colors"
                    aria-label="Share board"
                >
                    <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default BoardHeader;
