import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { BottomNav } from './BottomNav.tsx';
import { SearchBar } from '@/components/search/SearchBar.tsx';
import { useIsMobile } from '@/hooks/useIsMobile.ts';
import styles from './Layout.module.css';

export function Layout() {
  const isMobile = useIsMobile();

  return (
    <div className={styles.wrapper}>
      {!isMobile && <Sidebar />}

      <div className={`${styles.mainCol} ${isMobile ? styles.mainColMobile : ''}`}>
        <header className={styles.topBar}>
          <SearchBar />
        </header>

        <main id="layout-main" className={styles.main}>
          <Outlet />
        </main>
      </div>

      {isMobile && <BottomNav />}
    </div>
  );
}
