# Zoomies Visual Overhaul ("Tiny Skies") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each implementer subagent should also use superpowers:test-driven-development for the pure-logic tasks.

**Goal:** Restyle Zoomies into a polished Tiny Skies–style world — warm atmospheric lighting with god-rays, stylized low-poly water, a hilly horizon around a flat drivable basin, cute recolorable GLTF cars, and detailed scattered vegetation/landmarks — **without changing gameplay, physics, or netcode.**

**Architecture:** Hybrid rendering. Custom shaders for water/sky; pmndrs `postprocessing` for bloom + god-rays + vignette; CC0 low-poly GLTF for hero models (cars, trees, rocks, landmarks) loaded via Three.js `GLTFLoader`. All world placement is deterministic from seeds in `shared/` (same discipline as the physics-constants golden rule) so every client sees an identical world. `world.ts` becomes a thin composition root over focused new modules. React/UI untouched except a brief asset-loading phase.

**Tech Stack:** TypeScript, Vite, React, Three.js (`GLTFLoader`), the `postprocessing` library (pmndrs), Vitest. New runtime deps: `postprocessing`.

**Spec:** `docs/superpowers/specs/2026-06-05-zoomies-visual-overhaul-design.md`

**Skills/plugins used (called out per-task):** `procedural` (seed-system, constraint-rules + constraint-designer agent) for seeded gen; `context7` (resolve-library-id → query-docs) for `postprocessing`/`three` APIs; `web-games` (webgl-audit, web-optimization-checklist + webgl-specialist agent) for perf; `accessibility` (a11y-check + accessibility-advocate) for reduced-motion/contrast; `juice` (juice-recipe) for water/feel; `frontend-design` for the loading screen; `level-design` (environment-storyteller / spatial-designer agents) for landmark placement; **Playwright MCP** for in-engine screenshot verification each stage.

**Conventions (unchanged from MVP):** world is the X/Z ground plane, +Y up; `.js` import specifiers in source; pure logic in `shared/` is TDD'd; visual wiring verified by running + screenshots; commit per task. Run commands from repo root. Windows: bash tool works; `curl` needs `--ssl-no-revoke`, git/vercel need `NODE_OPTIONS=--use-system-ca` (network blocks cert-revocation checks).

---

## File Structure

```
shared/src/
  rng.ts            NEW  deterministic PRNG (mulberry32) + helpers  [TDD]
  rng.test.ts       NEW
  constants.ts      MOD  + VISUAL block (palette, seeds, densities, margins)
  map.ts            MOD  + waterBodies, terrain params, scatter params, exclusion helper  [TDD]
  map.test.ts       MOD  + water/scatter-exclusion tests

client/src/game/
  settings.ts       NEW  prefersReducedMotion(), detectQuality()  [small TDD]
  settings.test.ts  NEW
  lighting.ts       NEW  hemisphere + warm sun (shadows) + ambient; contact shadow factory
  sky.ts            NEW  gradient sky dome + sun mesh (also the god-ray light source)
  postfx.ts         NEW  EffectComposer pipeline (bloom + god-rays + vignette + SMAA)
  water.ts          NEW  stylized water ShaderMaterial + lake meshes from MAP.waterBodies
  terrain.ts        NEW  seeded low-poly heightfield mesh (flat basin, hill ring)
  assets.ts         NEW  GLTFLoader + cache + preload(); procedural fallbacks
  carModel.ts       NEW  GLTF car instance + per-player body recolor (replaces carMesh.ts use)
  scatter.ts        NEW  seeded prop placement + InstancedMesh builders  [TDD core in shared]
  world.ts          MOD  composition root wiring the above
  Game.ts           MOD  await assets.preload; postfx render; water collision; carModel; dispose
  collisionObstacles via shared (MAP.props + MAP.waterBodies)

client/public/
  models/           NEW  committed CC0 .glb (car, tree variants, rock, reed, lighthouse, cottage)
  CREDITS.md        NEW  asset provenance + licenses

client/src/ui/
  LoadingScreen.tsx NEW  shown during asset preload
  App.tsx           MOD  + 'loading' phase
  GameCanvas.tsx    MOD  await preload before constructing Game
```

---

# STAGE 0 — Dependency + scaffolding

## Task 0.1: Add the `postprocessing` dependency and verify its API

**Files:** Modify `client/package.json`

- [ ] **Step 1: Confirm the current `postprocessing` API via context7 (with fallback)**

Use the `context7` plugin: call `resolve-library-id` with libraryName `postprocessing`, then `query-docs` on the returned id with query "EffectComposer RenderPass EffectPass BloomEffect GodRaysEffect VignetteEffect SMAAEffect three.js setup". Confirm the import names + constructor options used in Task 1.4.
**Fallback if context7 network fails:** `WebFetch` `https://github.com/pmndrs/postprocessing` with prompt "current import names and constructor options for EffectComposer, RenderPass, EffectPass, BloomEffect, GodRaysEffect, VignetteEffect, SMAAEffect". If both fail, proceed with the code in Task 1.4 (written against postprocessing v6) and adjust if the build errors.

- [ ] **Step 2: Add the dependency**

In `client/package.json` `dependencies`, add `"postprocessing": "^6.36.0"`. Then run `npm install`.

- [ ] **Step 3: Verify install + existing build still green**

Run: `npm install && npm run build`
Expected: installs `postprocessing`; client builds clean.

- [ ] **Step 4: Commit**

```bash
git add client/package.json package-lock.json
git commit -m "chore(client): add postprocessing dependency"
```

## Task 0.2: Deterministic PRNG in shared (seeded generation foundation)

> **Use the `procedural:seed-system` skill first** to sanity-check the seed scheme (single master seed in `shared/constants.ts` → derived per-system seeds for terrain vs scatter). Keep it tiny; the skill's guidance informs the derivation, the code below is the implementation.

**Files:** Create `shared/src/rng.ts`, `shared/src/rng.test.ts`; modify `shared/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, randRange, deriveSeed } from './rng.js';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('randRange maps into [min,max)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = randRange(r, -5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });
  it('derived seeds differ per subsystem but are stable', () => {
    expect(deriveSeed(100, 'terrain')).toBe(deriveSeed(100, 'terrain'));
    expect(deriveSeed(100, 'terrain')).not.toBe(deriveSeed(100, 'scatter'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/src/rng.test.ts`
Expected: FAIL — cannot resolve `./rng.js`.

- [ ] **Step 3: Create `shared/src/rng.ts`**

```ts
/** Deterministic PRNG (mulberry32). Returns a function giving floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: () => number, minInclusive: number, maxExclusive: number): number {
  return Math.floor(randRange(rng, minInclusive, maxExclusive));
}

/** Derive a stable sub-seed from a master seed + a string tag (FNV-1a mix). */
export function deriveSeed(master: number, tag: string): number {
  let h = (master >>> 0) ^ 0x811c9dc5;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/src/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Export from `shared/src/index.ts`**

Add: `export * from './rng.js';`

- [ ] **Step 6: Commit**

```bash
git add shared/src/rng.ts shared/src/rng.test.ts shared/src/index.ts
git commit -m "feat(shared): deterministic seeded PRNG for world generation"
```

## Task 0.3: Visual constants block + settings (quality / reduced-motion)

**Files:** Modify `shared/src/constants.ts`; create `client/src/game/settings.ts`, `client/src/game/settings.test.ts`

- [ ] **Step 1: Add a VISUAL block to `shared/src/constants.ts`** (append)

```ts
// ---- Visual / art-direction (cosmetic, but centralized like everything else) ----
export const WORLD_SEED = 1337; // master seed for all deterministic world generation

export const PALETTE = {
  skyTop: '#3aa0ff',
  skyHorizon: '#bfe9ff',
  sun: '#fff3d6',
  grassLow: '#4f9e3a',
  grassHigh: '#79c45a',
  rock: '#8a8f99',
  snow: '#f3f7ff',
  sand: '#e8d9a8',
  waterDeep: '#1b6fa8',
  waterShallow: '#56c3d6',
  waterFoam: '#dffaff',
  road: '#3a3f4a',
} as const;

// Scatter (Stage 5): density + exclusion margins (world units).
export const SCATTER_TARGET_COUNT = 220; // candidate props before exclusion
export const SCATTER_ROAD_MARGIN = 6; // keep props this far from the road edge
export const SCATTER_WATER_MARGIN = 3; // and this far from lake edges

// Terrain (Stage 3): hill ring around the flat basin.
// MUST be >= world bounds half-extents (200 x 150) so the ENTIRE drivable area is
// flat (height 0) and cars never float; hills only rise beyond where cars can drive.
export const BASIN_HALF_X = 210;
export const BASIN_HALF_Z = 160;
export const HILL_MAX_HEIGHT = 60;
```

- [ ] **Step 2: Write the failing test for settings**

`client/src/game/settings.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { detectQuality } from './settings.js';

describe('detectQuality', () => {
  it('returns low when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }));
    expect(detectQuality()).toBe('low');
  });
  it('returns high by default', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(detectQuality()).toBe('high');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run client/src/game/settings.test.ts`
Expected: FAIL — cannot resolve `./settings.js`.

- [ ] **Step 4: Create `client/src/game/settings.ts`**

```ts
export type Quality = 'high' | 'low';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Coarse quality pick: reduced-motion or a low device-memory hint → 'low'. */
export function detectQuality(): Quality {
  if (prefersReducedMotion()) return 'low';
  const mem = (navigator as { deviceMemory?: number } | undefined)?.deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return 'low';
  return 'high';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run client/src/game/settings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add shared/src/constants.ts client/src/game/settings.ts client/src/game/settings.test.ts
git commit -m "feat: visual constants + quality/reduced-motion settings"
```

---

# STAGE 1 — Light, sky & atmosphere

> After this stage, run a Playwright screenshot check (see Task 1.6) — this is the biggest visible jump. Then run `accessibility:a11y-check` on the new palette/motion.

## Task 1.1: Lighting module + contact shadow

**Files:** Create `client/src/game/lighting.ts`

- [ ] **Step 1: Create `client/src/game/lighting.ts`**

```ts
import * as THREE from 'three';
import { PALETTE } from '@zoomies/shared';
import type { Quality } from './settings.js';

/** Warm hemisphere + sun key light with soft shadows. Returns the sun for god-rays. */
export function addLighting(scene: THREE.Scene, quality: Quality): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(PALETTE.skyHorizon, PALETTE.grassLow, 0.8));
  scene.add(new THREE.AmbientLight('#ffffff', 0.15));

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.25);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  const s = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(s, s);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  const d = 220;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/** A cheap soft blob shadow that follows a car (grounding without per-car shadow maps). */
export function makeContactShadow(): THREE.Mesh {
  const tex = makeRadialTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.renderOrder = 1;
  return mesh;
}

function makeRadialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
```

- [ ] **Step 2: Typecheck** — Run: `npm --workspace client run build` → Expected: compiles (unused until Task 1.5).

- [ ] **Step 3: Commit**

```bash
git add client/src/game/lighting.ts
git commit -m "feat(client): warm lighting + soft contact shadow"
```

## Task 1.2: Gradient sky dome + sun mesh

**Files:** Create `client/src/game/sky.ts`

- [ ] **Step 1: Create `client/src/game/sky.ts`**

```ts
import * as THREE from 'three';
import { PALETTE } from '@zoomies/shared';

/** Big inverted sphere with a vertical gradient. Returns the sky group. */
export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 horizon;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  return sky;
}

/** Bright sun disc placed along the light direction — also the god-ray source. */
export function createSunMesh(): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 16), mat);
  sun.position.set(360, 520, 240); // same direction as the DirectionalLight, far away
  return sun;
}
```

- [ ] **Step 2: Typecheck** — Run: `npm --workspace client run build` → Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/sky.ts
git commit -m "feat(client): gradient sky dome + sun disc"
```

## Task 1.3: Post-processing pipeline (bloom + god-rays + vignette)

> Confirm the API first via the context7 result from Task 0.1 Step 1. The code below targets `postprocessing` v6.

**Files:** Create `client/src/game/postfx.ts`

- [ ] **Step 1: Create `client/src/game/postfx.ts`**

```ts
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  GodRaysEffect,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
  BlendFunction,
} from 'postprocessing';
import type { Quality } from './settings.js';

export interface PostFX {
  composer: EffectComposer;
  setSize: (w: number, h: number) => void;
  render: (dt: number) => void;
}

/** Build the bloom + god-rays + vignette pipeline. `sun` is the god-ray light source. */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  sun: THREE.Mesh,
  quality: Quality,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: quality === 'high' ? 0.9 : 0.5,
    luminanceThreshold: 0.65,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });

  const godRays = new GodRaysEffect(camera, sun, {
    blendFunction: BlendFunction.SCREEN,
    density: 0.92,
    decay: 0.92,
    weight: quality === 'high' ? 0.5 : 0.3,
    samples: quality === 'high' ? 60 : 30,
    resolutionScale: quality === 'high' ? 0.6 : 0.4,
  });

  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.45 });
  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });

  composer.addPass(new EffectPass(camera, godRays, bloom, vignette, smaa));

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    render: (dt) => composer.render(dt),
  };
}
```

- [ ] **Step 2: Typecheck** — Run: `npm --workspace client run build`
Expected: compiles. If imports/option names differ from installed `postprocessing`, fix per the context7/WebFetch docs from Task 0.1 (e.g., a renamed effect option) — keep the same structure.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/postfx.ts
git commit -m "feat(client): postprocessing pipeline (god-rays + bloom + vignette)"
```

## Task 1.4: Wire Stage 1 into world.ts + Game.ts (lighting, sky, postfx, contact shadow)

**Files:** Modify `client/src/game/world.ts`, `client/src/game/Game.ts`

- [ ] **Step 1: Update `client/src/game/world.ts`** to compose sky + lighting and expose the sun

Replace the lighting/sky/background portion of `createWorld()` so it returns the scene **and** the sun mesh. New shape:

```ts
import * as THREE from 'three';
import { MAP, PALETTE } from '@zoomies/shared';
import { addLighting } from './lighting.js';
import { createSky, createSunMesh } from './sky.js';
import type { Quality } from './settings.js';

export interface World {
  scene: THREE.Scene;
  sun: THREE.Mesh; // god-ray source
}

export function createWorld(quality: Quality): World {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.skyHorizon, 260, 820);

  scene.add(createSky());
  const sunMesh = createSunMesh();
  scene.add(sunMesh);
  addLighting(scene, quality);

  // Ground (kept; recolored). Road ribbon + trees stay for now (replaced in later stages).
  const b = MAP.bounds;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + 400, b.maxZ - b.minZ + 400),
    new THREE.MeshLambertMaterial({ color: PALETTE.grassLow }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(buildRoadMesh());
  for (const p of MAP.props) scene.add(buildTree(p.x, p.z, p.radius));
  return { scene, sun: sunMesh };
}
```

(Keep the existing `buildRoadMesh` and `buildTree` functions in the file; just update the road material color to `PALETTE.road`. The old `scene.background` line is removed — the sky dome replaces it.)

- [ ] **Step 2: Update `client/src/game/Game.ts`** to use quality, the sun, postfx, and a contact shadow

Changes (keep everything else):
- Import `detectQuality` from `./settings.js`, `createPostFX` from `./postfx.js`, `makeContactShadow` from `./lighting.js`.
- In the constructor: `const quality = detectQuality();` then `const world = createWorld(quality);` capture `this.sun = world.sun`. After camera creation: `this.postfx = createPostFX(this.renderer, this.scene, this.camera, world.sun, quality);`
- Enable shadows: `this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;`
- Add a contact shadow under the local car: `this.contact = makeContactShadow(); this.scene.add(this.contact);` and in `render()` set `this.contact.position.set(this.car.x, 0.05, this.car.z);`
- Replace the render call `this.renderer.render(this.scene, this.camera)` with `this.postfx.render(0.016)`.
- In `resize()`, after sizing the renderer, also `this.postfx?.setSize(w, h)`.
- Add fields: `private postfx!: PostFX; private sun!: THREE.Mesh; private contact!: THREE.Mesh;` (import `type { PostFX }`).
- In `dispose()`: `this.postfx.composer.dispose();`

- [ ] **Step 3: Build** — Run: `npm --workspace client run build` → Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/world.ts client/src/game/Game.ts
git commit -m "feat(client): atmospheric world — sky, lighting, post-fx, contact shadow"
```

## Task 1.5: Screenshot verification + accessibility check (Stage 1)

- [ ] **Step 1: Boot and screenshot with Playwright MCP**

Start `npm run dev:party` and `npm run dev` in the background. Use the **Playwright MCP** tools: `browser_navigate` to `http://localhost:5173`, fill name + Create lobby, wait ~2s, `browser_take_screenshot`. Read the screenshot and confirm: gradient sky, warm sun, visible god-ray sunbeams, soft shadow under the car, no console errors (`browser_console_messages` — favicon 404 is fine). Kill both servers when done.

- [ ] **Step 2: Accessibility pass**

Invoke the **`accessibility:a11y-check`** skill on the new visuals (palette contrast for HUD-over-world legibility; confirm `prefers-reduced-motion` path: with reduced motion, quality='low' and god-ray animation is static). Apply any quick fixes it surfaces (e.g., HUD panel opacity). Commit if changed:

```bash
git add -A && git commit -m "a11y: Stage 1 contrast/reduced-motion adjustments"
```

- [ ] **Step 3: Spot-tune** the palette/intensities in `constants.ts`/`postfx.ts` to taste based on the screenshot, then re-screenshot. Commit any tuning:

```bash
git add -A && git commit -m "polish: Stage 1 atmosphere tuning"
```

---

# STAGE 2 — Stylized water (lakes)

## Task 2.1: Add water bodies to the map + collision (TDD)

**Files:** Modify `shared/src/map.ts`, `shared/src/map.test.ts`, and `client/src/game/Game.ts` (obstacle list)

- [ ] **Step 1: Add the failing tests** to `shared/src/map.test.ts`

```ts
import { MAP, isInBounds } from './map.js';
import { resolveCollisions } from './collision.js';
import { CAR_RADIUS } from './constants.js';

describe('water bodies', () => {
  it('defines lakes inside the world bounds', () => {
    expect(MAP.waterBodies.length).toBeGreaterThan(0);
    for (const w of MAP.waterBodies) {
      expect(isInBounds(w.x, w.z)).toBe(true);
      expect(w.radius).toBeGreaterThan(0);
    }
  });
  it('a car driven into a lake is pushed back out (water is solid)', () => {
    const w = MAP.waterBodies[0]!;
    const car = { x: w.x, z: w.z, heading: 0, vx: 0, vz: 0 };
    const out = resolveCollisions(car, [...MAP.props, ...MAP.waterBodies]);
    const dist = Math.hypot(out.x - w.x, out.z - w.z);
    expect(dist).toBeGreaterThanOrEqual(w.radius + CAR_RADIUS - 1e-6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/src/map.test.ts`
Expected: FAIL — `MAP.waterBodies` undefined.

- [ ] **Step 3: Add `waterBodies` to `MapDef` and `MAP` in `shared/src/map.ts`**

Add `waterBodies: Circle[];` to the `MapDef` interface, and in the `MAP` object add (positioned in grass, off the road, echoing the reference map's lakes):

```ts
  waterBodies: [
    { x: -70, z: 60, radius: 26 },
    { x: 95, z: -55, radius: 22 },
    { x: 140, z: 70, radius: 18 },
  ],
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run shared/src/map.test.ts`
Expected: PASS. (If a seeded lake overlaps the road, nudge its center until the existing road tests + these pass.)

- [ ] **Step 5: Add water to the collision obstacle list in `Game.ts`**

In `fixedStep()`, change `resolveCollisions(next, MAP.props)` to `resolveCollisions(next, [...MAP.props, ...MAP.waterBodies])`.

- [ ] **Step 6: Run all tests + build**

Run: `npx vitest run && npm --workspace client run build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add shared/src/map.ts shared/src/map.test.ts client/src/game/Game.ts
git commit -m "feat: lakes — water bodies in map + solid collision"
```

## Task 2.2: Stylized water shader + lake meshes

> Optionally consult the **`juice:juice-recipe`** skill for "calm stylized water" to pick which motions read best (ripple speed, shoreline shimmer). Keep within the shader below.

**Files:** Create `client/src/game/water.ts`; modify `client/src/game/world.ts`, `client/src/game/Game.ts`

- [ ] **Step 1: Create `client/src/game/water.ts`**

```ts
import * as THREE from 'three';
import { MAP, PALETTE } from '@zoomies/shared';

export interface Water {
  group: THREE.Group;
  update: (t: number) => void; // animate; call each frame (no-op if reduced motion)
}

export function createWater(animate: boolean): Water {
  const group = new THREE.Group();
  const materials: THREE.ShaderMaterial[] = [];

  for (const w of MAP.waterBodies) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color(PALETTE.waterDeep) },
        shallow: { value: new THREE.Color(PALETTE.waterShallow) },
        foam: { value: new THREE.Color(PALETTE.waterFoam) },
        radius: { value: w.radius },
      },
      vertexShader: `
        uniform float time; varying vec2 vXz; varying float vR;
        void main() {
          vXz = position.xy; vR = length(position.xy);
          float ripple = sin(position.x*0.4 + time) * cos(position.y*0.4 + time) * 0.25;
          vec3 p = vec3(position.x, position.y, ripple);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform float time; uniform float radius;
        varying vec2 vXz; varying float vR;
        void main() {
          float edge = vR / radius;               // 0 center → 1 rim
          vec3 col = mix(deep, shallow, smoothstep(0.0, 1.0, edge));
          float caustic = 0.5 + 0.5 * sin(vXz.x*0.6 + time*1.3) * sin(vXz.y*0.6 - time);
          col += caustic * 0.06;
          float ring = smoothstep(0.82, 0.98, edge);    // shoreline foam
          col = mix(col, foam, ring * 0.8);
          gl_FragColor = vec4(col, 0.92);
        }
      `,
    });
    const geo = new THREE.CircleGeometry(w.radius, 48);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(w.x, 0.12, w.z);
    group.add(mesh);
    materials.push(mat);
  }

  return {
    group,
    update: (t) => {
      if (!animate) return;
      for (const m of materials) m.uniforms.time.value = t;
    },
  };
}
```

- [ ] **Step 2: Wire into `world.ts` + `Game.ts`**

- In `world.ts`, import `createWater`, add `water: Water` to the `World` interface, create it (`createWater(quality === 'high')` — freeze on low/reduced-motion), `scene.add(water.group)`, and return it.
- In `Game.ts`, keep `this.water = world.water`; in `render(now)` call `this.water.update(now / 1000)`.

- [ ] **Step 3: Build** — Run: `npm --workspace client run build` → Expected: compiles.

- [ ] **Step 4: Screenshot verification (Playwright MCP)** — boot servers, navigate, create lobby, drive near a lake, screenshot; confirm shimmering water with a lighter shoreline ring and that the car cannot enter the lake. Kill servers.

- [ ] **Step 5: Commit**

```bash
git add client/src/game/water.ts client/src/game/world.ts client/src/game/Game.ts
git commit -m "feat(client): stylized animated lake water"
```

---

# STAGE 3 — Terrain silhouette

## Task 3.1: Seeded heightfield helper in shared (TDD)

> **Use `procedural:algorithm-eval`** to confirm value-noise vs. radial falloff for the hill ring; the implementation below uses a deterministic radial-falloff + value-noise blend (flat basin, hills outside). Keep it pure and seeded.

**Files:** Create `shared/src/terrain.ts`, `shared/src/terrain.test.ts`; export from index

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { heightAt } from './terrain.js';
import { BASIN_HALF_X, BASIN_HALF_Z, HILL_MAX_HEIGHT } from './constants.js';

describe('terrain heightAt', () => {
  it('is flat (≈0) inside the drivable basin', () => {
    expect(Math.abs(heightAt(0, 0))).toBeLessThan(0.01);
    expect(Math.abs(heightAt(BASIN_HALF_X * 0.5, BASIN_HALF_Z * 0.5))).toBeLessThan(0.01);
  });
  it('rises outside the basin and is deterministic', () => {
    const h = heightAt(BASIN_HALF_X + 120, 0);
    expect(h).toBeGreaterThan(2);
    expect(h).toBeLessThanOrEqual(HILL_MAX_HEIGHT + 1e-6);
    expect(heightAt(BASIN_HALF_X + 120, 0)).toBe(h); // deterministic
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/src/terrain.test.ts`
Expected: FAIL — cannot resolve `./terrain.js`.

- [ ] **Step 3: Create `shared/src/terrain.ts`**

```ts
import { WORLD_SEED, BASIN_HALF_X, BASIN_HALF_Z, HILL_MAX_HEIGHT } from './constants.js';
import { mulberry32, deriveSeed } from './rng.js';
import { clamp } from './math.js';

// Precompute a small value-noise lattice from the seed (deterministic, shared).
const N = 16;
const lattice: number[] = (() => {
  const r = mulberry32(deriveSeed(WORLD_SEED, 'terrain'));
  return Array.from({ length: N * N }, () => r());
})();

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  // sample the lattice over a 900-unit span, bilinear-smooth
  const u = ((x / 60) % N + N) % N;
  const v = ((z / 60) % N + N) % N;
  const x0 = Math.floor(u), z0 = Math.floor(v);
  const x1 = (x0 + 1) % N, z1 = (z0 + 1) % N;
  const fx = smooth(u - x0), fz = smooth(v - z0);
  const a = lattice[z0 * N + x0]!, b = lattice[z0 * N + x1]!;
  const c = lattice[z1 * N + x0]!, d = lattice[z1 * N + x1]!;
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

/** Decorative height: 0 inside the basin, ramping to hills outside. Pure + deterministic. */
export function heightAt(x: number, z: number): number {
  // distance outside the basin rectangle (0 inside)
  const dx = Math.max(0, Math.abs(x) - BASIN_HALF_X);
  const dz = Math.max(0, Math.abs(z) - BASIN_HALF_Z);
  const outside = Math.hypot(dx, dz);
  if (outside <= 0) return 0;
  const ramp = clamp(outside / 120, 0, 1); // reach full height ~120 units out
  return smooth(ramp) * HILL_MAX_HEIGHT * (0.55 + 0.45 * valueNoise(x, z));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run shared/src/terrain.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Export + commit**

Add `export * from './terrain.js';` to `shared/src/index.ts`.

```bash
git add shared/src/terrain.ts shared/src/terrain.test.ts shared/src/index.ts
git commit -m "feat(shared): deterministic decorative heightfield (flat basin + hill ring)"
```

## Task 3.2: Low-poly terrain mesh + recolored ground/road

**Files:** Create `client/src/game/terrain.ts`; modify `client/src/game/world.ts`

- [ ] **Step 1: Create `client/src/game/terrain.ts`**

```ts
import * as THREE from 'three';
import { heightAt } from '@zoomies/shared';
import { PALETTE } from '@zoomies/shared';

/** Flat-shaded low-poly terrain covering the world + hill ring, vertex-colored by height. */
export function createTerrain(): THREE.Mesh {
  const size = 900, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const cLow = new THREE.Color(PALETTE.grassLow);
  const cHigh = new THREE.Color(PALETTE.grassHigh);
  const cRock = new THREE.Color(PALETTE.rock);
  const cSnow = new THREE.Color(PALETTE.snow);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const t = Math.min(h / 60, 1);
    if (t < 0.02) tmp.copy(cLow);
    else if (t < 0.5) tmp.copy(cLow).lerp(cHigh, t / 0.5);
    else if (t < 0.8) tmp.copy(cHigh).lerp(cRock, (t - 0.5) / 0.3);
    else tmp.copy(cRock).lerp(cSnow, (t - 0.8) / 0.2);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
```

- [ ] **Step 2: Replace the flat ground in `world.ts`** with `createTerrain()` (remove the old `ground` plane; keep the road ribbon on the flat basin and the water). Road material color → `PALETTE.road`.

- [ ] **Step 3: Build + screenshot (Playwright MCP)** — confirm hills rising around a flat drivable basin, vertex-colored slopes, horizon blended into fog/sky; car still drives on the flat area. Kill servers.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/terrain.ts client/src/game/world.ts
git commit -m "feat(client): low-poly terrain — flat basin ringed by colored hills"
```

---

# STAGE 4 — Cars (GLTF)

## Task 4.1: Fetch CC0 car asset + CREDITS

**Files:** Create `client/public/models/car.glb`, `client/public/CREDITS.md`

- [ ] **Step 1: Download a CC0 low-poly car**

Fetch a CC0 low-poly car GLB (Kenney Car Kit is CC0). Use curl with the revocation flag, e.g. download the Kenney Car Kit zip from its source/mirror and extract one car, or pull a single CC0 car GLB from Poly Pizza. Command form:

```bash
mkdir -p client/public/models
curl -sSL --ssl-no-revoke -o /tmp/car.glb "<DIRECT_CC0_CAR_GLB_URL>"
cp /tmp/car.glb client/public/models/car.glb
```

If no direct URL resolves (JS-gated page), pick another reachable CC0 car (Quaternius/Poly Pizza) or, as a last resort, note BLOCKED and request the user drop `client/public/models/car.glb`. Verify the file starts with `glTF` magic: `head -c 4 client/public/models/car.glb`.

- [ ] **Step 2: Create `client/public/CREDITS.md`**

```markdown
# Asset Credits

All models are CC0 (public domain) unless noted.

- `models/car.glb` — <pack name> by <author>, CC0. Source: <url>
```

- [ ] **Step 3: Commit**

```bash
git add client/public/models/car.glb client/public/CREDITS.md
git commit -m "assets: CC0 low-poly car model + credits"
```

## Task 4.2: Asset loader with preload + fallback

> Confirm `GLTFLoader` import path/API via **context7** (`resolve-library-id` `three`, then `query-docs` "GLTFLoader loadAsync three/examples/jsm"). Fallback: WebFetch the three.js GLTFLoader docs. Code targets current three (`three/examples/jsm/loaders/GLTFLoader.js`, `loadAsync`).

**Files:** Create `client/src/game/assets.ts`

- [ ] **Step 1: Create `client/src/game/assets.ts`**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();

const URLS = { car: '/models/car.glb' } as const;
export type AssetKey = keyof typeof URLS;

/** Load all GLBs once. Resolves even if some fail (fallbacks used instead). */
export async function preloadAssets(): Promise<void> {
  await Promise.all(
    (Object.keys(URLS) as AssetKey[]).map(async (key) => {
      try {
        const gltf = await loader.loadAsync(URLS[key]);
        cache.set(key, gltf.scene);
      } catch (e) {
        console.warn(`[assets] failed to load ${key}, using fallback`, e);
      }
    }),
  );
}

/** A fresh clone of a loaded asset, or null if it wasn't available. */
export function instantiate(key: AssetKey): THREE.Group | null {
  const src = cache.get(key);
  return src ? (src.clone(true) as THREE.Group) : null;
}
```

- [ ] **Step 2: Build** — Run: `npm --workspace client run build` → Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add client/src/game/assets.ts
git commit -m "feat(client): GLTF asset loader with preload + cache"
```

## Task 4.3: Car model with per-player recolor (+ procedural fallback)

**Files:** Create `client/src/game/carModel.ts`

- [ ] **Step 1: Create `client/src/game/carModel.ts`**

```ts
import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '@zoomies/shared';
import { instantiate } from './assets.js';
import { buildCarMesh, type CarMesh } from './carMesh.js'; // procedural fallback (kept)

/** Build a car: GLTF if available (recolored), else the procedural box car. */
export function buildCar(color: string): CarMesh {
  const gltf = instantiate('car');
  if (!gltf) return buildCarMesh(color);

  // Normalize the model to our car footprint and recolor the largest (body) material.
  fitToFootprint(gltf);
  let body: THREE.MeshStandardMaterial | null = null;
  let bodyArea = -1;
  gltf.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const geom = m.geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    const area = size.x * size.z;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    if (area > bodyArea && mat && 'color' in mat) {
      bodyArea = area;
      body = mat.clone();
      m.material = body;
    }
  });
  const group = new THREE.Group();
  group.add(gltf);
  return {
    group,
    setColor: (hex: string) => body?.color.set(hex),
  };
}

function fitToFootprint(g: THREE.Group): void {
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = Math.min(CAR_WIDTH / (size.x || 1), CAR_LENGTH / (size.z || 1));
  g.scale.setScalar(scale);
  // re-center on ground
  const box2 = new THREE.Box3().setFromObject(g);
  g.position.y -= box2.min.y;
}
```

- [ ] **Step 2: Swap `buildCarMesh` → `buildCar` in `Game.ts`**

Change the import and the two call sites (`this.carMesh = buildCar(opts.color)` and `spawnRemote`'s `buildCarMesh(info.color)` → `buildCar(info.color)`). The procedural `carMesh.ts` stays as the fallback used inside `buildCar`.

- [ ] **Step 3: Build** — Run: `npm --workspace client run build` → Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/carModel.ts client/src/game/Game.ts
git commit -m "feat(client): GLTF car with per-player recolor + procedural fallback"
```

## Task 4.4: Loading screen + preload gate

> Use the **`frontend-design`** skill to make the loading screen on-brand (low-poly/cute, matches StartScreen). Keep it a small focused component.

**Files:** Create `client/src/ui/LoadingScreen.tsx`; modify `client/src/ui/App.tsx`, `client/src/ui/GameCanvas.tsx`

- [ ] **Step 1: Create `client/src/ui/LoadingScreen.tsx`**

```tsx
export function LoadingScreen() {
  return (
    <div style={overlay}>
      <div style={{ textAlign: 'center' }}>
        <div style={spinner} />
        <p style={{ marginTop: 16, color: '#234', fontWeight: 600 }}>Warming up the engines…</p>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
  background: 'linear-gradient(#bfe9ff,#3aa0ff)',
};
const spinner: React.CSSProperties = {
  width: 48, height: 48, margin: '0 auto', borderRadius: '50%',
  border: '6px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', animation: 'spin 0.9s linear infinite',
};
```

- [ ] **Step 2: Gate the game on `preloadAssets()`**

In `GameCanvas.tsx`, before constructing `Game`, await preload. Simplest: lift it into `App.tsx` — add a `'loading'` phase: when `begin()` is called, set phase `'loading'`, call `preloadAssets().then(() => setPhase('playing'))`. Render `<LoadingScreen/>` while `'loading'`. (Preload is idempotent/cached, safe to call once.)

- [ ] **Step 3: Build + Playwright screenshot** — confirm the loading screen shows briefly, then the GLTF cars appear and recolor per player (two-client check: each car is the chosen color). Kill servers.

- [ ] **Step 4: Commit**

```bash
git add client/src/ui/LoadingScreen.tsx client/src/ui/App.tsx client/src/ui/GameCanvas.tsx
git commit -m "feat(client): asset preload gate + loading screen"
```

---

# STAGE 5 — Vegetation, rocks & landmarks

## Task 5.1: Seeded scatter layout in shared (TDD)

> **Dispatch the `procedural:constraint-designer` agent** (or use `procedural:constraint-rules`) to validate the exclusion rules (no props on the road, in water, or out of bounds; clustered in grass). Encode the agreed rules as the tests below.

**Files:** Create `shared/src/scatter.ts`, `shared/src/scatter.test.ts`; export from index

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { scatterProps } from './scatter.js';
import { MAP, surfaceAt, isInBounds, SCATTER_ROAD_MARGIN } from './index.js';

describe('scatterProps', () => {
  it('is deterministic for the world seed', () => {
    expect(scatterProps()).toEqual(scatterProps());
  });
  it('places nothing on the road, in water, or out of bounds', () => {
    for (const p of scatterProps()) {
      expect(isInBounds(p.x, p.z)).toBe(true);
      expect(surfaceAt(p.x, p.z)).toBe('grass');
      for (const w of MAP.waterBodies) {
        expect(Math.hypot(p.x - w.x, p.z - w.z)).toBeGreaterThan(w.radius);
      }
    }
  });
  it('assigns each prop a kind and a yaw', () => {
    const props = scatterProps();
    expect(props.length).toBeGreaterThan(20);
    for (const p of props) {
      expect(['tree', 'rock', 'reed']).toContain(p.kind);
      expect(p.yaw).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/src/scatter.test.ts`
Expected: FAIL — cannot resolve `./scatter.js`.

- [ ] **Step 3: Create `shared/src/scatter.ts`**

```ts
import type { Vec2 } from './types.js';
import { MAP, surfaceAt, isInBounds } from './map.js';
import { distanceToSegment } from './math.js';
import { mulberry32, deriveSeed, randRange } from './rng.js';
import {
  WORLD_SEED, SCATTER_TARGET_COUNT, SCATTER_ROAD_MARGIN, SCATTER_WATER_MARGIN,
} from './constants.js';

export type PropKind = 'tree' | 'rock' | 'reed';
export interface ScatterProp extends Vec2 { kind: PropKind; yaw: number; scale: number }

function nearRoad(x: number, z: number, margin: number): boolean {
  const pts = MAP.roadCenterline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    if (distanceToSegment(x, z, a.x, a.z, b.x, b.z) <= MAP.roadWidth / 2 + margin) return true;
  }
  return false;
}

function inWater(x: number, z: number, margin: number): boolean {
  return MAP.waterBodies.some((w) => Math.hypot(x - w.x, z - w.z) <= w.radius + margin);
}

/** Deterministic prop placement (trees/rocks/reeds) honoring all exclusions. */
export function scatterProps(): ScatterProp[] {
  const rng = mulberry32(deriveSeed(WORLD_SEED, 'scatter'));
  const b = MAP.bounds;
  const out: ScatterProp[] = [];
  for (let i = 0; i < SCATTER_TARGET_COUNT; i++) {
    const x = randRange(rng, b.minX + 4, b.maxX - 4);
    const z = randRange(rng, b.minZ + 4, b.maxZ - 4);
    const kind: PropKind = rng() < 0.7 ? 'tree' : rng() < 0.6 ? 'rock' : 'reed';
    const yaw = randRange(rng, 0, Math.PI * 2);
    const scale = randRange(rng, 0.8, 1.4);
    if (!isInBounds(x, z)) continue;
    if (surfaceAt(x, z) !== 'grass') continue;
    if (nearRoad(x, z, SCATTER_ROAD_MARGIN)) continue;
    if (inWater(x, z, SCATTER_WATER_MARGIN)) continue;
    out.push({ x, z, kind, yaw, scale });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run shared/src/scatter.test.ts`
Expected: PASS (3 tests). Add `export * from './scatter.js';` to `shared/src/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add shared/src/scatter.ts shared/src/scatter.test.ts shared/src/index.ts
git commit -m "feat(shared): deterministic prop scatter with exclusions"
```

## Task 5.2: Fetch CC0 vegetation/rock assets + CREDITS update

**Files:** add `client/public/models/{tree_a,tree_b,rock,reed}.glb`; update `client/public/CREDITS.md`

- [ ] **Step 1: Download CC0 nature assets** (Kenney Nature Kit is CC0). Same curl form as Task 4.1 (`--ssl-no-revoke`), extracting tree variants, a rock, a reed. Verify each `head -c 4` is `glTF`. If a direct URL is unreachable, substitute another reachable CC0 model or note BLOCKED for that one file.

- [ ] **Step 2: Append entries to `client/public/CREDITS.md`** for each model (pack, author, CC0, source URL).

- [ ] **Step 3: Register URLs in `assets.ts`** — extend `URLS` with `tree_a`, `tree_b`, `rock`, `reed`.

- [ ] **Step 4: Commit**

```bash
git add client/public/models client/public/CREDITS.md client/src/game/assets.ts
git commit -m "assets: CC0 trees/rock/reed + credits"
```

## Task 5.3: Render scattered props with InstancedMesh + landmarks

> **Use the `web-games:webgl-specialist` agent** to confirm the InstancedMesh batching keeps draw calls low. **Optionally dispatch `level-design:environment-storyteller`** for landmark choice/placement (lighthouse by a lake, cottages on a hill) so they aid orientation and charm.

**Files:** Create `client/src/game/scatter.ts`; modify `client/src/game/world.ts`

- [ ] **Step 1: Create `client/src/game/scatter.ts`**

```ts
import * as THREE from 'three';
import { scatterProps, type PropKind } from '@zoomies/shared';
import { instantiate } from './assets.js';

/** Build InstancedMeshes for scattered props from the deterministic layout. */
export function createScatter(): THREE.Group {
  const group = new THREE.Group();
  const byKind: Record<PropKind, THREE.Object3D[]> = { tree: [], rock: [], reed: [] };
  for (const p of scatterProps()) byKind[p.kind].push(makeMatrixHolder(p.x, p.z, p.yaw, p.scale));

  const assetFor: Record<PropKind, string[]> = {
    tree: ['tree_a', 'tree_b'],
    rock: ['rock'],
    reed: ['reed'],
  };

  for (const kind of Object.keys(byKind) as PropKind[]) {
    const holders = byKind[kind];
    if (holders.length === 0) continue;
    // Use the first available asset variant; instance it.
    const variant = assetFor[kind].map(instantiate).find((g) => g !== null) ?? null;
    const mesh = variant && firstMesh(variant);
    if (!mesh) continue; // asset missing → skip (procedural fallback could go here)
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, holders.length);
    inst.castShadow = true;
    const m = new THREE.Matrix4();
    holders.forEach((h, i) => {
      h.updateMatrix();
      inst.setMatrixAt(i, h.matrix);
      void m;
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  return group;
}

function makeMatrixHolder(x: number, z: number, yaw: number, scale: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, 0, z);
  o.rotation.y = yaw;
  o.scale.setScalar(scale);
  return o;
}

function firstMesh(g: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!found && m.isMesh) found = m;
  });
  return found;
}
```

- [ ] **Step 2: Wire into `world.ts`** — import `createScatter`, `scene.add(createScatter())`. Remove the old per-prop `buildTree` loop (decorative trees now come from scatter; keep `buildTree` only if used as a fallback). Optionally add 1–2 landmark GLTFs (lighthouse/cottage) at hand-picked spots near a lake/hill.

- [ ] **Step 3: Build + Playwright screenshot** — confirm dense, varied, instanced vegetation in the grass (none on road/in water), landmarks visible, identical across two clients. Kill servers.

- [ ] **Step 4: Commit**

```bash
git add client/src/game/scatter.ts client/src/game/world.ts
git commit -m "feat(client): instanced scattered vegetation + landmarks"
```

---

# STAGE 6 — Performance, accessibility, dispose & docs

## Task 6.1: Performance pass

> Run the **`web-games:web-optimization-checklist`** and **`web-games:webgl-audit`** skills; optionally dispatch the **`web-games:browser-performance-expert`** agent. Apply the high-value items.

**Files:** modify `client/src/game/Game.ts` and others as needed

- [ ] **Step 1: Measure** — with two browser tabs + 3+ cars, check FPS (DevTools) and draw calls. Record before-numbers.
- [ ] **Step 2: Apply** the checklist's high-value items that aren't already done: confirm InstancedMesh usage, shared geometries/materials, pixel-ratio cap (≤2), frustum culling defaults, terrain segment count sane, post-fx resolution scale on `low`. Ensure the `visibilitychange` pause (from MVP) still holds.
- [ ] **Step 3: Verify** ~60 fps with 6 cars on `high`, and that `low` quality (reduced-motion) noticeably reduces cost. Commit any changes:

```bash
git add -A && git commit -m "perf: Stage 6 webgl/optimization pass"
```

## Task 6.2: Accessibility pass

> Run **`accessibility:a11y-check`** (or the **`accessibility:accessibility-advocate`** agent) over the finished look.

- [ ] **Step 1:** Confirm `prefers-reduced-motion` disables water animation + god-ray motion and that quality drops to `low`. Confirm HUD text/dots remain legible over the busier world (adjust HUD panel background opacity in `Hud.tsx` if needed). Confirm player colors remain distinguishable against grass/water.
- [ ] **Step 2:** Apply fixes; commit:

```bash
git add -A && git commit -m "a11y: final reduced-motion + legibility pass"
```

## Task 6.3: Dispose new GPU resources

**Files:** modify `client/src/game/Game.ts`

- [ ] **Step 1:** In `dispose()`, traverse `this.scene` and dispose geometries, materials, and textures (terrain, water shader materials, instanced meshes, GLTF clones, contact-shadow texture), plus `this.postfx.composer.dispose()`. This closes the new-object leak the MVP review flagged.
- [ ] **Step 2:** Build + a quick mount/unmount check (navigate away and back via the menu) shows no console errors. Commit:

```bash
git add client/src/game/Game.ts
git commit -m "fix(client): dispose terrain/water/instanced/GLTF resources"
```

## Task 6.4: Update CLAUDE.md

**Files:** modify `CLAUDE.md`

- [ ] **Step 1:** Add a "Rendering & assets" section: the module map (`lighting/sky/water/terrain/postfx/assets/carModel/scatter/world`), the **determinism rule** (all world-gen seeded in `shared`, never `Math.random` per client), the **CC0 asset + CREDITS** convention and `client/public/models/`, the **quality/reduced-motion** settings, and the `postprocessing` dependency. Note the `--ssl-no-revoke` / `--use-system-ca` network quirks.
- [ ] **Step 2:** Commit:

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — rendering & assets section"
```

## Task 6.5: Final verification + deploy preview

- [ ] **Step 1: Full gate** — Run: `npx vitest run && npm run typecheck && npm run lint && npm run build && npx tsc -p party/tsconfig.json --noEmit` → all green.
- [ ] **Step 2: Two-client local check** — `npm run dev:party` + `npm run dev`; confirm both clients see the identical world, cars recolored, lakes solid, hills/scatter present, ~60 fps. Playwright screenshots saved for the record (then deleted; `.playwright-mcp/` is git-ignored).
- [ ] **Step 3 (optional): Redeploy** — rebuild + `NODE_OPTIONS=--use-system-ca npx vercel@latest --prod --yes` to push the new look live (PartyKit unchanged).
- [ ] **Step 4: Commit/tag** — `git commit --allow-empty -m "chore: visual overhaul complete (Tiny Skies look)"` and push: `NODE_OPTIONS=--use-system-ca git push origin main`.

---

## Self-Review (completed by plan author)

- **Spec coverage:** lighting+sky+god-rays+contact-shadow (Stage 1) ✓; stylized water + solid lakes (Stage 2) ✓; decorative hill terrain w/ flat basin (Stage 3) ✓; GLTF recolorable cars + loading gate + fallback (Stage 4) ✓; seeded vegetation/rocks/landmarks via InstancedMesh (Stage 5) ✓; determinism via `shared` seeds (rng/terrain/scatter, all TDD) ✓; perf + a11y + dispose + CLAUDE.md (Stage 6) ✓; CC0 + CREDITS ✓; quality/reduced-motion ✓; gameplay/physics/netcode untouched (only collision obstacle list extended with `waterBodies`) ✓.
- **Skill/plugin calls embedded:** procedural (seed-system 0.2, algorithm-eval 3.1, constraint-designer 5.1), context7 (0.1 postprocessing, 4.2 GLTFLoader), web-games (5.3 webgl-specialist, 6.1 checklist/audit), accessibility (1.5, 6.2), juice (2.2), frontend-design (4.4), level-design environment-storyteller (5.3), Playwright MCP screenshots (1.5, 2.2, 3.2, 4.4, 5.3, 6.5). ✓
- **Placeholders:** none — every code step has complete code. The only intentionally-parameterized item is the CC0 asset URL in Tasks 4.1/5.2 (resolved at run time by the implementer with a documented fallback to a reachable CC0 model or a BLOCKED ask), since exact direct URLs must be fetched live.
- **Type consistency:** `Quality` (settings) flows through `createWorld`/`addLighting`/`createPostFX`. `World { scene, sun, water }` matches `Game` usage. `CarMesh { group, setColor }` is preserved by `buildCar` (so `Game`/`spawnRemote` are unchanged besides the import). `ScatterProp { x,z,kind,yaw,scale }` consistent between `scatter.ts` (shared) and the client `createScatter`. `heightAt`, `scatterProps`, `mulberry32/deriveSeed/randRange` signatures match across tasks. `MAP.waterBodies: Circle[]` used in collision (Game), water render, and scatter exclusion identically.
```
