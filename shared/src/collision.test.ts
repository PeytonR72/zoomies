import { describe, it, expect } from 'vitest';
import { resolveBounds, resolveCircle, resolveCollisions } from './collision.js';
import { MAP } from './map.js';
import { CAR_RADIUS } from './constants.js';
import type { CarState } from './types.js';

const at = (x: number, z: number, vx = 0, vz = 0): CarState => ({ x, z, heading: 0, vx, vz });

describe('collision', () => {
  it('clamps a car back inside the world bounds', () => {
    const out = resolveBounds(at(MAP.bounds.maxX + 10, 0, 5, 0));
    expect(out.x).toBeLessThanOrEqual(MAP.bounds.maxX - CAR_RADIUS + 1e-6);
    expect(out.vx).toBeLessThanOrEqual(0); // outward velocity removed
  });

  it('pushes a car out of an overlapping circle', () => {
    const obstacle = { x: 0, z: 0, radius: 5 };
    const out = resolveCircle(at(1, 0, -3, 0), obstacle);
    const dist = Math.hypot(out.x - obstacle.x, out.z - obstacle.z);
    expect(dist).toBeGreaterThanOrEqual(5 + CAR_RADIUS - 1e-6);
  });

  it('leaves a non-overlapping car unchanged', () => {
    const car = at(100, 100);
    const out = resolveCollisions(car, MAP.props);
    expect(out.x).toBeCloseTo(100);
    expect(out.z).toBeCloseTo(100);
  });
});
