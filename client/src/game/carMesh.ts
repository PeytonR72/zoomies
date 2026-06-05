import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH } from '@zoomies/shared';

export interface CarMesh {
  group: THREE.Group;
  setColor: (hex: string) => void;
}

/** Build a chunky low-poly car. Body color is recolorable per player. */
export function buildCarMesh(color: string): CarMesh {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });

  const L = CAR_LENGTH;
  const W = CAR_WIDTH;

  // Lower body.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, L), bodyMat);
  lower.position.y = 0.6;
  group.add(lower);

  // Cabin (shorter, set back).
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.82, 0.7, L * 0.42),
    new THREE.MeshLambertMaterial({ color: '#cfe8ff', flatShading: true }),
  );
  cabin.position.set(0, 1.25, -L * 0.05);
  group.add(cabin);

  // Wheels (4 cylinders laid on their sides).
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#1b1b1f' });
  const wx = W / 2 + 0.05;
  const wz = L * 0.32;
  for (const [sx, sz] of [
    [wx, wz],
    [-wx, wz],
    [wx, -wz],
    [-wx, -wz],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.55, sz);
    group.add(wheel);
  }

  return {
    group,
    setColor: (hex: string) => bodyMat.color.set(hex),
  };
}
