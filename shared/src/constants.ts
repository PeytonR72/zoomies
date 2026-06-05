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
