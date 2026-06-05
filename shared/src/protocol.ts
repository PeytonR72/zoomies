import type { CarState, PlayerInfo } from './types.js';

export type ClientMsg =
  | { t: 'join'; name: string; color: string }
  | { t: 'state'; car: CarState };

export type ServerMsg =
  | { t: 'welcome'; selfId: string; players: PlayerInfo[] }
  | { t: 'roster'; players: PlayerInfo[] }
  | { t: 'snapshot'; states: Record<string, CarState> }
  | { t: 'correction'; car: CarState }
  | { t: 'full' };

const CLIENT_TAGS = new Set(['join', 'state']);
const SERVER_TAGS = new Set(['welcome', 'roster', 'snapshot', 'correction', 'full']);

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

/** Parse a wire message; returns null if it isn't a known message shape. */
export function decode(raw: string): ClientMsg | ServerMsg | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const t = (parsed as { t?: unknown }).t;
  if (typeof t !== 'string') return null;
  if (!CLIENT_TAGS.has(t) && !SERVER_TAGS.has(t)) return null;
  return parsed as ClientMsg | ServerMsg;
}
