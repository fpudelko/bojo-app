import { supabase } from './supabase';

// Faza 3 SEO/GEO (BACKLOG.md §7a) — mikro-ankiety UGC pod obiektem. Bliźniak
// `lib/fieldComments.ts`: publiczny odczyt, zapis wyłącznie we własnym imieniu
// (RLS w migracji 123), userId przekazywany z komponentu (useAuth()), nie
// domyślany po stronie bazy.

export type FaktObiektu = 'oswietlenie' | 'nawierzchnia';

export interface Potwierdzenie {
  fakt: FaktObiektu;
  wartosc: string;
}

/** Zliczone głosy per (fakt, wartość) — to, co się wyświetla jako
 *  "potwierdzone przez N graczy". */
export interface PotwierdzeniaZliczone {
  fakt: FaktObiektu;
  wartosc: string;
  liczba: number;
}

/** Ile niezależnych głosów uzasadnia pokazanie "potwierdzone przez graczy" —
 *  jeden klik nie jest jeszcze potwierdzeniem, tylko czyjąś opinią. Współdzielone
 *  między `AnkietyObiektu.tsx` (widoczna treść) i `lib/structuredData.ts`
 *  (dane strukturalne na tej samej stronie) — jeden próg, żeby fakt pokazany
 *  robotowi nigdy nie wyprzedzał tego, co widzi człowiek. */
export const QUORUM_POTWIERDZEN = 2;

/** Najliczniej potwierdzona wartość dla danego faktu, albo `null`, gdy nikt
 *  jeszcze nie głosował. Nie sprawdza quorum — wołający decyduje, czy
 *  `liczba >= QUORUM_POTWIERDZEN` uzasadnia pokazanie wyniku. */
export function najlepszePotwierdzenie(
  zliczone: readonly PotwierdzeniaZliczone[],
  fakt: FaktObiektu,
): PotwierdzeniaZliczone | null {
  const dlaFaktu = zliczone.filter((z) => z.fakt === fakt);
  if (dlaFaktu.length === 0) return null;
  return dlaFaktu.reduce((a, b) => (b.liczba > a.liczba ? b : a));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPotwierdzenie(row: any): Potwierdzenie {
  return { fakt: row.fakt, wartosc: row.wartosc };
}

/** Wszystkie głosy dla obiektu, zliczone per (fakt, wartość) — do wyświetlenia
 *  bez ujawniania, KTO konkretnie zagłosował (agregacja po stronie klienta,
 *  bo tabela ma publiczny SELECT, ale liczba wierszy na obiekt jest mała). */
export async function pobierzPotwierdzenia(fieldId: string): Promise<PotwierdzeniaZliczone[]> {
  const { data, error } = await supabase
    .from('potwierdzenia_obiektu')
    .select('fakt, wartosc')
    .eq('field_id', fieldId);
  if (error) throw new Error(error.message);

  const liczniki = new Map<string, PotwierdzeniaZliczone>();
  for (const row of (data ?? []).map(toPotwierdzenie)) {
    const klucz = `${row.fakt}:${row.wartosc}`;
    const istniejacy = liczniki.get(klucz);
    if (istniejacy) istniejacy.liczba += 1;
    else liczniki.set(klucz, { fakt: row.fakt, wartosc: row.wartosc, liczba: 1 });
  }
  return Array.from(liczniki.values());
}

/** Własny głos zalogowanego użytkownika per fakt — do podświetlenia
 *  wybranej opcji zamiast pytania od nowa przy każdej wizycie. */
export async function pobierzMojePotwierdzenia(
  fieldId: string,
  userId: string,
): Promise<Partial<Record<FaktObiektu, string>>> {
  const { data, error } = await supabase
    .from('potwierdzenia_obiektu')
    .select('fakt, wartosc')
    .eq('field_id', fieldId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const moje: Partial<Record<FaktObiektu, string>> = {};
  for (const row of (data ?? []).map(toPotwierdzenie)) moje[row.fakt] = row.wartosc;
  return moje;
}

/** Zapisuje albo zmienia własny głos. `onConflict` na (field_id, user_id, fakt)
 *  z migracji 123 — drugi głos na ten sam fakt NADPISUJE pierwszy, nie
 *  dokłada się do niego. */
export async function zapiszPotwierdzenie(
  fieldId: string,
  userId: string,
  fakt: FaktObiektu,
  wartosc: string,
): Promise<void> {
  const { error } = await supabase
    .from('potwierdzenia_obiektu')
    .upsert(
      { field_id: fieldId, user_id: userId, fakt, wartosc },
      { onConflict: 'field_id,user_id,fakt' },
    );
  if (error) throw new Error(error.message);
}
