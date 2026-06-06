import * as THREE from 'three';
import { MAP, PALETTE } from '@zoomies/shared';

export interface Water {
  group: THREE.Group;
  update: (t: number) => void; // animate; call each frame (no-op if reduced motion)
}

export function createWater(animate: boolean): Water {
  const group = new THREE.Group();
  const materials: THREE.ShaderMaterial[] = [];

  for (const w of MAP.waterBodies) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color(PALETTE.waterDeep) },
        shallow: { value: new THREE.Color(PALETTE.waterShallow) },
        foam: { value: new THREE.Color(PALETTE.waterFoam) },
        radius: { value: w.radius },
      },
      vertexShader: `
        uniform float time; varying vec2 vXz; varying float vR;
        void main() {
          vXz = position.xy; vR = length(position.xy);
          float ripple = sin(position.x*0.4 + time) * cos(position.y*0.4 + time) * 0.25;
          vec3 p = vec3(position.x, position.y, ripple);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform float time; uniform float radius;
        varying vec2 vXz; varying float vR;
        void main() {
          float edge = vR / radius;               // 0 center → 1 rim
          vec3 col = mix(deep, shallow, smoothstep(0.0, 1.0, edge));
          float caustic = 0.5 + 0.5 * sin(vXz.x*0.6 + time*1.3) * sin(vXz.y*0.6 - time);
          col += caustic * 0.06;
          float ring = smoothstep(0.82, 0.98, edge);    // shoreline foam
          col = mix(col, foam, ring * 0.8);
          gl_FragColor = vec4(col, 0.92);
        }
      `,
    });
    const geo = new THREE.CircleGeometry(w.radius, 48);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(w.x, 0.12, w.z);
    group.add(mesh);
    materials.push(mat);
  }

  return {
    group,
    update: (t) => {
      if (!animate) return;
      for (const m of materials) { const u = m.uniforms['time']; if (u) u.value = t; }
    },
  };
}
