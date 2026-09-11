import FamilyWorkspace from './src/features/family/FamilyWorkspace';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import FullScreenLoading from './components/loading/FullScreenLoading';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/auth/RequireAuth';
import BoardView from './components/BoardView';
import CreateContest from './pages/CreateContest';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Paid from './pages/Paid';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

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
const Homepage = React.lazy(() => import('./src/features/homepage/Homepage'));

const HomepageProductFallback = () => (
  <main className="min-h-[100dvh] bg-ink px-4 py-8 text-broadcast-white">
    <p className="text-gold">GridOne</p>
    <h1 className="mt-3 text-4xl font-black">Football-squares fundraiser boards</h1>
    <p className="mt-4">Build the board, share one link, and let GridOne track game day.</p>
    <p className="mt-4">First published board free. GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners.</p>
  </main>
);

const Root = () => {
  const [searchParams] = useSearchParams();
  const poolId = searchParams.get('poolId');

  if (poolId) {
    return <BoardView />;
  }

  return <React.Suspense fallback={<HomepageProductFallback />}><Homepage /></React.Suspense>;
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
                element={<Login />}
              />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/create"
                element={<CreateContest />}
              />

              <Route path="/family" element={<FamilyWorkspace />} />
              <Route path="/paid" element={<Paid />} />
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
