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
  // Migration Logic Wrapper
  const MigrationWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { migrateGuestBoard } = usePoolData(); // Import the hook
    const navigate = useNavigate();
    const [isMigrating, setIsMigrating] = React.useState(false);

    React.useEffect(() => {
      const checkAndMigrate = async () => {
        if (!user || isMigrating) return;

        const storedGame = localStorage.getItem('squares_game');
        const storedBoard = localStorage.getItem('squares_board');

        // GUARD 1: If we just finished migration (url has migrated=true), force clear and stop.
        if (window.location.search.includes('migrated=true')) {
          if (storedGame || storedBoard) {
            localStorage.removeItem('squares_game');
            localStorage.removeItem('squares_board');
          }
          return;
        }

        // GUARD 2: If we are already viewing a pool (poolId exists), DO NOT MIGRATE.
        // This protects the user from being kicked off a paid board if they have leftover local data.
        if (window.location.search.includes('poolId=')) {
          return;
        }

        if (storedGame && storedBoard) {
          setIsMigrating(true);
          try {
            const gameData = JSON.parse(storedGame);
            const boardData = JSON.parse(storedBoard);

            // Only migrate if there's actual data (basic check)
            if (gameData.title) {
              console.log("Migrating guest board...", { title: gameData.title, squares: boardData.squares?.length });
              // Optional: user feedback
              // alert(`Migrating your board: ${gameData.title}`); 

              const newId = await migrateGuestBoard(user, {
                game: gameData,
                board: boardData
              });

              // Clear storage
              localStorage.removeItem('squares_game');
              localStorage.removeItem('squares_board');

              // Redirect to new board
              // Add a query param so Dashboard can show success toast
              window.location.href = `/?poolId=${newId}&migrated=true`;
            }
          } catch (err) {
            console.error("Migration failed:", err);
          } finally {
            setIsMigrating(false);
          }
        }
      };

      checkAndMigrate();
    }, [user, migrateGuestBoard]);

    if (isMigrating) {
      return <FullScreenLoading />;
    }

    return <>{children}</>;
  };

  return (
    <Router>
      <AuthProvider>
        <React.Suspense fallback={<FullScreenLoading />}>
          <MigrationWrapper>
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
          </MigrationWrapper>
        </React.Suspense>
      </AuthProvider>
    </Router>
  );
};

export default App;
