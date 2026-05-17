import { useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi.ts';
import type { Objection, PaginatedResponse } from '@/models/api';
import { ObjectionDrawer } from './ObjectionDrawer.tsx';
import styles from './ObjectionsPage.module.css';

function truncate(str: string, max = 30): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function ObjectionsPage() {
  const { data: res, loading, error } = useApi<PaginatedResponse<Objection>>('/api/objections?limit=500');
  const data = res?.data ?? null;
  const [selected, setSelected] = useState<Objection | null>(null);

  const columns = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { uuid: string; name: string; from: string; items: Objection[] }>();
    for (const obj of data) {
      const { uuid, name, from } = obj.category;
      if (!map.has(uuid)) map.set(uuid, { uuid, name, from, items: [] });
      map.get(uuid)!.items.push(obj);
    }
    return Array.from(map.values());
  }, [data]);

  if (loading) return (
    <div className={styles.skeleton}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skeletonCol} />
      ))}
    </div>
  );

  if (error) return <p className={styles.error}>Erreur de chargement : {error}</p>;

  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Objections</h1>
          <p className={styles.subtitle}>
            {data?.length ?? 0} objections · {columns.length} catégories
          </p>
        </div>

        <div className={styles.board}>
          {columns.map(col => (
            <div key={col.uuid} className={styles.column}>
              <div className={styles.colHeader}>
                <span className={styles.colName}>{col.name}</span>
                <span className={styles.colCount}>{col.items.length}</span>
              </div>
              <div className={styles.cards}>
                {col.items.map(obj => (
                  <button
                    key={obj.uuid}
                    className={`${styles.card} ${selected?.uuid === obj.uuid ? styles.cardActive : ''}`}
                    onClick={() => setSelected(obj)}
                  >
                    {truncate(obj.name)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <ObjectionDrawer
          objection={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
