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

export type Visibility = 'private' | 'public';

export interface EventItem {
  id: string;
  organizerId: string;
  organizerName: string;
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  maxPlayers: number;
  visibility: Visibility;
  createdAt: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  isGuest: boolean;
  createdAt: string;
}

export interface EventCreate {
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  maxPlayers: number;
  visibility: Visibility;
}
