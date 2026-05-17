export interface Category {
  uuid: string;
  name: string;
  description: string;
  from: string;
  tags: string[];
  name_en: string;
  description_en: string;
}

export interface Reference {
  name: string;
  chapter: number;
  from: number;
  to: number;
  summary: string;
  summary_en: string;
  name_en: string;
  rank: 1 | 2 | 3;
  group?: number;
}

export interface Objection {
  uuid: string;
  category: Category;
  name: string;
  references: Reference[];
  description: string;
  author: string;
  name_en: string;
  description_en: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface GeoMap {
  id: string;
  label: string;
  year: number | null;
}

export interface BiblicalPlace {
  id: string;
  name: string;
  type: string;
  lonlat: [number, number];
  verses: string[];
  geojsonFile?: string;
}
