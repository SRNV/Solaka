import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const NAV = [
  { to: '/',           label: 'Accueil',    icon: '⌂' },
  { to: '/objections', label: 'Objections', icon: '⚖' },
  { to: '/games',      label: 'Jeux',       icon: '🕹' },
  { to: '/references', label: 'Références', icon: '📖' },
  { to: '/sources',    label: 'Sources',    icon: '✦' },
];

export function BottomNav() {
  return (
    <nav className={styles.nav}>
      {NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span className={styles.navLabel}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
