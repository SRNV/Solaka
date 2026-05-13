import { startTransition, useEffect, useRef, useState } from 'react';
import type { IMessage } from '@stomp/stompjs';
import { getStompClient, onStompConnect } from '../store/stompClient.ts';
import type { VerseSearchResult } from '../types/bible.ts';

interface State {
  results: VerseSearchResult[];
  loading: boolean;
}

export function useStompSearch(query: string): State {
  const [state, setState] = useState<State>({ results: [], loading: false });
  const resultsRef = useRef<VerseSearchResult[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ results: [], loading: false });
      resultsRef.current = [];
      return;
    }

    setState({ results: [], loading: true });
    resultsRef.current = [];

    const dest = `/user/queue/search?q=${encodeURIComponent(q)}`;

    let unsubStomp = () => {};

    const cancelConnect = onStompConnect(() => {
      const client = getStompClient();
      const sub = client.subscribe(dest, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data._end) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }
        const result = data as VerseSearchResult;
        console.log('[STOMP] Search hit received:', result);
        resultsRef.current = [...resultsRef.current, result];
        const snapshot = resultsRef.current;
        setState({ results: snapshot, loading: true });
      });
      unsubStomp = () => sub.unsubscribe();
    });

    return () => {
      cancelConnect();
      unsubStomp();
      resultsRef.current = [];
    };
  }, [query]);

  return state;
}
