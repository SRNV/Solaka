import { Category } from './Category';

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
