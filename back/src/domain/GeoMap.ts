export interface GeoMap {
  id: string;
  label: string;
  year: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GeoMapData = Record<string, any>;
