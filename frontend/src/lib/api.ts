import type { FieldFilters, FieldsResponse, GamesResponse, Game, GameCreate } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch a list of fields, optionally filtered.
 */
export async function getFields(filters?: FieldFilters): Promise<FieldsResponse> {
  const params = new URLSearchParams();
  if (filters?.sport) params.set('sport', filters.sport);
  if (filters?.available !== undefined) params.set('available', String(filters.available));
  if (filters?.lat !== undefined) params.set('lat', String(filters.lat));
  if (filters?.lng !== undefined) params.set('lng', String(filters.lng));
  if (filters?.radius_km !== undefined) params.set('radius_km', String(filters.radius_km));
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<FieldsResponse>(`/fields${query}`);
}

/**
 * Fetch a single field by ID.
 */
export async function getField(fieldId: string): Promise<FieldsResponse['fields'][0]> {
  return apiFetch(`/fields/${fieldId}`);
}

/**
 * Fetch game announcements, optionally filtered by field or sport.
 */
export async function getGames(params?: {
  fieldId?: string;
  sport?: string;
  limit?: number;
}): Promise<GamesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.fieldId) searchParams.set('field_id', params.fieldId);
  if (params?.sport) searchParams.set('sport', params.sport);
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return apiFetch<GamesResponse>(`/games${query}`);
}

/**
 * Create a new game announcement.
 */
export async function createGame(data: GameCreate): Promise<Game> {
  return apiFetch<Game>('/games', {
    method: 'POST',
    body: JSON.stringify({
      field_id: data.fieldId,
      field_name: data.fieldName,
      sport: data.sport,
      date: data.date,
      time: data.time,
      players_needed: data.playersNeeded,
      author: data.author,
      description: data.description,
    }),
  });
}
