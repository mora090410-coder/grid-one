import React, { useMemo, useState } from 'react';
import { BoardData } from '../../types';
import { distinctAssignedNames, matchPlayerNames } from '../../utils/playerNameMatching';
import { ActionButton } from '../primitives/ActionButton';
import { Dialog } from '../primitives/Dialog';
import { Field } from '../primitives/Field';

interface FindSquaresModalProps {
    board: BoardData;
    selectedPlayer: string;
    onSelectPlayer: (player: string) => void;
    onClose: () => void;
}

const FindSquaresModal: React.FC<FindSquaresModalProps> = ({ board, selectedPlayer, onSelectPlayer, onClose }) => {
    const [query, setQuery] = useState('');

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
    <Dialog titleId="find-squares-title" onClose={onClose} backdropLabel="Close Find my squares" panelClassName="max-w-md mx-4 mb-0 md:mb-0">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 id="find-squares-title" className="oa-headline !text-lg text-ink">Find my squares</h3>
                    <ActionButton variant="plain" onClick={onClose} className="p-2 text-ink/60 hover:bg-newsprint transition-colors" aria-label="Close">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </ActionButton>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div className="flex gap-2 items-end">
                        <Field
                            id="viewer-player-search"
                            label="Name used on board"
                            type="search"
                            autoComplete="off"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Type your name"
                            containerClassName="min-w-0 flex-1"
                            className="oa-data bg-broadcast-white"
                        />
                        <ActionButton type="submit" disabled={!result.autoSelect} className="px-4">
                            Find
                        </ActionButton>
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
                                    <ActionButton key={name} variant="plain" onClick={() => selectPlayer(name)} className="oa-data block w-full border-b border-newsprint px-3 py-2 text-left last:border-b-0 hover:bg-newsprint focus:bg-newsprint">
                                        {name}
                                    </ActionButton>
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
                                    <ActionButton key={name} variant="plain" onClick={() => selectPlayer(name)} className="oa-data block w-full border-b border-newsprint px-3 py-2 text-left last:border-b-0 hover:bg-newsprint focus:bg-newsprint">
                                        {name}
                                    </ActionButton>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {selectedPlayer && (
                    <ActionButton
                        variant="plain"
                        onClick={() => { onSelectPlayer(''); onClose(); }}
                        className="oa-slab w-full min-h-11 mt-4 py-2 text-ink/50 hover:text-ink transition-colors"
                    >
                        Clear selection
                    </ActionButton>
                )}
            </div>
    </Dialog>
    );
};

export default FindSquaresModal;
