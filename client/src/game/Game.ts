import * as THREE from 'three';
import {
  FIXED_DT,
  SEND_RATE_HZ,
  INTERP_DELAY_MS,
  CAR_RADIUS,
  MAP,
  spawnCar,
  stepCar,
  resolveCollisions,
  resolveCircle,
  surfaceAt,
  type CarState,
} from '@zoomies/shared';
import { createWorld } from './world.js';
import { buildCarMesh, type CarMesh } from './carMesh.js';
import { buildNameTag } from './nameTag.js';
import { makeCamera, updateCamera } from './camera.js';
import { FixedStepper } from './loop.js';
import { Keyboard } from './input.js';
import { Interpolator } from './remote.js';
import type { NetClient } from '../net/client.js';

interface Remote {
  mesh: CarMesh;
  tag: THREE.Sprite;
  interp: Interpolator;
  lastPos: { x: number; z: number };
}

export interface GameOptions {
  color: string;
  net: NetClient;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private keyboard = new Keyboard();
  private detachInput: () => void;
  private stepper = new FixedStepper(FIXED_DT);
  private car: CarState;
  private carMesh: CarMesh;
  private net: NetClient;
  private remotes = new Map<string, Remote>();
  private sendAcc = 0;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: GameOptions,
  ) {
    this.net = opts.net;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();

    const world = createWorld();
    this.scene = world.scene;
    this.camera = makeCamera(canvas.clientWidth / canvas.clientHeight);

    const spawn = MAP.spawnPoints[Math.floor(Math.random() * MAP.spawnPoints.length)]!;
    this.car = spawnCar(spawn.x, spawn.z, 0);
    this.carMesh = buildCarMesh(opts.color);
    this.scene.add(this.carMesh.group);

    this.net.onSnapshot = (states, arrival) => this.ingestSnapshot(states, arrival);
    this.net.onCorrection = (car) => {
      this.car = { ...this.car, ...car }; // snap to server correction
    };

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
      this.maybeSend(elapsed);
      this.render(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private fixedStep(): void {
    const input = this.keyboard.state();
    const surface = surfaceAt(this.car.x, this.car.z);
    let next = stepCar(this.car, input, surface, FIXED_DT);
    next = resolveCollisions(next, MAP.props);
    // Soft-bump: push only our own car out of remotes' interpolated positions.
    const renderTime = performance.now() - INTERP_DELAY_MS;
    for (const r of this.remotes.values()) {
      const s = r.interp.sample(renderTime);
      if (s) next = resolveCircle(next, { x: s.x, z: s.z, radius: CAR_RADIUS });
    }
    this.car = next;
  }

  private maybeSend(elapsed: number): void {
    this.sendAcc += elapsed;
    const interval = 1 / SEND_RATE_HZ;
    if (this.sendAcc >= interval) {
      this.sendAcc = 0;
      this.net.sendState(this.car);
    }
  }

  private ingestSnapshot(states: Record<string, CarState>, arrival: number): void {
    for (const [id, s] of Object.entries(states)) {
      if (id === this.net.selfId) continue;
      let r = this.remotes.get(id);
      if (!r) r = this.spawnRemote(id);
      if (r) r.interp.push(arrival, s);
    }
  }

  private spawnRemote(id: string): Remote | undefined {
    const info = this.net.players.get(id);
    if (!info) return undefined;
    const mesh = buildCarMesh(info.color);
    const tag = buildNameTag(info.name, info.color);
    mesh.group.add(tag);
    this.scene.add(mesh.group);
    const r: Remote = { mesh, tag, interp: new Interpolator(), lastPos: { x: 0, z: 0 } };
    this.remotes.set(id, r);
    return r;
  }

  private render(now: number): void {
    this.carMesh.group.position.set(this.car.x, 0, this.car.z);
    this.carMesh.group.rotation.y = this.car.heading;

    const renderTime = now - INTERP_DELAY_MS;
    for (const [id, r] of this.remotes) {
      if (!this.net.players.has(id)) {
        this.scene.remove(r.mesh.group);
        this.remotes.delete(id);
        continue;
      }
      const s = r.interp.sample(renderTime);
      if (s) {
        r.mesh.group.position.set(s.x, 0, s.z);
        r.mesh.group.rotation.y = s.heading;
      }
    }

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
