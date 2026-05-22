import { useEffect, useRef, useState } from 'react';

const MAX_LINES = 40;

export function DebugOverlay({ controllerId, roomId }: { controllerId?: string; roomId?: string } = {}) {
  const [lines, setLines] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const originalDebug = useRef<typeof console.debug>(console.debug);

  useEffect(() => {
    const orig = console.debug.bind(console);
    originalDebug.current = orig;

    console.debug = (...args: unknown[]) => {
      orig(...args);
      const msg = args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ');
      setLines(prev => {
        const next = [...prev, msg];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    };

    return () => { console.debug = orig; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed', bottom: 8, left: 8, zIndex: 99999,
          background: 'rgba(0,0,0,0.7)', color: '#0f0', border: '1px solid #0f0',
          borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
        }}
      >DBG</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: '38vh', zIndex: 99999,
      background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column',
      borderTop: '2px solid #0f0', fontFamily: 'monospace',
    }}>
      {(controllerId || roomId) && (
        <div style={{ padding: '2px 8px', borderBottom: '1px solid #333', flexShrink: 0 }}>
          {roomId    && <div style={{ fontSize: 10, color: '#ff0', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>room: {roomId}</div>}
          {controllerId && <div style={{ fontSize: 10, color: '#0ff', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ctrl: {controllerId}</div>}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', gap: 8, flexShrink: 0 }}>
        <span style={{ color: '#0f0', fontSize: 11, flex: 1 }}>DEBUG</span>
        <button onClick={() => setLines([])}
          style={{ background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 4, padding: '1px 7px', fontSize: 11, cursor: 'pointer' }}>
          clear
        </button>
        <button onClick={() => setVisible(false)}
          style={{ background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 4, padding: '1px 7px', fontSize: 11, cursor: 'pointer' }}>
          ✕
        </button>
      </div>
      <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, padding: '0 8px 8px' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: 11, color: l.includes('null') || l.includes('false') ? '#f88' : '#cfc', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
