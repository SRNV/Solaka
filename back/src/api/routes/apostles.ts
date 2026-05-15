import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export default function apostlesRouter(geomapPath: string): Router {
  const router = Router();
  const apostlesDir = path.join(geomapPath, 'apostles');

  router.get('/', (_req, res) => {
    try {
      const files = fs.readdirSync(apostlesDir).filter(f => f.endsWith('.geojson'));
      const allFeatures: unknown[] = [];
      for (const file of files) {
        const slug = file.replace(/\.geojson$/, '');
        const raw  = fs.readFileSync(path.join(apostlesDir, file), 'utf-8');
        const data = JSON.parse(raw) as { features?: { properties?: Record<string, unknown> }[] };
        if (!Array.isArray(data.features)) continue;
        for (const f of data.features) {
          if (f.properties) f.properties.slug = slug;
          allFeatures.push(f);
        }
      }
      res.json({ type: 'FeatureCollection', features: allFeatures });
    } catch {
      res.status(500).json({ error: 'Failed to load apostles data' });
    }
  });

  return router;
}
