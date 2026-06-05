# Zoomies — Multiplayer Driving Game (MVP Design)

**Date:** 2026-06-04
**Status:** Approved (design); pending implementation plan
**Phase:** "Lay the basis" — the playable, deployed foundation that powerups, drifting, and mouse controls build on later.

---

## 1. Summary

Zoomies is a cute, low-poly, browser-based **online multiplayer free-roam driving game**. A player
enters a name, picks a car color, and either creates a lobby (getting a short shareable code) or joins
a friend's lobby by code. Up to **6 players** share one hand-authored world and drive recolorable
low-poly cars with **WASD**. The camera is top-down at a slight angle and follows the player's own car.
Cars **soft-bump** each other.

The visual direction follows the supplied references: the low-poly "Tiny Skies" world look and the
low-poly car render (clean flat-shaded geometry, bright recolorable bodies). The camera frames roughly
the area shown by the red rectangle on the reference map sketch.

This phase deliberately stops at a polished, deployed free-roam foundation. It is built so that laps,
powerups, and drifting are **additive** later, not rewrites.

---

## 2. Goals & Non-Goals

### Goals (this phase)
- Free-roam driving in a shared world, up to 6 concurrent players per lobby.
- Name entry + create/join lobby by short code. No accounts.
- WASD arcade driving with light lateral slip; road vs grass surfaces change grip.
- Soft-bump car-to-car collision.
- Angled top-down follow camera.
- Procedurally-built, per-player recolorable low-poly cars and world props (no asset files).
- Hybrid netcode: each client simulates its own car; server validates and relays.
- Deployed: client on Vercel, realtime server on PartyKit cloud.
- A high-quality `CLAUDE.md`.

### Non-Goals (explicitly deferred — structure for them, don't build them)
- Powerups and mouse-based controls.
- Drifting mechanics (the slip model leaves a clean hook for it).
- Laps, checkpoints logic, scoring, race results (the *data* exists; the *logic* does not).
- Public matchmaking / solo public servers.
- Accounts, persistence, databases.
- Mobile / touch controls.
- Audio / music / SFX.

### Definition of Done
Two or more browsers join the same lobby code; each player drives their own car with WASD and sees the
others moving smoothly in near-real-time; cars gently bump on contact; grass slows/loosens the car
relative to road; a 7th joiner is rejected as "lobby full"; and the whole thing runs from a deployed
Vercel client talking to a deployed PartyKit server.

---

## 3. Decisions (locked during brainstorming)

| Topic | Decision | Rationale |
|---|---|---|
| Core loop | **Free-roam now, race-ready data** | Lowest-risk base; lap layer drops in later without rework. |
| Authority | **Hybrid: client-sim + server-validated relay** | Zero input latency on own car; server clamps/rejects cheating; far less code than full server sim. |
| Car feel | **Arcade with light slip** | Responsive + cute; lateral-velocity term is the future drift hook. |
| Car collision | **Soft bump** | Bumper-car fun; each client moves only its own car, so it stays stable under hybrid authority. |
| Terrain | **Flat ground + surface types** | Road (grippy/fast) vs grass (slow/slip); no terrain-conform physics cost. |
| Obstacles | **Solid circular props + invisible world boundary** | Cheap, robust collision; keeps players in the play area. |
| Assets | **Procedural Three.js geometry** | No asset pipeline; instant per-player recolor; trivial iteration. |
| Render arch | **Raw Three.js scene + React for UI only** | Predictable perf, no reconciler in the hot loop, clean separation. |
| Framework | **Vite SPA (React + TS)** | Right tool for a client-only WebGL game; trivial static deploy to Vercel. |
| Server | **PartyKit, one room per lobby** | Purpose-built realtime rooms; lobby == room maps perfectly. |
| Deploy | **Client → Vercel, server → PartyKit cloud** | Shareable URLs from the start. |

---

## 4. Architecture

### 4.1 Repo (monorepo)

```
zoomies/
  client/                Vite + React + TS app
    src/
      game/              imperative game loop & 3D world (owns per-frame work)
        loop.ts          fixed-timestep accumulator + render tick
        world.ts         scene, ground, road, props, lighting
        car.ts           car mesh builder (recolorable) + visual state
        carSim.ts        pure physics step (shared-consts driven)
        camera.ts        angled top-down follow camera
        remote.ts        interpolation buffer for other players' cars
        input.ts         WASD -> input state
        collision.ts     circle collision: world bounds, props, soft-bump
      net/
        client.ts        PartyKit socket; connect, send, receive
        protocol.ts      (de)serialization using shared message types
      ui/                React overlay (no Three.js here)
        screens/         Landing (name+color+create/join), Lobby-full, Error
        hud/             room code, player list, controls hint, connection status
        App.tsx          app state machine: landing -> connecting -> playing
      main.tsx
    index.html
    vite.config.ts
  party/                 PartyKit server (TS)
    server.ts            room lifecycle, roster, validate + relay
  shared/                imported by BOTH client and server
    types.ts             message schemas, player/car state shapes
    constants.ts         map dims, tick rates, physics consts, validation limits
    map.ts               the hand-authored map definition (incl. race-ready data)
  CLAUDE.md
  package.json           workspaces: client, party, shared
  docs/superpowers/specs/2026-06-04-zoomies-driving-game-design.md
```

**Key discipline:** physics constants and validation limits live **only** in `shared/constants.ts`, so
the client's local simulation and the server's validation are guaranteed to agree. Divergence here is
the classic source of "server keeps correcting me" bugs.

### 4.2 Client runtime model
- One **imperative game loop** (`requestAnimationFrame` + fixed-timestep accumulator) owns: input
  sampling, local car simulation, collision, camera, remote-car interpolation, and rendering.
- **React owns only 2D UI** (overlay DOM/HTML). React state changes (e.g., roster updates) flow in from
  the net layer via a small event/store boundary; React never touches Three.js objects.
- The net layer is the only bridge: it pushes roster/UI data to React and snapshot data to the game loop.

---

## 5. World

- **Single fixed, hand-authored map** defined in `shared/map.ts`, sized for 6 players and roughly 4–6×
  the area the camera frames at once.
- **Ground:** flat plane. **Surfaces:** `road` and `grass`, resolved from world position (road described
  by the centerline spline + width; everything else is grass). Surface sets the grip factor used by the
  car sim.
- **Props:** low-poly trees / rocks / water-edge markers as **solid circles** (center + radius) for
  collision; rendered as procedural geometry.
- **World boundary:** an invisible bounds rectangle/loop; the car cannot leave it (clamped + soft push
  back). Also used server-side for validation.
- **Race-ready data (stored, unused this phase):** the road centerline **spline** and an **ordered list
  of checkpoint volumes**. A future lap system reads these; nothing this phase depends on them.

All geometry is procedural Three.js (flat-shaded `MeshStandardMaterial`/`MeshLambert`-style look),
recoloring car bodies via material color so each player is visually distinct.

---

## 6. Car Simulation & Feel

Model: **arcade with light slip**, fixed-timestep (target 60 Hz internal step via accumulator).

Per-car state: `position (x,z)`, `heading (yaw)`, `forwardVelocity`, `lateralVelocity`, plus the current
`input` (throttle, brake/reverse, steerLeft, steerRight).

Per step:
1. Throttle/brake apply engine force along `heading`; reverse when stopped + brake held.
2. Steering rotates `heading`, scaled by current speed (no turning when parked).
3. Movement adds a small `lateralVelocity` (the slide); each step **bleeds lateral velocity by a grip
   factor** that is **higher on road, lower on grass** (more slide on grass).
4. Friction decays velocity when coasting; speed clamped to `MAX_SPEED`.

The lateral-velocity term + grip factor is the explicit **drift hook**: a future handbrake/powerup
lowers grip to make the car slide intentionally.

**Soft-bump collision** (`collision.ts`):
- All cars and props are circles.
- The local client checks **its own** car against props, world bounds, and the **interpolated** positions
  of other cars.
- On overlap with another car, apply a **separating impulse to the local car only** (push out along the
  contact normal + a little velocity damping). Both clients do this independently, producing mutual
  push-off without any networked collision resolution.
- Slight positional disagreement between the two clients is acceptable for "soft bump" and is smoothed by
  interpolation on the receiving side.

---

## 7. Netcode

**Model:** hybrid — client-authoritative simulation of *own* car, server-validated relay.

### 7.1 Flow
1. **Local car:** simulated locally every frame from sampled input → zero perceived input latency.
2. **Uplink:** client sends its car state (position, heading, forward + lateral velocity, input flags) to
   the server at **~15–20 Hz** (`SEND_RATE_HZ` in shared constants).
3. **Server validation** (`party/server.ts`): for each incoming update, clamp to world bounds and reject
   physically impossible deltas (exceeds `MAX_SPEED` + tolerance, or a teleport jump larger than possible
   for the elapsed time). Store last-good validated state per player.
4. **Broadcast:** server sends the validated roster state to all clients at its broadcast rate.
5. **Correction:** if an update is rejected, the server echoes the last-good/clamped state back; the
   offending client **snaps** its local car to the correction.
6. **Remote rendering:** each client renders *other* players from an **interpolation buffer** ~100 ms
   behind real-time (`INTERP_DELAY_MS`), lerping position/heading between the two newest snapshots so
   15–20 Hz packets look smooth.

The local player's own car is **never** interpolated — it's the local sim, only ever corrected by an
explicit server rejection.

### 7.2 Server responsibilities
- One PartyKit **room == one lobby**, addressed by the room id (the share code).
- Maintain the **roster** (id, name, color, join order) and the last validated car state per player.
- Enforce **max 6 players**; reject the 7th with a "lobby full" close/﻿message.
- Broadcast join/leave roster events to drive the React HUD.
- **Ephemeral:** no database; when the room empties, state is gone.

### 7.3 Messages (shapes live in `shared/types.ts`)
- Client→Server: `join {name, color}`, `state {car fields}`, `leave` (implicit on disconnect).
- Server→Client: `welcome {selfId, roster, map seed/version}`, `roster {players}`, `snapshot {states}`,
  `correction {state}`, `full`.

Exact rates, buffer length, timeout/idle handling, and the precise validation tolerances will be
finalized during planning using the `multiplayer:netcode-brief` and `multiplayer:network-spec` skills,
and the protocol reviewed by the `netcode-specialist` / `network-architect` subagents.

---

## 8. Lobby, Identity & UI

### 8.1 Flow
- **Landing screen:** name input (1–12 chars, required) + **color picker** (6-swatch palette; defaults to
  the next free color) + **Create lobby** or **Join by code**.
- **Create** → client opens a PartyKit room with a freshly generated **short code** (e.g., 4 uppercase
  letters), and is dropped straight into the world.
- **Join** → client connects to the entered code's room. If full → "lobby full" screen with a back action.
- **Drop-in/drop-out free-roam:** no host and no "start game" gate. Joining the code means you're driving.

### 8.2 UI (React overlay)
- **HUD:** copyable room code, player list (name + color dot, self highlighted), WASD controls hint,
  connection/status indicator.
- **In-world:** floating **name tags above each car** (billboarded), colored to match the car.
- Minimap is **out of scope** here; the hand-drawn reference map is the natural seed for it later.

---

## 9. Tech Stack

- **Client:** Vite + React + TypeScript (strict). Raw **Three.js** for the 3D scene; React only for the
  2D overlay. PartyKit client SDK for networking.
- **Server:** **PartyKit** (TypeScript), one room per lobby.
- **Shared:** a `shared/` workspace of pure TS (types + constants + map) imported by both sides.
- **Tooling:** ESLint + Prettier; **Vitest** for unit tests. Highest-value unit targets are the pure
  pieces: `carSim.ts`, `collision.ts`, server validation, and message (de)serialization.
- **Config:** PartyKit host comes from an env var (`.env` locally → Vercel env in prod).

---

## 10. Deployment

- **Client:** static Vite build deployed to **Vercel**.
- **Server:** deployed to **PartyKit cloud**.
- The client reads the PartyKit host/URL from an environment variable so local dev and production differ
  only by config.
- Repo is structured so deploy is a thin final step, but real deployment is part of this phase's DoD.

---

## 11. Testing Strategy

- **TDD on pure logic:** `carSim` step behavior (accelerates, clamps to max speed, grass slips more than
  road), `collision` (separating impulse pushes out of overlap; bounds clamp; prop blocking), server
  **validation** (clamps out-of-bounds, rejects impossible jumps), and protocol **serialization**
  round-trips.
- **Manual / integration:** two browser tabs on one lobby code → both cars visible and smoothly
  interpolated; bump behavior; surface grip difference; 7th-joiner rejection. Optionally automated later
  with the Playwright MCP.
- Perf and WebGL compatibility checks via the `web-games` skills during the polish stage.

---

## 12. Implementation Plan Preview (stages)

The detailed plan comes from the **writing-plans** skill next. Anticipated stages:

1. **Scaffold:** monorepo + workspaces, Vite client, PartyKit server, shared package, lint/format/test,
   deploy skeleton (Vercel + PartyKit) wired to a trivial "hello".
2. **Shared core:** types, constants, map definition (incl. race-ready spline + checkpoints data).
3. **Single-player world:** Three.js scene, ground/road/props, procedural recolorable car, angled follow
   camera, WASD input, `carSim` + `collision` (no network). TDD the pure pieces.
4. **Lobby:** PartyKit room, join-by-code, name+color, roster, max-6 / lobby-full, React landing + HUD.
5. **State sync:** uplink at send-rate, snapshots, remote interpolation buffer, name tags.
6. **Validation + soft-bump online:** server clamps/rejects + corrections; soft-bump vs interpolated
   remotes.
7. **Polish:** game feel (`juice` skills), web perf/WebGL (`web-games`), accessibility pass
   (`accessibility`).
8. **Deploy:** Vercel + PartyKit production, env wiring, smoke test.

**`CLAUDE.md` is an explicit deliverable** (architecture map, dev/build/deploy commands, the
shared-constants rule, netcode invariants, project conventions, known gotchas), created early and kept
current.

**Subagents/skills to leverage:** `multiplayer` (netcode-brief, network-spec, rpc-design + netcode/
network-architect agents) for the protocol; `juice` for feel; `web-games` for perf/WebGL/compat;
`accessibility` for an inclusive pass; `frontend-design` for the landing/HUD polish.

---

## 13. Risks & Mitigations

- **Client-sim cheating** — accepted for friends-only MVP; mitigated by server clamping/rejection and
  fully addressable later by moving toward server-authoritative sim (the shared `carSim` makes that a
  smaller jump).
- **Interpolation jitter / rubber-banding** — keep a single source of physics constants, tune
  `INTERP_DELAY_MS` and send rate, never interpolate the local car.
- **Soft-bump disagreement between peers** — bounded by "each client moves only its own car"; acceptable
  visual divergence for gentle bumps, smoothed by interpolation.
- **Scope creep from deferred features** — the Non-Goals list is the guardrail; race/powerup/drift hooks
  are data/parameters only this phase.
