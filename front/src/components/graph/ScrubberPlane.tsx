import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

interface Props {
  worldX:   number;
  maxY:     number;
  color?:   string;
  opacity?: number;
  width?:   number;
}

const vert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2  vUv;
  void main() {
    float alpha = sin(vUv.y * 3.14159265) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function ScrubberPlane({ worldX, maxY, color = '#C879FF', opacity = 0, width = 3 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   vert,
    fragmentShader: frag,
    transparent:    true,
    depthWrite:     false,
    depthTest:      false,
    uniforms: {
      uColor:   { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
  }), [color, opacity]);

  useFrame(() => { if (meshRef.current) meshRef.current.position.x = worldX * horizontalScale; });

  return (
    <mesh ref={meshRef} position={[worldX * horizontalScale, maxY / 2, 10]} renderOrder={10} material={material}>
      <planeGeometry args={[width, maxY + 80]} />
    </mesh>
  );
}
