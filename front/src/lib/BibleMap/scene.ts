import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { createInnerSphere } from './sphere.ts';
import { createTiles } from './tiles.ts';
import earthNormal   from './assets/earth_normal_8k.png';
import earthSpecular from './assets/earth_specular_8k.png';
import { bordersFromData, createBorders, computeFeatureCentroids } from './borders.ts';
import { BordersVertexShader, BordersFragmentShader, createBordersTexture } from './BordersShader.ts';
import { buildBillboards, type BillboardHandle } from './PersonBillboardService.ts';
import { buildPersonJourney, type PersonJourneyHandle } from './PersonJourneyService.ts';

import mc3 from './assets/matcaps/8D8D8D_DDDDDD_CCCCCC_B7B7B7-64px.png';

export const MATCAP_URLS: string[] = [mc3];
export const OUTLINE_MATCAP_URLS: string[] = [];

const APOSTLE_LIFESPAN: Record<string, { born: number; died: number }> = {
  paul:              { born:   5, died:  67 },
  pierre:            { born:  -1, died:  67 },
  jean:              { born:  15, died: 100 },
  andre:             { born:   5, died:  60 },
  jacques_le_majeur: { born:   5, died:  44 },
  jacques_le_mineur: { born:   5, died:  62 },
  thomas:            { born:   5, died:  72 },
  matthieu:          { born:   0, died:  74 },
  philippe:          { born:   5, died:  80 },
  barthelemy:        { born:   5, died:  71 },
  simon_le_zelote:   { born:   5, died:  65 },
  matthias:          { born:   5, died:  80 },
  jude_thaddee:      { born:   5, died:  65 },
};

const haloVert = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFrag = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim    = 1.0 - max(dot(vNormal, viewDir), 0.0);
    rim          = pow(rim, 2.5);
    gl_FragColor = vec4(0.45, 0.7, 1.0, rim * 0.35);
  }
`;

import type { CameraState, PlaceItem, SceneControls, PersonPin } from '@/models/bibleMap';
export type { CameraState, PlaceItem, SceneControls, PersonPin };

// ── Places point-cloud shaders ────────────────────────────────────────────────

const placesVert = /* glsl */`
  uniform float uSize;
  void main() {
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;

const placesFrag = /* glsl */`
  uniform vec3  uColor;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = (1.0 - smoothstep(0.3, 0.5, d)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

function lonLatToXYZ(lon: number, lat: number, r = 1.002): [number, number, number] {
  const φ = lat * (Math.PI / 180);
  const λ = lon * (Math.PI / 180);
  return [-Math.cos(φ) * Math.cos(λ), Math.sin(φ), Math.cos(φ) * Math.sin(λ)].map(v => v * r) as [number, number, number];
}

function buildPointsMesh(color: number, opacity: number): { mesh: THREE.Points; setPlaces: (places: PlaceItem[]) => void } {
  const mat = new THREE.ShaderMaterial({
    vertexShader:   placesVert,
    fragmentShader: placesFrag,
    transparent:    true,
    depthWrite:     false,
    uniforms: {
      uSize:    { value: 4.0 },
      uColor:   { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
  });
  const geo  = new THREE.BufferGeometry();
  const mesh = new THREE.Points(geo, mat);
  mesh.visible = false;

  const setPlaces = (places: PlaceItem[]) => {
    const pos = new Float32Array(places.length * 3);
    let i = 0;
    for (const p of places) {
      const [x, y, z] = lonLatToXYZ(p.lonlat[0], p.lonlat[1]);
      pos[i++] = x; pos[i++] = y; pos[i++] = z;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mesh.visible = places.length > 0;
  };

  return { mesh, setPlaces };
}

export function mountScene(
  containerEl: HTMLElement,
  onCameraUpdate?: (s: CameraState) => void,
): SceneControls {
  // Read true dimensions (layout must be settled before effect runs)
  const w = containerEl.clientWidth  || 800;
  const h = containerEl.clientHeight || 400;

  // ── Renderer ──────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: true, 
    alpha: true,
    precision: 'high'
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  // Fill the container via CSS (ResizeObserver updates the WebGL buffer)
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  containerEl.appendChild(renderer.domElement);

  // ── Camera — centered, symmetric frustum ─────────────────────
  const aspect = w / h;
  const camera = new THREE.OrthographicCamera(
    -aspect,  aspect,
     1,       -1,
    0.01, 100,
  );
  camera.position.set(0, 0, 5);
  camera.zoom = 0.01;
  camera.updateProjectionMatrix();

  // ── Scene ──────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 3.5);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  // ── Globe materials ────────────────────────────────────────────
  const loader       = new THREE.TextureLoader();
  const normalMap    = loader.load(earthNormal);
  const dispMap      = loader.load(earthSpecular);
  const matcapTextures = MATCAP_URLS.map(url => loader.load(url));
  const outlineMatcapTextures = OUTLINE_MATCAP_URLS.map(url => loader.load(url));

  // Inverted specular → alpha map (land opaque, ocean transparent)
  let invertedAlpha: THREE.Texture | null = null;

  const DEFAULT_MATCAP = 0; // The only one left

  const stdMat = new THREE.MeshStandardMaterial({
    color:            0xbbbfce,
    roughness:        0.85,
    displacementMap:  dispMap,
    displacementScale: 0,
  });

  // default matcap (8D) with displacement
  let matcapMat: THREE.MeshMatcapMaterial | null = new THREE.MeshMatcapMaterial({
    matcap:            matcapTextures[DEFAULT_MATCAP],
    normalMap,
    normalScale:       new THREE.Vector2(6, 6),
    displacementMap:   dispMap,
    displacementScale: 0,
    transparent:       true,
  });

  const sphereGeo  = createInnerSphere();
  const sphereMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(sphereGeo, matcapMat);
  scene.add(sphereMesh);

  loader.load(earthSpecular, (tex) => {
    const img    = tex.image as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width  = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i]     = 255 - data.data[i];
      data.data[i + 1] = 255 - data.data[i + 1];
      data.data[i + 2] = 255 - data.data[i + 2];
    }
    ctx.putImageData(data, 0, 0);
    invertedAlpha = new THREE.CanvasTexture(canvas);
    applyAlpha(true);
  });

  // Secondary-colour outline via inverted-hull
  const outlineBaseMat = new THREE.MeshBasicMaterial({ color: 0xC879FF, side: THREE.BackSide });
  const outlineMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    createInnerSphere(),
    outlineBaseMat,
  );
  outlineMesh.scale.setScalar(1.008);
  scene.add(outlineMesh);

  // ── Country borders ────────────────────────────────────────────
  let bordersObj: THREE.LineSegments | null = null;
  let projectionObj: THREE.LineSegments | null = null;
  let bordersVisible = true;
  let labelData: { name: string; pos: THREE.Vector3 }[] = [];
  let biblicalPlacesData: { name: string; pos: THREE.Vector3; priority: number }[] = [];
  let bgdLabelsData:     { name: string; pos: THREE.Vector3; priority: number }[] = [];
  let apostleLabelsData: { name: string; pos: THREE.Vector3 }[] = [];

  // ── BGD point clouds ────────────────────────────────
  const bgdCloud      = buildPointsMesh(0xC879FF, 0.85); // violet
  scene.add(bgdCloud.mesh);

  // ── Shared atlas texture (loaded once, reused by authors + apostle portraits) ─
  let atlasTexture: THREE.Texture | null = null;
  const getAtlasTexture = () => {
    if (!atlasTexture) atlasTexture = new THREE.TextureLoader().load('/atlas.png');
    return atlasTexture;
  };

  // ── Person billboards ─────────────────────────────────────────────────────
  let personBillboards: BillboardHandle | null = null;

  // ── Per-apostle journey handles (one per slug) ────────────────────────────
  let journeyHandles: PersonJourneyHandle[] = [];

  // ── Historical Shader Borders ──────────────────────────────────
  const borderMat = new THREE.ShaderMaterial({
    vertexShader: BordersVertexShader,
    fragmentShader: BordersFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      u_borderTexture: { value: new THREE.Texture() },
      u_borderColor:   { value: new THREE.Color(0xC879FF) },
      u_opacity:       { value: 0.85 },
      u_zoom:          { value: 1.0 },
    },
  });
  const borderMesh = new THREE.Mesh(createInnerSphere(), borderMat);
  borderMesh.scale.setScalar(1.0002);
  scene.add(borderMesh);

  // ── Labels canvas overlay ──────────────────────────────────────
  containerEl.style.position = 'relative';
  const labelsCanvas = document.createElement('canvas');
  labelsCanvas.width  = w;
  labelsCanvas.height = h;
  Object.assign(labelsCanvas.style, {
    position: 'absolute', top: '0', left: '0',
    width: '100%', height: '100%', pointerEvents: 'none',
  });
  containerEl.appendChild(labelsCanvas);
  const labelsCtx = labelsCanvas.getContext('2d')!;

  function drawLabels() {
    const lw = labelsCanvas.width;
    const lh = labelsCanvas.height;
    labelsCtx.clearRect(0, 0, lw, lh);
    
    const allLabels = [
      ...labelData.map(l => ({ ...l, priority: 100, isPlace: false, isBiblical: false })),
      ...bgdLabelsData.map(l => ({ ...l, isPlace: true, isBiblical: true })),
      ...biblicalPlacesData.map(l => ({ ...l, isPlace: true, isBiblical: true, priority: 200 }))
    ];
    if (!allLabels.length) return;

    const mvp = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix, camera.matrixWorldInverse,
    );
    const frustum = new THREE.Frustum().setFromProjectionMatrix(mvp);
    const camNorm = camera.position.clone().normalize();

    // Tri par priorité (on affiche les plus importants d'abord pour le test de collision)
    allLabels.sort((a, b) => b.priority - a.priority);

    const zoom = camera.zoom;
    const occupiedRects: { x: number; y: number; w: number; h: number }[] = [];

    for (const { name, pos, isPlace, isBiblical, priority } of allLabels) {
      // LOD: les places de basse priorité n'apparaissent qu'au zoom
      if (!isBiblical && isPlace && priority < 10 && zoom < 4) continue;
      if (!isBiblical && isPlace && priority < 5  && zoom < 8) continue;
      if (!isBiblical && isPlace && priority < 2  && zoom < 15) continue;

      if (pos.dot(camNorm) < 0.1) continue; // Occlusion face arrière
      if (!frustum.containsPoint(pos)) continue;

      const proj = pos.clone().project(camera);
      const x = (proj.x  + 1) / 2 * lw;
      const y = (-proj.y + 1) / 2 * lh;

      const fontSize = isPlace 
        ? Math.round(Math.min(11, Math.max(7, 8 * zoom * 0.5)))
        : Math.round(Math.min(13, Math.max(8, 9 * zoom)));
      
      labelsCtx.font = `${isPlace ? (isBiblical ? '700' : '400') : '600'} ${fontSize}px system-ui,sans-serif`;
      const tw = labelsCtx.measureText(name).width;
      const ph = fontSize + 4;
      const pw = tw + 8;
      
      const rx = x - pw / 2;
      const ry = y - ph / 2;

      // Collision detection (simple overlap check)
      const overlap = occupiedRects.some(r => 
        rx < r.x + r.w && rx + pw > r.x && 
        ry < r.y + r.h && ry + ph > r.y
      );
      if (overlap) continue;

      occupiedRects.push({ x: rx, y: ry, w: pw, h: ph });

      labelsCtx.textAlign    = 'center';
      labelsCtx.textBaseline = 'middle';

      if (isBiblical) {
        labelsCtx.fillStyle = 'rgba(200, 121, 255, 0.9)'; // Violet to match
      } else {
        labelsCtx.fillStyle = isPlace ? 'rgba(255,255,255,0.7)' : 'rgba(247,248,252,0.82)';
      }

      labelsCtx.beginPath();
      (labelsCtx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
        .roundRect(rx, ry, pw, ph, 3);
      labelsCtx.fill();

      labelsCtx.fillStyle = isBiblical ? '#fff' : (isPlace ? '#666' : '#444');
      labelsCtx.fillText(name, x, y);
    }

    // Apostle place labels — shown when mouse is within 60 px
    const HOVER_R = 60;
    for (const { name, pos } of apostleLabelsData) {
      if (pos.dot(camNorm) < 0.1) continue;
      if (!frustum.containsPoint(pos)) continue;
      const proj = pos.clone().project(camera);
      const sx = (proj.x  + 1) / 2 * lw;
      const sy = (-proj.y + 1) / 2 * lh;
      if (Math.hypot(sx - mouseX, sy - mouseY) > HOVER_R) continue;

      labelsCtx.font = '700 11px system-ui,sans-serif';
      const tw = labelsCtx.measureText(name).width;
      const ph = 16;
      const pw = tw + 10;
      const rx = sx - pw / 2;
      const ry = sy - ph - 10;

      labelsCtx.fillStyle = 'rgba(212, 172, 13, 0.92)';
      labelsCtx.beginPath();
      (labelsCtx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
        .roundRect(rx, ry, pw, ph, 3);
      labelsCtx.fill();

      labelsCtx.fillStyle = '#fff';
      labelsCtx.textAlign = 'center';
      labelsCtx.textBaseline = 'middle';
      labelsCtx.fillText(name, sx, ry + ph / 2);
    }
  }

  // ── Atmosphere halo ────────────────────────────────────────────
  const haloMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.06, 20),
    new THREE.ShaderMaterial({
      vertexShader:   haloVert,
      fragmentShader: haloFrag,
      transparent:    true,
      side:           THREE.FrontSide,
      depthWrite:     false,
    }),
  );
  scene.add(haloMesh);

  // ── Tiles (hidden) ─────────────────────────────────────────────
  const uniforms = {
    zoom:       { value: 1.0 },
    resolution: { value: new THREE.Vector2(w, h) },
  };
  const { displayPoints, pickingPoints } = createTiles(uniforms);
  scene.add(displayPoints);
  void pickingPoints;

  // ── OrbitControls ──────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan       = false;
  controls.minZoom         = 0.01;
  controls.maxZoom         = 18;
  controls.autoRotate      = false;
  controls.autoRotateSpeed = 0.4;
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.06;

  controls.addEventListener('change', () => {
    controls.rotateSpeed = (1 / camera.zoom) / 1.5;
    uniforms.zoom.value  = camera.zoom;
    // (historical borders now use LineSegments — no shader zoom update needed)
    if (onCameraUpdate) {
      onCameraUpdate({ x: camera.position.x, y: camera.position.y, z: camera.position.z, zoom: camera.zoom });
    }
  });

  // zoom-to-cursor for orthographic camera
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect   = renderer.domElement.getBoundingClientRect();
    const ndcX   = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY   = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const before = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);

    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    camera.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, camera.zoom * zoomFactor));
    camera.updateProjectionMatrix();

    const after  = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
    const delta  = before.sub(after);
    camera.position.x += delta.x;
    camera.position.y += delta.y;
    controls.target.x  += delta.x;
    controls.target.y  += delta.y;
    controls.update();
    uniforms.zoom.value = camera.zoom;
  };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  // ── Mouse tracking for hover labels ───────────────────────────
  let mouseX = -9999;
  let mouseY = -9999;
  const onMouseMove = (e: MouseEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  };
  const onMouseLeave = () => { mouseX = -9999; mouseY = -9999; };
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseleave', onMouseLeave);

  // ── Resize ────────────────────────────────────────────────────
  const onResize = () => {
    const nw = containerEl.clientWidth;
    const nh = containerEl.clientHeight;
    if (nw <= 0 || nh <= 0) return;
    const na = nw / nh;
    camera.left   = -na;
    camera.right  =  na;
    camera.top    =  1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh, false); // false = don't override the CSS width/height we set
    uniforms.resolution.value.set(nw, nh);
    labelsCanvas.width  = nw;
    labelsCanvas.height = nh;
    personBillboards?.setViewport(nw, nh);
    for (const h of journeyHandles) h.setViewport(nw, nh);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(containerEl);

  // ── Alpha helper (callable before & after texture loads) ──────
  function applyAlpha(on: boolean) {
    const applyTo = (mat: THREE.MeshStandardMaterial | THREE.MeshMatcapMaterial) => {
      mat.alphaMap    = on && invertedAlpha ? invertedAlpha : null;
      mat.transparent = on;
      mat.needsUpdate = true;
    };
    applyTo(stdMat);
    if (matcapMat) applyTo(matcapMat);
  }

  // ── Animation loop ─────────────────────────────────────────────
  let rafId = 0;
  const clock = performance;
  const animate = () => {
    rafId = requestAnimationFrame(animate);
    controls.update();
    borderMat.uniforms.u_zoom.value = camera.zoom;
    const t = clock.now() / 1000;
    for (const h of journeyHandles) h.tick(t);
    renderer.render(scene, camera);
    drawLabels();
  };
  animate();

  // ── Public controls ────────────────────────────────────────────
  const controlsResult: SceneControls = {
    cleanup: () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
      for (const h of journeyHandles) h.dispose();
      journeyHandles = [];
      controls.dispose();
      renderer.dispose();
      containerEl.removeChild(renderer.domElement);
      containerEl.removeChild(labelsCanvas);
    },
    setDisplacement: (scale) => {
      stdMat.displacementScale = scale;
      stdMat.needsUpdate = true;
      if (matcapMat) {
        matcapMat.displacementScale = scale;
        matcapMat.needsUpdate = true;
      }
    },
    updateProjectionFeatures: (features, isBase) => {
      if (isBase) {
        if (bordersObj) {
          scene.remove(bordersObj);
          bordersObj.geometry.dispose();
        }
        if (features.length > 0) {
          bordersObj = bordersFromData({ type: 'FeatureCollection', features }, 0xC879FF, 0.55, 1.001);
          scene.add(bordersObj);
          bordersObj.visible = bordersVisible;
        } else {
          bordersObj = null;
        }
      } else {
        if (projectionObj) {
          scene.remove(projectionObj);
          projectionObj.geometry.dispose();
          projectionObj = null;
        }
        if (features.length > 0) {
          projectionObj = bordersFromData({ type: 'FeatureCollection', features }, 0xC879FF, 0.65, 1.0004);
          scene.add(projectionObj);
          labelData = computeFeatureCentroids({ type: 'FeatureCollection', features }, 1.005);
        } else {
          labelData = [];
        }
      }
    },
    updateHistoricalBorders: (data) => {
      const prev = borderMat.uniforms.u_borderTexture.value;
      if (prev && prev.image) prev.dispose();
      if (!data) {
        borderMat.uniforms.u_borderTexture.value = new THREE.Texture();
        labelData = [];
      } else {
        borderMat.uniforms.u_borderTexture.value = createBordersTexture(data.features);
        labelData = computeFeatureCentroids(data, 1.005);
      }
      borderMat.uniforms.u_borderTexture.value.needsUpdate = true;
    },
    setBGDPlaces: (places) => {
      bgdCloud.setPlaces(places);
      bgdLabelsData = []; // labels hidden per user request
    },
    setBiblicalPlaces: (places) => {
      biblicalPlacesData = places.map(p => {
        const [lon, lat] = p.lonlat;
        const lonR = lon * (Math.PI / 180);
        const latR = lat * (Math.PI / 180);
        const x = -Math.cos(latR) * Math.cos(lonR);
        const y =  Math.sin(latR);
        const z =  Math.cos(latR) * Math.sin(lonR);
        return { name: p.name, pos: new THREE.Vector3(x, y, z), priority: 200 };
      });
    },
    setPersons: (pins: PersonPin[]) => {
      if (personBillboards) { scene.remove(personBillboards.mesh); personBillboards.dispose(); personBillboards = null; }
      if (pins.length === 0) return;
      const nw = containerEl.clientWidth  || w;
      const nh = containerEl.clientHeight || h;
      personBillboards = buildBillboards(pins, { w: nw, h: nh }, getAtlasTexture());
      scene.add(personBillboards.mesh);
    },
    flyTo: (lon, lat, zoom) => {
      const [x, y, z] = lonLatToXYZ(lon, lat, 5);
      gsap.to(camera.position, {
        x, y, z,
        duration: 2.8,
        ease: 'expo.inOut',
        onUpdate: () => controls.update()
      });
      if (zoom !== undefined) {
        gsap.to(camera, {
          zoom,
          duration: 2.8,
          ease: 'expo.inOut',
          onUpdate: () => {
            camera.updateProjectionMatrix();
            uniforms.zoom.value = camera.zoom;
          },
          onComplete: () => {
            controls.minZoom = 2.5; // Reprend la contrainte normale
            controls.update();
          }
        });
      }
    },
    setApostles: (data, atlasIndex) => {
      // Tear down previous journey handles
      for (const h of journeyHandles) {
        for (const m of h.meshes) scene.remove(m);
        h.dispose();
      }
      journeyHandles = [];
      apostleLabelsData = [];
      if (!data || data.features.length === 0) return;

      // Hover labels for all apostle places
      apostleLabelsData = data.features
        .filter((f: any) => f.geometry?.type === 'Point')
        .map((f: any) => ({
          name: (f.properties?.name as string) ?? '',
          pos:  new THREE.Vector3(...lonLatToXYZ(f.geometry.coordinates[0], f.geometry.coordinates[1], 1.006)),
        }));

      const nw = containerEl.clientWidth  || w;
      const nh = containerEl.clientHeight || h;
      const tex = getAtlasTexture();

      // Group features by slug → one PersonJourneyHandle per apostle
      const bySlug = new Map<string, any[]>();
      for (const f of data.features) {
        const slug = f.properties?.slug as string | undefined;
        if (!slug) continue;
        if (!bySlug.has(slug)) bySlug.set(slug, []);
        bySlug.get(slug)!.push(f);
      }

      for (const [slug, features] of bySlug) {
        const tile     = atlasIndex?.[slug];
        const lifespan = APOSTLE_LIFESPAN[slug];
        const handle = buildPersonJourney(
          {
            features,
            atlasEntry: tile ?? { x: 0, y: 0 },
            borderType: 2,
            born: lifespan?.born,
            died: lifespan?.died,
          },
          { w: nw, h: nh },
          tex,
        );
        for (const m of handle.meshes) scene.add(m);
        journeyHandles.push(handle);
      }
    },

    setJourneyDate: (year) => {
      for (const h of journeyHandles) h.setDate(year);
    },
  };

  // Initial animation to Mediterranean
  setTimeout(() => {
    controlsResult.flyTo(18, 40, 5.5);
  }, 300);

  return controlsResult;
}
