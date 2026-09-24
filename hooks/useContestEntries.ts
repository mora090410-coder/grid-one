import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { EntryMeta } from '../types';

export const useContestEntries = (activePoolId: string | null) => {
    const [entryMetaByIndex, setEntryMetaByIndex] = useState<Record<number, EntryMeta>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadedPoolId, setLoadedPoolId] = useState<string | null>(null);
    const sequence = useRef(0);
    const activeId = useRef(activePoolId);
    activeId.current = activePoolId;
    /**
     * `background` is the quiet refresh used while the organizer keeps working:
     * it never locks the editor with the loading state, and a failure keeps the
     * notes already on screen instead of raising the blocking error.
     */
    const reloadEntries = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
        const request = ++sequence.current;
        if (!activePoolId) { setEntryMetaByIndex({}); setError(null); setIsLoading(false); return; }
        if (!background) { setIsLoading(true); setError(null); }
        try {
            const { data, error: failure } = await supabase.from('contest_entries')
                .select('cell_index, paid_status, notify_opt_in, contact_type, contact_value, seller_label')
                .eq('contest_id', activePoolId);
            if (failure) throw new Error(failure.message);
            if (request !== sequence.current || activeId.current !== activePoolId) return;
            const map: Record<number, EntryMeta> = {};
            data?.forEach((row: EntryMeta) => { map[row.cell_index] = row; });
            setEntryMetaByIndex(map);
            setLoadedPoolId(activePoolId);
            setError(null);
        } catch (failure) {
            if (!background && request === sequence.current && activeId.current === activePoolId) {
                setError('Private square notes could not be refreshed. Reload them before editing.');
            }
            throw failure;
        } finally {
            if (request === sequence.current && activeId.current === activePoolId) setIsLoading(false);
        }
    }, [activePoolId]);
    useEffect(() => {
        void reloadEntries().catch(() => undefined);
        return () => { sequence.current += 1; };
    }, [reloadEntries]);
    return { entryMetaByIndex, isLoading, error, setEntryMetaByIndex, reloadEntries, hasLoadedEntries: activePoolId !== null && loadedPoolId === activePoolId };
};
