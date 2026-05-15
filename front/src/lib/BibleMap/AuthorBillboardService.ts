/**
 * AuthorBillboardService — screen-space atlas-sprite billboards on a sphere.
 *
 * Each pin is a fixed-pixel-size quad centred on a sphere-surface position,
 * showing a tile from a sprite atlas with an optional coloured border.
 *
 * Usage
 * ─────
 *   const handle = buildBillboards(pins, { w, h }, texture);
 *   handle.setViewport(nw, nh);   // in resize handler
 *   handle.dispose();              // on teardown
 */

import * as THREE from 'three';

// ── Shader sources ────────────────────────────────────────────────────────────

const billboardVert = /* glsl */`
  attribute vec2  aUv;
  attribute vec2  aAtlas;
  attribute vec3  aCenter;
  attribute float aBorderType;

  uniform vec2  uViewport;
  uniform float uPixelSize;
  uniform vec2  uAtlasTile;

  varying vec2  vUv;
  varying vec2  vAtlasUv;
  varying float vBorderType;

  void main() {
    vec3 n    = normalize(aCenter);
    float vis = step(0.05, dot(n, normalize(cameraPosition)));

    vec4 clip = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
    vec2 off  = (aUv - 0.5) * uPixelSize / uViewport * 2.0 * clip.w;
    clip.xy  += off;
    clip.z   -= aBorderType * 0.001 * clip.w;  // magistere drawn on top
    clip.xy  += (1.0 - vis) * 9999.0;

    vUv         = aUv;
    vAtlasUv    = aAtlas + aUv * uAtlasTile;
    vBorderType = aBorderType;
    gl_Position = clip;
  }
`;

const billboardFrag = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float     uB;
  varying vec2      vUv;
  varying vec2      vAtlasUv;
  varying float     vBorderType;

  vec3 borderColor(float t) {
    // 0 = patristic → secondary #C879FF  (violet)
    // 1 = magistere → gold      #D4AC0D
    // 2 = apostle   → success   #CAFF8A  (vert clair)
    vec3 secondary = vec3(0.784, 0.475, 1.000);
    vec3 gold      = vec3(0.831, 0.675, 0.051);
    vec3 success   = vec3(0.792, 1.000, 0.541);
    vec3 col = secondary;
    col = mix(col, gold,    step(0.5, t));
    col = mix(col, success, step(1.5, t));
    return col;
  }

  void main() {
    bool border = vUv.x < uB || vUv.x > 1.0 - uB
               || vUv.y < uB || vUv.y > 1.0 - uB;
    if (border) {
      gl_FragColor = vec4(borderColor(vBorderType), 1.0);
    } else {
      gl_FragColor = texture2D(uAtlas, vAtlasUv);
    }
  }
`;

const CORNERS_UV = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
const TRI_IDX    = [0, 1, 2, 0, 2, 3] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BillboardPin {
  lon:        number;
  lat:        number;
  atlasX:     number;
  atlasY:     number;
  /** 0 = patristic (violet border), 1 = magistere (gold border) */
  borderType: number;
}

export interface BillboardOptions {
  /** Screen-space quad size in pixels (default 24) */
  pinSizePx?:   number;
  /** Border fraction of pin size (default 0.065) */
  borderFrac?:  number;
  /** Tile size in the atlas PNG in pixels (default 64) */
  atlasTilePx?: number;
  /** Atlas PNG pixel width (default 512) */
  atlasW?:      number;
  /** Atlas PNG pixel height (default 576) */
  atlasH?:      number;
  /** Sphere radius offset (default 1.003) */
  sphereR?:     number;
}

export interface BillboardHandle {
  mesh:        THREE.Mesh;
  material:    THREE.ShaderMaterial;
  /** Call in resize handler */
  setViewport: (w: number, h: number) => void;
  /** Move pin[pinIndex] to a new sphere-surface position (sphere XYZ, not lon/lat). */
  setCenter:   (pinIndex: number, x: number, y: number, z: number) => void;
  setVisible:  (v: boolean) => void;
  dispose:     () => void;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a batch of atlas-sprite billboards.
 * `atlasTexture` is a THREE.Texture already loaded by the caller.
 */
export function buildBillboards(
  pins: BillboardPin[],
  viewport: { w: number; h: number },
  atlasTexture: THREE.Texture,
  opts: BillboardOptions = {},
): BillboardHandle {
  const {
    pinSizePx   = 24,
    borderFrac  = 0.065,
    atlasTilePx = 64,
    atlasW      = 512,
    atlasH      = 576,
    sphereR     = 1.003,
  } = opts;

  const tileUvW = atlasTilePx / atlasW;
  const tileUvH = atlasTilePx / atlasH;

  const n         = pins.length;
  const positions    = new Float32Array(n * 4 * 3);
  const aUvs         = new Float32Array(n * 4 * 2);
  const aAtlasBuf    = new Float32Array(n * 4 * 2);
  const aBorderTypes = new Float32Array(n * 4);
  const indices      = new Uint32Array(n * 6);

  for (let i = 0; i < n; i++) {
    const { lon, lat, atlasX, atlasY, borderType } = pins[i];
    const φ = lat * (Math.PI / 180);
    const λ = lon * (Math.PI / 180);
    const cx = -Math.cos(φ) * Math.cos(λ) * sphereR;
    const cy =  Math.sin(φ)               * sphereR;
    const cz =  Math.cos(φ) * Math.sin(λ) * sphereR;

    // UV origin: flip V to convert image top-left → WebGL bottom-left
    const u0 = atlasX / atlasW;
    const v0 = 1 - (atlasY + atlasTilePx) / atlasH;

    const vBase = i * 4;
    for (let c = 0; c < 4; c++) {
      const vi = (vBase + c) * 3;
      positions[vi]     = cx;
      positions[vi + 1] = cy;
      positions[vi + 2] = cz;

      const ui = (vBase + c) * 2;
      aUvs[ui]     = CORNERS_UV[c][0];
      aUvs[ui + 1] = CORNERS_UV[c][1];

      aAtlasBuf[ui]     = u0;
      aAtlasBuf[ui + 1] = v0;

      aBorderTypes[vBase + c] = borderType;
    }

    const iBase = i * 6;
    for (let t = 0; t < 6; t++) indices[iBase + t] = vBase + TRI_IDX[t];
  }

  const cenBuf = positions.slice();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aCenter',     new THREE.BufferAttribute(cenBuf, 3));
  geo.setAttribute('aUv',         new THREE.BufferAttribute(aUvs, 2));
  geo.setAttribute('aAtlas',      new THREE.BufferAttribute(aAtlasBuf, 2));
  geo.setAttribute('aBorderType', new THREE.BufferAttribute(aBorderTypes, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const posBufAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const cenBufAttr = geo.getAttribute('aCenter')  as THREE.BufferAttribute;

  const material = new THREE.ShaderMaterial({
    vertexShader:   billboardVert,
    fragmentShader: billboardFrag,
    transparent:    false,
    depthWrite:     true,
    uniforms: {
      uAtlas:     { value: atlasTexture },
      uAtlasTile: { value: new THREE.Vector2(tileUvW, tileUvH) },
      uViewport:  { value: new THREE.Vector2(viewport.w, viewport.h) },
      uPixelSize: { value: pinSizePx },
      uB:         { value: borderFrac },
    },
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    setViewport: (w, h) => material.uniforms.uViewport.value.set(w, h),
    setCenter: (pinIndex, x, y, z) => {
      const vBase = pinIndex * 4;
      for (let c = 0; c < 4; c++) {
        posBufAttr.setXYZ(vBase + c, x, y, z);
        cenBufAttr.setXYZ(vBase + c, x, y, z);
      }
      posBufAttr.needsUpdate = true;
      cenBufAttr.needsUpdate = true;
    },
    setVisible: (v) => { mesh.visible = v; },
    dispose:    ()  => { geo.dispose(); material.dispose(); },
  };
}
