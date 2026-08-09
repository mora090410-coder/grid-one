import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { EntryMeta } from '../types';

export const useContestEntries = (activePoolId: string | null) => {
    const [entryMetaByIndex, setEntryMetaByIndex] = useState<Record<number, EntryMeta>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activePoolId) {
            setEntryMetaByIndex({});
            return;
        }

        const fetchMeta = async () => {
            setIsLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('contest_entries')
                .select('cell_index, paid_status, notify_opt_in, contact_type, contact_value, seller_label')
                .eq('contest_id', activePoolId);

            if (error) {
                console.error("Error fetching metadata:", error);
                setError(error.message);
                setIsLoading(false);
                return;
            }

            const map: Record<number, EntryMeta> = {};
            data?.forEach((row: any) => {
                map[row.cell_index] = row as EntryMeta;
            });
            setEntryMetaByIndex(map);
            setIsLoading(false);
        };

        fetchMeta();
    }, [activePoolId]);

    return { entryMetaByIndex, isLoading, error, setEntryMetaByIndex };
};
