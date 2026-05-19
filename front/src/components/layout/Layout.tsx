import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { BottomNav } from './BottomNav.tsx';
import { ToastContainer } from './ToastContainer.tsx';
import { SearchBar } from '@/components/search/SearchBar.tsx';
import { useIsMobile } from '@/hooks/useIsMobile.ts';
import styles from './Layout.module.css';

export function Layout() {
  const isMobile    = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`${styles.mainCol} ${isMobile ? styles.mainColMobile : ''}`}>
        <header className={styles.topBar}>
          <button
            className={styles.burger}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
          <SearchBar />
        </header>

        <main id="layout-main" className={styles.main}>
          <Outlet />
        </main>
      </div>

      {isMobile && <BottomNav />}
      <ToastContainer />
    </div>
  );
}
