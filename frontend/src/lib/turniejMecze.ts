// Terminarz turnieju: grupy, areny, mecze. Wzorem `lib/turnieje.ts` —
// komponenty nie omijają tego pliku. Generowanie planu (kto z kim, kiedy)
// jest czystymi funkcjami w `lib/turniejFormat.ts`; tu tylko baza.
import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';
import type { NowyMecz } from './turniejFormat';
import type { TurniejArena, TurniejGrupa, TurniejMecz } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGrupa(row: any): TurniejGrupa {
  return { id: row.id, turniejId: row.turniej_id, nazwa: row.nazwa };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArena(row: any): TurniejArena {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    nazwa: row.nazwa,
    fieldId: row.field_id ?? undefined,
    kolejnosc: row.kolejnosc,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMecz(row: any): TurniejMecz {
  return {
    id: row.id,
    turniejId: row.turniej_id,
    numer: row.numer,
    faza: row.faza,
    grupaId: row.grupa_id ?? undefined,
    kolejka: row.kolejka ?? undefined,
    pozycjaWDrabince: row.pozycja_w_drabince ?? undefined,
    druzynaAId: row.druzyna_a_id ?? undefined,
    druzynaBId: row.druzyna_b_id ?? undefined,
    zrodloAMeczId: row.zrodlo_a_mecz_id ?? undefined,
    zrodloBMeczId: row.zrodlo_b_mecz_id ?? undefined,
    zrodloATyp: row.zrodlo_a_typ ?? undefined,
    zrodloBTyp: row.zrodlo_b_typ ?? undefined,
    arenaId: row.arena_id ?? undefined,
    zaplanowanyAt: row.zaplanowany_at ?? undefined,
    prowadzacyId: row.prowadzacy_id ?? undefined,
    status: row.status,
    rozpoczetyAt: row.rozpoczety_at ?? undefined,
    zakonczonyAt: row.zakonczony_at ?? undefined,
    wynikA: row.wynik_a,
    wynikB: row.wynik_b,
    sety: row.sety ?? undefined,
    karneA: row.karne_a ?? undefined,
    karneB: row.karne_b ?? undefined,
    wynikRecznie: row.wynik_recznie,
    walkowerDla: row.walkower_dla ?? undefined,
    zwyciezcaId: row.zwyciezca_id ?? undefined,
    mvpZawodnikId: row.mvp_zawodnik_id ?? undefined,
    notatka: row.notatka ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getGrupy(turniejId: string): Promise<TurniejGrupa[]> {
  const { data, error } = await supabase
    .from('turniej_grupy')
    .select('*')
    .eq('turniej_id', turniejId)
    .order('nazwa');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toGrupa);
}

export async function dodajGrupe(turniejId: string, nazwa: string): Promise<TurniejGrupa> {
  const { data, error } = await supabase
    .from('turniej_grupy')
    .insert({ turniej_id: turniejId, nazwa })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toGrupa(data);
}

export async function usunGrupe(id: string): Promise<void> {
  const { error } = await supabase.from('turniej_grupy').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getAreny(turniejId: string): Promise<TurniejArena[]> {
  const { data, error } = await supabase
    .from('turniej_areny')
    .select('*')
    .eq('turniej_id', turniejId)
    .order('kolejnosc');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toArena);
}

export async function dodajArene(turniejId: string, nazwa: string, kolejnosc: number): Promise<TurniejArena> {
  const { data, error } = await supabase
    .from('turniej_areny')
    .insert({ turniej_id: turniejId, nazwa, kolejnosc })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return toArena(data);
}

export async function zmienNazweAreny(id: string, nazwa: string): Promise<void> {
  await zaktualizujJedenWiersz('turniej_areny', id, { nazwa }, 'Nie udało się zmienić nazwy areny');
}

export async function usunArene(id: string): Promise<void> {
  const { error } = await supabase.from('turniej_areny').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getMecze(turniejId: string): Promise<TurniejMecz[]> {
  const { data, error } = await supabase
    .from('turniej_mecze')
    .select('*')
    .eq('turniej_id', turniejId)
    .order('numer');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMecz);
}

export async function getMecz(id: string): Promise<TurniejMecz | null> {
  const { data, error } = await supabase.from('turniej_mecze').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMecz(data) : null;
}

/** Klucze camelCase → payload dla RPC `zapisz_terminarz` (migracja 146). */
function doPayloadu(m: NowyMecz): Record<string, unknown> {
  return {
    id: m.id,
    numer: m.numer,
    faza: m.faza,
    grupaId: m.grupaId ?? null,
    kolejka: m.kolejka ?? null,
    pozycjaWDrabince: m.pozycjaWDrabince ?? null,
    druzynaAId: m.druzynaAId ?? null,
    druzynaBId: m.druzynaBId ?? null,
    zrodloAMeczId: m.zrodloAMeczId ?? null,
    zrodloBMeczId: m.zrodloBMeczId ?? null,
    zrodloATyp: m.zrodloATyp ?? null,
    zrodloBTyp: m.zrodloBTyp ?? null,
    arenaId: m.arenaId ?? null,
    zaplanowanyAt: m.zaplanowanyAt ?? null,
    status: m.status ?? 'zaplanowany',
    zwyciezcaId: m.zwyciezcaId ?? null,
    walkowerDla: m.walkowerDla ?? null,
  };
}

/**
 * Zapisuje cały wygenerowany terminarz naraz (nadpisuje poprzedni). Baza
 * odmawia (rzuca wyjątkiem), gdy jakikolwiek mecz turnieju jest już poza
 * statusem `zaplanowany` — patrz `zapisz_terminarz()` w migracji 146.
 */
export async function zapiszTerminarz(turniejId: string, mecze: NowyMecz[]): Promise<number> {
  const { data, error } = await supabase.rpc('zapisz_terminarz', {
    p_turniej: turniejId,
    p_mecze: mecze.map(doPayloadu),
  });
  if (error) throw new Error(error.message);
  return data as number;
}

/** Przesuwa `odMeczu` i wszystkie kolejne wciąż-zaplanowane mecze o `minuty`. */
export async function przesunTerminarz(turniejId: string, odMeczu: string, minuty: number): Promise<number> {
  const { data, error } = await supabase.rpc('przesun_terminarz', {
    p_turniej: turniejId,
    p_od_meczu: odMeczu,
    p_minuty: minuty,
  });
  if (error) throw new Error(error.message);
  return data as number;
}

export interface ZmianaMeczu {
  arenaId?: string | null;
  zaplanowanyAt?: string | null;
  prowadzacyId?: string | null;
  status?: TurniejMecz['status'];
}

/** Punktowa zmiana JEDNEGO meczu (przełożenie na inną arenę/godzinę, wyznaczenie
 *  sędziego) — bez przechodzenia przez `zapisz_terminarz()`, więc działa też
 *  po starcie turnieju. RLS (`czy_prowadzi_mecz`) i tak pilnuje, kto to robi. */
export async function updateMecz(id: string, zmiany: ZmianaMeczu): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ('arenaId' in zmiany) payload.arena_id = zmiany.arenaId;
  if ('zaplanowanyAt' in zmiany) payload.zaplanowany_at = zmiany.zaplanowanyAt;
  if ('prowadzacyId' in zmiany) payload.prowadzacy_id = zmiany.prowadzacyId;
  if ('status' in zmiany) payload.status = zmiany.status;
  await zaktualizujJedenWiersz('turniej_mecze', id, payload, 'Nie udało się zapisać zmiany meczu');
}
