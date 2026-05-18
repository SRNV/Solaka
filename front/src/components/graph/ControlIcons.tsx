import type { ReactNode } from 'react';
import { useTraditionStore }       from '@/store/tradition.store';
import { useGraphModeStore }       from '@/store/graphMode.store';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { useTimelineStore }        from '@/store/timeline.store';
import { SPEEDS }                  from './useTimeline';
import styles from './ControlIcons.module.css';

interface IconBtnProps {
  title:        string;
  active?:      boolean;
  activeColor?: string;
  onClick:      () => void;
  children:     ReactNode;
}

function IconBtn({ title, active, activeColor, onClick, children }: IconBtnProps) {
  return (
    <button
      className={styles.iconBtn}
      title={title}
      onClick={onClick}
      style={active ? {
        background:  activeColor ?? 'var(--secondary)',
        color:       '#fff',
        borderColor: activeColor ?? 'var(--secondary)',
      } : undefined}
    >
      {children}
    </button>
  );
}

function Sep() { return <div className={styles.sep} />; }

export function ControlIcons() {
  const { showCath, showProt, showPulse, setShowCath, setShowProt, togglePulse } = useTraditionStore();
  const {
    sortMode, histSubMode, histSecondaryFrise,
    setSortMode, setHistSubMode, setHistSecondaryFrise,
  } = useGraphModeStore();
  const {
    drawerRelations, activeSearchTarget,
    setDrawerRelations, setActiveRelationsQuery, setRelationsEnabled,
  } = useActiveRelationsStore();
  const { playSpeed, setSpeed } = useTimelineStore();

  function reloadForTarget(cath: boolean, prot: boolean) {
    if (!activeSearchTarget) return;
    const { book, chapter, verse, verseTo } = activeSearchTarget;
    const v = verse != null ? ` ${verse}${verseTo && verseTo !== verse ? `–${verseTo}` : ''}` : '';
    setActiveRelationsQuery(`${book} ${chapter}${v}`);
    setRelationsEnabled(true);
    setShowCath(cath);
    setShowProt(prot);
  }

  return (
    <div className={styles.bar}>

      {/* Sort mode */}
      <IconBtn title="Classique"   active={sortMode === 'classic'}    onClick={() => setSortMode('classic')}><ListIcon /></IconBtn>
      <IconBtn title="Historique"  active={sortMode === 'historical'} onClick={() => setSortMode('historical')}><ClockIcon /></IconBtn>
      <IconBtn title="Taille"      active={sortMode === 'size'}       onClick={() => setSortMode('size')}><BarChartIcon /></IconBtn>

      {/* Frise overlays + sub-mode (historical mode only) */}
      {sortMode === 'historical' && (
        <>
          <Sep />
          <IconBtn title="Rois"             active={histSecondaryFrise === 'kings'}   onClick={() => setHistSecondaryFrise('kings')}><CrownIcon /></IconBtn>
          <IconBtn title="Périodes"         active={histSecondaryFrise === 'periods'} onClick={() => setHistSecondaryFrise('periods')}><PeriodsIcon /></IconBtn>
          <IconBtn title="Événements"       active={histSecondaryFrise === 'events'}  onClick={() => setHistSecondaryFrise('events')}><BoltIcon /></IconBtn>
          <Sep />
          <IconBtn title="Période auteur"   active={histSubMode === 'authorPeriod'}    onClick={() => setHistSubMode('authorPeriod')}><QuillIcon /></IconBtn>
          <IconBtn title="Composition"      active={histSubMode === 'mainComposition'} onClick={() => setHistSubMode('mainComposition')}><LayersIcon /></IconBtn>
          <IconBtn title="Rédaction finale" active={histSubMode === 'finalRedaction'}  onClick={() => setHistSubMode('finalRedaction')}><SealIcon /></IconBtn>
        </>
      )}

      <Sep />

      {/* Tradition */}
      <IconBtn
        title="Catholique"
        active={showCath}
        onClick={() => { reloadForTarget(!showCath, showProt); setShowCath(!showCath); }}
      ><CrossIcon /></IconBtn>
      <IconBtn
        title="Protestant"
        active={showProt}
        activeColor="#888"
        onClick={() => { reloadForTarget(showCath, !showProt); setShowProt(!showProt); }}
      ><BookIcon /></IconBtn>
      <IconBtn title="Pulse" active={showPulse} onClick={togglePulse}><PulseIcon /></IconBtn>

      {/* Clear relation filter */}
      {drawerRelations && (
        <>
          <Sep />
          <IconBtn title="Effacer le filtre" onClick={() => setDrawerRelations(null)}><FilterClearIcon /></IconBtn>
        </>
      )}

      {/* Speeds (historical mode only) */}
      {sortMode === 'historical' && (
        <>
          <Sep />
          <div className={styles.speeds}>
            {SPEEDS.map(s => (
              <button
                key={s}
                className={`${styles.speedBtn} ${playSpeed === s ? styles.speedActive : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Icons (16×16 viewBox, currentColor) ──────────────────────────── */

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round">
      <line x1="2" y1="4"  x2="14" y2="4"  strokeWidth="1.8" />
      <line x1="2" y1="8"  x2="14" y2="8"  strokeWidth="1.8" />
      <line x1="2" y1="12" x2="14" y2="12" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
      <polyline points="8,4.5 8,8 10.5,10" strokeWidth="1.8" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <rect x="1"  y="3" width="4" height="11" rx="0.8" />
      <rect x="6"  y="6" width="4" height="8"  rx="0.8" />
      <rect x="11" y="9" width="4" height="5"  rx="0.8" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h12L12 6 8 9.5 8 3 4 6z" strokeWidth="1.5" />
      <line x1="2" y1="14" x2="14" y2="14" strokeWidth="1.8" />
    </svg>
  );
}

function PeriodsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round">
      <rect x="2" y="4" width="12" height="9" rx="1.5" strokeWidth="1.5" />
      <line x1="2"  y1="7" x2="14" y2="7"  strokeWidth="1.2" />
      <line x1="5"  y1="2" x2="5"  y2="6"  strokeWidth="1.5" />
      <line x1="11" y1="2" x2="11" y2="6"  strokeWidth="1.5" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <path d="M9.5 1.5L3 9h5.5L6 14.5l8-8.5H8.5z" />
    </svg>
  );
}

function QuillIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2c-3.5 1-7 5-8 12l3-2c1-2 4-6 5-10z" strokeWidth="1.4" />
      <line x1="3" y1="13" x2="5.5" y2="15" strokeWidth="1.5" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6l6-4 6 4-6 4z"   strokeWidth="1.5" />
      <path d="M2 10l6 4 6-4"       strokeWidth="1.5" />
    </svg>
  );
}

function SealIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
      <polyline points="5,8.5 7,10.5 11,5.5" strokeWidth="2" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" stroke="currentColor" strokeLinecap="round">
      <line x1="8" y1="2"   x2="8"  y2="14" strokeWidth="2.5" />
      <line x1="3.5" y1="6" x2="12.5" y2="6" strokeWidth="2.5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13S5 11.5 2 11.5V3.5C5 3.5 8 5 8 5s3-1.5 6-1.5V11.5C11 11.5 8 13 8 13z" strokeWidth="1.4" />
      <line x1="8" y1="5" x2="8" y2="13" strokeWidth="1.2" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,8 4.5,8 6,4.5 8,11.5 10,5.5 11.5,8 15,8" strokeWidth="1.8" />
    </svg>
  );
}

function FilterClearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12l-5 5.5V13l-2-1.5V8.5z" strokeWidth="1.5" />
      <line x1="10" y1="9.5"  x2="14" y2="13.5" strokeWidth="1.8" />
      <line x1="14" y1="9.5"  x2="10" y2="13.5" strokeWidth="1.8" />
    </svg>
  );
}
