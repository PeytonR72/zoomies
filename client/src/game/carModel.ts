import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '@zoomies/shared';
import { instantiate } from './assets.js';
import { buildCarMesh, type CarMesh } from './carMesh.js'; // procedural fallback (kept)
export type { CarMesh };

/** Build a car: GLTF if available (recolored), else the procedural box car. */
export function buildCar(color: string): CarMesh {
  const gltf = instantiate('car');
  if (!gltf) return buildCarMesh(color);

  // Normalize the model to our car footprint and recolor the largest (body) material.
  fitToFootprint(gltf);
  let body: THREE.MeshStandardMaterial | null = null;
  let bodyArea = -1;
  gltf.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const geom = m.geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    const area = size.x * size.z;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    if (area > bodyArea && mat && 'color' in mat) {
      bodyArea = area;
      body = mat.clone();
      // Remove the atlas texture so the solid player color shows cleanly
      body.map = null;
      body.needsUpdate = true;
      m.material = body;
    }
  });
  // Apply the initial color (cast needed: TS narrows `body` to never after callback)
  const bodyMat = body as THREE.MeshStandardMaterial | null;
  if (bodyMat) bodyMat.color.set(color);

  const group = new THREE.Group();
  group.add(gltf);
  return {
    group,
    setColor: (hex: string) => { if (bodyMat) bodyMat.color.set(hex); },
  };
}

function fitToFootprint(g: THREE.Group): void {
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = Math.min(CAR_WIDTH / (size.x || 1), CAR_LENGTH / (size.z || 1));
  g.scale.setScalar(scale);
  // re-center on ground
  const box2 = new THREE.Box3().setFromObject(g);
  g.position.y -= box2.min.y;
}
