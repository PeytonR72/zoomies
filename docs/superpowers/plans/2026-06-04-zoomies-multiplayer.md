# Zoomies Multiplayer, Deploy & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-player foundation into a 6-player online game: PartyKit lobby (create/join by code), client→server state relay with server validation, smooth interpolation of remote cars, soft-bump between cars, a lobby/HUD, real deployment (Vercel + PartyKit), and a polish pass (juice / performance / accessibility).

**Architecture:** Hybrid authority — each client simulates its own car (Plan 1's pure `stepCar`) and sends state at `SEND_RATE_HZ`; the PartyKit room validates each update against `shared` limits (clamp bounds, reject impossible jumps), stores per-player state, and broadcasts snapshots at `SNAPSHOT_RATE_HZ`. Remotes render from an interpolation buffer `INTERP_DELAY_MS` in the past. Each client only ever moves its own car, so soft-bumps stay stable.

**Tech Stack:** PartyKit + `partysocket`, plus everything from Plan 1 (TypeScript, Vite, React, raw Three.js, Vitest).

**Prerequisite:** Plan 1 complete (`docs/superpowers/plans/2026-06-04-zoomies-foundation.md`). **Spec:** `docs/superpowers/specs/2026-06-04-zoomies-driving-game-design.md`.

---

## File Structure (new/changed)

```
zoomies/
  partykit.json                  PartyKit project config (name + entry)
  vercel.json                    client build/output for Vercel
  client/.env.example            VITE_PARTYKIT_HOST sample

  shared/src/
    protocol.ts                  message union (client<->server) + encode/decode
    protocol.test.ts
    roomCode.ts                  generateRoomCode()
    roomCode.test.ts
    validation.ts                validateState() — server-side, pure
    validation.test.ts
    index.ts                     (extended to re-export the above)

  party/
    package.json                 (+ partykit dep)
    tsconfig.json
    server.ts                    room: roster, validate, broadcast snapshots

  client/src/
    net/client.ts                NetClient: PartySocket wrapper + events
    game/remote.ts               Interpolator (timed sample buffer)
    game/remote.test.ts
    game/nameTag.ts              billboarded name sprite
    game/Game.ts                 (rewritten to be networked + render remotes)
    ui/App.tsx                   (rewritten: menu/connecting/playing/full state machine)
    ui/StartScreen.tsx           (rewritten: name+color+create/join code)
    ui/Hud.tsx                   room code, player list, controls, status
    ui/GameCanvas.tsx            (rewritten to pass NetClient into Game)
```

---

## Task 1: Message protocol (types + encode/decode)

**Files:**
- Create: `shared/src/protocol.ts`
- Test: `shared/src/protocol.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/protocol.test.ts`
Expected: FAIL — cannot resolve `./protocol.js`.

- [ ] **Step 3: Create `shared/src/protocol.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/protocol.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add to `shared/src/index.ts`**

Append:

```ts
export * from './protocol.js';
export * from './roomCode.js';
export * from './validation.js';
```

> `roomCode.js` and `validation.js` resolve in Tasks 2–3; if typecheck blocks now, add the two lines after Task 3.

- [ ] **Step 6: Commit**

```bash
git add shared/src/protocol.ts shared/src/protocol.test.ts shared/src/index.ts
git commit -m "feat(shared): wire protocol (encode/decode + message union)"
```

---

## Task 2: Room code generator

**Files:**
- Create: `shared/src/roomCode.ts`
- Test: `shared/src/roomCode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generateRoomCode, ROOM_CODE_ALPHABET } from './roomCode.js';
import { ROOM_CODE_LENGTH } from './constants.js';

describe('generateRoomCode', () => {
  it('has the configured length and uses only the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });
  it('is reasonably unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThan(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/roomCode.test.ts`
Expected: FAIL — cannot resolve `./roomCode.js`.

- [ ] **Step 3: Create `shared/src/roomCode.ts`**

```ts
import { ROOM_CODE_LENGTH } from './constants.js';

// No 0/O/1/I to keep codes easy to read and type aloud.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/roomCode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/roomCode.ts shared/src/roomCode.test.ts
git commit -m "feat(shared): readable room code generator"
```

---

## Task 3: Server-side validation (pure)

**Files:**
- Create: `shared/src/validation.ts`
- Test: `shared/src/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { validateState } from './validation.js';
import { MAP } from './map.js';
import { MAX_SPEED, MAX_STEP_DISTANCE } from './constants.js';
import type { CarState } from './types.js';

const base: CarState = { x: 0, z: 0, heading: 0, vx: 0, vz: 0 };

describe('validateState', () => {
  it('passes a normal in-bounds update untouched', () => {
    const next = { ...base, x: 5, vz: 10 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(false);
    expect(r.state.x).toBeCloseTo(5);
  });
  it('clamps an out-of-bounds position', () => {
    const next = { ...base, x: MAP.bounds.maxX + 100 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(true);
    expect(r.state.x).toBeLessThan(MAP.bounds.maxX);
  });
  it('clamps impossible speed', () => {
    const next = { ...base, vx: MAX_SPEED * 10 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(true);
    expect(Math.hypot(r.state.vx, r.state.vz)).toBeLessThanOrEqual(MAX_SPEED * 1.16);
  });
  it('rejects a teleport by keeping the previous position', () => {
    const prev = { ...base, x: 0, z: 0 };
    const next = { ...base, x: MAX_STEP_DISTANCE + 50, z: 0 };
    const r = validateState(prev, next);
    expect(r.corrected).toBe(true);
    expect(r.state.x).toBeCloseTo(prev.x);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/validation.test.ts`
Expected: FAIL — cannot resolve `./validation.js`.

- [ ] **Step 3: Create `shared/src/validation.ts`**

```ts
import type { CarState } from './types.js';
import { MAX_SPEED, SPEED_TOLERANCE, MAX_STEP_DISTANCE } from './constants.js';
import { resolveBounds } from './collision.js';

export interface ValidationResult {
  state: CarState;
  corrected: boolean;
}

/**
 * Server-authoritative sanity pass over a client-submitted state.
 * - Clamps to world bounds.
 * - Clamps total speed to MAX_SPEED * tolerance.
 * - Rejects teleports (jumps larger than one send-interval could allow) by
 *   keeping the previous position but accepting the new heading/velocity.
 * Pure: never mutates its inputs.
 */
export function validateState(prev: CarState | null, next: CarState): ValidationResult {
  let corrected = false;
  let s: CarState = { ...next };

  const bounded = resolveBounds(s);
  if (bounded.x !== s.x || bounded.z !== s.z) corrected = true;
  s = bounded;

  const spd = Math.hypot(s.vx, s.vz);
  const max = MAX_SPEED * SPEED_TOLERANCE;
  if (spd > max) {
    const k = max / spd;
    s = { ...s, vx: s.vx * k, vz: s.vz * k };
    corrected = true;
  }

  if (prev) {
    const jump = Math.hypot(s.x - prev.x, s.z - prev.z);
    if (jump > MAX_STEP_DISTANCE) {
      s = { ...s, x: prev.x, z: prev.z };
      corrected = true;
    }
  }

  return { state: s, corrected };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/validation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck shared**

Run: `npm --workspace shared run typecheck && npx vitest run`
Expected: clean; all shared tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/src/validation.ts shared/src/validation.test.ts shared/src/index.ts
git commit -m "feat(shared): pure server-side state validation"
```

---

## Task 4: PartyKit server scaffold

**Files:**
- Create: `partykit.json`
- Modify: `party/package.json`
- Create: `party/tsconfig.json`
- Create: `party/server.ts` (skeleton)
- Modify: root `package.json` (scripts + dev dep)

- [ ] **Step 1: Add PartyKit to `party/package.json`**

```json
{
  "name": "@zoomies/party",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "dependencies": { "@zoomies/shared": "*" },
  "devDependencies": { "partykit": "^0.0.111" }
}
```

- [ ] **Step 2: Create `party/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "composite": false, "types": [] },
  "include": ["*.ts"]
}
```

- [ ] **Step 3: Create `partykit.json`**

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "zoomies",
  "main": "party/server.ts",
  "compatibilityDate": "2024-09-01"
}
```

- [ ] **Step 4: Create `party/server.ts` skeleton**

```ts
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
```

- [ ] **Step 5: Add root scripts + dev dep in root `package.json`**

In `scripts` add:

```json
"dev:party": "partykit dev",
"deploy:party": "partykit deploy"
```

In root `devDependencies` add `"partykit": "^0.0.111"`.

- [ ] **Step 6: Install and verify the dev server boots**

Run: `npm install`
Then: `npm run dev:party`
Expected: PartyKit dev server starts on `http://127.0.0.1:1999`. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add partykit.json party package.json package-lock.json
git commit -m "chore(party): partykit scaffold + dev server"
```

---

## Task 5: Server roster, capacity, validation & snapshot broadcast

**Files:**
- Modify: `party/server.ts`

- [ ] **Step 1: Replace `party/server.ts` with the full implementation**

```ts
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
```

- [ ] **Step 2: Typecheck the party workspace**

Run: `npx tsc -p party/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test with the dev server**

Run: `npm run dev:party` (leave running). In another terminal:

```bash
npx wscat -c "ws://127.0.0.1:1999/parties/main/TEST" 2>/dev/null || echo "If wscat missing: npx -y wscat -c ws://127.0.0.1:1999/parties/main/TEST"
```

Type: `{"t":"join","name":"Tester","color":"#ff4d6d"}`
Expected: you receive a `welcome` then `roster`, and repeated `snapshot` messages once a state is sent. Stop both.

> If installing `wscat` is undesirable, skip this manual check — the full path is exercised end-to-end in Task 9.

- [ ] **Step 4: Commit**

```bash
git add party/server.ts
git commit -m "feat(party): roster, capacity, validation, snapshot broadcast"
```

---

## Task 6: Remote interpolation buffer

**Files:**
- Create: `client/src/game/remote.ts`
- Test: `client/src/game/remote.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Interpolator } from './remote.js';
import type { CarState } from '@zoomies/shared';

const car = (x: number, z: number, heading = 0): CarState => ({ x, z, heading, vx: 0, vz: 0 });

describe('Interpolator', () => {
  it('lerps position between two timed samples', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0));
    it_.push(100, car(10, 20));
    const s = it_.sample(50)!;
    expect(s.x).toBeCloseTo(5);
    expect(s.z).toBeCloseTo(10);
  });
  it('returns the latest sample when asked beyond the buffer', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0));
    it_.push(100, car(10, 0));
    expect(it_.sample(999)!.x).toBeCloseTo(10);
  });
  it('takes the shortest path when interpolating heading across the ±π seam', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0, -Math.PI + 0.1));
    it_.push(100, car(0, 0, Math.PI - 0.1));
    const h = it_.sample(50)!.heading;
    // Should be near ±π, NOT near 0 (which is the long way around).
    expect(Math.abs(Math.abs(h) - Math.PI)).toBeLessThan(0.2);
  });
  it('returns null when empty', () => {
    expect(new Interpolator().sample(0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/game/remote.test.ts`
Expected: FAIL — cannot resolve `./remote.js`.

- [ ] **Step 3: Create `client/src/game/remote.ts`**

```ts
import type { CarState } from '@zoomies/shared';

interface Sample {
  time: number;
  car: CarState;
}

/** Shortest angular interpolation between two yaw angles. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Timed sample buffer for one remote car; sample() lerps to a render time. */
export class Interpolator {
  private buf: Sample[] = [];
  private readonly maxSamples = 20;

  push(time: number, car: CarState): void {
    this.buf.push({ time, car });
    if (this.buf.length > this.maxSamples) this.buf.shift();
  }

  sample(renderTime: number): CarState | null {
    if (this.buf.length === 0) return null;
    if (this.buf.length === 1) return this.buf[0]!.car;

    const last = this.buf[this.buf.length - 1]!;
    if (renderTime >= last.time) return last.car;
    const first = this.buf[0]!;
    if (renderTime <= first.time) return first.car;

    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i]!;
      const b = this.buf[i + 1]!;
      if (renderTime >= a.time && renderTime <= b.time) {
        const span = b.time - a.time || 1;
        const t = (renderTime - a.time) / span;
        return {
          x: a.car.x + (b.car.x - a.car.x) * t,
          z: a.car.z + (b.car.z - a.car.z) * t,
          heading: lerpAngle(a.car.heading, b.car.heading, t),
          vx: b.car.vx,
          vz: b.car.vz,
        };
      }
    }
    return last.car;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/game/remote.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/game/remote.ts client/src/game/remote.test.ts
git commit -m "feat(client): remote interpolation buffer"
```

---

## Task 7: NetClient (PartySocket wrapper)

**Files:**
- Create: `client/src/net/client.ts`
- Modify: `client/package.json` (add `partysocket`)
- Create: `client/.env.example`

- [ ] **Step 1: Add `partysocket` to `client/package.json` dependencies**

Add to `dependencies`: `"partysocket": "^1.0.2"`. Then run `npm install`.

- [ ] **Step 2: Create `client/.env.example`**

```
# PartyKit host. Local dev default is 127.0.0.1:1999.
# In production set this to your deployed host, e.g. zoomies.<username>.partykit.dev
VITE_PARTYKIT_HOST=127.0.0.1:1999
```

- [ ] **Step 3: Create `client/src/net/client.ts`**

```ts
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
```

- [ ] **Step 4: Typecheck**

Run: `npm --workspace client run build`
Expected: compiles (Game still single-player; rewired next task).

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/.env.example client/src/net/client.ts package-lock.json
git commit -m "feat(client): NetClient PartySocket wrapper"
```

---

## Task 8: Name tags

**Files:**
- Create: `client/src/game/nameTag.ts`

- [ ] **Step 1: Create `client/src/game/nameTag.ts`**

```ts
import * as THREE from 'three';

/** A billboarded text sprite that floats above a car. */
export function buildNameTag(name: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 8, 8, 240, 48, 12);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 12), 128, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(8, 2, 1);
  sprite.position.y = 4.5;
  return sprite;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --workspace client run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/nameTag.ts
git commit -m "feat(client): billboarded car name tags"
```

---

## Task 9: Rewire Game for multiplayer (send state, render remotes, soft-bump)

**Files:**
- Modify: `client/src/game/Game.ts` (full rewrite)

- [ ] **Step 1: Replace `client/src/game/Game.ts`**

```ts
import * as THREE from 'three';
import {
  FIXED_DT,
  SEND_RATE_HZ,
  INTERP_DELAY_MS,
  CAR_RADIUS,
  MAP,
  spawnCar,
  stepCar,
  resolveCollisions,
  resolveCircle,
  surfaceAt,
  type CarState,
} from '@zoomies/shared';
import { createWorld } from './world.js';
import { buildCarMesh, type CarMesh } from './carMesh.js';
import { buildNameTag } from './nameTag.js';
import { makeCamera, updateCamera } from './camera.js';
import { FixedStepper } from './loop.js';
import { Keyboard } from './input.js';
import { Interpolator } from './remote.js';
import type { NetClient } from '../net/client.js';

interface Remote {
  mesh: CarMesh;
  tag: THREE.Sprite;
  interp: Interpolator;
  lastPos: { x: number; z: number };
}

export interface GameOptions {
  color: string;
  net: NetClient;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private keyboard = new Keyboard();
  private detachInput: () => void;
  private stepper = new FixedStepper(FIXED_DT);
  private car: CarState;
  private carMesh: CarMesh;
  private net: NetClient;
  private remotes = new Map<string, Remote>();
  private sendAcc = 0;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: GameOptions,
  ) {
    this.net = opts.net;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();

    const world = createWorld();
    this.scene = world.scene;
    this.camera = makeCamera(canvas.clientWidth / canvas.clientHeight);

    const spawn = MAP.spawnPoints[Math.floor(Math.random() * MAP.spawnPoints.length)]!;
    this.car = spawnCar(spawn.x, spawn.z, 0);
    this.carMesh = buildCarMesh(opts.color);
    this.scene.add(this.carMesh.group);

    this.net.onSnapshot = (states, arrival) => this.ingestSnapshot(states, arrival);
    this.net.onCorrection = (car) => {
      this.car = { ...this.car, ...car }; // snap to server correction
    };

    this.detachInput = this.keyboard.attach();
    window.addEventListener('resize', this.resize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const elapsed = (now - this.last) / 1000;
      this.last = now;
      this.stepper.advance(elapsed, () => this.fixedStep());
      this.maybeSend(elapsed);
      this.render(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fixedStep(): void {
    const input = this.keyboard.state();
    const surface = surfaceAt(this.car.x, this.car.z);
    let next = stepCar(this.car, input, surface, FIXED_DT);
    next = resolveCollisions(next, MAP.props);
    // Soft-bump: push only our own car out of remotes' interpolated positions.
    const renderTime = performance.now() - INTERP_DELAY_MS;
    for (const r of this.remotes.values()) {
      const s = r.interp.sample(renderTime);
      if (s) next = resolveCircle(next, { x: s.x, z: s.z, radius: CAR_RADIUS });
    }
    this.car = next;
  }

  private maybeSend(elapsed: number): void {
    this.sendAcc += elapsed;
    const interval = 1 / SEND_RATE_HZ;
    if (this.sendAcc >= interval) {
      this.sendAcc = 0;
      this.net.sendState(this.car);
    }
  }

  private ingestSnapshot(states: Record<string, CarState>, arrival: number): void {
    for (const [id, s] of Object.entries(states)) {
      if (id === this.net.selfId) continue;
      let r = this.remotes.get(id);
      if (!r) r = this.spawnRemote(id);
      if (r) r.interp.push(arrival, s);
    }
  }

  private spawnRemote(id: string): Remote | undefined {
    const info = this.net.players.get(id);
    if (!info) return undefined;
    const mesh = buildCarMesh(info.color);
    const tag = buildNameTag(info.name, info.color);
    mesh.group.add(tag);
    this.scene.add(mesh.group);
    const r: Remote = { mesh, tag, interp: new Interpolator(), lastPos: { x: 0, z: 0 } };
    this.remotes.set(id, r);
    return r;
  }

  private render(now: number): void {
    this.carMesh.group.position.set(this.car.x, 0, this.car.z);
    this.carMesh.group.rotation.y = this.car.heading;

    const renderTime = now - INTERP_DELAY_MS;
    for (const [id, r] of this.remotes) {
      if (!this.net.players.has(id)) {
        this.scene.remove(r.mesh.group);
        this.remotes.delete(id);
        continue;
      }
      const s = r.interp.sample(renderTime);
      if (s) {
        r.mesh.group.position.set(s.x, 0, s.z);
        r.mesh.group.rotation.y = s.heading;
      }
    }

    updateCamera(this.camera, this.car.x, this.car.z);
    this.renderer.render(this.scene, this.camera);
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  };

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.detachInput();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --workspace client run build`
Expected: compiles (GameCanvas updated next task; a temporary type error there is fixed in Task 10).

- [ ] **Step 3: Commit**

```bash
git add client/src/game/Game.ts
git commit -m "feat(client): networked Game — send state, render+interpolate remotes, soft-bump"
```

---

## Task 10: Lobby UI + HUD + wire everything end-to-end

**Files:**
- Rewrite: `client/src/ui/StartScreen.tsx`
- Rewrite: `client/src/ui/GameCanvas.tsx`
- Create: `client/src/ui/Hud.tsx`
- Rewrite: `client/src/ui/App.tsx`

- [ ] **Step 1: Rewrite `client/src/ui/StartScreen.tsx`** (name + color + create/join)

```tsx
import { useState } from 'react';
import { PLAYER_COLORS, NAME_MAX_LEN, ROOM_CODE_LENGTH } from '@zoomies/shared';

export interface StartChoice {
  name: string;
  color: string;
  mode: 'create' | 'join';
  code: string;
}

export function StartScreen({ onStart }: { onStart: (c: StartChoice) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);
  const [code, setCode] = useState('');

  const validName = name.trim().length > 0;
  const validJoin = code.trim().length === ROOM_CODE_LENGTH;

  return (
    <div style={overlay}>
      <div style={card}>
        <h1 style={{ margin: '0 0 4px' }}>Zoomies</h1>
        <p style={{ marginTop: 0, color: '#567' }}>Name your driver, pick a ride.</p>

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
          style={{ ...primary, opacity: validName ? 1 : 0.5 }}
          disabled={!validName}
          onClick={() => onStart({ name: name.trim(), color, mode: 'create', code: '' })}
        >
          Create lobby
        </button>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            style={{ ...input, textTransform: 'uppercase' }}
            placeholder="CODE"
            maxLength={ROOM_CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            style={{ ...secondary, opacity: validName && validJoin ? 1 : 0.5 }}
            disabled={!validName || !validJoin}
            onClick={() =>
              onStart({ name: name.trim(), color, mode: 'join', code: code.trim().toUpperCase() })
            }
          >
            Join
          </button>
        </div>
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
  width: 340,
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
const secondary: React.CSSProperties = { ...primary, background: '#4d8bff', width: 120 };
```

- [ ] **Step 2: Create `client/src/ui/Hud.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { PlayerInfo } from '@zoomies/shared';
import type { NetClient, NetStatus } from '../net/client.js';

export function Hud({ net, code }: { net: NetClient; code: string }) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [status, setStatus] = useState<NetStatus>('connecting');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    net.onRoster = (p) => setPlayers(p);
    const prevStatus = net.onStatus;
    net.onStatus = (s) => {
      prevStatus?.(s);
      setStatus(s);
    };
    return () => {
      net.onRoster = undefined;
    };
  }, [net]);

  const copy = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div style={wrap}>
      <div style={panel}>
        <button style={codeBtn} onClick={copy} title="Copy lobby code">
          {code} {copied ? '✓' : '⧉'}
        </button>
        <ul style={list}>
          {players.map((p) => (
            <li key={p.id} style={row}>
              <span style={{ ...dot, background: p.color }} />
              {p.name}
              {p.id === net.selfId ? ' (you)' : ''}
            </li>
          ))}
        </ul>
      </div>
      <div style={controls}>WASD / Arrows to drive</div>
      <div style={{ ...statusDot, background: status === 'open' ? '#37d67a' : '#ff924d' }} />
    </div>
  );
}

const wrap: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const panel: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 12,
  padding: 12,
  pointerEvents: 'auto',
  minWidth: 160,
};
const codeBtn: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: 2,
  border: 'none',
  background: '#eef3ff',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  width: '100%',
};
const list: React.CSSProperties = { listStyle: 'none', margin: '10px 0 0', padding: 0 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' };
const dot: React.CSSProperties = { width: 12, height: 12, borderRadius: 6, display: 'inline-block' };
const controls: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 13,
};
const statusDot: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  width: 12,
  height: 12,
  borderRadius: 6,
};
```

- [ ] **Step 3: Rewrite `client/src/ui/GameCanvas.tsx`**

```tsx
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
```

- [ ] **Step 4: Rewrite `client/src/ui/App.tsx`** (state machine)

```tsx
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
```

- [ ] **Step 5: Two-client manual verification (the multiplayer payoff)**

Terminal A: `npm run dev:party`
Terminal B: `npm run dev`
Open two browser windows at `http://localhost:5173`.
- Window 1: name + color → **Create lobby**. Note the 4-letter code in the HUD.
- Window 2: name + color → type the code → **Join**.

Expected: each window sees both cars; the other car moves smoothly (interpolated); the HUD player list shows both names with color dots; driving into the other car gently pushes both apart; the status dot is green. Open a 7th connection → "Lobby is full".

- [ ] **Step 6: Commit**

```bash
git add client/src/ui
git commit -m "feat(client): lobby flow (create/join), HUD, end-to-end multiplayer"
```

---

## Task 11: Full local verification

- [ ] **Step 1: Tests + typecheck + lint + build**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: all green; `client/dist` produced.

- [ ] **Step 2: Verify party typechecks**

Run: `npx tsc -p party/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: green verification for multiplayer milestone"
```

---

## Task 12: Deploy PartyKit server

> Requires a PartyKit/Cloudflare login. Run interactively.

- [ ] **Step 1: Log in and deploy**

Run: `npx partykit login` (browser auth), then `npm run deploy:party`
Expected: deploy succeeds; output prints the host, e.g. `https://zoomies.<username>.partykit.dev`. Record the host (without `https://`).

- [ ] **Step 2: Smoke-test the deployed room**

Run: `npx partykit tail` (optional) while opening the client against it in Task 13.

- [ ] **Step 3: Commit (config only; no secrets)**

```bash
git add partykit.json
git commit -m "chore: partykit production config"
```

---

## Task 13: Deploy client to Vercel

> Requires a Vercel login. Run interactively.

- [ ] **Step 1: Create `vercel.json` at repo root**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "framework": null,
  "installCommand": "npm install"
}
```

- [ ] **Step 2: Set the production PartyKit host as an env var**

Run: `npx vercel link` (first time), then:
`npx vercel env add VITE_PARTYKIT_HOST production`
Enter the host recorded in Task 12 (e.g. `zoomies.<username>.partykit.dev`).

- [ ] **Step 3: Deploy**

Run: `npx vercel --prod`
Expected: a production URL. Open it.

- [ ] **Step 4: Cross-network verification**

Share the URL + a created lobby code with a second device/person (or open on phone + desktop). Expected: both join the same lobby and drive together over the deployed PartyKit server (green status dot).

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "chore: vercel client deploy config"
```

---

## Task 14: Juice pass

> Use the `juice:juice-recipe` skill for the bump + surface-change moments before implementing, then add the feedback below. Keep additions small and behind the existing render/step structure.

**Files:**
- Modify: `client/src/game/Game.ts`, `client/src/game/camera.ts`

- [ ] **Step 1: Speed-reactive camera** — in `camera.ts`, widen FOV slightly with speed.

In `updateCamera`, accept an optional speed and nudge `cam.fov` between 45 and 52, calling `updateProjectionMatrix()` only when it changes. Pass `speed(this.car)` from `Game.render`.

```ts
// camera.ts — replace updateCamera signature/body
import { clamp } from '@zoomies/shared';

export function updateCamera(cam: THREE.PerspectiveCamera, carX: number, carZ: number, speed = 0): void {
  const { pos, look } = cameraTarget(carX, carZ);
  cam.position.x += (pos.x - cam.position.x) * FOLLOW_LERP;
  cam.position.y += (pos.y - cam.position.y) * FOLLOW_LERP;
  cam.position.z += (pos.z - cam.position.z) * FOLLOW_LERP;
  const targetFov = 45 + clamp(speed / 42, 0, 1) * 7;
  if (Math.abs(cam.fov - targetFov) > 0.05) {
    cam.fov += (targetFov - cam.fov) * 0.1;
    cam.updateProjectionMatrix();
  }
  cam.lookAt(look.x, look.y, look.z);
}
```

In `Game.render`, change the call to `updateCamera(this.camera, this.car.x, this.car.z, Math.hypot(this.car.vx, this.car.vz));`.

- [ ] **Step 2: Body lean on turn** — in `Game.render`, after setting `carMesh.group.rotation.y`, add a small roll based on lateral velocity:

```ts
// derive lateral speed for a subtle visual lean
const fx = Math.sin(this.car.heading);
const fz = Math.cos(this.car.heading);
const lateral = this.car.vx * fz - this.car.vz * fx;
this.carMesh.group.rotation.z = -lateral * 0.02;
```

- [ ] **Step 3: Manual feel check**

Run the two-client setup. Expected: camera subtly widens at speed; the car body leans into slides (more on grass). Tune the `0.02` and FOV span to taste.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/camera.ts client/src/game/Game.ts
git commit -m "feat(client): juice — speed FOV + body lean"
```

---

## Task 15: Performance & WebGL compatibility pass

> Use `web-games:web-optimization-checklist` and `web-games:webgl-audit` skills to generate the checklist, then apply the high-value items below.

- [ ] **Step 1: Reuse geometries/materials for props** — confirm `buildTree` shares geometry where cheap; cap `setPixelRatio` at 2 (already done). Verify draw calls in DevTools (Spector.js optional) stay low (<150).

- [ ] **Step 2: Pause the loop when the tab is hidden** — in `Game`, add a `visibilitychange` listener that stops requesting frames while `document.hidden`, resuming on focus (keeps net alive but saves GPU).

```ts
// in constructor
document.addEventListener('visibilitychange', this.onVisibility);
// methods
private onVisibility = () => {
  if (document.hidden) { this.running = false; cancelAnimationFrame(this.raf); }
  else if (!this.running) { this.running = true; this.last = performance.now(); this.start(); }
};
// in dispose(): document.removeEventListener('visibilitychange', this.onVisibility);
```

- [ ] **Step 3: Verify on a second browser** (Chrome + Firefox) that the scene renders and holds ~60 FPS with 3+ cars.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/Game.ts
git commit -m "perf(client): pause render loop when tab hidden + draw-call review"
```

---

## Task 16: Accessibility pass

> Use `accessibility:a11y-check` skill on the start screen + HUD, then apply:

- [ ] **Step 1: Reduced motion** — in `camera.ts`, if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, skip the FOV breathing (keep follow). Gate the body-lean in `Game.render` the same way.

- [ ] **Step 2: Distinguishable players** — name tags already pair color WITH text, so color isn't the only differentiator (colorblind-safe). Confirm the 6 palette colors remain distinguishable in grayscale; adjust any pair in `PLAYER_COLORS` that collides.

- [ ] **Step 3: Focusable, labeled controls** — verify start-screen inputs/buttons are keyboard-reachable and have `aria-label`s (color swatches already do). Add a visible focus outline if missing.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/camera.ts client/src/game/Game.ts shared/src/constants.ts
git commit -m "a11y: reduced-motion support + grayscale-distinct player colors"
```

---

## Task 17: CLAUDE.md (v2) — networking + deploy

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append a networking + deploy section to `CLAUDE.md`**

```markdown
## Networking (Plan 2)
- Hybrid authority: each client simulates its OWN car (`stepCar`) and sends state at
  `SEND_RATE_HZ`. The PartyKit room (`party/server.ts`) validates with the SHARED
  `validateState` (clamp bounds, clamp speed, reject teleports), stores per-player
  state, and broadcasts `snapshot`s at `SNAPSHOT_RATE_HZ`.
- Remotes render from `Interpolator` (`client/src/game/remote.ts`) sampled
  `INTERP_DELAY_MS` in the past, using local arrival time as the clock (no server
  clock sync needed). NEVER interpolate the local car — it's the local sim, corrected
  only by an explicit `correction` message.
- Soft-bump: each client moves only its OWN car (`resolveCircle` against remotes'
  interpolated positions). No networked collision resolution.
- Wire protocol lives in `shared/src/protocol.ts` (`encode`/`decode`, message union).
  One PartyKit room == one lobby, addressed by the room code (`generateRoomCode`).

## Run multiplayer locally
- Terminal A: `npm run dev:party` (PartyKit on 127.0.0.1:1999)
- Terminal B: `npm run dev` (client on :5173)
- `client/.env` sets `VITE_PARTYKIT_HOST` (defaults to 127.0.0.1:1999 in dev).

## Deploy
- Server: `npm run deploy:party` (PartyKit cloud) → records host `zoomies.<user>.partykit.dev`.
- Client: `npx vercel --prod`; set `VITE_PARTYKIT_HOST` to the PartyKit host via
  `npx vercel env add VITE_PARTYKIT_HOST production`. Build output is `client/dist`.

## Future hooks (intentionally present, unused)
- Laps/race: `MAP.roadCenterline` (spline) + `MAP.checkpoints` (ordered) are stored.
- Drifting: lateral-velocity + per-surface `GRIP_*` in `carSim`/`constants` — lower
  grip = more slide; a handbrake/powerup just lowers grip.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md v2 — networking, local mp, deploy, future hooks"
```

---

## Task 18: Final verification

- [ ] **Step 1: Full gate**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build && npx tsc -p party/tsconfig.json --noEmit`
Expected: all green.

- [ ] **Step 2: Deployed end-to-end**

Open the Vercel URL on two devices, create + join a lobby, confirm: both cars visible and smooth, soft-bump works, surfaces differ, HUD correct, lobby-full at 7. 

- [ ] **Step 3: Final commit / tag**

```bash
git add -A
git commit -m "chore: Zoomies MVP foundation complete (free-roam multiplayer, deployed)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** create/join by code + name + color (Tasks 2, 10) ✓; max 6 + lobby-full (Tasks 5, 10) ✓; hybrid client-sim + server-validated relay (Tasks 3, 5, 9) ✓; ~15–20 Hz send + snapshot broadcast (constants + Tasks 5, 9) ✓; ~100 ms interpolation, never interpolate self (Task 6, 9) ✓; soft-bump only-move-own-car (Task 9) ✓; corrections snap (Task 9) ✓; ephemeral server, room==lobby (Task 5) ✓; HUD: room code copy, player list, controls, status (Task 10) ✓; floating name tags (Tasks 8–9) ✓; deploy client→Vercel, server→PartyKit, env-driven host (Tasks 12–13) ✓; juice/perf/a11y polish (Tasks 14–16) ✓; CLAUDE.md kept current (Task 17) ✓; race/drift hooks documented as present-but-unused (Task 17) ✓.
- **Placeholders:** none — every code step is complete and runnable. Deploy tasks (12–13) intentionally require interactive login (the only blocked-by-credentials steps), with exact commands given.
- **Type consistency:** `ClientMsg`/`ServerMsg` tags (`join`/`state`/`welcome`/`roster`/`snapshot`/`correction`/`full`) are produced and consumed identically by `party/server.ts` (Task 5), `NetClient` (Task 7), and `App`/`Hud` (Task 10). `validateState(prev,next)→{state,corrected}`, `Interpolator.push(time,car)`/`sample(renderTime)`, and `NetClient.sendState(car)`/`onSnapshot(states,arrival)` match across definitions and call sites. `Game` consumes `{ color, net }` matching `GameCanvas`. `CarState`/`PlayerInfo` shapes are unchanged from Plan 1.
```
