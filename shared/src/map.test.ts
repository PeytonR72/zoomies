import { describe, it, expect } from 'vitest';
import { MAP, surfaceAt, isInBounds } from './map.js';

describe('map', () => {
  it('has a closed road centerline and ordered checkpoints', () => {
    expect(MAP.roadCenterline.length).toBeGreaterThan(3);
    expect(MAP.checkpoints.length).toBeGreaterThan(0);
    MAP.checkpoints.forEach((c, i) => expect(c.index).toBe(i));
  });
  it('a point on the centerline is road; a point far away is grass', () => {
    const p = MAP.roadCenterline[0]!;
    expect(surfaceAt(p.x, p.z)).toBe('road');
    expect(surfaceAt(MAP.bounds.maxX - 1, MAP.bounds.maxZ - 1)).toBe('grass');
  });
  it('bounds check rejects points outside the world', () => {
    expect(isInBounds(0, 0)).toBe(true);
    expect(isInBounds(MAP.bounds.maxX + 50, 0)).toBe(false);
  });
});
