import * as THREE from 'three';
import {
  FIXED_DT,
  MAP,
  spawnCar,
  stepCar,
  resolveCollisions,
  surfaceAt,
  type CarState,
} from '@zoomies/shared';
import { createWorld } from './world.js';
import { buildCarMesh, type CarMesh } from './carMesh.js';
import { makeCamera, updateCamera } from './camera.js';
import { FixedStepper } from './loop.js';
import { Keyboard } from './input.js';

export interface GameOptions {
  color: string;
}

/** Owns the canvas, render loop, and the local player's car. */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private keyboard = new Keyboard();
  private detachInput: () => void;
  private stepper = new FixedStepper(FIXED_DT);
  private car: CarState;
  private carMesh: CarMesh;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: GameOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();

    const world = createWorld();
    this.scene = world.scene;
    this.camera = makeCamera(canvas.clientWidth / canvas.clientHeight);

    const spawn = MAP.spawnPoints[0]!;
    this.car = spawnCar(spawn.x, spawn.z, 0);
    this.carMesh = buildCarMesh(opts.color);
    this.scene.add(this.carMesh.group);

    this.detachInput = this.keyboard.attach();
    window.addEventListener('resize', this.resize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const elapsed = (now - this.last) / 1000;
      this.last = now;
      this.stepper.advance(elapsed, () => this.fixedStep());
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fixedStep(): void {
    const input = this.keyboard.state();
    const surface = surfaceAt(this.car.x, this.car.z);
    let next = stepCar(this.car, input, surface, FIXED_DT);
    next = resolveCollisions(next, MAP.props);
    this.car = next;
  }

  private render(): void {
    this.carMesh.group.position.set(this.car.x, 0, this.car.z);
    this.carMesh.group.rotation.y = this.car.heading;
    updateCamera(this.camera, this.car.x, this.car.z);
    this.renderer.render(this.scene, this.camera);
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  };

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.detachInput();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
