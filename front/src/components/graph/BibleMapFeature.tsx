import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { BibleMap } from '@/lib/BibleMap/index.ts';
import styles from './GraphPage.module.css';

/** Autonomous globe layer — reads activeVerseUuids from store, no props needed. */
export function BibleMapFeature() {
  const activeVerseUuids = useActiveRelationsStore(s => s.activeVerseUuids);
  return (
    <div className={styles.bibleMapWrapper}>
      <BibleMap activeVerseUuids={activeVerseUuids} />
    </div>
  );
}
