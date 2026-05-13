import * as THREE from 'three';
import { integerToColor } from './pickingColors.ts';
import { displayVertex, displayFragment, pickerVertex, pickerFragment } from './shaders.ts';

const TILE_COUNT = 10_000;

// Generates random points distributed on a unit sphere (Fibonacci lattice).
function generateSpherePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / count);
    const phi   = 2 * Math.PI * i / goldenRatio;
    positions[i * 3]     = Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi);
    positions[i * 3 + 2] = Math.cos(theta);
  }
  return positions;
}

function generatePickingColors(count: number): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = integerToColor(i + 1);
    colors[i * 3]     = r / 255;
    colors[i * 3 + 1] = g / 255;
    colors[i * 3 + 2] = b / 255;
  }
  return colors;
}

export function createTiles(uniforms: { [key: string]: THREE.IUniform }) {
  const positions = generateSpherePositions(TILE_COUNT);
  const colors    = generatePickingColors(TILE_COUNT);
  const hover     = new Float32Array(TILE_COUNT).fill(0);

  const displayGeo = new THREE.BufferGeometry();
  displayGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  displayGeo.setAttribute('hover',    new THREE.BufferAttribute(hover, 1));

  const pickerGeo = new THREE.BufferGeometry();
  pickerGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pickerGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const displayPoints = new THREE.Points(displayGeo, new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader:   displayVertex,
    fragmentShader: displayFragment,
  }));

  const pickingPoints = new THREE.Points(pickerGeo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   pickerVertex,
    fragmentShader: pickerFragment,
  }));

  // Hidden until tiles are wired up
  displayPoints.visible = false;
  pickingPoints.visible = false;

  return { displayPoints, pickingPoints, tileCount: TILE_COUNT };
}
