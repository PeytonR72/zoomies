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
      depthWrite: false,
      uniforms: {
        time:    { value: 0 },
        deep:    { value: new THREE.Color(PALETTE.waterDeep) },
        shallow: { value: new THREE.Color(PALETTE.waterShallow) },
        foam:    { value: new THREE.Color(PALETTE.waterFoam) },
        radius:  { value: w.radius },
      },
      vertexShader: /* glsl */`
        uniform float time;
        varying vec2  vXz;
        varying float vR;

        void main() {
          vXz = position.xy;
          vR  = length(position.xy);

          // Gentle vertex ripple — two overlapping waves, small amplitude
          float ripple = sin(position.x * 0.35 + time * 1.1) * cos(position.y * 0.30 + time * 0.9) * 0.18
                       + sin(position.x * 0.18 - time * 0.7) * sin(position.y * 0.22 + time * 1.2) * 0.10;
          vec3 p = vec3(position.x, position.y, ripple);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3  deep;
        uniform vec3  shallow;
        uniform vec3  foam;
        uniform float time;
        uniform float radius;
        varying vec2  vXz;
        varying float vR;

        // Simple 2-D hash for caustic pattern (no texture needed)
        float hash2(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 19.19);
          return fract(p.x * p.y);
        }

        void main() {
          float edge = vR / radius;           // 0 = centre → 1 = rim

          // --- Depth gradient: use a gentler curve so mid-lake reads richer ---
          float depthT = smoothstep(0.0, 1.0, edge * edge * 0.6 + edge * 0.4);
          vec3 col = mix(deep, shallow, depthT);

          // --- Caustic shimmer: two overlapping sine grids ---
          float cx = vXz.x * 0.55, cy = vXz.y * 0.55;
          float c1 = sin(cx + time * 1.4) * sin(cy - time * 0.9);
          float c2 = sin(cx * 0.7 - time * 0.6) * sin(cy * 0.8 + time * 1.1);
          float caustic = 0.5 + 0.5 * (c1 * 0.6 + c2 * 0.4);
          // Fade caustics toward the edge (shallow looks calmer)
          float causticMask = smoothstep(0.85, 0.0, edge);
          col += caustic * 0.055 * causticMask;

          // --- Soft specular highlight: bright streak at a fixed angle ---
          // Fake specular: brightening along a diagonal (no lights needed)
          float spec = pow(clamp(0.5 + 0.5 * sin(vXz.x * 0.08 - vXz.y * 0.06 + time * 0.5), 0.0, 1.0), 4.0);
          col += vec3(spec) * 0.04;

          // --- Foam shoreline: two rings — a soft glow + a crisp bright band ---
          float outerFoam = smoothstep(0.78, 0.96, edge);   // wide soft glow
          float innerFoam = smoothstep(0.90, 0.99, edge);   // narrower bright crest
          col = mix(col, foam * 0.75, outerFoam * 0.45);
          col = mix(col, foam,        innerFoam * 0.70);

          // --- Transparency: opaque centre, slightly translucent at the shallow edge ---
          float alpha = mix(0.94, 0.78, smoothstep(0.60, 1.0, edge));

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    // Slightly more segments for a smoother rim on larger lakes
    const segs = Math.min(72, Math.max(48, Math.round(w.radius * 0.6)));
    const geo  = new THREE.CircleGeometry(w.radius, segs);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(w.x, 0.14, w.z);  // fractionally higher to avoid z-fight
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
