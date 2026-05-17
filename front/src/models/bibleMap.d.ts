import type { BiblicalPlace } from './api';

export type { BiblicalPlace };

export type CameraState = { x: number; y: number; z: number; zoom: number };

export interface PlaceItem { name: string; lonlat: [number, number]; }

export interface PersonPin {
  slug:       string;
  lon:        number;
  lat:        number;
  nameFr:     string;
  atlasX:     number;
  atlasY:     number;
  borderType: number;
}

export type SceneControls = {
  cleanup:                  () => void;
  setDisplacement:          (scale: number) => void;
  updateProjectionFeatures: (features: any[], isBase: boolean) => void;
  updateHistoricalBorders:  (data: any) => void;
  setBGDPlaces:             (places: PlaceItem[]) => void;
  setBiblicalPlaces:        (places: BiblicalPlace[]) => void;
  flyTo:                    (lon: number, lat: number, zoom?: number) => void;
  setPersons:               (persons: PersonPin[]) => void;
  setApostles:              (data: { type: string; features: any[] } | null, atlasIndex?: Record<string, { x: number; y: number }>) => void;
  setJourneyDate:           (year: number | null) => void;
};

export interface LineSegment {
  start: readonly [number, number, number];
  end:   readonly [number, number, number];
  t:    number;
  tEnd?: number;
}

export interface ArrowDef {
  center:  import('three').Vector3;
  tangent: import('three').Vector3;
}

export interface AnimatedLineOptions {
  width?:        number;
  pulseHz?:      number;
  pulseScale?:   number;
  opacity?:      number;
  colors?: [import('three').ColorRepresentation, import('three').ColorRepresentation, import('three').ColorRepresentation, import('three').ColorRepresentation];
  outlineColor?: import('three').ColorRepresentation;
  outlineFrac?:  number;
  maxT?:         number;
}

export interface AnimatedLineHandle {
  mesh:        import('three').Mesh;
  material:    import('three').ShaderMaterial;
  setViewport: (w: number, h: number) => void;
  tick:        (timeSeconds: number) => void;
  setMaxT:     (t: number) => void;
  getMaxT:     () => number;
  dispose:     () => void;
}

export interface ArrowHandle {
  mesh:        import('three').Mesh;
  material:    import('three').ShaderMaterial;
  setViewport: (w: number, h: number) => void;
  dispose:     () => void;
}

export interface BillboardPin {
  lon:        number;
  lat:        number;
  atlasX:     number;
  atlasY:     number;
  borderType: number;
}

export interface BillboardOptions {
  pinSizePx?:   number;
  borderFrac?:  number;
  atlasTilePx?: number;
  atlasW?:      number;
  atlasH?:      number;
  sphereR?:     number;
}

export interface BillboardHandle {
  mesh:        import('three').Mesh;
  material:    import('three').ShaderMaterial;
  setViewport: (w: number, h: number) => void;
  setCenter:   (pinIndex: number, x: number, y: number, z: number) => void;
  setVisible:  (v: boolean) => void;
  dispose:     () => void;
}

export interface PersonJourneyData {
  features:    any[];
  atlasEntry:  { x: number; y: number };
  borderType?: number;
}

export interface PersonJourneyHandle {
  meshes:      import('three').Object3D[];
  setDate:     (year: number | null) => void;
  setViewport: (w: number, h: number) => void;
  tick:        (timeSeconds: number) => void;
  dispose:     () => void;
}
