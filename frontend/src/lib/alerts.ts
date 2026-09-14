import { supabase } from './supabase';
import type { GameAlert } from '@/types';
import { PROMIEN_DOMYSLNY_KM, indeksPromienia, promienZIndeksu } from './miejscowosci';

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
    expiresAt:   row.expires_at ?? undefined,
    godzinaOd:   row.godzina_od ?? undefined,
    godzinaDo:   row.godzina_do ?? undefined,
    kanalEmail:  row.kanal_email ?? true,
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
  /** ISO albo `null` = bezterminowo (domyślnie, decyzja właściciela 2026-09-14). */
  expiresAt?:  string | null;
  /** Para 0–23 albo oba `null` = dowolna pora. Migracja `148` pilnuje, że idą parami. */
  godzinaOd?:  number | null;
  godzinaDo?:  number | null;
  kanalEmail?: boolean;
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
      expires_at:   input.expiresAt ?? null,
      godzina_od:   input.godzinaOd ?? null,
      godzina_do:   input.godzinaDo ?? null,
      kanal_email:  input.kanalEmail ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return toAlert(data);
}

/**
 * Wyłącza alert tokenem z maila, BEZ logowania (migracja `148`).
 *
 * Leci przez funkcję `SECURITY DEFINER`, nie przez zwykły `update`: polityka
 * RLS pozwalająca `anon` aktualizować `game_alerts` po tokenie otworzyłaby całą
 * tabelę — także `lat`, `lng` i `user_id` — a potrzebna jest dokładnie jedna
 * operacja. Zwraca `false`, gdy tokenu nie ma albo alert był już wyłączony;
 * strona nie rozróżnia tych przypadków, bo dla klikającego znaczą to samo.
 */
export async function wylaczAlertTokenem(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('wylacz_alert_tokenem', { p_token: token });
  if (error) throw error;
  return data === true;
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

// Promień alertu chodzi po TEJ SAMEJ skali co filtry (`PROMIENIE_SUWAK_KM`
// w `lib/miejscowosci.ts`) — od 2026-09-14 okno alertu używa tych samych
// kontrolek co arkusz filtrów, więc własny zakres 3–30 km oznaczałby, że te
// same kilometry znaczą w dwóch miejscach co innego. Ograniczenie w bazie
// poszerzyła migracja `148` do 1–100 km.
export const PROMIEN_DOMYSLNY = PROMIEN_DOMYSLNY_KM;

/** Ile alert ma żyć. `null` = bezterminowo i to jest wartość domyślna. */
export const OKRESY_ALERTU: { dni: number | null; etykieta: string }[] = [
  { dni: null, etykieta: 'Bezterminowo' },
  { dni: 30,   etykieta: 'Przez miesiąc' },
  { dni: 14,   etykieta: 'Przez 2 tygodnie' },
  { dni: 7,    etykieta: 'Przez tydzień' },
];

/** Dni → moment wygaśnięcia. `null` zostaje `null`, czyli bezterminowo. */
export function wygasaZa(dni: number | null, teraz: Date = new Date()): string | null {
  if (dni == null) return null;
  return new Date(teraz.getTime() + dni * 86_400_000).toISOString();
}

/** Moment wygaśnięcia → liczba dni z `OKRESY_ALERTU`, do wczytania w oknie.
 *  Nieznany odstęp ląduje na najbliższym okresie, a nie przewraca wyboru. */
export function okresZDaty(expiresAt: string | null | undefined, teraz: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const dni = (new Date(expiresAt).getTime() - teraz.getTime()) / 86_400_000;
  const zDniami = OKRESY_ALERTU.filter((o) => o.dni != null) as { dni: number; etykieta: string }[];
  let najlepszy = zDniami[0];
  for (const o of zDniami) {
    if (Math.abs(o.dni - dni) < Math.abs(najlepszy.dni - dni)) najlepszy = o;
  }
  return najlepszy.dni;
}

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
    // Przez skalę suwaka, nie przez `clamp`: filtr mógł mieć 6 km, a to nie
    // jest żaden przystanek — alert ma wystartować z wartości, którą suwak
    // w oknie potrafi pokazać.
    radiusKm: promienZIndeksu(indeksPromienia(promien)),
    lat:      filtry.pozycja?.lat,
    lng:      filtry.pozycja?.lng,
  };
}
