import * as THREE from 'three';
import { clamp, MAX_SPEED } from '@zoomies/shared';

// Angled top-down: high up and pulled back along −Z so we look down at a tilt.
// CAMERA_BACK/HEIGHT chosen so the frame covers ~the red-rectangle area.
const CAMERA_HEIGHT = 75;
const CAMERA_BACK = 52;
const FOLLOW_LERP = 0.12; // smoothing per frame

export function cameraTarget(carX: number, carZ: number) {
  return {
    pos: { x: carX, y: CAMERA_HEIGHT, z: carZ - CAMERA_BACK },
    look: { x: carX, y: 0, z: carZ },
  };
}

export function makeCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, aspect, 0.5, 1500);
  const { pos } = cameraTarget(0, 0);
  cam.position.set(pos.x, pos.y, pos.z);
  cam.lookAt(0, 0, 0);
  return cam;
}

/** Smoothly move the camera toward following the car at (x,z). */
export function updateCamera(cam: THREE.PerspectiveCamera, carX: number, carZ: number, speed = 0): void {
  const { pos, look } = cameraTarget(carX, carZ);
  cam.position.x += (pos.x - cam.position.x) * FOLLOW_LERP;
  cam.position.y += (pos.y - cam.position.y) * FOLLOW_LERP;
  cam.position.z += (pos.z - cam.position.z) * FOLLOW_LERP;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const targetFov = 45 + clamp(speed / MAX_SPEED, 0, 1) * 7;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  }
  cam.lookAt(look.x, look.y, look.z);
}
