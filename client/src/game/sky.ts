import * as THREE from 'three';
import { PALETTE } from '@zoomies/shared';

/** Big inverted sphere with a vertical gradient. Returns the sky group. */
export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 horizon;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  return sky;
}

/** Bright sun disc placed along the light direction — also the god-ray source. */
export function createSunMesh(): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 16), mat);
  sun.position.set(360, 520, 240); // same direction as the DirectionalLight, far away
  return sun;
}
