import type { InputState } from '@zoomies/shared';

/** Tracks pressed keys and projects them to an InputState. Pure-ish + DOM bind. */
export class Keyboard {
  private down = new Set<string>();

  handle(code: string, pressed: boolean): void {
    if (pressed) this.down.add(code);
    else this.down.delete(code);
  }

  state(): InputState {
    const has = (...codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      throttle: has('KeyW', 'ArrowUp'),
      brake: has('KeyS', 'ArrowDown'),
      left: has('KeyA', 'ArrowLeft'),
      right: has('KeyD', 'ArrowRight'),
    };
  }

  /** Attach to window; returns a detach function. */
  attach(target: Window = window): () => void {
    const onDown = (e: KeyboardEvent) => {
      this.handle(e.code, true);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => this.handle(e.code, false);
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    return () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
    };
  }
}
