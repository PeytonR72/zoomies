import { describe, it, expect } from 'vitest';
import { scatterProps } from './scatter.js';
import { MAP, surfaceAt, isInBounds } from './index.js';

describe('scatterProps', () => {
  it('is deterministic for the world seed', () => {
    expect(scatterProps()).toEqual(scatterProps());
  });
  it('places nothing on the road, in water, or out of bounds', () => {
    for (const p of scatterProps()) {
      expect(isInBounds(p.x, p.z)).toBe(true);
      expect(surfaceAt(p.x, p.z)).toBe('grass');
      for (const w of MAP.waterBodies) {
        expect(Math.hypot(p.x - w.x, p.z - w.z)).toBeGreaterThan(w.radius);
      }
    }
  });
  it('assigns each prop a kind and a yaw', () => {
    const props = scatterProps();
    expect(props.length).toBeGreaterThan(20);
    for (const p of props) {
      expect(['tree', 'rock', 'reed']).toContain(p.kind);
      expect(p.yaw).toBeGreaterThanOrEqual(0);
    }
  });
});
