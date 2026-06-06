import { MAP, surfaceAt, isInBounds } from './map.js';
import { distanceToSegment } from './math.js';
import { mulberry32, deriveSeed, randRange } from './rng.js';
import {
  WORLD_SEED, SCATTER_TARGET_COUNT, SCATTER_ROAD_MARGIN, SCATTER_WATER_MARGIN,
} from './constants.js';

export type PropKind = 'tree' | 'rock' | 'reed';
export interface ScatterProp { x: number; z: number; kind: PropKind; yaw: number; scale: number }

function nearRoad(x: number, z: number, margin: number): boolean {
  const pts = MAP.roadPath;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    if (distanceToSegment(x, z, a.x, a.z, b.x, b.z) <= MAP.roadWidth / 2 + margin) return true;
  }
  return false;
}

function inWater(x: number, z: number, margin: number): boolean {
  return MAP.waterBodies.some((w) => Math.hypot(x - w.x, z - w.z) <= w.radius + margin);
}

/** Deterministic prop placement (trees/rocks/reeds) honoring all exclusions. */
export function scatterProps(): ScatterProp[] {
  const rng = mulberry32(deriveSeed(WORLD_SEED, 'scatter'));
  const b = MAP.bounds;
  const out: ScatterProp[] = [];
  for (let i = 0; i < SCATTER_TARGET_COUNT; i++) {
    const x = randRange(rng, b.minX + 4, b.maxX - 4);
    const z = randRange(rng, b.minZ + 4, b.maxZ - 4);
    const kind: PropKind = rng() < 0.7 ? 'tree' : rng() < 0.6 ? 'rock' : 'reed';
    const yaw = randRange(rng, 0, Math.PI * 2);
    const scale = randRange(rng, 0.8, 1.4);
    if (!isInBounds(x, z)) continue;
    if (surfaceAt(x, z) !== 'grass') continue;
    if (nearRoad(x, z, SCATTER_ROAD_MARGIN)) continue;
    if (inWater(x, z, SCATTER_WATER_MARGIN)) continue;
    out.push({ x, z, kind, yaw, scale });
  }
  return out;
}
