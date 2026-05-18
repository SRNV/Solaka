import { Html } from '@react-three/drei';
import { useBibleDrawer }          from '@/contexts/BibleDrawerContext';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { useSearchBadges }         from './useSearchBadges';
import type { LayoutResult }       from '@/utils/graphLayout';
import type { BibleRelation }      from '@/models/bible';
import type { PanelData }          from './HoverPanel';
import styles from './GraphPage.module.css';

interface Props {
  layout:             LayoutResult;
  stompRelations:     BibleRelation[];
  drawerRelations:    BibleRelation[] | null;
  setHoveredCubeUuid: (uuid: string | null) => void;
  setPanelData:       (data: PanelData | null) => void;
}

/** R3F component: renders Html search-result badges floating above cubes in the main canvas. */
export function SearchBadgesCanvas({ layout, stompRelations, drawerRelations, setHoveredCubeUuid, setPanelData }: Props) {
  const { open }       = useBibleDrawer();
  const searchHitUuids = useActiveRelationsStore(s => s.searchHitUuids);

  const badges = useSearchBadges(searchHitUuids, layout, stompRelations, drawerRelations);
  if (badges.length === 0) return null;

  return (
    <>
      {badges.map(badge => (
        <Html key={badge.uuid} position={[badge.x, badge.y + 0.35, 0.05]} center zIndexRange={[100, 100]}>
          <div
            className={`${styles.searchBadge} ${badge.isAuthority ? styles.searchBadgeAuthority : ''}`}
            onClick={e => {
              e.stopPropagation();
              open({ book: badge.book, chapter: badge.chapter, verse: badge.verseStart, verseTo: badge.verseEnd });
            }}
            onMouseEnter={() => {
              setHoveredCubeUuid(badge.uuid);
              setPanelData({ type: 'cube', uuid: badge.uuid, verse: null, summary: null, verseEnd: badge.verseEnd > badge.verseStart ? badge.verseEnd : undefined });
            }}
            onMouseLeave={() => { setHoveredCubeUuid(null); setPanelData(null); }}
          >
            {badge.label}
          </div>
        </Html>
      ))}
    </>
  );
}
