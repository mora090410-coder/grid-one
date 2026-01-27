import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import usePoolData from './hooks/usePoolData'; // Added Import
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContest from './pages/CreateContest';
import Paid from './pages/Paid';
import BoardView from './components/BoardView';
import LandingPage from './components/LandingPage';
import FullScreenLoading from './components/loading/FullScreenLoading';
import Layout from './components/layout/Layout';

// Wrapper to handle root routing logic
const Home = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const poolId = searchParams.get('poolId');

  // If poolId is present, show the board
  if (poolId) {
    return <BoardView />;
  }

  // If user is logged in, redirect to dashboard
  if (user) {
    // Wrap in useEffect to avoid state update during render warning, or just use Navigate component
    // Since we are in the render body, using Navigate is cleaner if allowed, but here let's validly straightforward return.
    // Actually, side-effects in render are bad. Better to use useEffect.
    React.useEffect(() => {
      navigate('/dashboard');
    }, [navigate]);
    return null; // or a loading spinner
  }

  // Otherwise show the landing page
  return (
    <LandingPage
      onCreate={() => navigate('/create')}
      onLogin={() => navigate('/login?mode=signin')}
      onDemo={() => navigate('/demo')}
    />
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
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
            <Route path="/paid" element={<Layout><Paid /></Layout>} />
            <Route path="*" element={<BoardView />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </Router>
  );
};

export default App;
