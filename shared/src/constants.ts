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
