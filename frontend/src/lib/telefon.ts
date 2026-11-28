import { supabase } from './supabase';
import { normalizePhone, validatePhone } from './validation';

/**
 * Numer telefonu gracza: własny (profil) i numery składu dla organizatora.
 *
 * Od migracji `193` kolumna `profiles.phone` NIE jest czytelna przez API —
 * wcześniej numer każdego użytkownika dało się pobrać bez logowania. Własny
 * numer czyta i zapisuje się wyłącznie przez funkcje bazy, a numery składu
 * oddaje `telefony_skladu()` organizatorowi meczu z włączonym
 * „Wymagaj numeru telefonu” (`events.require_phone`).
 */

/** Fragment komunikatu, którym baza odbija zapis bez numeru
 *  (`pilnuj_wymaganego_telefonu()`, migracja `193`). */
export const BLAD_BRAK_TELEFONU = 'wymaga numeru telefonu';

/** Czy błąd zapisu oznacza „najpierw podaj numer”. */
export function czyBladBrakuTelefonu(blad: unknown): boolean {
  const tekst = blad instanceof Error ? blad.message : String(blad ?? '');
  return tekst.includes(BLAD_BRAK_TELEFONU);
}

/** Sprawdza i normalizuje numer wpisany w formularzu. Pusty → `null`.
 *  Rzuca błąd z komunikatem do pokazania pod polem. */
export function przygotujTelefon(surowy: string): string | null {
  const t = surowy.trim();
  if (!t) return null;
  if (!validatePhone(t)) {
    throw new Error('Podaj numer w formacie 9-cyfrowym lub +48XXXXXXXXX.');
  }
  return normalizePhone(t);
}

export interface MojTelefon {
  phone: string | null;
  phoneConsent: boolean;
}

export async function mojTelefon(): Promise<MojTelefon> {
  const { data, error } = await supabase.rpc('moj_telefon');
  if (error) throw new Error(error.message);
  const wiersz = Array.isArray(data) ? data[0] : data;
  return {
    phone: wiersz?.phone ?? null,
    phoneConsent: !!wiersz?.phone_consent,
  };
}

/** Zapisuje własny numer w profilu. Pusty numer kasuje numer razem ze zgodą. */
export async function zapiszMojTelefon(telefon: string | null, zgoda: boolean): Promise<void> {
  const { error } = await supabase.rpc('zapisz_moj_telefon', {
    p_telefon: telefon,
    p_zgoda: zgoda,
  });
  if (error) throw new Error(error.message);
}

/** Numery składu: `id` wpisu w `event_participants` → numer.
 *  Pusta mapa, gdy wywołujący nie zarządza składem albo mecz numeru nie wymaga. */
export async function telefonySkladu(eventId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('telefony_skladu', { p_event_id: eventId });
  if (error) throw new Error(error.message);
  const mapa: Record<string, string> = {};
  for (const w of (data ?? []) as { uczestnik: string; telefon: string }[]) {
    if (w.uczestnik && w.telefon) mapa[w.uczestnik] = w.telefon;
  }
  return mapa;
}

/** `tel:` bez spacji — część telefonów nie wybiera numeru ze spacjami. */
export function linkTelefonu(telefon: string): string {
  return `tel:${telefon.replace(/[^\d+]/g, '')}`;
}
