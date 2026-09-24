import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FullScreenLoading from '../loading/FullScreenLoading';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    // AuthProvider renders public pages before the sign-in check settles;
    // protected routes wait here so nothing redirects to /login too early.
    if (loading) {
        return <FullScreenLoading />;
    }

    if (!user) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        const mode = location.pathname === '/create' ? 'mode=signup&' : '';
        return (
            <Navigate
                to={`/login?${mode}returnTo=${encodeURIComponent(returnTo)}`}
                state={{ from: location }}
                replace
            />
        );
    }

    return <>{children}</>;
};

export default RequireAuth;
