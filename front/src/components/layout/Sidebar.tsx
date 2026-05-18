import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface NavItem { to: string; label: string; icon: string; }

const NAV: NavItem[] = [
  { to: '/',           label: 'Accueil',    icon: '⌂' },
  { to: '/graph',      label: 'Graphe',     icon: '◈' },
  { to: '/objections', label: 'Objections', icon: '⚖' },
  { to: '/games',      label: 'Jeux',       icon: '🕹' },
];

interface SidebarProps {
  open:    boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.logoIcon}>✦</span>
          <span className={styles.logoText}>SolaKa</span>
          <button className={styles.closeBtn} onClick={onClose} title="Fermer">✕</button>
        </div>

        <nav className={styles.nav}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onClose}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
