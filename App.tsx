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
import { RunYourPoolAlternative } from './pages/RunYourPoolAlternative';
import { HowToRunSquares } from './pages/HowToRunSquares';
import { FootballSquaresFundraiser } from './pages/FootballSquaresFundraiser';
import { OfficeSuperBowlSquares } from './pages/OfficeSuperBowlSquares';
import { ArticlesHub } from './pages/ArticlesHub';
import { HowFootballSquaresWork } from './pages/HowFootballSquaresWork';
import { YouthSportsFootballSquaresFundraiser } from './pages/YouthSportsFootballSquaresFundraiser';
import { SuperBowlSquaresIdeas } from './pages/SuperBowlSquaresIdeas';
import { DigitalFootballSquaresBoardVsPaper } from './pages/DigitalFootballSquaresBoardVsPaper';
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
              <Route path="/articles" element={<ArticlesHub />} />
              <Route path="/articles/run-your-pool-alternative" element={<RunYourPoolAlternative />} />
              <Route path="/articles/how-to-run-super-bowl-squares" element={<HowToRunSquares />} />
              <Route path="/articles/football-squares-fundraiser" element={<FootballSquaresFundraiser />} />
              <Route path="/articles/office-super-bowl-squares" element={<OfficeSuperBowlSquares />} />
              <Route path="/articles/how-football-squares-work" element={<HowFootballSquaresWork />} />
              <Route path="/articles/youth-sports-football-squares-fundraiser" element={<YouthSportsFootballSquaresFundraiser />} />
              <Route path="/articles/super-bowl-squares-ideas" element={<SuperBowlSquaresIdeas />} />
              <Route path="/articles/digital-football-squares-board-vs-paper" element={<DigitalFootballSquaresBoardVsPaper />} />
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
