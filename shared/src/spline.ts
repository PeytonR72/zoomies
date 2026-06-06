import type { Vec2 } from './types.js';

/**
 * Catmull-Rom closed-loop sampler.
 * Returns `points.length * segmentsPerSpan` evenly spaced samples
 * along the smooth closed curve that passes through every control point.
 */
export function sampleClosedCatmullRom(points: Vec2[], segmentsPerSpan: number): Vec2[] {
  if (points.length < 4) throw new Error('Need at least 4 control points for a closed Catmull-Rom spline');
  const n = points.length;
  const result: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * t +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      result.push({ x, z });
    }
  }
  return result;
}
