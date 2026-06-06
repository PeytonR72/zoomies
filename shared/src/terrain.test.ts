import { describe, it, expect } from 'vitest';
import { heightAt } from './terrain.js';
import { BASIN_HALF_X, BASIN_HALF_Z, HILL_MAX_HEIGHT } from './constants.js';

describe('terrain heightAt', () => {
  it('is flat (≈0) inside the drivable basin', () => {
    expect(Math.abs(heightAt(0, 0))).toBeLessThan(0.01);
    expect(Math.abs(heightAt(BASIN_HALF_X * 0.5, BASIN_HALF_Z * 0.5))).toBeLessThan(0.01);
  });
  it('rises outside the basin and is deterministic', () => {
    const h = heightAt(BASIN_HALF_X + 120, 0);
    expect(h).toBeGreaterThan(2);
    expect(h).toBeLessThanOrEqual(HILL_MAX_HEIGHT + 1e-6);
    expect(heightAt(BASIN_HALF_X + 120, 0)).toBe(h); // deterministic
  });
});
