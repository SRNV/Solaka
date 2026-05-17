import { useEffect, useState } from 'react';
import type { IMessage } from '@stomp/stompjs';
import { getStompClient, onStompConnect } from '../store/stompClient.ts';
import { mapFeaturesCache } from '../store/mapFeatures.store.ts';
import type { MapFeaturesState } from '@/models/hooks';

export function useStompMapFeatures(id: string | null): MapFeaturesState {
  const [state, setState] = useState<MapFeaturesState>({ features: [], loading: false, done: false });

  useEffect(() => {
    if (!id) {
      setState({ features: [], loading: false, done: false });
      return;
    }

    // Serve from cache without hitting the server
    if (mapFeaturesCache.has(id)) {
      setState({ features: mapFeaturesCache.get(id), loading: false, done: true });
      return;
    }

    setState({ features: [], loading: true, done: false });

    const dest = `/user/queue/features/map?id=${encodeURIComponent(id)}`;
    let unsubStomp = () => {};

    const cancelConnect = onStompConnect(() => {
      const client = getStompClient();
      const sub = client.subscribe(dest, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data._end) {
          setState(prev => ({ ...prev, loading: false, done: true }));
          return;
        }
        if (Array.isArray(data._batch)) {
          const accumulated = mapFeaturesCache.append(id, data._batch);
          setState({ features: accumulated, loading: true, done: false });
        }
      });
      unsubStomp = () => sub.unsubscribe();
    });

    return () => {
      cancelConnect();
      unsubStomp();
    };
  }, [id]);

  return state;
}
