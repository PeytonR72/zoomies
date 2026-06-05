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
