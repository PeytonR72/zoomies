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
