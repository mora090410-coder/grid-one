import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContest from './pages/CreateContest';
import ScanPage from './pages/ScanPage';
import BoardView from './components/BoardView';
import LandingPage from './components/LandingPage';
import FullScreenLoading from './components/loading/FullScreenLoading';
import Layout from './components/layout/Layout';

// Wrapper to handle root routing logic
const Home = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const poolId = searchParams.get('poolId');

  React.useEffect(() => {
    // Auth Check removed to allow Landing Page access
  }, []);

  // If poolId is present, show the board
  if (poolId) {
    return <BoardView />;
  }

  // If loading user state, show nothing or spinner to prevent flash
  if (loading) return null;

  // Otherwise show the landing page (Guest Entry)
  return (
    <LandingPage
      onCreate={() => navigate('/create')}
      onScan={() => navigate('/create?mode=scan')}
      onLogin={() => navigate('/login?mode=signin')}
      onDemo={() => navigate('/demo')}
    />
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <GuestProvider>
          <React.Suspense fallback={<FullScreenLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/demo" element={<BoardView demoMode={true} />} />
              <Route
                path="/login"
                element={
                  <Layout>
                    <Login />
                  </Layout>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Layout>
                    <Dashboard />
                  </Layout>
                }
              />
              <Route
                path="/create"
                element={
                  <Layout>
                    <CreateContest />
                  </Layout>
                }
              />
              <Route
                path="/scan"
                element={
                  <Layout>
                    <ScanPage />
                  </Layout>
                }
              />
              <Route path="*" element={<BoardView />} />
            </Routes>
          </React.Suspense>
        </GuestProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
