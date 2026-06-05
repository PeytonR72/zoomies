import PartySocket from 'partysocket';
import {
  decode,
  encode,
  type CarState,
  type PlayerInfo,
} from '@zoomies/shared';

export type NetStatus = 'connecting' | 'open' | 'full' | 'closed';

const HOST = import.meta.env.VITE_PARTYKIT_HOST ?? '127.0.0.1:1999';

/** Thin event wrapper around a PartySocket connection to one lobby room. */
export class NetClient {
  readonly players = new Map<string, PlayerInfo>();
  selfId: string | null = null;

  onRoster?: (players: PlayerInfo[]) => void;
  onSnapshot?: (states: Record<string, CarState>, arrival: number) => void;
  onCorrection?: (car: CarState) => void;
  onStatus?: (status: NetStatus) => void;

  private socket: PartySocket;

  constructor(
    readonly code: string,
    private readonly join: { name: string; color: string },
  ) {
    this.socket = new PartySocket({ host: HOST, room: code });
    this.socket.addEventListener('open', () => {
      this.onStatus?.('open');
      this.socket.send(encode({ t: 'join', name: join.name, color: join.color }));
    });
    this.socket.addEventListener('close', () => this.onStatus?.('closed'));
    this.socket.addEventListener('message', (e) => this.handle(e.data));
    this.onStatus?.('connecting');
  }

  private handle(raw: string): void {
    const msg = decode(raw);
    if (!msg) return;
    switch (msg.t) {
      case 'welcome':
        this.selfId = msg.selfId;
        this.setRoster(msg.players);
        break;
      case 'roster':
        this.setRoster(msg.players);
        break;
      case 'snapshot':
        this.onSnapshot?.(msg.states, performance.now());
        break;
      case 'correction':
        this.onCorrection?.(msg.car);
        break;
      case 'full':
        this.onStatus?.('full');
        break;
    }
  }

  private setRoster(players: PlayerInfo[]): void {
    this.players.clear();
    for (const p of players) this.players.set(p.id, p);
    this.onRoster?.(players);
  }

  sendState(car: CarState): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(encode({ t: 'state', car }));
  }

  close(): void {
    this.socket.close();
  }
}
