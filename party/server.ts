import type * as Party from 'partykit/server';
import {
  decode,
  encode,
  validateState,
  MAX_PLAYERS,
  SNAPSHOT_RATE_HZ,
  type CarState,
  type PlayerInfo,
  type ServerMsg,
} from '@zoomies/shared';

export default class ZoomiesServer implements Party.Server {
  private players = new Map<string, PlayerInfo>();
  private states = new Map<string, CarState>();
  private loop: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection): void {
    if (this.players.size >= MAX_PLAYERS) {
      connection.send(encode({ t: 'full' }));
      connection.close();
    }
    // Otherwise wait for the client's 'join' message before reserving a slot.
  }

  onMessage(raw: string, sender: Party.Connection): void {
    const msg = decode(raw);
    if (!msg || !('t' in msg)) return;

    if (msg.t === 'join') {
      if (this.players.size >= MAX_PLAYERS && !this.players.has(sender.id)) {
        sender.send(encode({ t: 'full' }));
        sender.close();
        return;
      }
      const player: PlayerInfo = {
        id: sender.id,
        name: msg.name.slice(0, 12) || 'Player',
        color: msg.color,
      };
      this.players.set(sender.id, player);
      sender.send(encode({ t: 'welcome', selfId: sender.id, players: [...this.players.values()] }));
      this.broadcastRoster();
      this.ensureLoop();
      return;
    }

    if (msg.t === 'state') {
      if (!this.players.has(sender.id)) return; // must join first
      const prev = this.states.get(sender.id) ?? null;
      const { state, corrected } = validateState(prev, msg.car);
      this.states.set(sender.id, state);
      if (corrected) sender.send(encode({ t: 'correction', car: state }));
    }
  }

  onClose(connection: Party.Connection): void {
    this.players.delete(connection.id);
    this.states.delete(connection.id);
    this.broadcastRoster();
    if (this.players.size === 0) this.stopLoop();
  }

  private broadcastRoster(): void {
    const msg: ServerMsg = { t: 'roster', players: [...this.players.values()] };
    this.room.broadcast(encode(msg));
  }

  private ensureLoop(): void {
    if (this.loop) return;
    this.loop = setInterval(() => this.broadcastSnapshot(), 1000 / SNAPSHOT_RATE_HZ);
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  private broadcastSnapshot(): void {
    if (this.states.size === 0) return;
    const states: Record<string, CarState> = {};
    for (const [id, s] of this.states) states[id] = s;
    this.room.broadcast(encode({ t: 'snapshot', states }));
  }
}
