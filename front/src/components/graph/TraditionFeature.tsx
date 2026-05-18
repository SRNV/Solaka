import { useState } from 'react';
import { useTraditionStore }       from '@/store/tradition.store';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { TraditionPills }          from './TraditionPills';
import styles from './GraphPage.module.css';

/** Owns tradition pill toggles + confirmation modal. Reads/writes tradition.store and activeRelations.store. */
export function TraditionFeature() {
  const { showCath, showProt, showPulse, setShowCath, setShowProt, togglePulse } = useTraditionStore();
  const {
    drawerRelations, activeSearchTarget,
    setDrawerRelations, setActiveRelationsQuery, setRelationsEnabled,
  } = useActiveRelationsStore();

  const [tradConfirm, setTradConfirm] = useState<{ traditions: string[]; onConfirm: () => void } | null>(null);

  const reloadForTarget = (cath: boolean, prot: boolean) => {
    if (!activeSearchTarget) return;
    const { book, chapter, verse, verseTo } = activeSearchTarget;
    const v = verse != null ? ` ${verse}${verseTo && verseTo !== verse ? `–${verseTo}` : ''}` : '';
    setActiveRelationsQuery(`${book} ${chapter}${v}`);
    setRelationsEnabled(true);
    setShowCath(cath);
    setShowProt(prot);
  };

  return (
    <>
      <TraditionPills
        showCath={showCath}
        showProt={showProt}
        showPulse={showPulse}
        hasFilter={!!drawerRelations}
        onToggleCath={() => reloadForTarget(!showCath, showProt) || setShowCath(!showCath)}
        onToggleProt={() => reloadForTarget(showCath, !showProt) || setShowProt(!showProt)}
        onTogglePulse={togglePulse}
        onClearFilter={() => setDrawerRelations(null)}
      />

      {tradConfirm && (
        <div className={styles.modalOverlay} onClick={() => setTradConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Traditions masquées</p>
            <p className={styles.modalText}>
              {tradConfirm.traditions.length === 1
                ? `Ce passage contient des relations de tradition ${tradConfirm.traditions[0]}, actuellement masquée. Souhaitez-vous l'afficher ?`
                : `Ce passage contient des relations de traditions ${tradConfirm.traditions.join(' et ')}, actuellement masquées. Souhaitez-vous les afficher ?`}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel}  onClick={() => setTradConfirm(null)}>Ignorer</button>
              <button className={styles.modalConfirm} onClick={tradConfirm.onConfirm}>Afficher</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
