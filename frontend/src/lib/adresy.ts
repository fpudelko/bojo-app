// Adresy turniejów i meczów z nazwą zamiast uuid (migracja 177).
//
//   bojo.pl/turnieje/gramy-dla-marysi-28-11-2026
//   bojo.pl/turnieje/gramy-dla-marysi-28-11-2026/mecz/5
//   bojo.pl/wydarzenia/czwartkowa-gierka-27-11-2026
//
// Trasy dalej mają w `[id]` uuid: adres z nazwą tłumaczy na uuid
// `src/middleware.ts` (przepisanie, nie przekierowanie), więc żaden ekran nie
// musiał się zmienić. Tu są dwie rzeczy dla ekranów: odczyt adresu obiektu
// (do linków udostępniania) i podmiana uuid na nazwę w pasku przeglądarki.
import { supabase } from './supabase';

export type RodzajAdresu = 'turniej' | 'mecz';

export const UUID_W_ADRESIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Kształt adresu z nazwą, ten sam co CHECK w migracji 177. */
export const KSZTALT_ADRESU = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const pamiec = new Map<string, Promise<string | null>>();

/** Adres z nazwą obiektu albo `null` (brak migracji 177, brak wiersza, błąd).
 *  Nigdy nie rzuca: bez adresu link zostaje przy uuid, który działa zawsze. */
export function pobierzAdres(rodzaj: RodzajAdresu, id: string): Promise<string | null> {
  const klucz = `${rodzaj}:${id}`;
  let wynik = pamiec.get(klucz);
  if (!wynik) {
    wynik = (async () => {
      try {
        const { data, error } = await supabase
          .from('adresy_z_nazwa')
          .select('slug')
          .eq(rodzaj === 'turniej' ? 'turniej_id' : 'event_id', id)
          .maybeSingle();
        if (error || !data?.slug) return null;
        return KSZTALT_ADRESU.test(data.slug) ? (data.slug as string) : null;
      } catch {
        return null;
      }
    })();
    pamiec.set(klucz, wynik);
    // Nieudany odczyt nie zostaje w pamięci na zawsze.
    void wynik.then((s) => { if (s === null) pamiec.delete(klucz); });
  }
  return wynik;
}

/**
 * Ścieżka z podmienionymi fragmentami: każdy segment równy kluczowi `zamiany`
 * dostaje wartość. Czysta funkcja, żeby dało się ją sprawdzić bez przeglądarki.
 */
export function podmienSegmenty(sciezka: string, zamiany: Record<string, string | undefined>): string {
  return sciezka
    .split('/')
    .map((seg) => zamiany[seg] ?? seg)
    .join('/');
}
