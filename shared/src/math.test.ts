import { describe, it, expect } from 'vitest';
import { length, clamp, distanceToSegment } from './math.js';

describe('math', () => {
  it('length of (3,4) is 5', () => {
    expect(length(3, 4)).toBeCloseTo(5);
  });
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('distance from point to a segment uses the nearest point on the segment', () => {
    // segment along x-axis from (0,0) to (10,0); point above the middle
    expect(distanceToSegment(5, 4, 0, 0, 10, 0)).toBeCloseTo(4);
    // point beyond the end clamps to the endpoint
    expect(distanceToSegment(13, 0, 0, 0, 10, 0)).toBeCloseTo(3);
  });
});
