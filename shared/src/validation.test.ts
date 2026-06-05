import { describe, it, expect } from 'vitest';
import { validateState } from './validation.js';
import { MAP } from './map.js';
import { MAX_SPEED, MAX_STEP_DISTANCE } from './constants.js';
import type { CarState } from './types.js';

const base: CarState = { x: 0, z: 0, heading: 0, vx: 0, vz: 0 };

describe('validateState', () => {
  it('passes a normal in-bounds update untouched', () => {
    const next = { ...base, x: 3, vz: 10 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(false);
    expect(r.state.x).toBeCloseTo(3);
  });
  it('clamps an out-of-bounds position', () => {
    const next = { ...base, x: MAP.bounds.maxX + 100 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(true);
    expect(r.state.x).toBeLessThan(MAP.bounds.maxX);
  });
  it('clamps impossible speed', () => {
    const next = { ...base, vx: MAX_SPEED * 10 };
    const r = validateState(base, next);
    expect(r.corrected).toBe(true);
    expect(Math.hypot(r.state.vx, r.state.vz)).toBeLessThanOrEqual(MAX_SPEED * 1.16);
  });
  it('rejects a teleport by keeping the previous position', () => {
    const prev = { ...base, x: 0, z: 0 };
    const next = { ...base, x: MAX_STEP_DISTANCE + 50, z: 0 };
    const r = validateState(prev, next);
    expect(r.corrected).toBe(true);
    expect(r.state.x).toBeCloseTo(prev.x);
  });
});
