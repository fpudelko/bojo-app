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
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=pl`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pl', 'User-Agent': 'bojo.app/1.0' } });
    const data = await res.json();
    if (!data[0]) return null;
    return {
      lat:   parseFloat(data[0].lat),
      lng:   parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 2).join(', '),
    };
  } catch {
    return null;
  }
}
