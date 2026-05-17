import type { BibleRelation, VerseSearchResult } from './bible';
import type { PlaceItem } from './bibleMap';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface PaginatedApiState<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
}

export type { PlaceItem };

export type PlaceType = 'bgd';

export interface StompPlacesState {
  places: PlaceItem[];
  done: boolean;
}

export interface StompRelationsState {
  relations: BibleRelation[];
  loading:   boolean;
}

export interface MapFeaturesState {
  features: GeoJSON.Feature[];
  loading: boolean;
  done: boolean;
}

export interface SearchState {
  results: VerseSearchResult[];
  loading: boolean;
}
