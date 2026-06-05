import { describe, it, expect } from 'vitest';
import { encode, decode } from './protocol.js';
import type { ClientMsg, ServerMsg } from './protocol.js';

describe('protocol', () => {
  it('round-trips a client state message', () => {
    const msg: ClientMsg = {
      t: 'state',
      car: { x: 1, z: 2, heading: 0.5, vx: 3, vz: 4 },
    };
    expect(decode(encode(msg))).toEqual(msg);
  });
  it('round-trips a server snapshot message', () => {
    const msg: ServerMsg = {
      t: 'snapshot',
      states: { abc: { x: 0, z: 0, heading: 0, vx: 0, vz: 0 } },
    };
    expect(decode(encode(msg))).toEqual(msg);
  });
  it('returns null for garbage', () => {
    expect(decode('not json')).toBeNull();
    expect(decode(JSON.stringify({ t: 'nope' }))).toBeNull();
  });
});
