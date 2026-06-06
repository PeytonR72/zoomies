import * as THREE from 'three';
import { heightAt, grassColorNoise } from '@zoomies/shared';
import { PALETTE } from '@zoomies/shared';

/** Flat-shaded low-poly terrain covering the world + hill ring, vertex-colored by height.
 *  Basin grass gets subtle organic patchiness via a deterministic low-frequency noise. */
export function createTerrain(): THREE.Mesh {
  const size = 900, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];

  const cLow   = new THREE.Color(PALETTE.grassLow);   // #4f9e3a
  const cHigh  = new THREE.Color(PALETTE.grassHigh);  // #79c45a
  const cDry   = new THREE.Color('#5a8c2a');           // slightly warmer/darker dry patch
  const cRock  = new THREE.Color(PALETTE.rock);
  const cSnow  = new THREE.Color(PALETTE.snow);
  const tmp    = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);

    const t = Math.min(h / 60, 1);

    if (t < 0.02) {
      // Basin floor — apply organic patchiness
      const n = grassColorNoise(x, z); // [0,1]
      // Blend between grassLow and grassHigh with gentle patch variation (~±15%)
      // Occasionally pull slightly toward a dry/darker tone for sparse dry patches
      const patchBlend = Math.pow(n, 1.4); // bias toward mid-low values
      tmp.copy(cLow).lerp(cHigh, patchBlend * 0.55);
      // Very sparse dry patches: only when noise is in bottom 15%
      if (n < 0.15) {
        tmp.lerp(cDry, (0.15 - n) / 0.15 * 0.35);
      }
    } else if (t < 0.5) {
      // Grass slopes — mild variation too
      const n = grassColorNoise(x, z);
      tmp.copy(cLow).lerp(cHigh, (t / 0.5) + (n - 0.5) * 0.15);
      tmp.r = THREE.MathUtils.clamp(tmp.r, 0, 1);
      tmp.g = THREE.MathUtils.clamp(tmp.g, 0, 1);
      tmp.b = THREE.MathUtils.clamp(tmp.b, 0, 1);
    } else if (t < 0.8) {
      tmp.copy(cHigh).lerp(cRock, (t - 0.5) / 0.3);
    } else {
      tmp.copy(cRock).lerp(cSnow, (t - 0.8) / 0.2);
    }

    colors.push(tmp.r, tmp.g, tmp.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
