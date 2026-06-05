import type { CarState, InputState, Surface } from './types.js';
import {
  ENGINE_ACCEL,
  REVERSE_ACCEL,
  BRAKE_DECEL,
  MAX_SPEED,
  MAX_REVERSE_SPEED,
  DRAG_ROAD,
  DRAG_GRASS,
  STEER_RATE,
  STEER_FULL_SPEED,
  GRIP_ROAD,
  GRIP_GRASS,
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

export function stepCar(car: CarState, input: InputState, surface: Surface, dt: number): CarState {
  // Decompose current velocity against current heading.
  let fx = Math.sin(car.heading);
  let fz = Math.cos(car.heading);
  let forward = car.vx * fx + car.vz * fz;
  let lx = car.vx - forward * fx;
  let lz = car.vz - forward * fz;

  // Longitudinal forces.
  if (input.throttle && !input.brake) {
    forward += ENGINE_ACCEL * dt;
  } else if (input.brake && !input.throttle) {
    forward -= forward > 0.1 ? BRAKE_DECEL * dt : REVERSE_ACCEL * dt;
  }
  const drag = surface === 'road' ? DRAG_ROAD : DRAG_GRASS;
  forward -= forward * drag * dt;
  forward = clamp(forward, -MAX_REVERSE_SPEED, MAX_SPEED);

  // Steering: authority scales with speed; flips when reversing.
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const spd = Math.hypot(car.vx, car.vz);
  if (steerInput !== 0 && spd > 0.2) {
    const authority = Math.min(spd, STEER_FULL_SPEED) / STEER_FULL_SPEED;
    const dir = forward >= 0 ? 1 : -1;
    car = { ...car, heading: car.heading + steerInput * STEER_RATE * authority * dir * dt };
    // Recompute basis after turning so the forward axis follows the new heading.
    fx = Math.sin(car.heading);
    fz = Math.cos(car.heading);
  }

  // Lateral grip: bleed sideways velocity toward zero (less on grass = more slide).
  const grip = surface === 'road' ? GRIP_ROAD : GRIP_GRASS;
  const lateralFactor = Math.max(0, 1 - grip * dt);
  lx *= lateralFactor;
  lz *= lateralFactor;

  // Recompose and integrate.
  const vx = forward * fx + lx;
  const vz = forward * fz + lz;
  return { x: car.x + vx * dt, z: car.z + vz * dt, heading: car.heading, vx, vz };
}
