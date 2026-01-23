import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContest from './pages/CreateContest';
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

  // Otherwise show the landing page
  return (
    <LandingPage
      onCreate={() => {
        if (user) {
          navigate('/create');
        } else {
          navigate('/login?mode=signup');
        }
      }}
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
            <Route path="*" element={<BoardView />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </Router>
  );
};

export default App;
