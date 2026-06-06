import type { Circle, Vec2 } from './types.js';
import { distanceToSegment } from './math.js';

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Checkpoint extends Circle {
  index: number; // ordered; race-ready, unused this phase
}

export interface MapDef {
  bounds: MapBounds;
  /** Closed loop polyline (last point connects back to first). */
  roadCenterline: Vec2[];
  roadWidth: number;
  /** Solid decorative obstacles (trees/rocks). */
  props: Circle[];
  /** Lakes — solid (car is pushed out) and rendered as water. */
  waterBodies: Circle[];
  /** Ordered checkpoints derived from the road; stored, not used yet. */
  checkpoints: Checkpoint[];
  /** Where new cars spawn (cycled by join order). */
  spawnPoints: Vec2[];
}

const v = (x: number, z: number): Vec2 => ({ x, z });

// A roughly rectangular road loop inside a 400 x 300 world, echoing the
// reference sketch (a big outer loop). Hand-authored; tune freely.
const centerline: Vec2[] = [
  v(-150, -90),
  v(150, -90),
  v(170, 0),
  v(150, 90),
  v(-150, 90),
  v(-170, 0),
];

export const MAP: MapDef = {
  bounds: { minX: -200, maxX: 200, minZ: -150, maxZ: 150 },
  roadCenterline: centerline,
  roadWidth: 16,
  props: [
    { x: 0, z: 0, radius: 6 }, // central tree cluster
    { x: -60, z: 30, radius: 4 },
    { x: 70, z: -25, radius: 4 },
    { x: 110, z: 40, radius: 5 },
    { x: -110, z: -40, radius: 5 },
  ],
  waterBodies: [
    { x: -70, z: 60, radius: 26 },
    { x: 95, z: -55, radius: 22 },
    { x: 140, z: 70, radius: 18 },
  ],
  checkpoints: centerline.map((p, index) => ({ x: p.x, z: p.z, radius: 10, index })),
  spawnPoints: [
    v(-150, -78),
    v(-120, -78),
    v(-90, -78),
    v(-60, -78),
    v(-30, -78),
    v(0, -78),
  ],
};

/** Distance from a point to the closed road polyline. */
function distanceToRoad(x: number, z: number): number {
  const pts = MAP.roadCenterline;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const d = distanceToSegment(x, z, a.x, a.z, b.x, b.z);
    if (d < best) best = d;
  }
  return best;
}

export function surfaceAt(x: number, z: number): 'road' | 'grass' {
  return distanceToRoad(x, z) <= MAP.roadWidth / 2 ? 'road' : 'grass';
}

export function isInBounds(x: number, z: number): boolean {
  const b = MAP.bounds;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}
