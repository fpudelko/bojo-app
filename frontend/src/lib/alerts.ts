import { supabase } from './supabase';
import type { GameAlert } from '@/types';

function toAlert(row: any): GameAlert {
  return {
    id:          row.id,
    userId:      row.user_id,
    sport:       row.sport ?? undefined,
    daysOfWeek:  row.days_of_week ?? [],
    lat:         row.lat,
    lng:         row.lng,
    radiusKm:    row.radius_km,
    cityLabel:   row.city_label ?? undefined,
    isActive:    row.is_active,
    createdAt:   row.created_at,
  };
}

export async function getMyAlert(): Promise<GameAlert | null> {
  const { data } = await supabase
    .from('game_alerts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toAlert(data) : null;
}

export interface AlertInput {
  sport?:      string;
  daysOfWeek:  number[];
  lat:         number;
  lng:         number;
  radiusKm:    number;
  cityLabel?:  string;
}

export async function saveAlert(userId: string, input: AlertInput): Promise<GameAlert> {
  // Deactivate any previous alerts first
  await supabase.from('game_alerts').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);

  const { data, error } = await supabase
    .from('game_alerts')
    .insert({
      user_id:      userId,
      sport:        input.sport ?? null,
      days_of_week: input.daysOfWeek,
      lat:          input.lat,
      lng:          input.lng,
      radius_km:    input.radiusKm,
      city_label:   input.cityLabel ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toAlert(data);
}

export async function deleteMyAlert(id: string): Promise<void> {
  await supabase.from('game_alerts').delete().eq('id', id);
}

/** Count users with active alerts matching a potential event — shown on create form */
export async function countAlertSeekers(lat: number, lng: number, sport: string, dow: number): Promise<number> {
  const { data } = await supabase.rpc('count_alert_seekers', {
    p_lat: lat, p_lng: lng, p_sport: sport, p_dow: dow,
  });
  return (data as number) ?? 0;
}

/** Geocode a Polish city/address via Nominatim (free, no key) */
export async function geocodeCity(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return {
      lat:   parseFloat(data[0].lat),
      lng:   parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 2).join(', '),
    };
  } catch {
    return null;
  }
}

// Zakres promienia alertu. Suwak w oknie alertu chodzi po tych wartościach,
// a `domyslneZFiltrow` przycina do nich promień przyniesiony z filtrów listy
// (te chodzą od 1 km, więc same z siebie potrafią podać wartość spoza skali).
export const PROMIEN_MIN = 3;
export const PROMIEN_MAX = 30;
export const PROMIEN_DOMYSLNY = 15;

/**
 * Ustawienia, z jakimi otwiera się okno alertu wywołane z pustej listy meczów.
 *
 * Człowiek właśnie powiedział filtrami, czego szuka — pytanie go o to drugi raz
 * w oknie alertu byłoby przepisywaniem tego samego. Jeden sport przenosi się
 * wprost; przy dwóch i więcej alert nie ma czego przenieść (trzyma dokładnie
 * jeden sport albo dowolny), więc uczciwiej zostawić „dowolny" niż wybrać za
 * kogoś jeden z dwóch.
 */
export function domyslneZFiltrow(filtry: {
  sports: string[];
  radiusKm: number | null;
  pozycja: { lat: number; lng: number } | null;
}): { sport?: string; radiusKm: number; lat?: number; lng?: number } {
  const promien = filtry.radiusKm ?? PROMIEN_DOMYSLNY;
  return {
    sport:    filtry.sports.length === 1 ? filtry.sports[0] : undefined,
    radiusKm: Math.min(PROMIEN_MAX, Math.max(PROMIEN_MIN, promien)),
    lat:      filtry.pozycja?.lat,
    lng:      filtry.pozycja?.lng,
  };
}
