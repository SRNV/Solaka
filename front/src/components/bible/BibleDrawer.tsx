import { useNavigate } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { MapIconSvg } from './MapIconSvg.tsx';
import { MultiSection } from './MultiSection.tsx';
import { BibleDrawerContent } from './BibleDrawerContent.tsx';
import styles from './BibleDrawer.module.css';

function MapButton({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.mapBar}>
      <button className={styles.mapBtn} title="Voir les relations dans la Map" onClick={onClick}>
        <MapIconSvg />
      </button>
    </div>
  );
}

export function BibleDrawer() {
  const { target, targets, close, open, triggerShowInMap } = useBibleDrawer();
  const routerNavigate = useNavigate();
  const handleMap = () => { triggerShowInMap(); routerNavigate('/graph'); };

  if (!target && targets.length === 0) return null;

  if (targets.length > 0) {
    return (
      <>
        <div className={styles.backdrop} onClick={close} />
        <aside className={styles.drawer}>
          <div className={styles.header}>
            <button className={styles.closeBtn} onClick={close} title="Fermer">✕</button>
            <span className={styles.heading}>Relation</span>
            <MapButton onClick={handleMap} />
          </div>
          <div className={styles.list}>
            {targets.map((t, i) => <MultiSection key={i} target={t} onMap={handleMap} />)}
          </div>
        </aside>
      </>
    );
  }

  return <BibleDrawerContent target={target!} close={close} open={open} onMap={handleMap} />;
}
