import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();

const URLS = { car: '/models/car.glb' } as const;
export type AssetKey = keyof typeof URLS;

/** Load all GLBs once. Resolves even if some fail (fallbacks used instead). */
export async function preloadAssets(): Promise<void> {
  await Promise.all(
    (Object.keys(URLS) as AssetKey[]).map(async (key) => {
      try {
        const gltf = await loader.loadAsync(URLS[key]);
        cache.set(key, gltf.scene);
      } catch (e) {
        console.warn(`[assets] failed to load ${key}, using fallback`, e);
      }
    }),
  );
}

/** A fresh clone of a loaded asset, or null if it wasn't available. */
export function instantiate(key: AssetKey): THREE.Group | null {
  const src = cache.get(key);
  return src ? (src.clone(true) as THREE.Group) : null;
}
