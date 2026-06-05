import { describe, it, expect } from 'vitest';
import { mulberry32, randRange, deriveSeed } from './rng.js';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('produces values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('randRange maps into [min,max)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = randRange(r, -5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });
  it('derived seeds differ per subsystem but are stable', () => {
    expect(deriveSeed(100, 'terrain')).toBe(deriveSeed(100, 'terrain'));
    expect(deriveSeed(100, 'terrain')).not.toBe(deriveSeed(100, 'scatter'));
  });
});
