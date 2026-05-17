import 'reflect-metadata';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { injectable, inject } from 'inversify';
import type { IBibleRepository } from '../models/IBibleRepository';
import type { IGeoMapRepository } from '../models/IGeoMapRepository';
import type { IBiblicalPlaceRepository } from '../models/BiblicalPlace';
import type { StompFrame, Session } from '../models/stomp';
import { TYPES } from '../container/types';

// ── STOMP frame parsing ───────────────────────────────────────────────────────

function parseFrame(raw: string): StompFrame | null {
  const nullIdx = raw.indexOf('\0');
  const data = nullIdx >= 0 ? raw.slice(0, nullIdx) : raw;
  const blankLine = data.indexOf('\n\n');
  if (blankLine < 0) return null;

  const headerSection = data.slice(0, blankLine);
  const body = data.slice(blankLine + 2);
  const lines = headerSection.split('\n');
  const command = lines[0].trim();
  if (!command) return null;

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon > 0) headers[lines[i].slice(0, colon)] = lines[i].slice(colon + 1);
  }
  return { command, headers, body };
}

function buildFrame(command: string, headers: Record<string, string>, body = ''): string {
  const h = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
  return `${command}\n${h}\n\n${body}\0`;
}

function sendMsg(ws: WebSocket, destination: string, subscriptionId: string, body: string, msgId: number): Promise<void> {
  return new Promise(resolve => {
    if (ws.readyState !== WebSocket.OPEN) { resolve(); return; }
    ws.send(buildFrame('MESSAGE', {
      destination,
      subscription: subscriptionId,
      'message-id': String(msgId),
      'content-type': 'application/json',
    }, body), { binary: false }, () => resolve());
  });
}

const END = JSON.stringify({ _end: true });

// ── STOMP server ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;

@injectable()
export class StompServer {
  private sessions = new Map<WebSocket, Session>();

  constructor(
    @inject(TYPES.HttpServer)               server: Server,
    @inject(TYPES.IBibleRepository)         private readonly bible: IBibleRepository,
    @inject(TYPES.IGeoMapRepository)        private readonly geomap: IGeoMapRepository,
    @inject(TYPES.IBiblicalPlaceRepository) private readonly bgd: IBiblicalPlaceRepository,
  ) {
    const wss = new WebSocketServer({ server, path: '/stomp' });
    wss.on('connection', ws => this.onConnect(ws));
  }

  private onConnect(ws: WebSocket) {
    this.sessions.set(ws, { subs: new Map() });

    ws.on('message', data => {
      const frame = parseFrame(data.toString());
      if (frame) this.handleFrame(ws, frame);
    });

    ws.on('close', () => {
      const session = this.sessions.get(ws);
      if (session) for (const sub of session.subs.values()) sub.cancel();
      this.sessions.delete(ws);
    });
  }

  private handleFrame(ws: WebSocket, frame: StompFrame) {
    switch (frame.command) {
      case 'CONNECT':
      case 'STOMP':
        ws.send(buildFrame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }), { binary: false });
        break;
      case 'SUBSCRIBE':
        this.onSubscribe(ws, frame);
        break;
      case 'UNSUBSCRIBE':
        this.onUnsubscribe(ws, frame.headers['id']);
        break;
      case 'DISCONNECT':
        if (frame.headers['receipt']) ws.send(buildFrame('RECEIPT', { 'receipt-id': frame.headers['receipt'] }), { binary: false });
        ws.close();
        break;
    }
  }

  private onUnsubscribe(ws: WebSocket, id: string) {
    const session = this.sessions.get(ws);
    if (!session) return;
    session.subs.get(id)?.cancel();
    session.subs.delete(id);
  }

  private onSubscribe(ws: WebSocket, frame: StompFrame) {
    const id   = frame.headers['id'];
    const dest = frame.headers['destination'];
    if (!id || !dest) return;

    const session = this.sessions.get(ws);
    if (!session) return;

    // Cancel & replace any existing sub with this id
    session.subs.get(id)?.cancel();

    let cancelled = false;
    session.subs.set(id, { destination: dest, cancel: () => { cancelled = true; } });

    const isCancelled = () => cancelled;

    if (dest.startsWith('/user/queue/relations')) {
      const qs = dest.includes('?') ? new URLSearchParams(dest.split('?')[1]) : null;
      const tradParam = qs?.get('trad') ?? 'c,p';
      const q    = qs?.get('q')    ?? undefined;
      const from = qs?.get('from') ?? undefined;
      const trads = new Set(tradParam.split(',').filter(t => t === 'c' || t === 'p') as Array<'c' | 'p'>);
      this.streamRelations(ws, dest, id, trads, isCancelled, q, from);

    } else if (dest.startsWith('/user/queue/search')) {
      const qs = dest.includes('?') ? new URLSearchParams(dest.split('?')[1]) : null;
      const q = qs?.get('q') ?? '';
      this.streamSearch(ws, dest, id, q, isCancelled);

    } else if (dest === '/topic/relations') {
      this.streamRelations(ws, dest, id, new Set(['c', 'p']), isCancelled);

    } else if (dest.startsWith('/user/queue/features/map')) {
      const qs = dest.includes('?') ? new URLSearchParams(dest.split('?')[1]) : null;
      const mapId = qs?.get('id') ?? '';
      this.streamMapFeatures(ws, dest, id, mapId, isCancelled);

    } else if (dest === '/user/queue/places/bgd') {
      this.streamBGDPlaces(ws, dest, id, isCancelled);
    }
  }

  /** /user/queue/relations — stream filtered by tradition, optionally by source verse */
  private async streamRelations(ws: WebSocket, dest: string, subId: string, trads: Set<'c' | 'p'>, isCancelled: () => boolean, q?: string, from?: string) {
    let msgId = 0;
    // For per-verse requests (from=), batch everything and send at once — low latency.
    // For full streams (q= or unbounded), yield in batches of BATCH_SIZE to avoid blocking.
    const batch: object[] = [];
    for (const rel of this.bible.iterRelations(trads, q, from)) {
      if (isCancelled() || ws.readyState !== WebSocket.OPEN) return;
      batch.push(rel);
      if (!from && batch.length >= BATCH_SIZE) {
        await sendMsg(ws, dest, subId, JSON.stringify({ _batch: batch.splice(0) }), msgId++);
        await new Promise<void>(r => setImmediate(r));
      }
    }
    if (batch.length) {
      await sendMsg(ws, dest, subId, JSON.stringify({ _batch: batch }), msgId++);
    }
    if (!isCancelled() && ws.readyState === WebSocket.OPEN) {
      await sendMsg(ws, dest, subId, END, msgId);
    }
  }

  /** /user/queue/places/bgd — stream BGD biblical places in batches of 10 */
  private async streamBGDPlaces(ws: WebSocket, dest: string, subId: string, isCancelled: () => boolean) {
    const all = await this.bgd.findAll();
    let msgId = 0;
    for (let i = 0; i < all.length; i += BATCH_SIZE) {
      if (isCancelled() || ws.readyState !== WebSocket.OPEN) return;
      const batch = all.slice(i, i + BATCH_SIZE).map(p => ({ name: p.name, lonlat: p.lonlat }));
      await sendMsg(ws, dest, subId, JSON.stringify({ _batch: batch }), msgId++);
    }
    if (!isCancelled() && ws.readyState === WebSocket.OPEN)
      await sendMsg(ws, dest, subId, END, msgId);
  }

  /** /user/queue/features/map — stream GeoJSON features in batches of 10 */
  private async streamMapFeatures(ws: WebSocket, dest: string, subId: string, mapId: string, isCancelled: () => boolean) {
    if (!mapId) return;
    const data = this.geomap.findById(mapId) as { features?: unknown[] } | null;
    if (!data?.features?.length) {
      if (!isCancelled() && ws.readyState === WebSocket.OPEN)
        await sendMsg(ws, dest, subId, END, 0);
      return;
    }
    const features = data.features;
    let msgId = 0;
    for (let i = 0; i < features.length; i += BATCH_SIZE) {
      if (isCancelled() || ws.readyState !== WebSocket.OPEN) return;
      const batch = features.slice(i, i + BATCH_SIZE);
      await sendMsg(ws, dest, subId, JSON.stringify({ _batch: batch }), msgId++);
    }
    if (!isCancelled() && ws.readyState === WebSocket.OPEN)
      await sendMsg(ws, dest, subId, END, msgId);
  }

  /** /user/queue/search — stream search results */
  private async streamSearch(ws: WebSocket, dest: string, subId: string, q: string, isCancelled: () => boolean) {
    if (!q.trim()) return;
    let msgId = 0;
    for (const result of this.bible.searchAll(q)) {
      if (isCancelled() || ws.readyState !== WebSocket.OPEN) return;
      await sendMsg(ws, dest, subId, JSON.stringify(result), msgId++);
    }
    if (!isCancelled() && ws.readyState === WebSocket.OPEN) {
      await sendMsg(ws, dest, subId, END, msgId);
    }
  }
}
