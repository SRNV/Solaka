import { useState, useEffect } from 'react';
import { fetchOnce } from '../store/apiCache.ts';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!url) { setState({ data: null, loading: false, error: null }); return; }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchOnce<T>(url)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(e  => { if (!cancelled) setState({ data: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
  }, [url]);

  return state;
}
