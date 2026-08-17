import { supabase } from './supabase';
import { zaktualizujJedenWiersz } from './zapytania';

/** Cykl życia zgłoszenia. Trzy stany wystarczą — więcej i nikt ich nie używa. */
export type StatusZgloszenia = 'nowe' | 'w_toku' | 'zamkniete';

export interface ZgloszenieBledu {
  id: string;
  rodzaj: 'uzytkownik' | 'awaria' | 'obiekt';
  opis: string;
  slad: string | null;
  adres: string | null;
  przegladarka: string | null;
  wersja: string | null;
  userId: string | null;
  fieldId: string | null;
  status: StatusZgloszenia;
  notatka: string | null;
  liczba: number;
  pierwszyRaz: string;
  ostatniRaz: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function naZgloszenie(w: any): ZgloszenieBledu {
  return {
    id: w.id,
    rodzaj: w.rodzaj,
    opis: w.opis,
    slad: w.slad ?? null,
    adres: w.adres ?? null,
    przegladarka: w.przegladarka ?? null,
    wersja: w.wersja ?? null,
    userId: w.user_id ?? null,
    fieldId: w.field_id ?? null,
    status: w.status,
    notatka: w.notatka ?? null,
    liczba: w.liczba ?? 1,
    pierwszyRaz: w.pierwszy_raz,
    ostatniRaz: w.ostatni_raz,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Lista zgłoszeń dla administratora.
 *
 * Sortowanie po `ostatni_raz`, nie po dacie powstania: błąd sprzed tygodnia,
 * który wciąż się dzieje, jest ważniejszy od wczorajszego, który ucichł.
 */
export async function pobierzZgloszenia(
  status?: StatusZgloszenia,
): Promise<ZgloszenieBledu[]> {
  let zapytanie = supabase
    .from('zgloszenia_bledow')
    .select('*')
    .order('ostatni_raz', { ascending: false })
    .limit(200);

  if (status) zapytanie = zapytanie.eq('status', status);

  const { data, error } = await zapytanie;
  if (error) throw new Error(error.message);
  return (data ?? []).map(naZgloszenie);
}

export async function zmienStatusZgloszenia(
  id: string,
  status: StatusZgloszenia,
): Promise<void> {
  // Przez `zaktualizujJedenWiersz`, bo tabela ma politykę tylko dla admina —
  // komuś bez uprawnień gołe `.update()` zwróciłoby sukces przy zerze
  // zmienionych wierszy (patrz `lib/zapytania.ts`).
  await zaktualizujJedenWiersz(
    'zgloszenia_bledow',
    id,
    { status },
    'Nie udało się zmienić statusu zgłoszenia',
  );
}

export async function zapiszNotatke(id: string, notatka: string): Promise<void> {
  await zaktualizujJedenWiersz(
    'zgloszenia_bledow',
    id,
    { notatka },
    'Nie udało się zapisać notatki',
  );
}

/** Ile jest nowych — do plakietki przy wejściu do panelu. */
export async function policzNowe(): Promise<number> {
  const { count, error } = await supabase
    .from('zgloszenia_bledow')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'nowe');
  if (error) return 0;
  return count ?? 0;
}
