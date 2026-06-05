import { describe, it, expect } from 'vitest';
import {
  FIXED_DT,
  TICK_HZ,
  SEND_RATE_HZ,
  MAX_SPEED,
  MAX_PLAYERS,
  PLAYER_COLORS,
} from './constants.js';

describe('constants', () => {
  it('fixed timestep matches tick rate', () => {
    expect(FIXED_DT).toBeCloseTo(1 / TICK_HZ, 6);
  });
  it('network send rate is slower than the sim tick', () => {
    expect(SEND_RATE_HZ).toBeLessThan(TICK_HZ);
  });
  it('has a distinct color per max player', () => {
    expect(PLAYER_COLORS.length).toBeGreaterThanOrEqual(MAX_PLAYERS);
    expect(new Set(PLAYER_COLORS).size).toBe(PLAYER_COLORS.length);
  });
  it('max speed is positive', () => {
    expect(MAX_SPEED).toBeGreaterThan(0);
  });
});
