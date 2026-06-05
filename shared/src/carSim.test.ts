import { describe, it, expect } from 'vitest';
import { stepCar, spawnCar, speed } from './carSim.js';
import { MAX_SPEED, FIXED_DT, GRIP_ROAD, GRIP_GRASS } from './constants.js';
import type { InputState } from './types.js';

const THROTTLE: InputState = { throttle: true, brake: false, left: false, right: false };
const COAST: InputState = { throttle: false, brake: false, left: false, right: false };

function simulate(input: InputState, seconds: number) {
  let car = spawnCar(0, 0, 0);
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) car = stepCar(car, input, 'road', FIXED_DT);
  return car;
}

describe('carSim forward motion', () => {
  it('throttle accelerates the car forward (+Z at heading 0)', () => {
    const car = simulate(THROTTLE, 1);
    expect(car.z).toBeGreaterThan(1);
    expect(speed(car)).toBeGreaterThan(0);
  });
  it('speed never exceeds MAX_SPEED', () => {
    const car = simulate(THROTTLE, 10);
    expect(speed(car)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
  });
  it('coasting bleeds speed via drag', () => {
    let car = simulate(THROTTLE, 3);
    const fast = speed(car);
    for (let i = 0; i < Math.round(2 / FIXED_DT); i++) car = stepCar(car, COAST, 'road', FIXED_DT);
    expect(speed(car)).toBeLessThan(fast);
  });
  it('does not move from rest while coasting', () => {
    const car = simulate(COAST, 1);
    expect(speed(car)).toBeCloseTo(0, 5);
  });
});

const FWD_RIGHT: InputState = { throttle: true, brake: false, left: false, right: true };

describe('carSim steering + slip', () => {
  it('steering only turns the car while it is moving', () => {
    let parked = spawnCar(0, 0, 0);
    parked = stepCar(parked, { throttle: false, brake: false, left: false, right: true }, 'road', FIXED_DT);
    expect(parked.heading).toBeCloseTo(0, 6);
  });

  it('turns heading when moving and steering', () => {
    let car = spawnCar(0, 0, 0);
    for (let i = 0; i < Math.round(1 / FIXED_DT); i++) car = stepCar(car, FWD_RIGHT, 'road', FIXED_DT);
    expect(Math.abs(car.heading)).toBeGreaterThan(0.1);
  });

  it('grass retains more lateral velocity than road (slides more)', () => {
    // Seed a pure sideways velocity and let one step bleed it.
    const seed = { x: 0, z: 0, heading: 0, vx: 8, vz: 0 };
    const onRoad = stepCar(seed, { throttle: false, brake: false, left: false, right: false }, 'road', FIXED_DT);
    const onGrass = stepCar(seed, { throttle: false, brake: false, left: false, right: false }, 'grass', FIXED_DT);
    expect(Math.abs(onGrass.vx)).toBeGreaterThan(Math.abs(onRoad.vx));
  });
});

