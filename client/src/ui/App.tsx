import { useEffect, useRef, useState } from 'react';
import { generateRoomCode } from '@zoomies/shared';
import { StartScreen, type StartChoice } from './StartScreen.js';
import { GameCanvas } from './GameCanvas.js';
import { Hud } from './Hud.js';
import { NetClient, type NetStatus } from '../net/client.js';

type Phase = 'menu' | 'playing' | 'full';

export function App() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [choice, setChoice] = useState<StartChoice | null>(null);
  const [code, setCode] = useState('');
  const netRef = useRef<NetClient | null>(null);

  const begin = (c: StartChoice) => {
    const room = c.mode === 'create' ? generateRoomCode() : c.code;
    const net = new NetClient(room, { name: c.name, color: c.color });
    net.onStatus = (s: NetStatus) => {
      if (s === 'full') {
        net.close();
        setPhase('full');
      }
    };
    netRef.current = net;
    setChoice(c);
    setCode(room);
    setPhase('playing');
  };

  useEffect(() => () => netRef.current?.close(), []);

  if (phase === 'full') {
    return (
      <div style={center}>
        <div>
          <h2>Lobby is full</h2>
          <button onClick={() => setPhase('menu')}>Back</button>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && choice && netRef.current) {
    return (
      <>
        <GameCanvas color={choice.color} net={netRef.current} />
        <Hud net={netRef.current} code={code} />
      </>
    );
  }

  return <StartScreen onStart={begin} />;
}

const center: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(#bfe3ff,#8fd0ff)',
  textAlign: 'center',
};
