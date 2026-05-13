import { GeoMap, GeoMapData } from '../GeoMap';

export interface IGeoMapRepository {
  findAll(): GeoMap[];
  findById(id: string): GeoMapData | null;
}
