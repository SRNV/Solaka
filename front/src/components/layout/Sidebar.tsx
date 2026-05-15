import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface NavItem { to: string; label: string; icon: string; }

const NAV: NavItem[] = [
  { to: '/',           label: 'Accueil',    icon: '⌂' },
  { to: '/graph',      label: 'Graphe',     icon: '◈' },
  { to: '/objections', label: 'Objections', icon: '⚖' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>✦</span>
        {!collapsed && <span className={styles.logoText}>SolaKa</span>}
      </div>

      <nav className={styles.nav}>
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        className={styles.toggle}
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Déplier' : 'Replier'}
      >
        {collapsed ? '›' : '‹'}
      </button>
    </aside>
  );
}
