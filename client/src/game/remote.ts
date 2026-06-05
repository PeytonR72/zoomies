import type { CarState } from '@zoomies/shared';

interface Sample {
  time: number;
  car: CarState;
}

/** Shortest angular interpolation between two yaw angles. */
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Timed sample buffer for one remote car; sample() lerps to a render time. */
export class Interpolator {
  private buf: Sample[] = [];
  private readonly maxSamples = 20;

  push(time: number, car: CarState): void {
    this.buf.push({ time, car });
    if (this.buf.length > this.maxSamples) this.buf.shift();
  }

  sample(renderTime: number): CarState | null {
    if (this.buf.length === 0) return null;
    if (this.buf.length === 1) return this.buf[0]!.car;

    const last = this.buf[this.buf.length - 1]!;
    if (renderTime >= last.time) return last.car;
    const first = this.buf[0]!;
    if (renderTime <= first.time) return first.car;

    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i]!;
      const b = this.buf[i + 1]!;
      if (renderTime >= a.time && renderTime <= b.time) {
        const span = b.time - a.time || 1;
        const t = (renderTime - a.time) / span;
        return {
          x: a.car.x + (b.car.x - a.car.x) * t,
          z: a.car.z + (b.car.z - a.car.z) * t,
          heading: lerpAngle(a.car.heading, b.car.heading, t),
          vx: b.car.vx,
          vz: b.car.vz,
        };
      }
    }
    return last.car;
  }
}
