import { describe, it, expect } from 'vitest';
import { FixedStepper } from './loop.js';

describe('FixedStepper', () => {
  it('runs the correct number of fixed steps for elapsed time', () => {
    const stepper = new FixedStepper(1 / 60);
    let steps = 0;
    stepper.advance(0.05, () => steps++); // 0.05s / (1/60) = 3 steps
    expect(steps).toBe(3);
  });
  it('carries leftover time into the next advance', () => {
    const stepper = new FixedStepper(1 / 60);
    let steps = 0;
    stepper.advance(0.01, () => steps++); // < one step
    expect(steps).toBe(0);
    stepper.advance(0.01, () => steps++); // now 0.02 total -> 1 step
    expect(steps).toBe(1);
  });
  it('clamps a huge frame to avoid the spiral of death', () => {
    const stepper = new FixedStepper(1 / 60, 0.1);
    let steps = 0;
    stepper.advance(100, () => steps++);
    expect(steps).toBeLessThanOrEqual(6);
  });
});
