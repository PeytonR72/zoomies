# Zoomies — Visual Overhaul ("Tiny Skies" Art Direction)

**Date:** 2026-06-05
**Status:** Approved (design); pending implementation plan
**Depends on:** the shipped MVP (`docs/superpowers/specs/2026-06-04-zoomies-driving-game-design.md`)

---

## 1. Summary

Transform Zoomies from its placeholder look (flat green plane, box cars, cone trees) into a
polished, cohesive **Tiny Skies–style** world: warm atmospheric lighting with god-ray sunbeams,
stylized low-poly water, a shaped hilly horizon, cute rounded cars, and detailed vegetation/landmarks
— **without changing gameplay, physics, or netcode.** Driving stays flat; hills and water frame and
dot the world decoratively.

**Approach:** hybrid rendering — custom **shaders** for water/sky/terrain, curated **CC0 low-poly GLTF
models** for hero objects (cars, trees, rocks, landmarks). All world placement is **deterministic
(seeded in `shared`)** so every player sees the identical world, mirroring the existing
physics-constants "golden rule."

Built in **five shippable stages**, each independently valuable; we can stop, reorder, or pause after
any stage.

---

## 2. Goals & Non-Goals

### Goals
- A cohesive, vibrant, "finished-looking" low-poly world evoking the Tiny Skies references.
- Atmospheric lighting + post-processing (bloom + god-rays + vignette), performance-scaled.
- Stylized animated water for lakes (impassable — drive around them).
- A shaped horizon: rolling decorative hills/mountains ringing a flat, drivable basin.
- Cuter, rounder, per-player-recolorable cars (GLTF).
- Detailed multi-variant trees, rocks, reeds, and a few landmarks (lighthouse, cottages).
- Identical world across all clients (deterministic placement).
- Keep 60 fps with 6 cars on typical hardware; degrade gracefully on weak GPUs.

### Non-Goals (deferred)
- **Drivable terrain** — hills are decorative; the play area stays flat (no terrain-conform physics,
  no vertical netcode). This was the explicit decision.
- Day/night cycle, weather, seasons.
- Dynamic water interaction (wakes/ripples from cars), buoyancy.
- Destructible or animated props beyond shader motion.
- Racing, powerups, drifting mechanics (next efforts, separate specs).
- Audio.

### Definition of Done
Loading the game shows the loading step, then a warm, atmospheric low-poly world: gradient sky with
god-ray sunbeams, shimmering lakes you drive around, a hilly horizon around a flat drivable basin,
cute recolorable GLTF cars with soft shadows, and scattered detailed trees/rocks/landmarks — identical
for every player in a lobby, holding ~60 fps with 6 cars, with a graceful low-quality fallback.

---

## 3. Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Hills | **Decorative** — flat driving preserved; hills/mountains frame a basin. |
| Asset strategy | **Hybrid** — shaders for terrain/water/sky; **CC0 GLTF** for cars/trees/rocks/landmarks. |
| Post-processing | **Full** — bloom + god-rays + vignette, performance-scaled, reduced-motion fallback. |
| Assets license | **CC0** packs (Kenney / Poly Pizza CC0), committed under `client/public/`, with a `CREDITS.md`. |
| Determinism | All placement **seeded in `shared`** — never `Math.random()` per client. |
| Scope | **All 5 stages**, built stage-by-stage; each shippable. |
| Gameplay/physics/netcode | **Unchanged.** Water adds collision via the existing circle system only. |

---

## 4. Architecture

### 4.1 New / changed modules

```
client/src/game/
  world.ts        composition root — wires the pieces below (was: built everything inline)
  lighting.ts     warm hemisphere + sun (directional, soft shadows) + ambient; car contact shadow
  sky.ts          gradient sky dome (large inverted sphere / shader)
  water.ts        stylized water ShaderMaterial + lake meshes from MAP.waterBodies
  terrain.ts      decorative low-poly ground/hill mesh from a seeded heightfield (flat play area)
  postfx.ts       EffectComposer pipeline (bloom + god-rays + vignette) + quality scaling
  assets.ts       GLTF loader + cache + preload(); graceful fallback to procedural placeholder
  carModel.ts     replaces carMesh.ts — loads the GLTF car, recolors body material per player
  scatter.ts      seeded placement of trees/rocks/reeds/landmarks; InstancedMesh builders
client/public/
  models/         committed CC0 .glb files (car, tree variants, rock, reed, lighthouse, cottage)
  CREDITS.md      asset provenance + licenses

shared/src/
  rng.ts          deterministic PRNG (mulberry32) + helpers — pure, tested
  map.ts          extended: waterBodies, terrain params, scatter params (all seeded)
  constants.ts    new VISUAL constants block (palette, seeds, densities) — cosmetic, but centralized
```

`Game.ts` changes minimally: it composes the new `world.ts`, awaits `assets.preload()` before
starting, adds `MAP.waterBodies` to the collision obstacle list, and swaps `buildCarMesh` →
`carModel`. The fixed-step simulation, loop, camera, input, and net layers are untouched.

### 4.2 Shared data extensions (deterministic)

`shared/src/map.ts` gains, all consumed identically by every client:
- `waterBodies: Circle[]` — lakes inside the basin. **Rendered** as water (Stage 2) **and** added to
  collision so cars are pushed out (drive around them). Placed to match the reference map's lakes.
- `terrain: { seed: number; … hill-ring params }` — drives the decorative heightfield: height is
  **0 inside the drivable basin polygon**, rising to hills/mountains outside it.
- `scatter: { seed: number; density…; exclusion params }` — drives `scatter.ts`. Exclusion rules:
  nothing within `roadWidth/2 + margin` of the road centerline, nothing inside a water body, nothing
  outside world bounds; props cluster in grass and toward the hill ring.

`shared/src/rng.ts` provides a tiny seeded PRNG so terrain + scatter are reproducible and identical
across clients and runs. **No `Math.random()`** in any world-generation path (golden-rule discipline).

### 4.3 Rendering specifics

- **Lighting (Stage 1):** `HemisphereLight` (sky/ground tint) + warm `DirectionalLight` sun with a
  shadow map sized to the basin; tuned ambient. A soft **contact shadow** under each car (blob texture
  or a small shadow-map quad) for grounding.
- **Sky (Stage 1):** large inverted sphere with a vertical gradient shader (horizon → zenith), tuned to
  the palette; fog color matched to the horizon so the terrain silhouette blends.
- **Post-FX (Stage 1):** use the pmndrs **`postprocessing`** library: `EffectComposer` →
  `RenderPass` → `BloomEffect` + `GodRaysEffect` (sun mesh as the light source) + `VignetteEffect` +
  `SMAAEffect`. Half-resolution god-rays; a `quality` setting (high/low) that drops god-rays + bloom
  resolution; `prefers-reduced-motion` disables god-ray animation. Falls back to plain `renderer.render`
  if WebGL2/effects are unsupported.
- **Water (Stage 2):** low-segment plane per lake with a custom `ShaderMaterial`: deep→shallow color
  gradient, animated caustic shimmer (cheap noise), fresnel rim, a lighter **shoreline ring** by radial
  distance, gentle vertex ripple. Reduced-motion freezes the animation.
- **Terrain (Stage 3):** one low-poly ground mesh covering bounds + a margin. Vertex heights from the
  seeded heightfield: flat (y≈0) across the drivable basin, ramping to hills/mountains around and beyond
  it. **Flat-shaded**, vertex-colored by height/slope (beach → grass → rock → snow). The road is an
  inlaid ribbon on the flat area (kept from MVP, nicer material); grass gets multi-tone vertex color.
- **Hero models (Stages 4–5):** `GLTFLoader` via `assets.ts`, cached. `carModel.ts` clones the car
  scene per player and recolors the body material (model chosen/prepared with a separable body
  material or vertex-color body to tint); collision dims still from `shared/constants`. `scatter.ts`
  builds an `InstancedMesh` per variant for trees/rocks/reeds; landmarks placed individually.

### 4.4 Asset loading flow

`assets.preload()` returns a promise that loads all GLBs. `App.tsx` gains a brief **`loading`** phase
(spinner/progress) shown until preload resolves, then proceeds to `playing`. On load failure, `assets`
returns procedural placeholders (today's box car / cone tree) so the game still runs — logged, not
fatal.

### 4.5 Performance

- `InstancedMesh` for all scattered props; cap total draw calls; reuse geometries/materials.
- Keep the pixel-ratio cap (≤2); post-FX at scaled resolution; a `quality` setting (auto from a
  lightweight GPU heuristic, user-overridable) trims post-FX + shadow map size + scatter density.
- `prefers-reduced-motion` disables animated water + god-rays.
- Dispose new geometries/materials/textures on `Game.dispose()` (closes the MVP's known leak for the
  new objects).
- Verified with the `web-games` perf/WebGL skills during the polish stage; target 60 fps with 6 cars.

---

## 5. Stages (each shippable)

1. **Light, sky & atmosphere** — lighting.ts, sky.ts, postfx.ts, car contact shadow, palette in
   constants. *Biggest polish-per-effort.*
2. **Stylized water** — water.ts + `MAP.waterBodies` (render + collision). Drive around lakes.
3. **Terrain silhouette** — terrain.ts seeded heightfield (flat basin, hill ring), nicer road/grass.
4. **Cars (GLTF)** — assets.ts + carModel.ts; recolor per player; contact shadow; CC0 + CREDITS.
5. **Vegetation, rocks & landmarks** — scatter.ts seeded layout + InstancedMesh; trees/rocks/reeds +
   lighthouse/cottages.

---

## 6. Testing

- **TDD (pure, in `shared`):**
  - `rng.ts` — deterministic sequence for a seed; uniform-ish spread.
  - `scatter` layout — same seed → identical positions; **exclusion** honored (no prop within
    `roadWidth/2 + margin` of the road, none inside a water body, none out of bounds).
  - `waterBodies` collision — a car driven into a lake is pushed out (reuses `resolveCircle`).
  - `MAP` invariants — water bodies within bounds; terrain basin polygon contains the road.
- **Visual (per stage):** run the game and capture **in-engine screenshots** for review (the agreed
  "preview" medium), plus a two-client check that the world looks identical for both players.
- **Perf:** `web-games:web-optimization-checklist` + `webgl-audit`; confirm ~60 fps with 6 cars and the
  low-quality fallback.

---

## 7. Risks & Mitigations

- **Post-FX perf on weak GPUs** → quality scaling, half-res god-rays, reduced-motion, plain-render
  fallback.
- **GLTF recolor depends on model structure** → choose/prepare a model with a separable body
  material; fallback to a tint or vertex-color recolor; verify in Stage 4 before committing the asset.
- **Asset load failure / bundle size** → procedural placeholders on failure; keep GLBs small (optional
  Draco), load once and cache; loading screen covers latency.
- **Determinism drift** → all terrain/scatter from `shared` seeds; a test asserts no `Math.random` in
  world-gen by construction (pure functions take a seeded RNG).
- **Scope creep** → the Non-Goals list (esp. drivable terrain) is the guardrail; stages are independent.

---

## 8. Implementation note

Detailed, staged, TDD task breakdown comes next via the **writing-plans** skill. `CLAUDE.md` will gain
a short "Rendering & assets" section (module map, the determinism rule for world-gen, the asset/CREDITS
convention, the quality/reduced-motion settings).
