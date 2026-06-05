import * as THREE from 'three';
import { MAP } from '@zoomies/shared';

export interface World {
  scene: THREE.Scene;
}

/** Build the static scene: sky, ground, road ribbon, props, lighting. */
export function createWorld(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fd0ff');
  scene.fog = new THREE.Fog('#8fd0ff', 200, 600);

  // Lighting: soft ambient + a warm key light for the flat-shaded low-poly look.
  scene.add(new THREE.HemisphereLight('#bfe3ff', '#4f7a3a', 0.9));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.1);
  sun.position.set(80, 160, 60);
  scene.add(sun);

  // Grass ground.
  const b = MAP.bounds;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + 80, b.maxZ - b.minZ + 80),
    new THREE.MeshLambertMaterial({ color: '#5fb84e' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  scene.add(ground);

  // Road: a thin extruded ribbon following the closed centerline.
  scene.add(buildRoadMesh());

  // Props: simple low-poly trees (cone + trunk) at each prop circle.
  for (const p of MAP.props) scene.add(buildTree(p.x, p.z, p.radius));

  return { scene };
}

function buildRoadMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#3a3f4a' });
  const pts = MAP.roadCenterline;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const c = pts[(i + 1) % pts.length]!;
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(MAP.roadWidth, len), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(dz, dx) + Math.PI / 2;
    seg.position.set((a.x + c.x) / 2, 0.02, (a.z + c.z) / 2);
    group.add(seg);
    // Round the corners with a disc so segments join cleanly.
    const joint = new THREE.Mesh(new THREE.CircleGeometry(MAP.roadWidth / 2, 12), mat);
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(a.x, 0.02, a.z);
    group.add(joint);
  }
  return group;
}

function buildTree(x: number, z: number, radius: number): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.22, radius * 1.2, 6),
    new THREE.MeshLambertMaterial({ color: '#7a4a2b' }),
  );
  trunk.position.y = radius * 0.6;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(radius, radius * 2.4, 7),
    new THREE.MeshLambertMaterial({ color: '#2f9e44', flatShading: true }),
  );
  leaves.position.y = radius * 1.9;
  g.add(trunk, leaves);
  g.position.set(x, 0, z);
  return g;
}
