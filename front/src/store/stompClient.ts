import { Client } from '@stomp/stompjs';

let _client: Client | null = null;
const _connectQueue: Array<() => void> = [];

export function getStompClient(): Client {
  if (_client) return _client;

  _client = new Client({
    brokerURL: `ws://${window.location.host}/stomp`,
    reconnectDelay: 3000,
    debug: () => {},
  });
  _client.onConnect = () => {
    _connectQueue.splice(0).forEach(cb => cb());
  };
  _client.activate();
  return _client;
}

/** Call cb immediately if already connected, otherwise queue it until CONNECTED frame. Returns a cancel fn. */
export function onStompConnect(cb: () => void): () => void {
  const client = getStompClient();
  if (client.connected) {
    cb();
    return () => {};
  }
  _connectQueue.push(cb);
  return () => {
    const i = _connectQueue.indexOf(cb);
    if (i !== -1) _connectQueue.splice(i, 1);
  };
}
