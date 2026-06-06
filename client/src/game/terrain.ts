import * as THREE from 'three';
import { heightAt } from '@zoomies/shared';
import { PALETTE } from '@zoomies/shared';

/** Flat-shaded low-poly terrain covering the world + hill ring, vertex-colored by height. */
export function createTerrain(): THREE.Mesh {
  const size = 900, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const cLow = new THREE.Color(PALETTE.grassLow);
  const cHigh = new THREE.Color(PALETTE.grassHigh);
  const cRock = new THREE.Color(PALETTE.rock);
  const cSnow = new THREE.Color(PALETTE.snow);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const t = Math.min(h / 60, 1);
    if (t < 0.02) tmp.copy(cLow);
    else if (t < 0.5) tmp.copy(cLow).lerp(cHigh, t / 0.5);
    else if (t < 0.8) tmp.copy(cHigh).lerp(cRock, (t - 0.5) / 0.3);
    else tmp.copy(cRock).lerp(cSnow, (t - 0.8) / 0.2);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
