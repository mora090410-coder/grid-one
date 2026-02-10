import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContest from './pages/CreateContest';
import Paid from './pages/Paid';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import BoardView from './components/BoardView';
import LandingPage from './components/LandingPage';
import FullScreenLoading from './components/loading/FullScreenLoading';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/auth/RequireAuth';

const Root = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const poolId = searchParams.get('poolId');

  if (poolId) {
    return <BoardView />;
  }

  return (
      <LandingPage
        onCreate={() => {
          if (user) {
            navigate('/create');
        } else {
          // Direct to sign up, but return to create page after
          navigate('/login?mode=signup&returnTo=/create');
        }
        }}
        onLogin={() => navigate('/login?mode=signin')}
      />
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <React.Suspense fallback={<FullScreenLoading />}>
            <Routes>
              <Route path="/" element={<Root />} />
              <Route path="/demo" element={<BoardView demoMode={true} />} />
              <Route
                path="/login"
                element={
                  <Layout>
                    <Login />
                  </Layout>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/create"
                element={
                  <RequireAuth>
                    <Layout>
                      <CreateContest />
                    </Layout>
                  </RequireAuth>
                }
              />

              <Route path="/paid" element={<Layout><Paid /></Layout>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
