import * as THREE from 'three';
import { scatterProps, type PropKind, mulberry32, deriveSeed, WORLD_SEED } from '@zoomies/shared';
import { instantiate } from './assets.js';

// ---------------------------------------------------------------------------
// Per-instance color palettes (deterministic, drives variety across clients).
// ---------------------------------------------------------------------------

/** Canopy hues: 3 greens + gold + warm orange-gold for autumn variety. */
const CANOPY_PALETTE: THREE.Color[] = [
  new THREE.Color('#4a9e30'), // deep green
  new THREE.Color('#6abf4b'), // mid green
  new THREE.Color('#85d45a'), // light green
  new THREE.Color('#c8b832'), // golden-yellow
  new THREE.Color('#d4883a'), // warm amber/autumn
];

/** A dark-enough canopy hue in HSL: hue 60-160° (green-yellow band) or orange (20-40°).
 *  Used to detect whether a primitive is the canopy vs trunk. */
function isCanopyColor(c: THREE.Color): boolean {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // Greenish (hue 80-200°) or yellowish/warm (hue 40-80°) and reasonably saturated
  return hsl.s > 0.2 && (hsl.h > 0.11 && hsl.h < 0.56);
}

/** Neutral stone colors for rocks. */
const ROCK_COLORS: THREE.Color[] = [
  new THREE.Color('#9a9590'), // warm grey
  new THREE.Color('#8a8678'), // tan-grey
  new THREE.Color('#b0a898'), // light stone
];

/** Reed/grass green. */
const REED_COLOR = new THREE.Color('#5e9e3a');

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

  // Deterministic RNG for per-instance color selection (same seed → same world on every client).
  const colorRng = mulberry32(deriveSeed(WORLD_SEED, 'scattercolor'));

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

    // Determine color role for this kind's primitives.
    // We use the primitive's baseColor to classify it and choose an override palette.
    for (const prim of primitives) {
      // Determine what override color (if any) to apply.
      // For trees: canopy primitives get a varied palette color (white base + instance tint).
      //            trunk primitives keep their brown baseColor unchanged.
      // For rocks: all primitives get neutral stone colors (per-instance).
      // For reeds: all primitives get grassy green (uniform).
      const isTree = kind === 'tree';
      const isCanopy = isTree && isCanopyColor(prim.baseColor);
      const isRock = kind === 'rock';
      const isReed = kind === 'reed';

      // Decide base material color: white lets instanceColor show through faithfully.
      let matColor: THREE.Color;
      if (isCanopy) matColor = new THREE.Color(0xffffff);
      else if (isRock) matColor = new THREE.Color(0xffffff);
      else if (isReed) matColor = REED_COLOR.clone();
      else matColor = prim.baseColor.clone(); // trunk — keep original brown

      const mat = new THREE.MeshLambertMaterial({
        color: matColor,
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

        // Apply per-instance color for varied canopy / stone palette.
        if (isCanopy) {
          const c = CANOPY_PALETTE[Math.floor(colorRng() * CANOPY_PALETTE.length)]!;
          inst.setColorAt(i, c);
        } else if (isRock) {
          const c = ROCK_COLORS[Math.floor(colorRng() * ROCK_COLORS.length)]!;
          inst.setColorAt(i, c);
        }
      });

      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
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
