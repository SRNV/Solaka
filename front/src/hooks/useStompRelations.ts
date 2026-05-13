import { useEffect, useRef, useState } from 'react';
import type { IMessage } from '@stomp/stompjs';
import { getStompClient, onStompConnect } from '../store/stompClient.ts';
import type { BibleRelation } from '../types/bible.ts';

interface StompRelationsState {
  relations: BibleRelation[];
  loading:   boolean;
}

/**
 * Streams Bible cross-references for the given tradition(s) and optional query
 * via STOMP WebSocket. Relations arrive one at a time from the backend and are
 * batched on the client every 250 ms so the UI updates smoothly.
 *
 * @param enabled  - Whether the stream should be active.
 * @param showCath - Include Catholic tradition relations.
 * @param showProt - Include Protestant tradition relations.
 * @param q        - Optional verse reference or text query to filter relations.
 */
export function useStompRelations(
  enabled:  boolean,
  showCath: boolean,
  showProt: boolean,
  q?:       string,
): StompRelationsState {
  const [state, setState] = useState<StompRelationsState>({ relations: [], loading: false });
  const relationsRef      = useRef<BibleRelation[]>([]);
  const incomingQueueRef  = useRef<BibleRelation[]>([]);

  useEffect(() => {
    if (!enabled || (!showCath && !showProt)) {
      setState({ relations: [], loading: false });
      relationsRef.current     = [];
      incomingQueueRef.current = [];
      return;
    }

    setState({ relations: [], loading: true });
    relationsRef.current     = [];
    incomingQueueRef.current = [];

    const traditions  = [showCath && 'c', showProt && 'p'].filter(Boolean).join(',');
    const destination = `/user/queue/relations?trad=${traditions}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

    let unsubscribeStomp = () => {};
    let streamEnded      = false;

    const cancelConnect = onStompConnect(() => {
      const client = getStompClient();
      const sub    = client.subscribe(destination, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data._end) { streamEnded = true; return; }

        // Backend may send a batch array or a single relation object
        if (data._batch && Array.isArray(data._batch)) {
          incomingQueueRef.current = [...incomingQueueRef.current, ...data._batch as BibleRelation[]];
        } else {
          incomingQueueRef.current.push(data as BibleRelation);
        }
      });
      unsubscribeStomp = () => sub.unsubscribe();
    });

    // Drain the incoming queue one relation per tick to keep renders smooth
    const drainInterval = setInterval(() => {
      if (incomingQueueRef.current.length > 0) {
        // Preserve the full BibleRelation shape (including fromTo) for correct
        // normalizeRelations behaviour — do not strip fields here.
        const rel = incomingQueueRef.current.shift()!;
        relationsRef.current = [...relationsRef.current, rel];
        setState({ relations: relationsRef.current, loading: true });
      } else if (streamEnded) {
        setState(prev => prev.loading ? { relations: relationsRef.current, loading: false } : prev);
        clearInterval(drainInterval);
      }
    }, 250);

    return () => {
      cancelConnect();
      unsubscribeStomp();
      clearInterval(drainInterval);
      relationsRef.current     = [];
      incomingQueueRef.current = [];
    };
  }, [enabled, showCath, showProt, q]);

  return state;
}
