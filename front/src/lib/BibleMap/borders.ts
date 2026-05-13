import * as THREE from 'three';
import { fetchOnce } from '../../store/apiCache';

function lonLatToVec3(lon: number, lat: number, r = 1.001): THREE.Vector3 {
  const latR = lat * (Math.PI / 180);
  const lonR = lon * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.cos(latR) * Math.cos(lonR),
     r * Math.sin(latR),
     r * Math.cos(latR) * Math.sin(lonR),
  );
}

export function bordersFromData(
  data: GeoJSON.FeatureCollection,
  color = 0xC879FF,
  opacity = 0.55,
  r = 1.001,
): THREE.LineSegments {
  const positions: number[] = [];

  for (const feature of data.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const polygons: number[][][][] =
      geom.type === 'Polygon'
        ? [(geom as GeoJSON.Polygon).coordinates]
        : geom.type === 'MultiPolygon'
          ? (geom as GeoJSON.MultiPolygon).coordinates
          : [];

    for (const polygon of polygons) {
      for (const ring of polygon) {
        const pts = (ring as number[][]).map(([lon, lat]) => lonLatToVec3(lon, lat, r));
        for (let i = 0; i < pts.length - 1; i++) {
          positions.push(pts[i].x, pts[i].y, pts[i].z);
          positions.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color, opacity, transparent: true });
  return new THREE.LineSegments(geometry, material);
}

export async function createBorders(
  url: string,
  color = 0xC879FF,
  opacity = 0.55,
  r = 1.001,
): Promise<THREE.LineSegments> {
  const data = await fetchOnce<GeoJSON.FeatureCollection>(url);
  return bordersFromData(data, color, opacity, r);
}

export function computeFeatureCentroids(
  data: GeoJSON.FeatureCollection,
  r = 1.005,
): { name: string; pos: THREE.Vector3 }[] {
  const result: { name: string; pos: THREE.Vector3 }[] = [];

  for (const feature of data.features) {
    const props = feature.properties as Record<string, unknown> | null;
    const name = (props?.NAME ?? props?.name) as string | undefined;
    if (!name) continue;

    const geom = feature.geometry;
    if (!geom) continue;

    const polygons: number[][][][] =
      geom.type === 'Polygon'
        ? [(geom as GeoJSON.Polygon).coordinates]
        : geom.type === 'MultiPolygon'
          ? (geom as GeoJSON.MultiPolygon).coordinates
          : [];

    if (!polygons.length) continue;

    // pick the polygon with the most vertices as representative
    let bestRing: number[][] = [];
    for (const poly of polygons) {
      if ((poly[0] as number[][]).length > bestRing.length) bestRing = poly[0] as number[][];
    }
    if (!bestRing.length) continue;

    let sumLon = 0, sumLat = 0;
    for (const [lon, lat] of bestRing) { sumLon += lon; sumLat += lat; }
    result.push({
      name,
      pos: lonLatToVec3(sumLon / bestRing.length, sumLat / bestRing.length, r),
    });
  }

  return result;
}
