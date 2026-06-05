import { useState } from 'react';
import { PLAYER_COLORS, NAME_MAX_LEN } from '@zoomies/shared';

export interface StartChoice {
  name: string;
  color: string;
}

export function StartScreen({ onStart }: { onStart: (c: StartChoice) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);

  const canStart = name.trim().length > 0;
  return (
    <div style={overlay}>
      <div style={card}>
        <h1 style={{ margin: '0 0 4px' }}>Zoomies</h1>
        <p style={{ marginTop: 0, color: '#567' }}>Pick a name and a car.</p>
        <input
          style={input}
          placeholder="Your name"
          maxLength={NAME_MAX_LEN}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c,
                border: color === c ? '3px solid #222' : '3px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <button
          style={{ ...primary, opacity: canStart ? 1 : 0.5 }}
          disabled={!canStart}
          onClick={() => onStart({ name: name.trim(), color })}
        >
          Drive
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(#bfe3ff,#8fd0ff)',
};
const card: React.CSSProperties = {
  background: '#fff',
  padding: 28,
  borderRadius: 16,
  width: 320,
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: 10,
  fontSize: 16,
  borderRadius: 8,
  border: '1px solid #ccd',
  boxSizing: 'border-box',
};
const primary: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 16,
  fontWeight: 700,
  color: '#fff',
  background: '#ff4d6d',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
};
