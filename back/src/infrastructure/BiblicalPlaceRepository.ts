import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import type { BiblicalPlace, IBiblicalPlaceRepository } from '../models/BiblicalPlace';
import type { AppConfig } from '../models/config';
import { TYPES } from '../container/types';

@injectable()
export class BiblicalPlaceRepository implements IBiblicalPlaceRepository {
  private places: BiblicalPlace[] = [];
  private verseMap: Map<string, string[]> = new Map();
  private dataPath: string;

  constructor(@inject(TYPES.Config) config: AppConfig) {
    this.dataPath = config.biblicalDataPath;
    this.loadData();
  }

  private loadData() {
    const ancientPath = path.join(this.dataPath, 'data', 'ancient.jsonl');
    if (!fs.existsSync(ancientPath)) {
      console.warn(`Biblical data not found at ${ancientPath}`);
      return;
    }

    const lines = fs.readFileSync(ancientPath, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        
        // Finding lonlat in resolutions
        let lonlatStr = '';
        if (data.identifications?.[0]?.resolutions?.[0]?.lonlat) {
          lonlatStr = data.identifications[0].resolutions[0].lonlat;
        }

        if (!lonlatStr) continue;

        const [lon, lat] = lonlatStr.split(',').map(Number);
        if (isNaN(lon) || isNaN(lat)) continue;
        
        const place: BiblicalPlace = {
          id: data.id,
          name: data.friendly_id,
          type: data.types?.[0] || 'unknown',
          lonlat: [lon, lat],
          verses: (data.verses || [])
            .map((v: any) => v.osis)
            .filter((osis: any) => typeof osis === 'string'),
          geojsonFile: data.geojson_file
        };

        this.places.push(place);

        // Index by verse
        for (const osis of place.verses) {
          if (!osis) continue;
          
          // Add both full verse and chapter level indexing
          // e.g. Gen.12.1 and Gen.12
          const parts = osis.split('.');
          const chapterLevel = parts.slice(0, 2).join('.');
          
          this.addToVerseMap(osis, place.id);
          if (chapterLevel !== osis) {
            this.addToVerseMap(chapterLevel, place.id);
          }
        }
      } catch (e) {
        console.error('Error parsing line in ancient.jsonl', e);
      }
    }
  }

  private addToVerseMap(osis: string, placeId: string) {
    if (!this.verseMap.has(osis)) {
      this.verseMap.set(osis, []);
    }
    this.verseMap.get(osis)!.push(placeId);
  }

  async findAll(): Promise<BiblicalPlace[]> {
    return this.places;
  }

  async findByVerse(osisVerse: string): Promise<BiblicalPlace[]> {
    const placeIds = this.verseMap.get(osisVerse) || [];
    return this.places.filter(p => placeIds.includes(p.id));
  }

  async getById(id: string): Promise<BiblicalPlace | null> {
    return this.places.find(p => p.id === id) || null;
  }
}
