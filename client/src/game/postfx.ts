import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  SMAAEffect,
  SMAAPreset,
} from 'postprocessing';
import type { Quality } from './settings.js';

export interface PostFX {
  composer: EffectComposer;
  setSize: (w: number, h: number) => void;
  render: (dt: number) => void;
}

/** Build the bloom + vignette + SMAA pipeline.
 *
 * God-rays (GodRaysEffect) were removed from the default pipeline: they require a
 * second full scene render for occlusion plus a 60-sample raymarch, which cuts
 * integrated-GPU frame rates from ~55 fps to 10-15 fps.  At the game's steep
 * top-down camera angle the rays are barely visible, so the cost far exceeds the
 * visual benefit.  Bloom + vignette + SMAA alone deliver a polished look at 60 fps.
 */
export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  _sun: THREE.Mesh,   // kept in signature so callers need no change
  quality: Quality,
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: quality === 'high' ? 0.8 : 0.4,
    luminanceThreshold: 0.65,
    luminanceSmoothing: 0.3,
    mipmapBlur: quality === 'high',  // mipmap blur is cheap but skip on low
  });

  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.45 });
  const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });

  composer.addPass(new EffectPass(camera, bloom, vignette, smaa));

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
