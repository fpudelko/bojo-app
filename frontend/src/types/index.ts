export interface Field {
  id: string;
  name: string;
  sport: string[];
  address: string;
  lat: number;
  lng: number;
  available: boolean;
  surface: string;
  isIndoor: boolean;
  phone?: string;
  website?: string;
}

export interface Game {
  id: string;
  fieldId: string;
  fieldName: string;
  sport: string;
  date: string;
  time: string;
  playersNeeded: number;
  playersJoined: number;
  author: string;
  description?: string;
  createdAt: string;
}

export interface GameCreate {
  fieldId: string;
  fieldName: string;
  sport: string;
  date: string;
  time: string;
  playersNeeded: number;
  author: string;
  description?: string;
}

export interface FieldsResponse {
  fields: Field[];
  total: number;
}

export interface GamesResponse {
  games: Game[];
  total: number;
}

export type SportType =
  | 'piłka nożna'
  | 'koszykówka'
  | 'siatkówka'
  | 'tenis'
  | 'futsal'
  | 'inne';

export type SurfaceType =
  | 'grass'
  | 'artificial'
  | 'concrete'
  | 'clay'
  | 'hardcourt';

export interface FieldFilters {
  sport?: SportType;
  available?: boolean;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
}
