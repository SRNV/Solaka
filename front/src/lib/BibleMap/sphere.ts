import * as THREE from 'three';

export function createInnerSphere(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.999, 50);
}
