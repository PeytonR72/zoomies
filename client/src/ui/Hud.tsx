import { useEffect, useState } from 'react';
import type { PlayerInfo } from '@zoomies/shared';
import type { NetClient, NetStatus } from '../net/client.js';

export function Hud({ net, code }: { net: NetClient; code: string }) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    net.onRoster = (p) => setPlayers(p);
    const prevStatus = net.onStatus;
    net.onStatus = (s) => {
      prevStatus?.(s);
      setStatus(s);
    };
    return () => {
      net.onRoster = undefined;
      net.onStatus = prevStatus;
    };
  }, [net]);

  const copy = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div style={wrap}>
      <div style={panel}>
        <button style={codeBtn} onClick={copy} title="Copy lobby code">
          {code} {copied ? '✓' : '⧉'}
        </button>
        <ul style={list}>
          {players.map((p) => (
            <li key={p.id} style={row}>
              <span style={{ ...dot, background: p.color }} />
              {p.name}
              {p.id === net.selfId ? ' (you)' : ''}
            </li>
          ))}
        </ul>
      </div>
      <div style={controls}>WASD / Arrows to drive</div>
      <div
        style={{ ...statusDot, background: status === 'open' ? '#37d67a' : '#ff924d' }}
        role="status"
        aria-label={status === 'open' ? 'Connected' : `Connection: ${status}`}
        title={status === 'open' ? 'Connected' : `Connection: ${status}`}
      />
    </div>
  );
}

const wrap: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const panel: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 12,
  padding: 12,
  pointerEvents: 'auto',
  minWidth: 160,
};
const codeBtn: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 2,
  border: 'none',
  background: '#eef3ff',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  width: '100%',
};
const list: React.CSSProperties = { listStyle: 'none', margin: '10px 0 0', padding: 0 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' };
const dot: React.CSSProperties = { width: 12, height: 12, borderRadius: 6, display: 'inline-block' };
const controls: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 13,
};
const statusDot: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  width: 12,
  height: 12,
  borderRadius: 6,
};
