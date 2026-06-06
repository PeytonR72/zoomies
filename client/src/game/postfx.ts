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
  type Effect,
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

  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.45 });
  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });

  // God-rays are the most motion-heavy effect and the priciest pass; drop them on
  // 'low' (which is also the prefers-reduced-motion path) for a calmer, cheaper image.
  const effects: Effect[] = [bloom, vignette, smaa];
  if (quality === 'high') {
    const godRays = new GodRaysEffect(camera, sun, {
      blendFunction: BlendFunction.SCREEN,
      density: 0.92,
      decay: 0.92,
      weight: 0.5,
      samples: 60,
      resolutionScale: 0.6,
    });
    effects.unshift(godRays);
  }

  composer.addPass(new EffectPass(camera, ...effects));

  // FIX: EffectComposer.createDepthTexture() calls depthTexture.clone(), which in
  // Three.js shares the same Source object between the original and the clone.
  // Three.js's texture cache (_sources Map) then maps both textures to the *same*
  // underlying WebGLTexture.  When blitDepthBuffer copies depth from inputBuffer
  // (which has depthTexture) into depthRenderTarget (which has stableDepthTexture),
  // both framebuffers share the same WebGL texture at DEPTH_ATTACHMENT — triggering:
  //   GL_INVALID_OPERATION: glBlitFramebuffer: Read and write depth stencil
  //   attachments cannot be the same image.
  //
  // Fix: replace the stable depth texture with a freshly allocated DepthTexture
  // (new Source, no shared cache key) after the passes have been compiled so the
  // composer's depthRenderTarget FBO gets a distinct WebGL texture.
  const depthRT = (composer as unknown as { depthRenderTarget: THREE.WebGLRenderTarget | null }).depthRenderTarget;
  if (depthRT) {
    // Must match EffectComposer's depthTexture format: FloatType/DepthFormat (no stencil).
    const freshDepth = new THREE.DepthTexture(depthRT.width, depthRT.height);
    freshDepth.type = THREE.FloatType;
    freshDepth.name = 'EffectComposer.StableDepth.Fixed';
    depthRT.depthTexture = freshDepth;
    // Propagate to all passes that received the old stableDepthTexture via setDepthTexture.
    // EffectPass stores it on fullscreenMaterial.depthBuffer; each effect stores it too.
    // The safest way is to iterate passes and call setDepthTexture again.
    for (const pass of (composer as unknown as { passes: { setDepthTexture?: (t: THREE.Texture) => void }[] }).passes) {
      pass.setDepthTexture?.(freshDepth);
    }
  }

  return {
    composer,
    setSize: (w, h) => composer.setSize(w, h),
    render: (dt) => composer.render(dt),
  };
}
