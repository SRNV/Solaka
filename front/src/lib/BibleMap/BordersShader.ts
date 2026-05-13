import * as THREE from 'three';

export const BordersVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vUv       = uv;
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const BordersFragmentShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  uniform sampler2D u_borderTexture;
  uniform vec3 u_borderColor;
  uniform float u_opacity;
  uniform float u_zoom;

  void main() {
    float borderVal = texture2D(u_borderTexture, vUv).r;
    
    // Antialiasing basé sur les dérivées pour une netteté parfaite au zoom
    // On augmente le seuil pour affiner davantage le trait
    // Zoom-adaptive threshold: higher zoom → higher threshold → thinner visible border
    float thickness = clamp(1.0 - 0.45 / max(u_zoom, 0.1), 0.25, 0.92);
    float edge = fwidth(borderVal) * 1.5;
    float border = smoothstep(thickness - edge, thickness + edge, borderVal);
    
    if (border < 0.01) discard;

    vec3 viewDir = normalize(-vPosition);
    float rim    = 1.0 - max(dot(vNormal, viewDir), 0.0);
    rim          = pow(rim, 2.0);

    gl_FragColor = vec4(u_borderColor, border * u_opacity * (1.0 - rim * 0.5));
  }
`;

/**
 * Crée une texture de données à partir de GeoJSON
 * On dessine avec une épaisseur plus grande pour avoir un gradient exploitable par le shader
 */
export function createBordersTexture(features: any[]): THREE.Texture {
  const width = 4096;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // On remplit de noir pour le fond (valeur 0)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  // On dessine en blanc (valeur 1) avec un flou léger pour le gradient
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 10;

  features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      drawPolygon(ctx, feature.geometry.coordinates, width, height);
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((poly: any) => {
        drawPolygon(ctx, poly, width, height);
      });
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  return texture;
}

function drawPolygon(ctx: CanvasRenderingContext2D, coordinates: any[], w: number, h: number) {
  coordinates.forEach(ring => {
    ctx.beginPath();
    ring.forEach((coord: [number, number], i: number) => {
      const x = (coord[0] + 180) / 360 * w;
      const y = (1 - (coord[1] + 90) / 180) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}
