import { useEffect, useRef } from 'react';
import { Game } from '../game/Game.js';
import type { NetClient } from '../net/client.js';

export function GameCanvas({ color, net }: { color: string; net: NetClient }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = new Game(ref.current, { color, net });
    game.start();
    return () => game.dispose();
  }, [color, net]);
  return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />;
}
