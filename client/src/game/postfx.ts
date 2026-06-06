import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  GodRaysEffect,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
  BlendFunction,
} from 'postprocessing';
import type { Quality } from './settings.js';

export interface PostFX {
  composer: EffectComposer;
  setSize: (w: number, h: number) => void;
  render: (dt: number) => void;
}

/** Build the bloom + god-rays + vignette pipeline. `sun` is the god-ray light source. */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  sun: THREE.Mesh,
  quality: Quality,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: quality === 'high' ? 0.9 : 0.5,
    luminanceThreshold: 0.65,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  });

  const godRays = new GodRaysEffect(camera, sun, {
    blendFunction: BlendFunction.SCREEN,
    density: 0.92,
    decay: 0.92,
    weight: quality === 'high' ? 0.5 : 0.3,
    samples: quality === 'high' ? 60 : 30,
    resolutionScale: quality === 'high' ? 0.6 : 0.4,
  });

  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.45 });
  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });

  composer.addPass(new EffectPass(camera, godRays, bloom, vignette, smaa));

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    render: (dt) => composer.render(dt),
  };
}
