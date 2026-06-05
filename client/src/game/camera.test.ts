import { describe, it, expect } from 'vitest';
import { cameraTarget } from './camera.js';

describe('cameraTarget', () => {
  it('positions the camera up and behind (−Z) the car for an angled top-down view', () => {
    const { pos, look } = cameraTarget(0, 0);
    expect(pos.y).toBeGreaterThan(20); // high up
    expect(pos.z).toBeLessThan(0); // pulled back along −Z
    expect(look.x).toBeCloseTo(0);
    expect(look.z).toBeCloseTo(0);
  });
  it('follows the car position', () => {
    const { pos } = cameraTarget(100, 50);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.z).toBeCloseTo(50 - 40); // offset back from the car
  });
});
