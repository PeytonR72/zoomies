import type { CarState, Circle } from './types.js';
import { MAP } from './map.js';
import { CAR_RADIUS } from './constants.js';

/** Keep the car inside the world rectangle; remove velocity pointing outward. */
export function resolveBounds(car: CarState): CarState {
  const b = MAP.bounds;
  let { x, z, vx, vz } = car;
  if (x < b.minX + CAR_RADIUS) {
    x = b.minX + CAR_RADIUS;
    vx = Math.max(0, vx);
  } else if (x > b.maxX - CAR_RADIUS) {
    x = b.maxX - CAR_RADIUS;
    vx = Math.min(0, vx);
  }
  if (z < b.minZ + CAR_RADIUS) {
    z = b.minZ + CAR_RADIUS;
    vz = Math.max(0, vz);
  } else if (z > b.maxZ - CAR_RADIUS) {
    z = b.maxZ - CAR_RADIUS;
    vz = Math.min(0, vz);
  }
  return { ...car, x, z, vx, vz };
}

/**
 * Push the car out of `obstacle` if overlapping, moving the CAR only (along the
 * contact normal) and damping the inward velocity component. Used for props and,
 * in Plan 2, for soft-bumping other cars (each client moves only its own car).
 */
export function resolveCircle(car: CarState, obstacle: Circle, selfRadius = CAR_RADIUS): CarState {
  const dx = car.x - obstacle.x;
  const dz = car.z - obstacle.z;
  const dist = Math.hypot(dx, dz);
  const minDist = obstacle.radius + selfRadius;
  if (dist >= minDist) return car;

  // Normal from obstacle to car (pick an arbitrary axis if exactly concentric).
  const nx = dist > 1e-6 ? dx / dist : 1;
  const nz = dist > 1e-6 ? dz / dist : 0;
  const push = minDist - dist;

  const x = car.x + nx * push;
  const z = car.z + nz * push;

  // Remove the inward (negative along normal) velocity component, damped.
  const vAlong = car.vx * nx + car.vz * nz;
  let vx = car.vx;
  let vz = car.vz;
  if (vAlong < 0) {
    vx -= vAlong * nx;
    vz -= vAlong * nz;
  }
  return { ...car, x, z, vx, vz };
}

/** Resolve the car against the world bounds and every obstacle in `obstacles`. */
export function resolveCollisions(car: CarState, obstacles: Circle[]): CarState {
  let out = resolveBounds(car);
  for (const o of obstacles) out = resolveCircle(out, o);
  return out;
}
