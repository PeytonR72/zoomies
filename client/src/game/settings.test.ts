import { describe, it, expect, vi } from 'vitest';
import { detectQuality } from './settings.js';

describe('detectQuality', () => {
  it('returns low when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }));
    expect(detectQuality()).toBe('low');
  });
  it('returns high by default', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(detectQuality()).toBe('high');
  });
});
