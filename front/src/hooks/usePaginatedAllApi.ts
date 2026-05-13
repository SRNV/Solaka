import { useState, useEffect } from 'react';
import type { PaginatedResponse } from '@/types/bible.ts';
import { fetchOnce } from '../store/apiCache.ts';

interface ApiState<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
}

export function usePaginatedAllApi<T>(url: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!url) { setState({ data: null, loading: false, error: null }); return; }

    let cancelled = false;
    let allData: T[] = [];

    const fetchPage = async (offset: number) => {
      if (cancelled) return;

      const separator = url.includes('?') ? '&' : '?';
      const pagedUrl  = `${url}${separator}offset=${offset}&limit=500`;

      try {
        // fetchOnce déduplique les requêtes identiques entre composants
        const res = await fetchOnce<PaginatedResponse<T>>(pagedUrl);

        allData = [...allData, ...res.data];

        if (!cancelled) {
          setState({
            data:    allData,
            loading: allData.length < res.total && res.data.length > 0,
            error:   null,
          });
        }

        if (allData.length < res.total && res.data.length > 0) {
          await fetchPage(offset + res.limit);
        }
      } catch (e: unknown) {
        if (!cancelled) setState({ data: null, loading: false, error: (e as Error).message });
      }
    };

    setState({ data: null, loading: true, error: null });
    fetchPage(0);

    return () => { cancelled = true; };
  }, [url]);

  return state;
}
