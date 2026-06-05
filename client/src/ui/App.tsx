import { useState } from 'react';
import { StartScreen, type StartChoice } from './StartScreen.js';
import { GameCanvas } from './GameCanvas.js';

export function App() {
  const [choice, setChoice] = useState<StartChoice | null>(null);
  if (!choice) return <StartScreen onStart={setChoice} />;
  return <GameCanvas color={choice.color} />;
}
