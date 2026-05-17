import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import { injectable, inject } from 'inversify';
import type { GeoMap, GeoMapData } from '../models/GeoMap';
import type { IGeoMapRepository } from '../models/IGeoMapRepository';
import type { AppConfig } from '../models/config';
import { TYPES } from '../container/types';

function parseYear(id: string): number | null {
  const bc = id.match(/^world_bc(\d+)$/);
  if (bc) return -parseInt(bc[1], 10);
  const ad = id.match(/^world_(\d+)$/);
  if (ad) return parseInt(ad[1], 10);
  return null;
}

function toLabel(id: string): string {
  return id.replace(/^world_/, '');
}

const ID_SAFE = /^[a-zA-Z0-9_-]+$/;

@injectable()
export class FileGeoMapRepository implements IGeoMapRepository {
  private readonly dir: string;
  constructor(@inject(TYPES.Config) config: AppConfig) { this.dir = config.geomapPath; }

  findAll(): GeoMap[] {
    return fs.readdirSync(this.dir)
      .filter(f => f.endsWith('.geojson') || f.endsWith('.json'))
      .map(f => {
        const id = f.replace(/\.(geo)?json$/, '');
        return { id, label: toLabel(id), year: parseYear(id) };
      })
      .sort((a, b) => {
        const ay = a.year ?? Infinity;
        const by = b.year ?? Infinity;
        return ay - by;
      });
  }

  findById(id: string): GeoMapData | null {
    if (!ID_SAFE.test(id)) return null;

    const candidates = [
      path.join(this.dir, id + '.geojson'),
      path.join(this.dir, id + '.json'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as GeoMapData;
      }
    }
    return null;
  }
}
