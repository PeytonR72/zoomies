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
