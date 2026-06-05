import type * as Party from 'partykit/server';
import { decode, encode, type ServerMsg } from '@zoomies/shared';

export default class ZoomiesServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection): void {
    // Capacity + join handled in Task 5.
    connection.send(encode({ t: 'roster', players: [] } satisfies ServerMsg));
  }

  onMessage(raw: string, sender: Party.Connection): void {
    const msg = decode(raw);
    if (!msg) return;
    // Routed in Task 5.
    void sender;
  }
}
