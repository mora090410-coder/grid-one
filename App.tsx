import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import FullScreenLoading from './components/loading/FullScreenLoading';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/auth/RequireAuth';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const CreateContest = React.lazy(() => import('./pages/CreateContest'));
const Paid = React.lazy(() => import('./pages/Paid'));
const Privacy = React.lazy(() => import('./pages/Privacy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const BoardView = React.lazy(() => import('./components/BoardView'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const ArticlesHub = React.lazy(() => import('./pages/ArticlesHub').then((module) => ({ default: module.ArticlesHub })));
const RunYourPoolAlternative = React.lazy(() => import('./pages/RunYourPoolAlternative').then((module) => ({ default: module.RunYourPoolAlternative })));
const HowToRunSquares = React.lazy(() => import('./pages/HowToRunSquares').then((module) => ({ default: module.HowToRunSquares })));
const FootballSquaresFundraiser = React.lazy(() => import('./pages/FootballSquaresFundraiser').then((module) => ({ default: module.FootballSquaresFundraiser })));
const OfficeSuperBowlSquares = React.lazy(() => import('./pages/OfficeSuperBowlSquares').then((module) => ({ default: module.OfficeSuperBowlSquares })));
const HowFootballSquaresWork = React.lazy(() => import('./pages/HowFootballSquaresWork').then((module) => ({ default: module.HowFootballSquaresWork })));
const YouthSportsFootballSquaresFundraiser = React.lazy(() => import('./pages/YouthSportsFootballSquaresFundraiser').then((module) => ({ default: module.YouthSportsFootballSquaresFundraiser })));
const SuperBowlSquaresIdeas = React.lazy(() => import('./pages/SuperBowlSquaresIdeas').then((module) => ({ default: module.SuperBowlSquaresIdeas })));
const DigitalFootballSquaresBoardVsPaper = React.lazy(() => import('./pages/DigitalFootballSquaresBoardVsPaper').then((module) => ({ default: module.DigitalFootballSquaresBoardVsPaper })));
const BoosterClubFootballSquares = React.lazy(() => import('./pages/BoosterClubFootballSquares').then((module) => ({ default: module.BoosterClubFootballSquares })));
const ChurchSchoolFundraiserSquares = React.lazy(() => import('./pages/ChurchSchoolFundraiserSquares').then((module) => ({ default: module.ChurchSchoolFundraiserSquares })));
const NFLOpeningWeekSquares = React.lazy(() => import('./pages/NFLOpeningWeekSquares').then((module) => ({ default: module.NFLOpeningWeekSquares })));
const FootballSquaresApp = React.lazy(() => import('./pages/FootballSquaresApp').then((module) => ({ default: module.FootballSquaresApp })));

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
              <Route path="/b/:shareCode" element={<BoardView />} />
              <Route
                path="/boards/:boardId"
                element={
                  <RequireAuth>
                    <BoardView />
                  </RequireAuth>
                }
              />
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
              <Route path="/articles/booster-club-football-squares" element={<BoosterClubFootballSquares />} />
              <Route path="/articles/church-school-football-squares-fundraiser" element={<ChurchSchoolFundraiserSquares />} />
              <Route path="/articles/nfl-opening-week-squares-pool" element={<NFLOpeningWeekSquares />} />
              <Route path="/articles/football-squares-app" element={<FootballSquaresApp />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </React.Suspense>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
