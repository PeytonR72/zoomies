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
  `decode` validates the message TAG only — `party/server.ts` guards payload shape
  before use. One PartyKit room == one lobby, addressed by the room code (`generateRoomCode`).

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

## Status
- Plan 1 (foundation + single-player): see `docs/superpowers/plans/2026-06-04-zoomies-foundation.md`
- Plan 2 (multiplayer + deploy + polish): see `docs/superpowers/plans/2026-06-04-zoomies-multiplayer.md`
- Built + locally verified (two-client). Deploy (Plan 2 Tasks 12-13) pending user login.
