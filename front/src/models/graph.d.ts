import type { BibleTarget } from './contexts';

export interface Pos3 { x: number; y: number; z: number; }

export interface LayoutResult {
  totalInstances: number;
  totalX:         number;
  maxTowerY:      number;
  maxChZ:         number;
  bookLabels:     { name: string; number: number; cx: number; startX: number; endX: number }[];
  uuidPosMap:     Map<string, Pos3>;
  uuidRefMap:     Map<string, BibleTarget>;
  instanceUuids:  string[];
  chapZMap:        Map<string, number>;
}

export interface ArcSeg {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  arcPeakY:    number;
  t0: number; t1: number;
  relIdx:      number;
  isAuthority: boolean;
  isCatholic:  boolean;
}

export interface LaneInfo {
  toLane:    number;
  toTotal:   number;
  fromLane:  number;
  fromTotal: number;
}

export interface BraceCircle {
  x:      number;
  y:      number;
  side:   number;
  relIdx: number;
  color:  string;
}

export interface ArcGeometryResult {
  visualGeo:    import('three').BufferGeometry | null;
  hitGeo:       import('three').BufferGeometry | null;
  segs:         ArcSeg[];
  circles:      BraceCircle[];
  hasAuthority: boolean;
}
