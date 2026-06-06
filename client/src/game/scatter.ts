import * as THREE from 'three';
import { scatterProps, type PropKind } from '@zoomies/shared';
import { instantiate } from './assets.js';

/** Build InstancedMeshes for scattered props from the deterministic layout. */
export function createScatter(): THREE.Group {
  const group = new THREE.Group();
  const byKind: Record<PropKind, Array<{ x: number; z: number; yaw: number; scale: number }>> = {
    tree: [],
    rock: [],
    reed: [],
  };
  for (const p of scatterProps()) {
    byKind[p.kind].push({ x: p.x, z: p.z, yaw: p.yaw, scale: p.scale });
  }

  const assetFor: Record<PropKind, string[]> = {
    tree: ['tree_a', 'tree_b'],
    rock: ['rock'],
    reed: ['reed'],
  };

  // Target world-space heights so props look right relative to cars (~2 units tall).
  const targetHeights: Record<PropKind, number> = { tree: 7, rock: 2.5, reed: 2.0 };

  for (const kind of Object.keys(byKind) as PropKind[]) {
    const holders = byKind[kind];
    if (holders.length === 0) continue;

    // Pick first available asset variant
    const variant = assetFor[kind]
      .map((k) => instantiate(k as Parameters<typeof instantiate>[0]))
      .find((g) => g !== null) ?? null;
    if (!variant) continue;

    // Collect all mesh primitives with their node-relative transforms.
    const primitives = collectMeshPrimitives(variant);
    if (primitives.length === 0) continue;

    // Compute the overall bounding box of all primitives to find the model's Y extent.
    const fullBox = new THREE.Box3();
    for (const prim of primitives) {
      prim.geometry.computeBoundingBox();
      const b = prim.geometry.boundingBox!.clone().applyMatrix4(prim.localMatrix);
      fullBox.union(b);
    }
    const modelMinY = fullBox.min.y;
    const modelHeight = fullBox.max.y - fullBox.min.y;
    const baseScale = modelHeight > 0 ? targetHeights[kind] / modelHeight : 1;

    // For each primitive, create an InstancedMesh with a Lambert material
    // (the Kenney GLBs use metallic=1 PBR which renders black without IBL).
    for (const prim of primitives) {
      const mat = new THREE.MeshLambertMaterial({
        color: prim.baseColor,
        flatShading: false,
      });

      const inst = new THREE.InstancedMesh(prim.geometry, mat, holders.length);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();

      holders.forEach(({ x, z, yaw, scale }, i) => {
        const s = baseScale * scale;
        // Ground the prop: offset by -modelMinY*s so its base sits at y=0.
        dummy.position.set(x, -modelMinY * s, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();

        // Bake the primitive's node-local transform into the instance matrix
        // so multi-node models (trunk + leaves) are assembled correctly.
        const final = new THREE.Matrix4().multiplyMatrices(dummy.matrix, prim.localMatrix);
        inst.setMatrixAt(i, final);
      });

      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }
  }
  return group;
}

interface PrimInfo {
  geometry: THREE.BufferGeometry;
  /** Base color extracted from the GLTF PBR material (or white if unrecognised). */
  baseColor: THREE.Color;
  /** Transform of this mesh node relative to the GLTF group root. */
  localMatrix: THREE.Matrix4;
}

/** Collect every Mesh primitive in a GLTF group with its root-relative transform. */
function collectMeshPrimitives(root: THREE.Object3D): PrimInfo[] {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const results: PrimInfo[] = [];

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;

    const localMatrix = new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];

    mats.forEach((mat) => {
      const baseColor = extractBaseColor(mat);
      results.push({ geometry: m.geometry as THREE.BufferGeometry, baseColor, localMatrix });
    });
  });

  return results;
}

/** Pull the diffuse/base color out of any Three.js material. */
function extractBaseColor(mat: THREE.Material): THREE.Color {
  // MeshStandardMaterial (GLTF PBR) has .color
  const std = mat as THREE.MeshStandardMaterial;
  if (std.color instanceof THREE.Color) {
    return std.color.clone();
  }
  return new THREE.Color(0xffffff);
}
