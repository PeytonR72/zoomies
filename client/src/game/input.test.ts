import { describe, it, expect } from 'vitest';
import { Keyboard } from './input.js';

describe('Keyboard', () => {
  it('maps WASD and arrows to InputState', () => {
    const kb = new Keyboard();
    kb.handle('KeyW', true);
    kb.handle('KeyD', true);
    expect(kb.state()).toEqual({ throttle: true, brake: false, left: false, right: true });
    kb.handle('KeyW', false);
    expect(kb.state().throttle).toBe(false);
  });
  it('arrow keys mirror WASD', () => {
    const kb = new Keyboard();
    kb.handle('ArrowUp', true);
    kb.handle('ArrowLeft', true);
    expect(kb.state()).toEqual({ throttle: true, brake: false, left: true, right: false });
  });
});
