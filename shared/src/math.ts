export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function length(x: number, z: number): number {
  return Math.hypot(x, z);
}

/** Shortest distance from point (px,pz) to segment (ax,az)-(bx,bz). */
export function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}
