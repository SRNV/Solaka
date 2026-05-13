import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IMessage } from '@stomp/stompjs';
import { getStompClient, onStompConnect } from '../store/stompClient.ts';
import {
  useRelationsStore,
  selectRelationsFrom,
  relsFetched,
  type RelRow,
} from '../store/relations.store.ts';

const EMPTY_RELS: any[] = [];
const emptySelector = () => EMPTY_RELS;

export function useVerseRelations(uuid: string | null) {
  const addBatch = useRelationsStore(s => s.addBatch);
  const rels     = useRelationsStore(useShallow(uuid ? selectRelationsFrom(uuid) : emptySelector));

  useEffect(() => {
    if (!uuid || relsFetched.has(uuid)) return;

    const dest = `/user/queue/relations?from=${encodeURIComponent(uuid)}&trad=c,p`;
    let unsubStomp = () => {};

    const cancelConnect = onStompConnect(() => {
      const client  = getStompClient();
      const pending: RelRow[] = [];

      const sub = client.subscribe(dest, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data._end) {
          if (pending.length) addBatch(pending.splice(0));
          relsFetched.add(uuid);
          return;
        }
        if (Array.isArray(data._batch)) {
          pending.push(...(data._batch as RelRow[]));
        } else {
          pending.push(data as RelRow);
        }
        if (pending.length >= 10) addBatch(pending.splice(0));
      });

      unsubStomp = () => sub.unsubscribe();
    });

    return () => { cancelConnect(); unsubStomp(); };
  }, [uuid, addBatch]);

  return rels;
}
