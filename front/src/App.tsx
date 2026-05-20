import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BibleDrawerProvider } from './contexts/BibleDrawerContext.tsx';
import { BibleDrawer } from './components/bible/BibleDrawer.tsx';
import { Layout } from './components/layout/Layout.tsx';
import { HomePage } from './components/home/HomePage.tsx';
import { ObjectionsPage } from './components/objections/ObjectionsPage.tsx';
import { SearchPage } from './components/search/SearchPage.tsx';
import { GraphPage } from './components/graph/GraphPage.tsx';
import { GamesPage } from './components/games/GamesPage.tsx';
import { GameDetailView } from './components/games/GameDetailView.tsx';
import { GameConsolePage } from './components/games/GameConsolePage.tsx';
import { GameRoomPage } from './components/games/GameRoomPage.tsx';
import { useBibleSearchParam } from './hooks/useBibleSearchParam.ts';
import { useBackendHealth } from './hooks/useBackendHealth.ts';
import { CommentModal } from './components/bible/CommentModal.tsx';

function BackendWaitingScreen({ error }: { error: string | null }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-display)',
      gap: '1rem'
    }}>
      <div className="loader" style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
        {error || '...'}
      </p>
    </div>
  );
}

function BibleSearchHandler() {
  useBibleSearchParam();
  return null;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: '48px 32px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--title)', fontSize: '2rem' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Section à venir.</p>
    </div>
  );
}

function MainApp() {
  const { isReady, error } = useBackendHealth();

  if (!isReady) {
    return <BackendWaitingScreen error={error} />;
  }

  return (
    <>
      <BibleSearchHandler />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="objections" element={<ObjectionsPage />} />
          <Route path="search"     element={<SearchPage />} />
          <Route path="graph"       element={<GraphPage />} />
          <Route path="games"                         element={<GamesPage />} />
          <Route path="games/:slug"                  element={<GameDetailView />} />
          <Route path="games/:slug/console/:roomId"  element={<GameConsolePage />} />
          <Route path="references" element={<Placeholder title="Références" />} />
          <Route path="sources"    element={<Placeholder title="Sources" />} />
        </Route>
      </Routes>
      <BibleDrawer />
      <CommentModal />
    </>
  );
}

export default function App() {
  return (
    <BibleDrawerProvider>
      <BrowserRouter>
        <Routes>
          {/* Phone controller route — no health gate, no Layout */}
          <Route path="games/:slug/:roomId" element={<GameRoomPage />} />
          {/* All other routes need backend health */}
          <Route path="*" element={<MainApp />} />
        </Routes>
      </BrowserRouter>
    </BibleDrawerProvider>
  );
}
