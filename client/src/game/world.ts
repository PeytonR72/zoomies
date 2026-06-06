import * as THREE from 'three';
import { MAP, PALETTE } from '@zoomies/shared';
import { addLighting } from './lighting.js';
import { createSky, createSunMesh } from './sky.js';
import { createWater, type Water } from './water.js';
import { createTerrain } from './terrain.js';
import { createScatter } from './scatter.js';
import type { Quality } from './settings.js';

export interface World {
  scene: THREE.Scene;
  sun: THREE.Mesh; // god-ray source
  water: Water;
}

export function createWorld(quality: Quality): World {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.skyHorizon, 260, 820);

  scene.add(createSky());
  const sunMesh = createSunMesh();
  scene.add(sunMesh);
  addLighting(scene, quality);

  // Terrain: low-poly heightfield (flat basin + hill ring).
  scene.add(createTerrain());
  scene.add(buildRoadMesh());
  // Scattered vegetation/rocks/reeds (instanced, from deterministic shared layout).
  // createScatter() uses the loaded GLTF assets; called after preloadAssets() resolves.
  scene.add(createScatter());
  const water = createWater(quality === 'high');
  scene.add(water.group);
  return { scene, sun: sunMesh, water };
}

function buildRoadMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const pts = MAP.roadCenterline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(MAP.roadWidth, len), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(dz, dx) + Math.PI / 2;
    seg.position.set((a.x + c.x) / 2, 0.02, (a.z + c.z) / 2);
    group.add(seg);
    // Round the corners with a disc so segments join cleanly.
    const joint = new THREE.Mesh(new THREE.CircleGeometry(MAP.roadWidth / 2, 12), mat);
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(a.x, 0.02, a.z);
    group.add(joint);
  }
  return group;
}
