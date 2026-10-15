
import { createClient } from '@supabase/supabase-js';
import { observeRecoveryAuthEvent } from '../src/features/site/recoveryArrival';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase credentials missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

// Register before lazy routes/AuthContext mount, so a consumed recovery link's
// verified event remains available in memory. No token is persisted by this observer.
supabase.auth.onAuthStateChange(observeRecoveryAuthEvent);
