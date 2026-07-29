/**
 * Compatibility wrapper around the account-based auth context.
 *
 * GridOne no longer supports board passwords or stores organizer credentials in
 * localStorage. Board administration is authorized only by the Supabase session.
 */
import { useAuth as useGlobalAuth } from '../context/AuthContext';

export function useAuth() {
    return useGlobalAuth();
}

export default useAuth;
