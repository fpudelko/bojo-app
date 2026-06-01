import { supabase } from './supabase';
import type { Field, FieldFilters, FieldsResponse, Game, GameCreate, GamesResponse } from '@/types';

// ---------------------------------------------------------------------------
// Row mappers  (DB snake_case → TS camelCase)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toField(row: any): Field {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    sport: row.sport ?? [],
    available: row.available,
    surface: row.surface ?? '',
    isIndoor: row.is_indoor,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGame(row: any): Game {
  return {
    id: row.id,
    fieldId: row.field_id,
    fieldName: row.fields?.name ?? '',
    sport: row.sport,
    date: row.game_date,
    time: row.game_time,
    playersNeeded: row.players_needed,
    playersJoined: row.players_joined,
    author: row.author_name,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export async function getFields(filters?: FieldFilters): Promise<FieldsResponse> {
  let query = supabase.from('fields').select('*', { count: 'exact' });

  if (filters?.sport) {
    query = query.contains('sport', [filters.sport]);
  }
  if (filters?.available !== undefined) {
    query = query.eq('available', filters.available);
  }
  if (filters?.limit !== undefined) {
    const from = filters.offset ?? 0;
    query = query.range(from, from + filters.limit - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { fields: (data ?? []).map(toField), total: count ?? 0 };
}

export async function getField(fieldId: string): Promise<Field> {
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .eq('id', fieldId)
    .single();

  if (error) throw new Error(error.message);
  return toField(data);
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export async function getGames(params?: {
  fieldId?: string;
  sport?: string;
  limit?: number;
}): Promise<GamesResponse> {
  let query = supabase
    .from('games')
    .select('*, fields(name)', { count: 'exact' })
    .eq('is_active', true)
    .order('game_date', { ascending: true });

  if (params?.fieldId) query = query.eq('field_id', params.fieldId);
  if (params?.sport)   query = query.eq('sport', params.sport);
  if (params?.limit)   query = query.limit(params.limit);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { games: (data ?? []).map(toGame), total: count ?? 0 };
}

export async function createGame(data: GameCreate): Promise<Game> {
  const { data: row, error } = await supabase
    .from('games')
    .insert({
      field_id: data.fieldId,
      sport: data.sport,
      game_date: data.date,
      game_time: data.time,
      players_needed: data.playersNeeded,
      author_name: data.author,
      description: data.description,
    })
    .select('*, fields(name)')
    .single();

  if (error) throw new Error(error.message);
  return toGame(row);
}
