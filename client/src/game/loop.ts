/** Fixed-timestep accumulator. Decouples physics rate from frame rate. */
export class FixedStepper {
  private acc = 0;
  constructor(
    private readonly dt: number,
    private readonly maxFrame = 0.1,
  ) {}

  /** Add elapsed seconds; invoke `step` once per whole fixed dt. */
  advance(elapsed: number, step: () => void): void {
    this.acc += Math.min(elapsed, this.maxFrame);
    while (this.acc >= this.dt) {
      step();
      this.acc -= this.dt;
    }
  }
}
