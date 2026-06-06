import { describe, it, expect } from 'vitest';
import { sampleClosedCatmullRom } from './spline.js';

const square = [
  { x: -1, z: -1 },
  { x:  1, z: -1 },
  { x:  1, z:  1 },
  { x: -1, z:  1 },
];

describe('sampleClosedCatmullRom', () => {
  it('returns points.length * segmentsPerSpan samples', () => {
    const result = sampleClosedCatmullRom(square, 8);
    expect(result.length).toBe(4 * 8);
  });

  it('first sample is approximately at the first control point', () => {
    const result = sampleClosedCatmullRom(square, 12);
    expect(result[0]!.x).toBeCloseTo(square[0]!.x, 5);
    expect(result[0]!.z).toBeCloseTo(square[0]!.z, 5);
  });

  it('passes through each control point at index i*segmentsPerSpan', () => {
    const N = 10;
    const result = sampleClosedCatmullRom(square, N);
    for (let i = 0; i < square.length; i++) {
      const sample = result[i * N]!;
      expect(sample.x).toBeCloseTo(square[i]!.x, 5);
      expect(sample.z).toBeCloseTo(square[i]!.z, 5);
    }
  });

  it('consecutive samples are close (continuity check)', () => {
    const result = sampleClosedCatmullRom(square, 20);
    for (let i = 0; i < result.length; i++) {
      const a = result[i]!;
      const b = result[(i + 1) % result.length]!;
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      expect(dist).toBeLessThan(1.5); // no teleports
    }
  });

  it('throws for fewer than 4 control points', () => {
    expect(() => sampleClosedCatmullRom([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], 5)).toThrow();
  });
});
