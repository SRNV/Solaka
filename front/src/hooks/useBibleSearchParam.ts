import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useApi } from './useApi.ts';
import { parseRef } from '@/utils/bibleRef.ts';
import type { BibleBookMeta } from '@/models/bible';

export function useBibleSearchParam() {
  const [searchParams] = useSearchParams();
  const { open } = useBibleDrawer();
  const { data: books } = useApi<BibleBookMeta[]>('/api/bible/books?limit=100');

  useEffect(() => {
    if (!books) return;
    const raw = searchParams.get('search');
    if (!raw) return;
    const target = parseRef(raw, books);
    if (target) open(target);
  }, [searchParams, books, open]);
}
