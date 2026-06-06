import type { Circle, Vec2 } from './types.js';
import { distanceToSegment } from './math.js';
import { sampleClosedCatmullRom } from './spline.js';

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
  /** Closed loop control points for the Catmull-Rom spline. */
  roadCenterline: Vec2[];
  /** Dense smooth polyline sampled from roadCenterline — use this for surfaceAt/scatter. */
  roadPath: Vec2[];
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

// Organic 8-point closed loop — clearly curvy, stays inside bounds with ample margin.
const centerline: Vec2[] = [
  v(-120, -110),
  v(  30, -130),
  v( 140,  -80),
  v( 160,   10),
  v( 110,  110),
  v( -30,  120),
  v(-140,   60),
  v(-160,  -40),
];

const SEGMENTS_PER_SPAN = 12;
const roadPath: Vec2[] = sampleClosedCatmullRom(centerline, SEGMENTS_PER_SPAN);

// Pick 6 evenly-spaced indices along roadPath for spawn points.
const totalPathPts = roadPath.length; // 96
const spawnIndices = [0, 16, 32, 48, 64, 80];

export const MAP: MapDef = {
  bounds: { minX: -200, maxX: 200, minZ: -150, maxZ: 150 },
  roadCenterline: centerline,
  roadPath,
  roadWidth: 16,
  props: [
    { x: 0,    z:  0,  radius: 6 }, // central tree cluster
    { x: -60,  z: 30,  radius: 4 },
    { x:  70,  z: -25, radius: 4 },
    { x: 110,  z: 40,  radius: 5 },
    { x: -110, z: -40, radius: 5 },
  ],
  waterBodies: [
    { x: -50, z:  40, radius: 22 },
    { x:  60, z:  60, radius: 20 },
    { x:  20, z: -50, radius: 18 },
  ],
  checkpoints: centerline.map((p, index) => ({ x: p.x, z: p.z, radius: 10, index })),
  spawnPoints: spawnIndices.map((idx) => roadPath[idx % totalPathPts]!),
};

/** Distance from a point to the closed road path (dense polyline). */
function distanceToRoad(x: number, z: number): number {
  const pts = MAP.roadPath;
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
