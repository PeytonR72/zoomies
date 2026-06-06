import { WORLD_SEED, BASIN_HALF_X, BASIN_HALF_Z, HILL_MAX_HEIGHT } from './constants.js';
import { mulberry32, deriveSeed } from './rng.js';
import { clamp } from './math.js';

// Precompute a small value-noise lattice from the seed (deterministic, shared).
const N = 16;
const lattice: number[] = (() => {
  const r = mulberry32(deriveSeed(WORLD_SEED, 'terrain'));
  return Array.from({ length: N * N }, () => r());
})();

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  // sample the lattice over a 900-unit span, bilinear-smooth
  const u = ((x / 60) % N + N) % N;
  const v = ((z / 60) % N + N) % N;
  const x0 = Math.floor(u), z0 = Math.floor(v);
  const x1 = (x0 + 1) % N, z1 = (z0 + 1) % N;
  const fx = smooth(u - x0), fz = smooth(v - z0);
  const a = lattice[z0 * N + x0]!, b = lattice[z0 * N + x1]!;
  const c = lattice[z1 * N + x0]!, d = lattice[z1 * N + x1]!;
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

// A second, low-frequency lattice for grass colour variation (large organic patches).
const GP = 12; // lattice size — coarser = wider patches
const grassPatchLattice: number[] = (() => {
  const r = mulberry32(deriveSeed(WORLD_SEED, 'grassPatch'));
  return Array.from({ length: GP * GP }, () => r());
})();

function grassPatchNoise(x: number, z: number): number {
  // sample over a ~300-unit span so patches are broad
  const u = ((x / 75) % GP + GP) % GP;
  const v = ((z / 75) % GP + GP) % GP;
  const x0 = Math.floor(u), z0 = Math.floor(v);
  const x1 = (x0 + 1) % GP, z1 = (z0 + 1) % GP;
  const fx = smooth(u - x0), fz = smooth(v - z0);
  const a = grassPatchLattice[z0 * GP + x0]!,
    b = grassPatchLattice[z0 * GP + x1]!;
  const c = grassPatchLattice[z1 * GP + x0]!,
    d = grassPatchLattice[z1 * GP + x1]!;
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

/** Grass colour variation noise in [0,1]: low-frequency organic patchiness. Pure + deterministic. */
export function grassColorNoise(x: number, z: number): number {
  // Blend two octaves: coarse patch + fine detail, weighted 70/30
  return grassPatchNoise(x, z) * 0.7 + valueNoise(x, z) * 0.3;
}

/** Decorative height: 0 inside the basin, ramping to hills outside. Pure + deterministic. */
export function heightAt(x: number, z: number): number {
  // distance outside the basin rectangle (0 inside)
  const dx = Math.max(0, Math.abs(x) - BASIN_HALF_X);
  const dz = Math.max(0, Math.abs(z) - BASIN_HALF_Z);
  const outside = Math.hypot(dx, dz);
  if (outside <= 0) return 0;
  const ramp = clamp(outside / 120, 0, 1); // reach full height ~120 units out
  return smooth(ramp) * HILL_MAX_HEIGHT * (0.55 + 0.45 * valueNoise(x, z));
}
