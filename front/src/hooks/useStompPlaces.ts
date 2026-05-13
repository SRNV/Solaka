import { useEffect, useState } from 'react';
import type { IMessage } from '@stomp/stompjs';
import { getStompClient, onStompConnect } from '../store/stompClient.ts';

export interface PlaceItem { name: string; lonlat: [number, number]; }

type PlaceType = 'bgd';

const cache = new Map<PlaceType, PlaceItem[]>();

interface State { places: PlaceItem[]; done: boolean; }

export function useStompPlaces(type: PlaceType): State {
  const [state, setState] = useState<State>(() =>
    cache.has(type)
      ? { places: cache.get(type)!, done: true }
      : { places: [], done: false }
  );

  useEffect(() => {
    if (cache.has(type)) {
      setState({ places: cache.get(type)!, done: true });
      return;
    }

    setState({ places: [], done: false });
    const dest = `/user/queue/places/${type}`;
    let unsubStomp = () => {};

    const cancelConnect = onStompConnect(() => {
      const client = getStompClient();
      const accumulated: PlaceItem[] = [];

      const sub = client.subscribe(dest, (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data._end) {
          cache.set(type, accumulated);
          setState({ places: accumulated, done: true });
          return;
        }
        if (Array.isArray(data._batch)) {
          accumulated.push(...data._batch);
          setState({ places: [...accumulated], done: false });
        }
      });
      unsubStomp = () => sub.unsubscribe();
    });

    return () => { cancelConnect(); unsubStomp(); };
  }, [type]);

  return state;
}
