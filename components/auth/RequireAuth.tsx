import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FullScreenLoading from '../loading/FullScreenLoading';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    // Although AuthProvider handles initial loading, we keep this check for safety
    if (loading) {
        return <FullScreenLoading />;
    }

    if (!user) {
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        return (
            <Navigate
                to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                state={{ from: location }}
                replace
            />
        );
    }

    return <>{children}</>;
};

export default RequireAuth;
