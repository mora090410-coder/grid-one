import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RequireAuth from '../components/auth/RequireAuth';
import ShareModal from '../components/board/ShareModal';

const mocks = vi.hoisted(() => ({
    authState: { user: null as null | { id: string }, loading: false },
    getSession: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        ...mocks.authState,
        session: null,
        signOut: vi.fn(),
    }),
}));

vi.mock('../services/supabase', () => ({
    supabase: {
        auth: {
            getSession: mocks.getSession,
        },
    },
}));

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mocks.authState.user = null;
    mocks.authState.loading = false;
});

describe('customer flow regressions', () => {
    it('preserves the protected path and query when redirecting to login', () => {
        const LocationProbe = () => {
            const location = useLocation();
            return <output>{`${location.pathname}${location.search}`}</output>;
        };

        render(
            <MemoryRouter initialEntries={['/create?scoreTest=1']}>
                <Routes>
                    <Route
                        path="/create"
                        element={<RequireAuth><div>Private</div></RequireAuth>}
                    />
                    <Route path="/login" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByText('/login?mode=signup&returnTo=%2Fcreate%3FscoreTest%3D1')).toBeInTheDocument();
    });

    it('does not claim a link was copied when clipboard permission is denied', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
        });

        render(<ShareModal shareUrl="https://example.test/b/ABCDEFGH" onClose={() => undefined} />);
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('could not be copied');
        expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    });
});
