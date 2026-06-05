import { useEffect, useRef } from 'react';
import { Game } from '../game/Game.js';

export function GameCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = new Game(ref.current, { color });
    game.start();
    return () => game.dispose();
  }, [color]);
  return <canvas ref={ref} style={{ width: '100vw', height: '100vh', display: 'block' }} />;
}
