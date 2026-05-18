import { BibleMapFeature }       from './BibleMapFeature';
import { GlobalPlayerComponent } from './GlobalPlayerComponent';
import styles from './GraphPage.module.css';

export function GraphPage() {
  return (
    <div className={styles.page}>
      <div className={styles.canvasContainer}>
        <BibleMapFeature />
        <GlobalPlayerComponent />
      </div>
    </div>
  );
}
