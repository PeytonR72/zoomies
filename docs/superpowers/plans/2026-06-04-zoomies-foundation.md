# Zoomies Foundation & Single-Player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Zoomies monorepo and a runnable, single-player low-poly driving game (Three.js world, arcade-with-slip car, angled follow camera, WASD) with the pure simulation logic fully test-driven — no networking yet.

**Architecture:** npm-workspaces monorepo (`shared`, `client`, `party`). `shared` holds pure TS (types, tuned constants, the hand-authored map, and the car/collision simulation) imported by both sides so client prediction and server validation can never diverge. The `client` runs an imperative fixed-timestep game loop (raw Three.js scene + React only for UI). `party` is created empty here and implemented in Plan 2.

**Tech Stack:** TypeScript (strict), Vite + React, raw Three.js, Vitest, ESLint + Prettier, npm workspaces. (PartyKit added in Plan 2.)

**Spec:** `docs/superpowers/specs/2026-06-04-zoomies-driving-game-design.md`

**Conventions used throughout:**
- World units are roughly meters. The ground plane is the X/Z plane; `+Y` is up. A car's `heading` is its yaw in radians (0 = facing `+Z`).
- All simulation is **pure**: functions take state in and return new state; no mutation of inputs, no globals, no `Date.now()` inside sim.
- Run all commands from the repo root unless stated. Tests run with `npx vitest run`.

---

## File Structure

```
zoomies/
  package.json            workspaces root, shared scripts (dev/build/test/lint)
  tsconfig.base.json      strict TS base config
  vitest.config.ts        picks up *.test.ts across workspaces
  .eslintrc.cjs           lint config
  .prettierrc             format config
  CLAUDE.md               project memory (created in Task 18)

  shared/
    package.json
    tsconfig.json
    src/
      index.ts            re-exports public surface
      constants.ts        physics/map/network constants (single source of truth)
      types.ts            Vec2, Surface, InputState, CarState, PlayerInfo
      math.ts             vec helpers + distanceToSegment (pure)
      map.ts              MapDef, MAP, surfaceAt(), isInBounds(), nearestObstacles()
      carSim.ts           stepCar() — arcade-with-slip physics
      collision.ts        resolveBounds(), resolveCircle(), resolveCollisions()
      *.test.ts           Vitest unit tests colocated with sources

  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx            React mount
      ui/App.tsx          app state machine: 'menu' | 'playing'
      ui/StartScreen.tsx  name + color picker + Drive (local, single-player)
      game/Game.ts        owns canvas, scene, loop lifecycle (start/stop)
      game/loop.ts        fixed-timestep accumulator
      game/world.ts       scene: ground, road, props, lights, sky
      game/carMesh.ts     buildCarMesh(color) procedural low-poly car
      game/camera.ts      angled top-down follow camera update
      game/input.ts       keyboard -> InputState

  party/                  created empty in Task 2 (implemented in Plan 2)
```

---

## Task 1: Root monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.prettierrc`
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "zoomies",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["shared", "client", "party"],
  "scripts": {
    "dev": "npm --workspace client run dev",
    "build": "npm --workspace shared run build && npm --workspace client run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b shared client --pretty",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "prettier": "^3.3.3",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "composite": true
  }
}
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

- [ ] **Step 4: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { browser: true, es2022: true, node: true },
  ignorePatterns: ['dist', 'node_modules', '*.config.ts', '*.config.cjs'],
  rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
};
```

- [ ] **Step 5: Install and verify**

Run: `npm install`
Expected: completes without error; `node_modules/` created at root.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json .prettierrc .eslintrc.cjs package-lock.json
git commit -m "chore: root monorepo scaffold (workspaces, ts, lint, format)"
```

---

## Task 2: Shared & party package skeletons + Vitest

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`
- Create: `party/package.json` (placeholder)
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@zoomies/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -b", "typecheck": "tsc -b --pretty" }
}
```

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Create `shared/src/index.ts`** (re-export surface; filled in as modules land)

```ts
export * from './types.js';
export * from './constants.js';
export * from './math.js';
export * from './map.js';
export * from './carSim.js';
export * from './collision.js';
```

> Note: `.js` specifiers in source resolve correctly under `"moduleResolution": "Bundler"` and Vitest. Keep them.

- [ ] **Step 4: Create `party/package.json`** (empty placeholder so the workspace resolves)

```json
{ "name": "@zoomies/party", "version": "0.0.0", "type": "module", "private": true }
```

- [ ] **Step 5: Create root `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/src/**/*.test.ts', 'client/src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 6: Verify Vitest runs (no tests yet is OK)**

Run: `npx vitest run`
Expected: exits 0 with "No test files found" (acceptable at this point).

- [ ] **Step 7: Commit**

```bash
git add shared party vitest.config.ts
git commit -m "chore: shared/party package skeletons + vitest config"
```

> `shared/src/index.ts` will fail typecheck until its modules exist — that's expected; we build the modules next and only run `typecheck` after Task 7.

---

## Task 3: Shared types

**Files:**
- Create: `shared/src/types.ts`

- [ ] **Step 1: Create `shared/src/types.ts`**

```ts
/** 2D point/vector on the ground plane (X right, Z forward). */
export interface Vec2 {
  x: number;
  z: number;
}

/** Drivable surface kinds. Affects grip + drag. */
export type Surface = 'road' | 'grass';

/** Per-frame control input sampled from the keyboard. */
export interface InputState {
  throttle: boolean; // W
  brake: boolean; // S (brake, then reverse when stopped)
  left: boolean; // A
  right: boolean; // D
}

/** Full physical state of a car. Velocity is a world-space vector (units/sec). */
export interface CarState {
  x: number;
  z: number;
  heading: number; // yaw radians, 0 = facing +Z
  vx: number;
  vz: number;
}

/** A car's lobby identity (color is a hex string like '#ff4d6d'). */
export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

/** A circular collidable (props and, later, other cars). */
export interface Circle {
  x: number;
  z: number;
  radius: number;
}

export const NO_INPUT: InputState = { throttle: false, brake: false, left: false, right: false };
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat(shared): core types"
```

---

## Task 4: Tuned constants

**Files:**
- Create: `shared/src/constants.ts`
- Test: `shared/src/constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  FIXED_DT,
  TICK_HZ,
  SEND_RATE_HZ,
  MAX_SPEED,
  MAX_PLAYERS,
  PLAYER_COLORS,
} from './constants.js';

describe('constants', () => {
  it('fixed timestep matches tick rate', () => {
    expect(FIXED_DT).toBeCloseTo(1 / TICK_HZ, 6);
  });
  it('network send rate is slower than the sim tick', () => {
    expect(SEND_RATE_HZ).toBeLessThan(TICK_HZ);
  });
  it('has a distinct color per max player', () => {
    expect(PLAYER_COLORS.length).toBeGreaterThanOrEqual(MAX_PLAYERS);
    expect(new Set(PLAYER_COLORS).size).toBe(PLAYER_COLORS.length);
  });
  it('max speed is positive', () => {
    expect(MAX_SPEED).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/constants.test.ts`
Expected: FAIL — cannot resolve `./constants.js`.

- [ ] **Step 3: Create `shared/src/constants.ts`**

```ts
// ---- Simulation timing ----
export const TICK_HZ = 60;
export const FIXED_DT = 1 / TICK_HZ; // seconds per physics step

// ---- Network timing (used in Plan 2) ----
export const SEND_RATE_HZ = 20; // client -> server state updates
export const SNAPSHOT_RATE_HZ = 20; // server -> clients broadcasts
export const INTERP_DELAY_MS = 100; // render remotes this far in the past

// ---- Lobby ----
export const MAX_PLAYERS = 6;
export const ROOM_CODE_LENGTH = 4;
export const NAME_MAX_LEN = 12;

// ---- Car dimensions ----
export const CAR_LENGTH = 4.2;
export const CAR_WIDTH = 1.9;
export const CAR_RADIUS = 2.1; // collision circle

// ---- Car physics (units = meters, seconds) ----
export const ENGINE_ACCEL = 26; // forward accel under throttle
export const REVERSE_ACCEL = 14; // accel while reversing
export const BRAKE_DECEL = 48; // decel while braking against motion
export const MAX_SPEED = 42; // top forward speed
export const MAX_REVERSE_SPEED = 14;
export const STEER_RATE = 2.6; // rad/sec at full steering authority
export const STEER_FULL_SPEED = 12; // speed at/above which steering is full

// Per-surface drag (forward speed bleed, 1/sec) and lateral grip (1/sec toward 0).
// Higher grip = less slide. Grass is draggier and slipperier.
export const DRAG_ROAD = 0.6;
export const DRAG_GRASS = 2.2;
export const GRIP_ROAD = 14; // strong lateral friction -> planted
export const GRIP_GRASS = 5; // weak -> slides (the future drift hook)

// ---- Validation tolerances (server, Plan 2) ----
export const SPEED_TOLERANCE = 1.15; // allow 15% over MAX_SPEED before rejecting
export const MAX_STEP_DISTANCE = (MAX_SPEED * SPEED_TOLERANCE) / SEND_RATE_HZ + 2; // anti-teleport

// ---- Per-player car colors (recolor materials by index) ----
export const PLAYER_COLORS = [
  '#ff4d6d', // pink/red (ref)
  '#4d8bff', // blue (ref)
  '#ffd23f', // yellow
  '#37d67a', // green
  '#a463f2', // purple
  '#ff924d', // orange
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/constants.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/constants.ts shared/src/constants.test.ts
git commit -m "feat(shared): tuned simulation + lobby constants"
```

---

## Task 5: Vector math helpers

**Files:**
- Create: `shared/src/math.ts`
- Test: `shared/src/math.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { length, clamp, distanceToSegment } from './math.js';

describe('math', () => {
  it('length of (3,4) is 5', () => {
    expect(length(3, 4)).toBeCloseTo(5);
  });
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('distance from point to a segment uses the nearest point on the segment', () => {
    // segment along x-axis from (0,0) to (10,0); point above the middle
    expect(distanceToSegment(5, 4, 0, 0, 10, 0)).toBeCloseTo(4);
    // point beyond the end clamps to the endpoint
    expect(distanceToSegment(13, 0, 0, 0, 10, 0)).toBeCloseTo(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/math.test.ts`
Expected: FAIL — cannot resolve `./math.js`.

- [ ] **Step 3: Create `shared/src/math.ts`**

```ts
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function length(x: number, z: number): number {
  return Math.hypot(x, z);
}

/** Shortest distance from point (px,pz) to segment (ax,az)-(bx,bz). */
export function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/math.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/math.ts shared/src/math.test.ts
git commit -m "feat(shared): vector math helpers"
```

---

## Task 6: The map (definition, surface lookup, bounds, race-ready data)

**Files:**
- Create: `shared/src/map.ts`
- Test: `shared/src/map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MAP, surfaceAt, isInBounds } from './map.js';

describe('map', () => {
  it('has a closed road centerline and ordered checkpoints', () => {
    expect(MAP.roadCenterline.length).toBeGreaterThan(3);
    expect(MAP.checkpoints.length).toBeGreaterThan(0);
    MAP.checkpoints.forEach((c, i) => expect(c.index).toBe(i));
  });
  it('a point on the centerline is road; a point far away is grass', () => {
    const p = MAP.roadCenterline[0]!;
    expect(surfaceAt(p.x, p.z)).toBe('road');
    expect(surfaceAt(MAP.bounds.maxX - 1, MAP.bounds.maxZ - 1)).toBe('grass');
  });
  it('bounds check rejects points outside the world', () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(MAP.bounds.maxX + 50, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/map.test.ts`
Expected: FAIL — cannot resolve `./map.js`.

- [ ] **Step 3: Create `shared/src/map.ts`**

```ts
import type { Circle, Vec2 } from './types.js';
import { distanceToSegment } from './math.js';

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Checkpoint extends Circle {
  index: number; // ordered; race-ready, unused this phase
}

export interface MapDef {
  bounds: MapBounds;
  /** Closed loop polyline (last point connects back to first). */
  roadCenterline: Vec2[];
  roadWidth: number;
  /** Solid decorative obstacles (trees/rocks). */
  props: Circle[];
  /** Ordered checkpoints derived from the road; stored, not used yet. */
  checkpoints: Checkpoint[];
  /** Where new cars spawn (cycled by join order). */
  spawnPoints: Vec2[];
}

const v = (x: number, z: number): Vec2 => ({ x, z });

// A roughly rectangular road loop inside a 400 x 300 world, echoing the
// reference sketch (a big outer loop). Hand-authored; tune freely.
const centerline: Vec2[] = [
  v(-150, -90),
  v(150, -90),
  v(170, 0),
  v(150, 90),
  v(-150, 90),
  v(-170, 0),
];

export const MAP: MapDef = {
  bounds: { minX: -200, maxX: 200, minZ: -150, maxZ: 150 },
  roadCenterline: centerline,
  roadWidth: 16,
  props: [
    { x: 0, z: 0, radius: 6 }, // central tree cluster
    { x: -60, z: 30, radius: 4 },
    { x: 70, z: -25, radius: 4 },
    { x: 110, z: 40, radius: 5 },
    { x: -110, z: -40, radius: 5 },
  ],
  checkpoints: centerline.map((p, index) => ({ x: p.x, z: p.z, radius: 10, index })),
  spawnPoints: [
    v(-150, -78),
    v(-120, -78),
    v(-90, -78),
    v(-60, -78),
    v(-30, -78),
    v(0, -78),
  ],
};

/** Distance from a point to the closed road polyline. */
function distanceToRoad(x: number, z: number): number {
  const pts = MAP.roadCenterline;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const d = distanceToSegment(x, z, a.x, a.z, b.x, b.z);
    if (d < best) best = d;
  }
  return best;
}

export function surfaceAt(x: number, z: number): 'road' | 'grass' {
  return distanceToRoad(x, z) <= MAP.roadWidth / 2 ? 'road' : 'grass';
}

export function isInBounds(x: number, z: number): boolean {
  const b = MAP.bounds;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/map.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add shared/src/map.ts shared/src/map.test.ts
git commit -m "feat(shared): hand-authored map with surfaces, bounds, race-ready data"
```

---

## Task 7: Car simulation — forward motion (throttle/brake/drag/max speed)

**Files:**
- Create: `shared/src/carSim.ts`
- Test: `shared/src/carSim.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { stepCar, spawnCar, speed } from './carSim.js';
import { MAX_SPEED, FIXED_DT } from './constants.js';
import type { InputState } from './types.js';

const THROTTLE: InputState = { throttle: true, brake: false, left: false, right: false };
const COAST: InputState = { throttle: false, brake: false, left: false, right: false };

function simulate(input: InputState, seconds: number) {
  let car = spawnCar(0, 0, 0);
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) car = stepCar(car, input, 'road', FIXED_DT);
  return car;
}

describe('carSim forward motion', () => {
  it('throttle accelerates the car forward (+Z at heading 0)', () => {
    const car = simulate(THROTTLE, 1);
    expect(car.z).toBeGreaterThan(1);
    expect(speed(car)).toBeGreaterThan(0);
  });
  it('speed never exceeds MAX_SPEED', () => {
    const car = simulate(THROTTLE, 10);
    expect(speed(car)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
  });
  it('coasting bleeds speed via drag', () => {
    let car = simulate(THROTTLE, 3);
    const fast = speed(car);
    for (let i = 0; i < Math.round(2 / FIXED_DT); i++) car = stepCar(car, COAST, 'road', FIXED_DT);
    expect(speed(car)).toBeLessThan(fast);
  });
  it('does not move from rest while coasting', () => {
    const car = simulate(COAST, 1);
    expect(speed(car)).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/carSim.test.ts`
Expected: FAIL — cannot resolve `./carSim.js`.

- [ ] **Step 3: Create `shared/src/carSim.ts`** (forward motion only for now)

```ts
import type { CarState, InputState, Surface } from './types.js';
import {
  ENGINE_ACCEL,
  REVERSE_ACCEL,
  BRAKE_DECEL,
  MAX_SPEED,
  MAX_REVERSE_SPEED,
  DRAG_ROAD,
  DRAG_GRASS,
} from './constants.js';
import { clamp } from './math.js';

export function spawnCar(x: number, z: number, heading: number): CarState {
  return { x, z, heading, vx: 0, vz: 0 };
}

export function speed(c: CarState): number {
  return Math.hypot(c.vx, c.vz);
}

/** Signed forward speed along heading (negative = reversing). */
export function forwardSpeed(c: CarState): number {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  return c.vx * fx + c.vz * fz;
}

/**
 * Advance one fixed step. Pure: returns a new CarState.
 * Forward-only physics in this task; steering + slip added in Task 8.
 */
export function stepCar(car: CarState, input: InputState, surface: Surface, dt: number): CarState {
  // Heading basis vectors.
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);

  // Decompose velocity into forward (along heading) and lateral components.
  let forward = car.vx * fx + car.vz * fz;
  const lx = car.vx - forward * fx;
  const lz = car.vz - forward * fz;

  // Longitudinal forces.
  if (input.throttle && !input.brake) {
    forward += ENGINE_ACCEL * dt;
  } else if (input.brake && !input.throttle) {
    if (forward > 0.1) {
      forward -= BRAKE_DECEL * dt; // braking
    } else {
      forward -= REVERSE_ACCEL * dt; // reverse
    }
  }

  // Drag (always bleeds toward zero).
  const drag = surface === 'road' ? DRAG_ROAD : DRAG_GRASS;
  forward -= forward * drag * dt;

  // Clamp speed range.
  forward = clamp(forward, -MAX_REVERSE_SPEED, MAX_SPEED);

  // Recompose velocity (lateral untouched until Task 8).
  const vx = forward * fx + lx;
  const vz = forward * fz + lz;

  return {
    x: car.x + vx * dt,
    z: car.z + vz * dt,
    heading: car.heading,
    vx,
    vz,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/carSim.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the whole shared package typechecks**

Run: `npm --workspace shared run typecheck`
Expected: no errors (index.ts now resolves carSim, collision is still missing — temporarily remove the `./collision.js` line from `shared/src/index.ts` if it blocks typecheck, then restore in Task 9).

> To avoid churn: in `shared/src/index.ts`, the `./collision.js` export will resolve in Task 9. If typecheck fails only on that line now, comment it out and uncomment in Task 9 Step 5.

- [ ] **Step 6: Commit**

```bash
git add shared/src/carSim.ts shared/src/carSim.test.ts shared/src/index.ts
git commit -m "feat(shared): car forward motion (throttle/brake/reverse/drag/clamp)"
```

---

## Task 8: Car simulation — steering + lateral slip (the drift hook)

**Files:**
- Modify: `shared/src/carSim.ts`
- Test: `shared/src/carSim.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `shared/src/carSim.test.ts`:

```ts
import { GRIP_ROAD, GRIP_GRASS } from './constants.js';

const FWD_RIGHT: InputState = { throttle: true, brake: false, left: false, right: true };

describe('carSim steering + slip', () => {
  it('steering only turns the car while it is moving', () => {
    let parked = spawnCar(0, 0, 0);
    parked = stepCar(parked, { throttle: false, brake: false, left: false, right: true }, 'road', FIXED_DT);
    expect(parked.heading).toBeCloseTo(0, 6);
  });

  it('turns heading when moving and steering', () => {
    let car = spawnCar(0, 0, 0);
    for (let i = 0; i < Math.round(1 / FIXED_DT); i++) car = stepCar(car, FWD_RIGHT, 'road', FIXED_DT);
    expect(Math.abs(car.heading)).toBeGreaterThan(0.1);
  });

  it('grass retains more lateral velocity than road (slides more)', () => {
    // Seed a pure sideways velocity and let one step bleed it.
    const seed = { x: 0, z: 0, heading: 0, vx: 8, vz: 0 };
    const onRoad = stepCar(seed, { throttle: false, brake: false, left: false, right: false }, 'road', FIXED_DT);
    const onGrass = stepCar(seed, { throttle: false, brake: false, left: false, right: false }, 'grass', FIXED_DT);
    expect(Math.abs(onGrass.vx)).toBeGreaterThan(Math.abs(onRoad.vx));
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run shared/src/carSim.test.ts`
Expected: FAIL on the steering/slip cases (no steering or grip yet).

- [ ] **Step 3: Update `stepCar` in `shared/src/carSim.ts`**

Replace the body of `stepCar` with the version below (adds steering before the recompose, and lateral grip bleed). New imports at top: add `STEER_RATE, STEER_FULL_SPEED, GRIP_ROAD, GRIP_GRASS`.

```ts
import {
  ENGINE_ACCEL,
  REVERSE_ACCEL,
  BRAKE_DECEL,
  MAX_SPEED,
  MAX_REVERSE_SPEED,
  DRAG_ROAD,
  DRAG_GRASS,
  STEER_RATE,
  STEER_FULL_SPEED,
  GRIP_ROAD,
  GRIP_GRASS,
} from './constants.js';

export function stepCar(car: CarState, input: InputState, surface: Surface, dt: number): CarState {
  // Decompose current velocity against current heading.
  let fx = Math.sin(car.heading);
  let fz = Math.cos(car.heading);
  let forward = car.vx * fx + car.vz * fz;
  let lx = car.vx - forward * fx;
  let lz = car.vz - forward * fz;

  // Longitudinal forces.
  if (input.throttle && !input.brake) {
    forward += ENGINE_ACCEL * dt;
  } else if (input.brake && !input.throttle) {
    forward -= forward > 0.1 ? BRAKE_DECEL * dt : REVERSE_ACCEL * dt;
  }
  const drag = surface === 'road' ? DRAG_ROAD : DRAG_GRASS;
  forward -= forward * drag * dt;
  forward = clamp(forward, -MAX_REVERSE_SPEED, MAX_SPEED);

  // Steering: authority scales with speed; flips when reversing.
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const spd = Math.hypot(car.vx, car.vz);
  if (steerInput !== 0 && spd > 0.2) {
    const authority = Math.min(spd, STEER_FULL_SPEED) / STEER_FULL_SPEED;
    const dir = forward >= 0 ? 1 : -1;
    car = { ...car, heading: car.heading + steerInput * STEER_RATE * authority * dir * dt };
    // Recompute basis after turning so the forward axis follows the new heading.
    fx = Math.sin(car.heading);
    fz = Math.cos(car.heading);
  }

  // Lateral grip: bleed sideways velocity toward zero (less on grass = more slide).
  const grip = surface === 'road' ? GRIP_ROAD : GRIP_GRASS;
  const lateralFactor = Math.max(0, 1 - grip * dt);
  lx *= lateralFactor;
  lz *= lateralFactor;

  // Recompose and integrate.
  const vx = forward * fx + lx;
  const vz = forward * fz + lz;
  return { x: car.x + vx * dt, z: car.z + vz * dt, heading: car.heading, vx, vz };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run shared/src/carSim.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add shared/src/carSim.ts shared/src/carSim.test.ts
git commit -m "feat(shared): steering + per-surface lateral slip (drift hook)"
```

---

## Task 9: Collision — bounds, props, generic circle separation

**Files:**
- Create: `shared/src/collision.ts`
- Test: `shared/src/collision.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveBounds, resolveCircle, resolveCollisions } from './collision.js';
import { MAP } from './map.js';
import { CAR_RADIUS } from './constants.js';
import type { CarState } from './types.js';

const at = (x: number, z: number, vx = 0, vz = 0): CarState => ({ x, z, heading: 0, vx, vz });

describe('collision', () => {
  it('clamps a car back inside the world bounds', () => {
    const out = resolveBounds(at(MAP.bounds.maxX + 10, 0, 5, 0));
    expect(out.x).toBeLessThanOrEqual(MAP.bounds.maxX - CAR_RADIUS + 1e-6);
    expect(out.vx).toBeLessThanOrEqual(0); // outward velocity removed
  });

  it('pushes a car out of an overlapping circle', () => {
    const obstacle = { x: 0, z: 0, radius: 5 };
    const out = resolveCircle(at(1, 0, -3, 0), obstacle);
    const dist = Math.hypot(out.x - obstacle.x, out.z - obstacle.z);
    expect(dist).toBeGreaterThanOrEqual(5 + CAR_RADIUS - 1e-6);
  });

  it('leaves a non-overlapping car unchanged', () => {
    const car = at(100, 100);
    const out = resolveCollisions(car, MAP.props);
    expect(out.x).toBeCloseTo(100);
    expect(out.z).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/collision.test.ts`
Expected: FAIL — cannot resolve `./collision.js`.

- [ ] **Step 3: Create `shared/src/collision.ts`**

```ts
import type { CarState, Circle } from './types.js';
import { MAP } from './map.js';
import { CAR_RADIUS } from './constants.js';

/** Keep the car inside the world rectangle; remove velocity pointing outward. */
export function resolveBounds(car: CarState): CarState {
  const b = MAP.bounds;
  let { x, z, vx, vz } = car;
  if (x < b.minX + CAR_RADIUS) {
    x = b.minX + CAR_RADIUS;
    vx = Math.max(0, vx);
  } else if (x > b.maxX - CAR_RADIUS) {
    x = b.maxX - CAR_RADIUS;
    vx = Math.min(0, vx);
  }
  if (z < b.minZ + CAR_RADIUS) {
    z = b.minZ + CAR_RADIUS;
    vz = Math.max(0, vz);
  } else if (z > b.maxZ - CAR_RADIUS) {
    z = b.maxZ - CAR_RADIUS;
    vz = Math.min(0, vz);
  }
  return { ...car, x, z, vx, vz };
}

/**
 * Push the car out of `obstacle` if overlapping, moving the CAR only (along the
 * contact normal) and damping the inward velocity component. Used for props and,
 * in Plan 2, for soft-bumping other cars (each client moves only its own car).
 */
export function resolveCircle(car: CarState, obstacle: Circle, selfRadius = CAR_RADIUS): CarState {
  const dx = car.x - obstacle.x;
  const dz = car.z - obstacle.z;
  const dist = Math.hypot(dx, dz);
  const minDist = obstacle.radius + selfRadius;
  if (dist >= minDist) return car;

  // Normal from obstacle to car (pick an arbitrary axis if exactly concentric).
  const nx = dist > 1e-6 ? dx / dist : 1;
  const nz = dist > 1e-6 ? dz / dist : 0;
  const push = minDist - dist;

  const x = car.x + nx * push;
  const z = car.z + nz * push;

  // Remove the inward (negative along normal) velocity component, damped.
  const vAlong = car.vx * nx + car.vz * nz;
  let vx = car.vx;
  let vz = car.vz;
  if (vAlong < 0) {
    vx -= vAlong * nx;
    vz -= vAlong * nz;
  }
  return { ...car, x, z, vx, vz };
}

/** Resolve the car against the world bounds and every obstacle in `obstacles`. */
export function resolveCollisions(car: CarState, obstacles: Circle[]): CarState {
  let out = resolveBounds(car);
  for (const o of obstacles) out = resolveCircle(out, o);
  return out;
}
```

> `clamp` is exported from `shared/src/math.ts` (re-exported by `index.ts`); collision does
> not re-export it, so the public `@zoomies/shared` surface has a single `clamp`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/collision.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Ensure `shared/src/index.ts` exports collision and the whole package typechecks**

Confirm `shared/src/index.ts` includes `export * from './collision.js';` (uncomment if you commented it in Task 7).

Run: `npm --workspace shared run typecheck && npx vitest run`
Expected: typecheck clean; all shared tests green.

- [ ] **Step 6: Commit**

```bash
git add shared/src/collision.ts shared/src/collision.test.ts shared/src/index.ts
git commit -m "feat(shared): bounds + circle separation collision"
```

---

## Task 10: Client Vite scaffold

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/ui/App.tsx`

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "@zoomies/client",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@zoomies/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.168.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.168.0",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.3"
  }
}
```

- [ ] **Step 2: Create `client/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": "src",
    "outDir": "dist",
    "noEmit": true,
    "composite": false,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `client/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zoomies</title>
    <style>
      html, body, #root { margin: 0; height: 100%; overflow: hidden; }
      body { font-family: system-ui, sans-serif; background: #9fd3ff; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Create `client/src/ui/App.tsx`** (temporary placeholder; replaced in Task 16)

```tsx
export function App() {
  return <div style={{ padding: 24 }}>Zoomies booting…</div>;
}
```

- [ ] **Step 7: Install workspace deps and verify dev server boots**

Run: `npm install`
Then: `npm run dev` and open `http://localhost:5173`
Expected: page shows "Zoomies booting…". Stop the server (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add client
git commit -m "chore(client): vite + react + three scaffold"
```

---

## Task 11: Three.js world (ground, road, props, lights, sky)

**Files:**
- Create: `client/src/game/world.ts`

> No unit test (visual/Three.js wiring). Verified on screen in Task 15.

- [ ] **Step 1: Create `client/src/game/world.ts`**

```ts
import * as THREE from 'three';
import { MAP } from '@zoomies/shared';

export interface World {
  scene: THREE.Scene;
}

/** Build the static scene: sky, ground, road ribbon, props, lighting. */
export function createWorld(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fd0ff');
  scene.fog = new THREE.Fog('#8fd0ff', 200, 600);

  // Lighting: soft ambient + a warm key light for the flat-shaded low-poly look.
  scene.add(new THREE.HemisphereLight('#bfe3ff', '#4f7a3a', 0.9));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.1);
  sun.position.set(80, 160, 60);
  scene.add(sun);

  // Grass ground.
  const b = MAP.bounds;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + 80, b.maxZ - b.minZ + 80),
    new THREE.MeshLambertMaterial({ color: '#5fb84e' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  scene.add(ground);

  // Road: a thin extruded ribbon following the closed centerline.
  scene.add(buildRoadMesh());

  // Props: simple low-poly trees (cone + trunk) at each prop circle.
  for (const p of MAP.props) scene.add(buildTree(p.x, p.z, p.radius));

  return { scene };
}

function buildRoadMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#3a3f4a' });
  const pts = MAP.roadCenterline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(MAP.roadWidth, len), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(dz, dx) + Math.PI / 2;
    seg.position.set((a.x + c.x) / 2, 0.02, (a.z + c.z) / 2);
    group.add(seg);
    // Round the corners with a disc so segments join cleanly.
    const joint = new THREE.Mesh(new THREE.CircleGeometry(MAP.roadWidth / 2, 12), mat);
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(a.x, 0.02, a.z);
    group.add(joint);
  }
  return group;
}

function buildTree(x: number, z: number, radius: number): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.22, radius * 1.2, 6),
    new THREE.MeshLambertMaterial({ color: '#7a4a2b' }),
  );
  trunk.position.y = radius * 0.6;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(radius, radius * 2.4, 7),
    new THREE.MeshLambertMaterial({ color: '#2f9e44', flatShading: true }),
  );
  leaves.position.y = radius * 1.9;
  g.add(trunk, leaves);
  g.position.set(x, 0, z);
  return g;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --workspace client run build`
Expected: compiles (no runtime check yet). If `tsc -b` complains about unused `World.scene`, ignore — it is used in Task 15.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/world.ts
git commit -m "feat(client): three.js world (ground, road ribbon, trees, lighting)"
```

---

## Task 12: Procedural recolorable car mesh

**Files:**
- Create: `client/src/game/carMesh.ts`

- [ ] **Step 1: Create `client/src/game/carMesh.ts`**

```ts
import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '@zoomies/shared';

export interface CarMesh {
  group: THREE.Group;
  setColor: (hex: string) => void;
}

/** Build a chunky low-poly car. Body color is recolorable per player. */
export function buildCarMesh(color: string): CarMesh {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });

  const L = CAR_LENGTH;
  const W = CAR_WIDTH;

  // Lower body.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, L), bodyMat);
  lower.position.y = 0.6;
  group.add(lower);

  // Cabin (shorter, set back).
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.82, 0.7, L * 0.42),
    new THREE.MeshLambertMaterial({ color: '#cfe8ff', flatShading: true }),
  );
  cabin.position.set(0, 1.25, -L * 0.05);
  group.add(cabin);

  // Wheels (4 cylinders laid on their sides).
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#1b1b1f' });
  const wx = W / 2 + 0.05;
  const wz = L * 0.32;
  for (const [sx, sz] of [
    [wx, wz],
    [-wx, wz],
    [wx, -wz],
    [-wx, -wz],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.55, sz);
    group.add(wheel);
  }

  return {
    group,
    setColor: (hex: string) => bodyMat.color.set(hex),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --workspace client run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/carMesh.ts
git commit -m "feat(client): procedural recolorable low-poly car mesh"
```

---

## Task 13: Angled top-down follow camera

**Files:**
- Create: `client/src/game/camera.ts`
- Test: `client/src/game/camera.test.ts`

- [ ] **Step 1: Write the failing test** (pure target-math, no Three.js needed)

```ts
import { describe, it, expect } from 'vitest';
import { cameraTarget } from './camera.js';

describe('cameraTarget', () => {
  it('positions the camera up and behind (−Z) the car for an angled top-down view', () => {
    const { pos, look } = cameraTarget(0, 0);
    expect(pos.y).toBeGreaterThan(20); // high up
    expect(pos.z).toBeLessThan(0); // pulled back along −Z
    expect(look.x).toBeCloseTo(0);
    expect(look.z).toBeCloseTo(0);
  });
  it('follows the car position', () => {
    const { pos } = cameraTarget(100, 50);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.z).toBeCloseTo(50 - 40); // offset back from the car
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/game/camera.test.ts`
Expected: FAIL — cannot resolve `./camera.js`.

- [ ] **Step 3: Create `client/src/game/camera.ts`**

```ts
import * as THREE from 'three';

// Angled top-down: high up and pulled back along −Z so we look down at a tilt.
// CAMERA_BACK/HEIGHT chosen so the frame covers ~the red-rectangle area.
const CAMERA_HEIGHT = 58;
const CAMERA_BACK = 40;
const FOLLOW_LERP = 0.12; // smoothing per frame

export function cameraTarget(carX: number, carZ: number) {
  return {
    pos: { x: carX, y: CAMERA_HEIGHT, z: carZ - CAMERA_BACK },
    look: { x: carX, y: 0, z: carZ },
  };
}

export function makeCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.5, 1500);
  const { pos } = cameraTarget(0, 0);
  cam.position.set(pos.x, pos.y, pos.z);
  cam.lookAt(0, 0, 0);
  return cam;
}

/** Smoothly move the camera toward following the car at (x,z). */
export function updateCamera(cam: THREE.PerspectiveCamera, carX: number, carZ: number): void {
  const { pos, look } = cameraTarget(carX, carZ);
  cam.position.x += (pos.x - cam.position.x) * FOLLOW_LERP;
  cam.position.y += (pos.y - cam.position.y) * FOLLOW_LERP;
  cam.position.z += (pos.z - cam.position.z) * FOLLOW_LERP;
  cam.lookAt(look.x, look.y, look.z);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/game/camera.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/game/camera.ts client/src/game/camera.test.ts
git commit -m "feat(client): angled top-down follow camera"
```

---

## Task 14: Keyboard input → InputState

**Files:**
- Create: `client/src/game/input.ts`
- Test: `client/src/game/input.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Keyboard } from './input.js';

describe('Keyboard', () => {
  it('maps WASD and arrows to InputState', () => {
    const kb = new Keyboard();
    kb.handle('KeyW', true);
    kb.handle('KeyD', true);
    expect(kb.state()).toEqual({ throttle: true, brake: false, left: false, right: true });
    kb.handle('KeyW', false);
    expect(kb.state().throttle).toBe(false);
  });
  it('arrow keys mirror WASD', () => {
    const kb = new Keyboard();
    kb.handle('ArrowUp', true);
    kb.handle('ArrowLeft', true);
    expect(kb.state()).toEqual({ throttle: true, brake: false, left: true, right: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/game/input.test.ts`
Expected: FAIL — cannot resolve `./input.js`.

- [ ] **Step 3: Create `client/src/game/input.ts`**

```ts
import type { InputState } from '@zoomies/shared';

/** Tracks pressed keys and projects them to an InputState. Pure-ish + DOM bind. */
export class Keyboard {
  private down = new Set<string>();

  handle(code: string, pressed: boolean): void {
    if (pressed) this.down.add(code);
    else this.down.delete(code);
  }

  state(): InputState {
    const has = (...codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      throttle: has('KeyW', 'ArrowUp'),
      brake: has('KeyS', 'ArrowDown'),
      left: has('KeyA', 'ArrowLeft'),
      right: has('KeyD', 'ArrowRight'),
    };
  }

  /** Attach to window; returns a detach function. */
  attach(target: Window = window): () => void {
    const onDown = (e: KeyboardEvent) => {
      this.handle(e.code, true);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => this.handle(e.code, false);
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/game/input.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/game/input.ts client/src/game/input.test.ts
git commit -m "feat(client): keyboard input mapping"
```

---

## Task 15: Fixed-timestep loop + Game lifecycle (single-player playable)

**Files:**
- Create: `client/src/game/loop.ts`
- Test: `client/src/game/loop.test.ts`
- Create: `client/src/game/Game.ts`

- [ ] **Step 1: Write the failing test for the accumulator**

```ts
import { describe, it, expect } from 'vitest';
import { FixedStepper } from './loop.js';

describe('FixedStepper', () => {
  it('runs the correct number of fixed steps for elapsed time', () => {
    const stepper = new FixedStepper(1 / 60);
    let steps = 0;
    stepper.advance(0.05, () => steps++); // 0.05s / (1/60) = 3 steps
    expect(steps).toBe(3);
  });
  it('carries leftover time into the next advance', () => {
    const stepper = new FixedStepper(1 / 60);
    let steps = 0;
    stepper.advance(0.01, () => steps++); // < one step
    expect(steps).toBe(0);
    stepper.advance(0.01, () => steps++); // now 0.02 total -> 1 step
    expect(steps).toBe(1);
  });
  it('clamps a huge frame to avoid the spiral of death', () => {
    const stepper = new FixedStepper(1 / 60, 0.1);
    let steps = 0;
    stepper.advance(100, () => steps++);
    expect(steps).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/game/loop.test.ts`
Expected: FAIL — cannot resolve `./loop.js`.

- [ ] **Step 3: Create `client/src/game/loop.ts`**

```ts
/** Fixed-timestep accumulator. Decouples physics rate from frame rate. */
export class FixedStepper {
  private acc = 0;
  constructor(
    private readonly dt: number,
    private readonly maxFrame = 0.1,
  ) {}

  /** Add elapsed seconds; invoke `step` once per whole fixed dt. */
  advance(elapsed: number, step: () => void): void {
    this.acc += Math.min(elapsed, this.maxFrame);
    while (this.acc >= this.dt) {
      step();
      this.acc -= this.dt;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/game/loop.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `client/src/game/Game.ts`** (wires everything; single local car)

```ts
import * as THREE from 'three';
import {
  FIXED_DT,
  MAP,
  spawnCar,
  stepCar,
  resolveCollisions,
  surfaceAt,
  type CarState,
} from '@zoomies/shared';
import { createWorld } from './world.js';
import { buildCarMesh, type CarMesh } from './carMesh.js';
import { makeCamera, updateCamera } from './camera.js';
import { FixedStepper } from './loop.js';
import { Keyboard } from './input.js';

export interface GameOptions {
  color: string;
}

/** Owns the canvas, render loop, and the local player's car. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private keyboard = new Keyboard();
  private detachInput: () => void;
  private stepper = new FixedStepper(FIXED_DT);
  private car: CarState;
  private carMesh: CarMesh;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: GameOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();

    const world = createWorld();
    this.scene = world.scene;
    this.camera = makeCamera(canvas.clientWidth / canvas.clientHeight);

    const spawn = MAP.spawnPoints[0]!;
    this.car = spawnCar(spawn.x, spawn.z, 0);
    this.carMesh = buildCarMesh(opts.color);
    this.scene.add(this.carMesh.group);

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
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fixedStep(): void {
    const input = this.keyboard.state();
    const surface = surfaceAt(this.car.x, this.car.z);
    let next = stepCar(this.car, input, surface, FIXED_DT);
    next = resolveCollisions(next, MAP.props);
    this.car = next;
  }

  private render(): void {
    this.carMesh.group.position.set(this.car.x, 0, this.car.z);
    this.carMesh.group.rotation.y = this.car.heading;
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

- [ ] **Step 6: Commit**

```bash
git add client/src/game/loop.ts client/src/game/loop.test.ts client/src/game/Game.ts
git commit -m "feat(client): fixed-step loop + single-player Game lifecycle"
```

---

## Task 16: Start screen + mount the game (end-to-end single-player)

**Files:**
- Modify: `client/src/ui/App.tsx`
- Create: `client/src/ui/StartScreen.tsx`
- Create: `client/src/ui/GameCanvas.tsx`

- [ ] **Step 1: Create `client/src/ui/StartScreen.tsx`**

```tsx
import { useState } from 'react';
import { PLAYER_COLORS, NAME_MAX_LEN } from '@zoomies/shared';

export interface StartChoice {
  name: string;
  color: string;
}

export function StartScreen({ onStart }: { onStart: (c: StartChoice) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);

  const canStart = name.trim().length > 0;
  return (
    <div style={overlay}>
      <div style={card}>
        <h1 style={{ margin: '0 0 4px' }}>Zoomies</h1>
        <p style={{ marginTop: 0, color: '#567' }}>Pick a name and a car.</p>
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
          style={{ ...primary, opacity: canStart ? 1 : 0.5 }}
          disabled={!canStart}
          onClick={() => onStart({ name: name.trim(), color })}
        >
          Drive
        </button>
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
  width: 320,
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
```

- [ ] **Step 2: Create `client/src/ui/GameCanvas.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `client/src/ui/App.tsx`**

```tsx
import { useState } from 'react';
import { StartScreen, type StartChoice } from './StartScreen.js';
import { GameCanvas } from './GameCanvas.js';

export function App() {
  const [choice, setChoice] = useState<StartChoice | null>(null);
  if (!choice) return <StartScreen onStart={setChoice} />;
  return <GameCanvas color={choice.color} />;
}
```

- [ ] **Step 4: Manual verification (the payoff)**

Run: `npm run dev`, open `http://localhost:5173`.
Expected: Start screen → pick name + color → **Drive** → you see the low-poly world and your car. WASD drives; the car accelerates, turns, slides a little on grass (more than on road), bumps off trees, and stops at the world edge. The camera follows at an angled top-down tilt. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add client/src/ui
git commit -m "feat(client): start screen + single-player playable end-to-end"
```

---

## Task 17: Full verification pass

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: all shared + client tests pass (constants, math, map, carSim, collision, camera, input, loop).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: clean typecheck, no lint errors, client builds to `client/dist`.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: green typecheck/lint/build for single-player foundation"
```

---

## Task 18: CLAUDE.md (v1)

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
# Zoomies — Project Memory

Cute low-poly multiplayer browser driving game. Free-roam now, structured to add
laps/powerups/drifting later. See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Monorepo layout (npm workspaces)
- `shared/` — pure TS imported by client AND server. Types, tuned constants, the
  hand-authored map, and the car/collision **simulation**. No DOM, no Three.js, no I/O.
- `client/` — Vite + React + raw Three.js. Imperative game loop in `src/game/`;
  React only renders 2D UI in `src/ui/`. Networking in `src/net/` (Plan 2).
- `party/` — PartyKit realtime server (Plan 2).

## The golden rule
Physics constants and validation limits live ONLY in `shared/src/constants.ts`.
The client's local simulation and the server's validation import the SAME values,
so they can never drift. Never hardcode a physics/network number in client or party.

## Architecture invariants
- Simulation (`shared/src/carSim.ts`, `collision.ts`) is pure: `(state,input,...) -> newState`.
  No mutation, no globals, no time/RNG inside. This is what makes it testable and
  reusable on the server.
- The game loop is fixed-timestep (`FixedStepper`, `FIXED_DT`). Physics rate is
  decoupled from frame rate. Don't put physics in `requestAnimationFrame` directly.
- React never touches Three.js objects. The only bridge (Plan 2) is the net layer.
- World is the X/Z ground plane, +Y up; car `heading` is yaw radians, 0 = facing +Z.

## Commands (run from repo root)
- `npm run dev` — client dev server (http://localhost:5173)
- `npm test` / `npm run test:watch` — Vitest
- `npm run typecheck` — project-wide TS build check
- `npm run lint` / `npm run format`
- `npm run build` — shared + client production build

## Conventions
- TDD the pure logic in `shared/` (carSim, collision, map, math) and pure client
  helpers (camera target, input mapping, loop). Visual Three.js wiring is verified
  by running the app, not unit tests.
- Source imports use `.js` specifiers (e.g. `./map.js`) — required by the TS
  bundler resolution; keep them even though files are `.ts`.
- Commit per task; keep commits small.

## Status
- Plan 1 (foundation + single-player): see `docs/superpowers/plans/2026-06-04-zoomies-foundation.md`
- Plan 2 (multiplayer + deploy + polish): see `docs/superpowers/plans/2026-06-04-zoomies-multiplayer.md`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md project memory (v1)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage (single-player slice):** monorepo + `shared/` constants discipline (Tasks 1–4, 18) ✓; flat ground + road/grass surfaces (Task 6/11) ✓; arcade-with-slip + drift hook (Tasks 7–8) ✓; solid props + world boundary (Tasks 6, 9) ✓; procedural recolorable car (Task 12) ✓; raw Three.js + React-for-UI split (Tasks 11–16) ✓; angled follow camera (Task 13) ✓; WASD (Task 14) ✓; race-ready spline + checkpoints data stored unused (Task 6) ✓; TDD on pure logic, manual verify for visuals (throughout) ✓. Multiplayer, soft-bump-vs-remotes, validation, lobby/HUD, deploy, polish are **Plan 2** by design.
- **Placeholders:** none — every code step contains complete, runnable code.
- **Type consistency:** `CarState`/`InputState`/`Surface`/`Circle` defined in Task 3 are used verbatim by `stepCar` (Tasks 7–8), `resolveCollisions`/`resolveCircle` (Task 9), `Keyboard` (Task 14), and `Game` (Task 15). `stepCar(car,input,surface,dt)` and `resolveCollisions(car,obstacles)` signatures match across definition and call sites. `buildCarMesh(color)→CarMesh` and `makeCamera/updateCamera` match their call sites in `Game`.
```
