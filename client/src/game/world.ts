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
  const mat = new THREE.MeshLambertMaterial({ color: PALETTE.road, side: THREE.DoubleSide });
  const path = MAP.roadPath;
  const n = path.length;
  const hw = MAP.roadWidth / 2;

  // Build one merged BufferGeometry ribbon (2 vertices per path point, one quad per segment).
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % n]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    // perpendicular (right-hand)
    const px = (dz / len) * hw;
    const pz = (-dx / len) * hw;

    const base = i * 2;
    // Left and right of point a
    positions.push(a.x - px, 0.02, a.z - pz);
    positions.push(a.x + px, 0.02, a.z + pz);

    // quad: connect to NEXT pair (wraps to close the loop)
    const nextBase = ((i + 1) % n) * 2;
    indices.push(base, base + 1, nextBase + 1);
    indices.push(base, nextBase + 1, nextBase);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, mat));

  // Optional: thin dashed center line for charm.
  const linePoints = path.map((p) => new THREE.Vector3(p.x, 0.04, p.z));
  linePoints.push(linePoints[0]!); // close the loop
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 4, gapSize: 4, linewidth: 1 });
  const line = new THREE.Line(lineGeo, lineMat);
  line.computeLineDistances();
  group.add(line);

  return group;
}
