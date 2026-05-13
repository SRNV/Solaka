export interface BiblicalPlace {
  id: string;
  name: string;
  type: string;
  lonlat: [number, number];
  verses: string[];
  geojsonFile?: string;
}

export interface IBiblicalPlaceRepository {
  findAll(): Promise<BiblicalPlace[]>;
  findByVerse(osisVerse: string): Promise<BiblicalPlace[]>;
  getById(id: string): Promise<BiblicalPlace | null>;
}
