import { useState } from 'react';
import type { RelRow } from '@/store/relations.store.ts';
import { TRAD_LIMIT, badgeLabel } from '@/utils/bibleDrawer.ts';

interface RelationBadgeListProps {
  rels:           RelRow[];
  activeKey:      string | null;
  onRelClick:     (r: RelRow) => void;
  badgeClass:     (r: RelRow) => string;
  activeClass:    string;
  authorityClass: string;
}

export function RelationBadgeList({ rels, activeKey, onRelClick, badgeClass, activeClass, authorityClass }: RelationBadgeListProps) {
  const [showAllCath, setShowAllCath] = useState(false);
  const [showAllProt, setShowAllProt] = useState(false);

  const authority   = rels.filter(r => r.relType === 'authority');
  const cath        = rels.filter(r => r.relType !== 'authority' && r.trad === 'c');
  const prot        = rels.filter(r => r.relType !== 'authority' && r.trad === 'p');
  const visibleCath = showAllCath ? cath : cath.slice(0, TRAD_LIMIT);
  const visibleProt = showAllProt ? prot : prot.slice(0, TRAD_LIMIT);

  const renderBadge = (r: RelRow, i: number) => (
    <button
      key={i}
      className={`${badgeClass(r)} ${r.relType === 'authority' ? authorityClass : ''} ${r.toFrom === activeKey ? activeClass : ''}`}
      onClick={() => onRelClick(r)}
      title={`${r.relType} · ${r.sourceUrl ?? ''}`}
    >
      {badgeLabel(r)}
    </button>
  );

  const moreBtn = (key: string, count: number, show: boolean, set: (v: boolean) => void) => (
    <button key={key} onClick={() => set(!show)} style={{
      fontSize: 10, fontWeight: 700, color: '#aaa', background: 'none', border: 'none',
      cursor: 'pointer', padding: '2px 4px',
    }}>
      {show ? '−' : `+${count - TRAD_LIMIT}`}
    </button>
  );

  return (
    <>
      {authority.map(renderBadge)}
      {visibleCath.map(renderBadge)}
      {cath.length > TRAD_LIMIT && moreBtn('more-cath', cath.length, showAllCath, setShowAllCath)}
      {visibleProt.map(renderBadge)}
      {prot.length > TRAD_LIMIT && moreBtn('more-prot', prot.length, showAllProt, setShowAllProt)}
    </>
  );
}
