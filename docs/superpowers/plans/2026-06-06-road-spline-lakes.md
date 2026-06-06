# Road Spline + Lakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stiff 6-point rectangular road with a smooth Catmull-Rom closed spline, reposition lakes so none overlap the road, put spawn points on the road, and render a smooth curved road ribbon in the client.

**Architecture:** A new pure function `sampleClosedCatmullRom` in `shared/src/spline.ts` produces a dense `Vec2[]` polyline. `MAP` grows a `roadPath` field (the dense polyline) computed from the redesigned `roadCenterline` control points. `surfaceAt` and scatter exclusion use `roadPath` instead of the raw 6 control points. `buildRoadMesh()` in `client` walks `roadPath` pairs to emit oriented quads (triangle strip style). No physics/netcode change.

**Tech Stack:** TypeScript, Vitest (tests), Three.js (client mesh only), npm workspaces.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `shared/src/spline.ts` | **Create** | `sampleClosedCatmullRom(points, segmentsPerSpan)` |
| `shared/src/spline.test.ts` | **Create** | Tests for the spline sampler |
| `shared/src/map.ts` | **Modify** | New control points, `roadPath`, new spawns, new lakes; `surfaceAt` uses `roadPath` |
| `shared/src/map.test.ts` | **Modify** | Add spawn-on-road test, lake-off-road test; fix broken test if needed |
| `shared/src/scatter.ts` | **Modify** | `nearRoad` uses `MAP.roadPath` segments instead of `MAP.roadCenterline` |
| `client/src/game/world.ts` | **Modify** | `buildRoadMesh()` reads `MAP.roadPath`, emits oriented quads |

---

## Task 1: Add `sampleClosedCatmullRom` to shared

**Files:**
- Create: `shared/src/spline.ts`
- Create: `shared/src/spline.test.ts`

### Background — Catmull-Rom closed loop

For a closed loop with `n` control points `P[0..n-1]`, each span `i` uses:
- `p0 = P[(i-1+n) % n]`
- `p1 = P[i]`
- `p2 = P[(i+1) % n]`
- `p3 = P[(i+2) % n]`

Catmull-Rom formula at `t ∈ [0,1)`:
```
q(t) = 0.5 * ( (2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t² + (-p0 + 3*p1 - 3*p2 + p3)*t³ )
```

The function emits `segmentsPerSpan` samples per span (t = 0, 1/N, 2/N, …, (N-1)/N), skipping t=1 (that's the start of the next span). Total output length = `n * segmentsPerSpan`.

- [ ] **Step 1.1: Write failing tests for `sampleClosedCatmullRom`**

Create `shared/src/spline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sampleClosedCatmullRom } from './spline.js';

const square = [
  { x: -1, z: -1 },
  { x:  1, z: -1 },
  { x:  1, z:  1 },
  { x: -1, z:  1 },
];

describe('sampleClosedCatmullRom', () => {
  it('returns points.length * segmentsPerSpan samples', () => {
    const result = sampleClosedCatmullRom(square, 8);
    expect(result.length).toBe(4 * 8);
  });

  it('first sample is approximately at the first control point', () => {
    const result = sampleClosedCatmullRom(square, 12);
    expect(result[0]!.x).toBeCloseTo(square[0]!.x, 5);
    expect(result[0]!.z).toBeCloseTo(square[0]!.z, 5);
  });

  it('passes through each control point at index i*segmentsPerSpan', () => {
    const N = 10;
    const result = sampleClosedCatmullRom(square, N);
    for (let i = 0; i < square.length; i++) {
      const sample = result[i * N]!;
      expect(sample.x).toBeCloseTo(square[i]!.x, 5);
      expect(sample.z).toBeCloseTo(square[i]!.z, 5);
    }
  });

  it('consecutive samples are close (continuity check)', () => {
    const result = sampleClosedCatmullRom(square, 20);
    for (let i = 0; i < result.length; i++) {
      const a = result[i]!;
      const b = result[(i + 1) % result.length]!;
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      expect(dist).toBeLessThan(1.5); // no teleports
    }
  });

  it('throws for fewer than 4 control points', () => {
    expect(() => sampleClosedCatmullRom([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], 5)).toThrow();
  });
});
```

- [ ] **Step 1.2: Run tests — confirm they fail**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run shared/src/spline.test.ts
```

Expected: FAIL (module not found or similar).

- [ ] **Step 1.3: Create `shared/src/spline.ts`**

```typescript
import type { Vec2 } from './types.js';

/**
 * Catmull-Rom closed-loop sampler.
 * Returns `points.length * segmentsPerSpan` evenly spaced samples
 * along the smooth closed curve that passes through every control point.
 */
export function sampleClosedCatmullRom(points: Vec2[], segmentsPerSpan: number): Vec2[] {
  if (points.length < 4) throw new Error('Need at least 4 control points for a closed Catmull-Rom spline');
  const n = points.length;
  const result: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * t +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      result.push({ x, z });
    }
  }
  return result;
}
```

- [ ] **Step 1.4: Run tests — confirm they pass**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run shared/src/spline.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add shared/src/spline.ts shared/src/spline.test.ts
git commit -m "feat(shared): add sampleClosedCatmullRom spline sampler + tests"
```

---

## Task 2: Redesign map — curvy road, roadPath, spawns, lakes

**Files:**
- Modify: `shared/src/map.ts`
- Modify: `shared/src/map.test.ts`

### New control-point design

Replace the rectangular 6-point loop with an 8-point organic loop that stays well inside bounds (margin ≥ 16 from edges).  The points are tuned to produce a clearly curvy road with varied turns:

```
(-120, -110)  → bottom-left  
(  30, -130)  → bottom sweeping right  
( 140, -80)   → lower-right curve  
( 160,  10)   → right side  
( 110,  110)  → upper-right
( -30,  120)  → top  
(-140,  60)   → upper-left  
(-160, -40)   → left side looping back  
```

This produces an S-shaped oval loop with obvious curvature everywhere. Adjust if any lake constraint is violated.

### Road path

`MAP.roadPath` = `sampleClosedCatmullRom(roadCenterline, 12)` → 96 samples (8 spans × 12).

### surfaceAt

Change `distanceToRoad` to walk `MAP.roadPath` segments (not `roadCenterline`).

### Spawn points

Pick 6 indices evenly spaced along `roadPath` (e.g. indices 0, 16, 32, 48, 64, 80) — they are by definition ON the smooth road.

### Lakes — no-overlap placement

The constraint: `dist(lake_center, roadPath) > lake.radius + roadWidth/2 + 4`.

New lake positions (verify manually against the road shape above):

```typescript
{ x: -50, z: 40, radius: 22 },   // central-left open grass area
{ x: 60,  z: 60, radius: 20 },   // upper-right open grass
{ x: 20,  z: -50, radius: 18 },  // central open grass below
```

Run `npx vitest run` after writing the code to confirm the lake-off-road test passes; if not, nudge positions.

- [ ] **Step 2.1: Write failing tests in `shared/src/map.test.ts`**

Add these two `describe` blocks (keep all existing tests):

```typescript
describe('spawn points', () => {
  it('every spawn point is on the road', () => {
    for (const sp of MAP.spawnPoints) {
      expect(surfaceAt(sp.x, sp.z), `spawn (${sp.x}, ${sp.z}) should be road`).toBe('road');
    }
  });
});

describe('lake placement', () => {
  it('no lake overlaps the road (clearance > radius + roadWidth/2)', () => {
    const path = MAP.roadPath;
    const half = MAP.roadWidth / 2;
    for (const lake of MAP.waterBodies) {
      let minDist = Infinity;
      for (let i = 0; i < path.length; i++) {
        const a = path[i]!;
        const b = path[(i + 1) % path.length]!;
        const d = distanceToSegment(lake.x, lake.z, a.x, a.z, b.x, b.z);
        if (d < minDist) minDist = d;
      }
      expect(minDist, `lake at (${lake.x},${lake.z}) too close to road`).toBeGreaterThan(lake.radius + half);
    }
  });

  it('all lakes are inside world bounds', () => {
    for (const w of MAP.waterBodies) {
      expect(isInBounds(w.x - w.radius, w.z)).toBe(true);
      expect(isInBounds(w.x + w.radius, w.z)).toBe(true);
      expect(isInBounds(w.x, w.z - w.radius)).toBe(true);
      expect(isInBounds(w.x, w.z + w.radius)).toBe(true);
    }
  });
});
```

Also add `distanceToSegment` to the import at the top of the test file:

```typescript
import { MAP, surfaceAt, isInBounds } from './map.js';
import { resolveCollisions } from './collision.js';
import { CAR_RADIUS } from './constants.js';
import { distanceToSegment } from './math.js';
```

- [ ] **Step 2.2: Run tests — confirm new ones fail**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run shared/src/map.test.ts
```

Expected: the two new `describe` blocks fail (MAP.roadPath doesn't exist yet).

- [ ] **Step 2.3: Update `shared/src/map.ts`**

Replace the entire file content:

```typescript
import type { Circle, Vec2 } from './types.js';
import { distanceToSegment } from './math.js';
import { sampleClosedCatmullRom } from './spline.js';

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
  /** Closed loop control points for the Catmull-Rom spline. */
  roadCenterline: Vec2[];
  /** Dense smooth polyline sampled from roadCenterline — use this for surfaceAt/scatter. */
  roadPath: Vec2[];
  roadWidth: number;
  /** Solid decorative obstacles (trees/rocks). */
  props: Circle[];
  /** Lakes — solid (car is pushed out) and rendered as water. */
  waterBodies: Circle[];
  /** Ordered checkpoints derived from the road; stored, not used yet. */
  checkpoints: Checkpoint[];
  /** Where new cars spawn (cycled by join order). */
  spawnPoints: Vec2[];
}

const v = (x: number, z: number): Vec2 => ({ x, z });

// Organic 8-point closed loop — clearly curvy, stays inside bounds with ample margin.
const centerline: Vec2[] = [
  v(-120, -110),
  v(  30, -130),
  v( 140,  -80),
  v( 160,   10),
  v( 110,  110),
  v( -30,  120),
  v(-140,   60),
  v(-160,  -40),
];

const SEGMENTS_PER_SPAN = 12;
const roadPath: Vec2[] = sampleClosedCatmullRom(centerline, SEGMENTS_PER_SPAN);

// Pick 6 evenly-spaced indices along roadPath for spawn points.
const totalPathPts = roadPath.length; // 96
const spawnIndices = [0, 16, 32, 48, 64, 80];

export const MAP: MapDef = {
  bounds: { minX: -200, maxX: 200, minZ: -150, maxZ: 150 },
  roadCenterline: centerline,
  roadPath,
  roadWidth: 16,
  props: [
    { x: 0,    z:  0,  radius: 6 }, // central tree cluster
    { x: -60,  z: 30,  radius: 4 },
    { x:  70,  z: -25, radius: 4 },
    { x: 110,  z: 40,  radius: 5 },
    { x: -110, z: -40, radius: 5 },
  ],
  waterBodies: [
    { x: -50, z:  40, radius: 22 },
    { x:  60, z:  60, radius: 20 },
    { x:  20, z: -50, radius: 18 },
  ],
  checkpoints: centerline.map((p, index) => ({ x: p.x, z: p.z, radius: 10, index })),
  spawnPoints: spawnIndices.map((idx) => roadPath[idx % totalPathPts]!),
};

/** Distance from a point to the closed road path (dense polyline). */
function distanceToRoad(x: number, z: number): number {
  const pts = MAP.roadPath;
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

- [ ] **Step 2.4: Run all shared tests**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run shared/src/map.test.ts
```

Expected: all tests PASS. If the lake-off-road test fails, nudge the `waterBodies` x/z values a few units away from the road path until it passes (keep lakes clearly in open grass areas). Run again after each nudge.

- [ ] **Step 2.5: Run full test suite**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run
```

Expected: all tests PASS (scatter test should still pass since `surfaceAt` now uses `roadPath`).

- [ ] **Step 2.6: Commit**

```bash
git add shared/src/map.ts shared/src/map.test.ts
git commit -m "feat(shared): smooth Catmull-Rom road spline + spawns/lakes off-road"
```

---

## Task 3: Update scatter exclusion to use `MAP.roadPath`

**Files:**
- Modify: `shared/src/scatter.ts`

The `nearRoad` function currently iterates `MAP.roadCenterline`. After Task 2, `surfaceAt` already uses `roadPath` — so the `surfaceAt(x, z) !== 'grass'` guard in `scatterProps` handles road exclusion correctly. However the explicit `nearRoad` margin check still uses the 8 raw control points (coarser), so props might cluster near sharp spline bends. Fix it to use `roadPath`.

- [ ] **Step 3.1: Update `nearRoad` in `shared/src/scatter.ts`**

Change the function to walk `MAP.roadPath`:

```typescript
function nearRoad(x: number, z: number, margin: number): boolean {
  const pts = MAP.roadPath;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if (distanceToSegment(x, z, a.x, a.z, b.x, b.z) <= MAP.roadWidth / 2 + margin) return true;
  }
  return false;
}
```

(No other changes needed — the rest of `scatterProps` is unchanged.)

- [ ] **Step 3.2: Run tests**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run
```

Expected: all PASS (scatter test verifies surfaceAt === 'grass' for every prop, which is now consistent).

- [ ] **Step 3.3: Commit**

```bash
git add shared/src/scatter.ts
git commit -m "fix(shared): scatter nearRoad exclusion uses roadPath (smooth curve)"
```

---

## Task 4: Smooth road ribbon mesh in client

**Files:**
- Modify: `client/src/game/world.ts`

Replace `buildRoadMesh()` to walk `MAP.roadPath` pairs and emit a smooth ribbon. For each consecutive pair `(a, b)` in `roadPath`:
1. Compute the tangent direction `(dx, dz)` normalised.
2. The perpendicular (left) is `(-dz, dx)` scaled to `roadWidth / 2`.
3. Emit a quad with corners `a ± perp` and `b ± perp`.

This creates a seamless strip with no gaps. Emit ALL quads into a single `BufferGeometry` (merged positions + indices) for one draw call. No joint discs needed because adjacent quads share their edge exactly.

Optionally add a faint dashed center line using `LineDashedMaterial` for visual charm.

- [ ] **Step 4.1: Rewrite `buildRoadMesh` in `client/src/game/world.ts`**

```typescript
function buildRoadMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: PALETTE.road, side: THREE.DoubleSide });
  const path = MAP.roadPath;
  const n = path.length;
  const hw = MAP.roadWidth / 2;

  // Build one merged BufferGeometry ribbon (2 vertices per path point, one quad per segment).
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % n]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    // perpendicular (right-hand)
    const px = (dz / len) * hw;
    const pz = (-dx / len) * hw;

    const base = i * 2;
    // Left and right of point a
    positions.push(a.x - px, 0.02, a.z - pz);
    positions.push(a.x + px, 0.02, a.z + pz);

    if (i < n) {
      // quad: (base, base+1, base+3, base+2) — connect to NEXT pair
      const nextBase = ((i + 1) % n) * 2;
      indices.push(base, base + 1, nextBase + 1);
      indices.push(base, nextBase + 1, nextBase);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, mat));

  // Optional: thin dashed center line for charm.
  const linePoints = path.map((p) => new THREE.Vector3(p.x, 0.04, p.z));
  linePoints.push(linePoints[0]!); // close the loop
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 4, gapSize: 4, linewidth: 1 });
  const line = new THREE.Line(lineGeo, lineMat);
  line.computeLineDistances();
  group.add(line);

  return group;
}
```

- [ ] **Step 4.2: Build client to verify no TypeScript errors**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npm --workspace client run build
```

Expected: clean build, no errors.

- [ ] **Step 4.3: Commit**

```bash
git add client/src/game/world.ts
git commit -m "feat(client): smooth curved road ribbon mesh from roadPath"
```

---

## Task 5: Full verification

- [ ] **Step 5.1: Run complete test suite one final time**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npx vitest run
```

Expected: all tests PASS (spline, map spawn/lake, scatter, existing tests).

- [ ] **Step 5.2: Typecheck entire project**

```bash
cd C:/Users/ztwis/Desktop/zoomies && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5.3: Visual check**

Start both servers (two separate terminals), open `http://localhost:5173` via Playwright, create a lobby, drive for a few seconds (`KeyW` + `KeyD`), take a screenshot, confirm:
- Road visibly curves (no straight rectangular appearance).
- Car spawns on the road surface.
- No lake sits on the road.
- No new console errors/warnings.

Kill servers, delete any screenshot PNGs from the repo root (`.playwright-mcp/` if created).

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Catmull-Rom sampler + tests | Task 1 |
| Curvy road control points | Task 2 |
| roadPath field on MAP | Task 2 |
| surfaceAt uses roadPath | Task 2 |
| Spawn points on road + test | Task 2 |
| Lakes off road + test | Task 2 |
| Smooth road mesh ribbon | Task 4 |
| Scatter exclusion uses roadPath | Task 3 |
| Full test pass | Task 5 |
| Client build green | Task 4 step 4.2 |
| Visual screenshot | Task 5 step 5.3 |

All spec requirements covered. No placeholders found. Type names (`Vec2`, `MapDef`, `roadPath`) are consistent throughout.
