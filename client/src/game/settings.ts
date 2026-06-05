export type Quality = 'high' | 'low';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Coarse quality pick: reduced-motion or a low device-memory hint → 'low'. */
export function detectQuality(): Quality {
  if (prefersReducedMotion()) return 'low';
  const mem = (navigator as { deviceMemory?: number } | undefined)?.deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return 'low';
  return 'high';
}
