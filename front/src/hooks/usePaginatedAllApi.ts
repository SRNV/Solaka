import { useState, useEffect } from 'react';
import type { PaginatedResponse } from '@/models/api';
import type { PaginatedApiState } from '@/models/hooks';
import { fetchOnce } from '../store/apiCache.ts';
import { useToastStore } from '../store/toast.store.ts';

export function usePaginatedAllApi<T>(url: string | null): PaginatedApiState<T> {
  const [state, setState] = useState<PaginatedApiState<T>>({ data: null, loading: false, error: null });
  const addToast = useToastStore(s => s.addToast);

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
        if (!cancelled) {
          setState({ data: null, loading: false, error: (e as Error).message });
          addToast((e as Error).message);
        }
      }
    };

    setState({ data: null, loading: true, error: null });
    fetchPage(0);

    return () => { cancelled = true; };
  }, [url]);

  return state;
}
