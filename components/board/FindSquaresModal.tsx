import React, { useMemo, useRef, useState } from 'react';
import { BoardData } from '../../types';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { distinctAssignedNames, matchPlayerNames } from '../../utils/playerNameMatching';

interface FindSquaresModalProps {
    board: BoardData;
    selectedPlayer: string;
    onSelectPlayer: (player: string) => void;
    onClose: () => void;
}

const FindSquaresModal: React.FC<FindSquaresModalProps> = ({ board, selectedPlayer, onSelectPlayer, onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    useDialogFocus(dialogRef, onClose);

    const assignedNames = useMemo(() => distinctAssignedNames(board.squares), [board.squares]);
    const result = useMemo(() => matchPlayerNames(query, assignedNames), [assignedNames, query]);
    const hasQuery = query.trim().length > 0;
    const showBrowseList = !hasQuery || result.tier === 'none';

    const selectPlayer = (player: string) => {
        onSelectPlayer(player);
        onClose();
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (result.autoSelect) selectPlayer(result.autoSelect);
    };

    return (
    <div className="oa-root fixed inset-0 z-[90] flex items-end md:items-center justify-center">
        <button type="button" className="absolute inset-0 bg-ink/80 cursor-default" onClick={onClose} aria-label="Close Find my squares" />
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="find-squares-title" className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-broadcast-white ring-[3px] ring-ink">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 id="find-squares-title" className="oa-headline !text-lg text-ink">Find my squares</h3>
                    <button onClick={onClose} className="min-w-11 min-h-11 p-2 text-ink/60 hover:bg-newsprint transition-colors" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <label htmlFor="viewer-player-search" className="oa-slab block text-ink/70">Name used on board</label>
                    <div className="flex gap-2">
                        <input
                            id="viewer-player-search"
                            type="search"
                            autoComplete="off"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Type your name"
                            className="oa-data min-h-11 min-w-0 flex-1 bg-broadcast-white px-3 text-ink ring-1 ring-inset ring-ink focus:outline-none focus:ring-[3px] focus:ring-cardinal"
                        />
                        <button type="submit" disabled={!result.autoSelect} className="oa-btn oa-btn-primary min-h-11 px-4 disabled:cursor-not-allowed disabled:opacity-40">
                            Find
                        </button>
                    </div>
                </form>

                <div className="mt-5" aria-live="polite">
                    {!assignedNames.length ? (
                        <p className="oa-data text-sm text-ink/60">No names have been assigned on this board yet.</p>
                    ) : showBrowseList ? (
                        <>
                            <p className="oa-slab text-ink">{hasQuery ? 'No close match. Browse every name' : 'Browse every name'}</p>
                            <div className="mt-2 max-h-56 overflow-y-auto ring-1 ring-inset ring-ink" data-testid="browse-name-list">
                                {assignedNames.map((name) => (
                                    <button key={name} type="button" onClick={() => selectPlayer(name)} className="oa-data block min-h-11 w-full border-b border-newsprint px-3 py-2 text-left text-ink last:border-b-0 hover:bg-newsprint focus:bg-newsprint">
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="oa-slab text-ink">
                                {result.tier === 'exact' ? 'Choose the organizer-entered name' : 'Did you mean…'}
                            </p>
                            <div className="mt-2 ring-1 ring-inset ring-ink" data-testid="name-suggestions">
                                {result.candidates.map((name) => (
                                    <button key={name} type="button" onClick={() => selectPlayer(name)} className="oa-data block min-h-11 w-full border-b border-newsprint px-3 py-2 text-left text-ink last:border-b-0 hover:bg-newsprint focus:bg-newsprint">
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {selectedPlayer && (
                    <button
                        onClick={() => { onSelectPlayer(''); onClose(); }}
                        className="oa-slab w-full min-h-11 mt-4 py-2 text-ink/50 hover:text-ink transition-colors"
                    >
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    </div>
    );
};

export default FindSquaresModal;
