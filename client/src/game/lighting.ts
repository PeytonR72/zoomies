import * as THREE from 'three';
import { PALETTE } from '@zoomies/shared';
import type { Quality } from './settings.js';

/** Warm hemisphere + sun key light with soft shadows. Returns the sun for god-rays. */
export function addLighting(scene: THREE.Scene, quality: Quality): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(PALETTE.skyHorizon, PALETTE.grassLow, 0.8));
  scene.add(new THREE.AmbientLight('#ffffff', 0.15));

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.25);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  // 1024 is sufficient for the top-down camera; 2048 doubled the shadow-map fill cost
  // with no visible quality gain at this viewing angle.
  const s = quality === 'high' ? 1024 : 512;
  sun.shadow.mapSize.set(s, s);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  const d = 220;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/** A cheap soft blob shadow that follows a car (grounding without per-car shadow maps). */
export function makeContactShadow(): THREE.Mesh {
  const tex = makeRadialTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.renderOrder = 1;
  return mesh;
}

function makeRadialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
