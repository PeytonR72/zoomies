import { describe, it, expect } from 'vitest';
import { MAP, surfaceAt, isInBounds } from './map.js';
import { resolveCollisions } from './collision.js';
import { CAR_RADIUS } from './constants.js';
import { distanceToSegment } from './math.js';

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

describe('spawn points', () => {
  it('every spawn point is on the road', () => {
    for (const sp of MAP.spawnPoints) {
      expect(surfaceAt(sp.x, sp.z), `spawn (${sp.x}, ${sp.z}) should be road`).toBe('road');
    }
  });
});

describe('lake placement', () => {
  it('no lake overlaps the road (clearance > radius + roadWidth/2)', () => {
    const path = MAP.roadPath;
    const half = MAP.roadWidth / 2;
    for (const lake of MAP.waterBodies) {
      let minDist = Infinity;
      for (let i = 0; i < path.length; i++) {
        const a = path[i]!;
        const b = path[(i + 1) % path.length]!;
        const d = distanceToSegment(lake.x, lake.z, a.x, a.z, b.x, b.z);
        if (d < minDist) minDist = d;
      }
      expect(minDist, `lake at (${lake.x},${lake.z}) too close to road`).toBeGreaterThan(lake.radius + half);
    }
  });

  it('all lakes are inside world bounds', () => {
    for (const w of MAP.waterBodies) {
      expect(isInBounds(w.x - w.radius, w.z)).toBe(true);
      expect(isInBounds(w.x + w.radius, w.z)).toBe(true);
      expect(isInBounds(w.x, w.z - w.radius)).toBe(true);
      expect(isInBounds(w.x, w.z + w.radius)).toBe(true);
    }
  });
});

describe('water bodies', () => {
  it('defines lakes inside the world bounds', () => {
    expect(MAP.waterBodies.length).toBeGreaterThan(0);
    for (const w of MAP.waterBodies) {
      expect(isInBounds(w.x, w.z)).toBe(true);
      expect(w.radius).toBeGreaterThan(0);
    }
  });
  it('a car driven into a lake is pushed back out (water is solid)', () => {
    const w = MAP.waterBodies[0]!;
    const car = { x: w.x, z: w.z, heading: 0, vx: 0, vz: 0 };
    const out = resolveCollisions(car, [...MAP.props, ...MAP.waterBodies]);
    const dist = Math.hypot(out.x - w.x, out.z - w.z);
    expect(dist).toBeGreaterThanOrEqual(w.radius + CAR_RADIUS - 1e-6);
  });
});
