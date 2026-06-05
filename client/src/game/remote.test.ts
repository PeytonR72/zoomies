import { describe, it, expect } from 'vitest';
import { Interpolator } from './remote.js';
import type { CarState } from '@zoomies/shared';

const car = (x: number, z: number, heading = 0): CarState => ({ x, z, heading, vx: 0, vz: 0 });

describe('Interpolator', () => {
  it('lerps position between two timed samples', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0));
    it_.push(100, car(10, 20));
    const s = it_.sample(50)!;
    expect(s.x).toBeCloseTo(5);
    expect(s.z).toBeCloseTo(10);
  });
  it('returns the latest sample when asked beyond the buffer', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0));
    it_.push(100, car(10, 0));
    expect(it_.sample(999)!.x).toBeCloseTo(10);
  });
  it('takes the shortest path when interpolating heading across the ±π seam', () => {
    const it_ = new Interpolator();
    it_.push(0, car(0, 0, -Math.PI + 0.1));
    it_.push(100, car(0, 0, Math.PI - 0.1));
    const h = it_.sample(50)!.heading;
    // Should be near ±π, NOT near 0 (which is the long way around).
    expect(Math.abs(Math.abs(h) - Math.PI)).toBeLessThan(0.2);
  });
  it('returns null when empty', () => {
    expect(new Interpolator().sample(0)).toBeNull();
  });
});
