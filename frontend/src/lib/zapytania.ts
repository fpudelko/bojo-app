// Dwie pułapki Supabase/PostgREST, które NIE dają błędu — dają fałszywy sukces.
// Oba helpery istnieją po to, żeby cisza zamieniła się w wyjątek.

import { supabase } from './supabase';

/**
 * UPDATE, który musi trafić w dokładnie jeden wiersz.
 *
 * PUŁAPKA: gdy polityka RLS nie pasuje, Postgres nie zgłasza błędu — po prostu
 * aktualizuje 0 wierszy i zwraca sukces. Objaw po stronie użytkownika:
 * „przycisk nic nie robi". Realny przypadek z tego repo: brakowało polityki
 * pozwalającej użytkownikowi zmienić własny wpis w `event_participants`
 * (naprawione w migracji `053`) — do jej wykrycia trzeba było czytać polityki,
 * bo aplikacja milczała.
 *
 * `.select('id')` po `.update()` zmusza PostgREST do oddania tego, co naprawdę
 * zmienił. Pusta odpowiedź = brak uprawnień albo nieistniejący wiersz.
 *
 * @throws gdy nie zmieniono żadnego wiersza
 */
export async function zaktualizujJedenWiersz(
  tabela: string,
  id: string,
  zmiany: Record<string, unknown>,
  opis = 'Nie udało się zapisać zmiany',
): Promise<void> {
  const { data, error } = await supabase
    .from(tabela)
    .update(zmiany)
    .eq('id', id)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      `${opis} — baza nie zmieniła żadnego wiersza. `
      + 'Najczęstsza przyczyna: brak uprawnień (RLS) albo wpis już nie istnieje.',
    );
  }
}

/** Domyślny rozmiar strony. Poniżej serwerowego limitu „Max rows" w Supabase,
 *  żeby pełna strona zawsze znaczyła „jest więcej", a nie „to już koniec". */
const STRONA = 1000;

/**
 * Pobiera WSZYSTKIE wiersze zapytania, stronami.
 *
 * PUŁAPKA: PostgREST ma serwerowy limit wierszy na odpowiedź i przekroczenie go
 * NIE jest błędem — przychodzi po cichu obcięta lista. Przy katalogu boisk,
 * który przekroczył cztery tysiące pozycji, indeks slugów budowany jednym
 * zapytaniem gubił ogon: świeżo zaimportowane boisko nie miało swojego adresu
 * i jego strona zwracała „Nie znaleziono".
 *
 * `budujZapytanie(od, do)` ma zwrócić zapytanie z `.range(od, do)`. Pętla kończy
 * się, gdy strona przyszła niepełna — czyli na pewno ostatnia.
 *
 * @param maksWierszy bezpiecznik przed nieskończoną pętlą, gdy zapytanie
 *        zwraca stale pełne strony (np. przez zły `.order()`).
 */
export async function pobierzWszystkie<T>(
  budujZapytanie: (od: number, doIndeksu: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  { strona = STRONA, maksWierszy = 200_000 }: { strona?: number; maksWierszy?: number } = {},
): Promise<T[]> {
  const wszystkie: T[] = [];
  for (let od = 0; od < maksWierszy; od += strona) {
    const { data, error } = await budujZapytanie(od, od + strona - 1);
    if (error) throw new Error(error.message);
    const partia = data ?? [];
    wszystkie.push(...partia);
    if (partia.length < strona) return wszystkie;
  }
  throw new Error(
    `pobierzWszystkie: przekroczono bezpiecznik ${maksWierszy} wierszy. `
    + 'Zapytanie zwraca stale pełne strony — sprawdź, czy ma stabilne sortowanie.',
  );
}

/**
 * Uruchamia zapis, a gdy padnie z powodu MARTWEJ SESJI — odświeża ją i próbuje
 * jeszcze raz.
 *
 * SKĄD TO SIĘ WZIĘŁO. Użytkownik z otwartą od rana kartą dostał przy wysyłaniu
 * wiadomości surowy komunikat z Postgresa:
 *
 *     new row violates row-level security policy for table "event_comments"
 *
 * Polityka na tej tabeli to `WITH CHECK (auth.uid() = user_id)` — najluźniejsza
 * z możliwych, pozwala każdemu zalogowanemu dopisać WŁASNY wpis. Skoro mimo to
 * nie przeszła, znaczy to jedno: `auth.uid()` po stronie bazy było puste albo
 * inne niż `user.id`, który wysłała przeglądarka. Czyli token wygasł, a aplikacja
 * dalej trzymała użytkownika w pamięci i wyglądała na zalogowaną.
 *
 * To jest pułapka klasy „ciche kłamstwo interfejsu": ekran mówi, że jesteś
 * zalogowany, baza uważa inaczej, a komunikat mówi o polityce bezpieczeństwa,
 * czyli o czymś, z czym użytkownik nie ma nic wspólnego.
 *
 * Odświeżenie zwykle wystarcza — wygasa token dostępu (godzina), a token
 * odświeżający żyje tygodniami. Dopiero gdy i on padnie, trzeba zalogować się
 * ponownie i wtedy mówimy to wprost.
 */
export async function zPonowieniemPoOdswiezeniu<T>(zapis: () => Promise<T>): Promise<T> {
  try {
    return await zapis();
  } catch (blad) {
    if (!czyMartwaSesja(blad)) throw blad;

    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      throw new Error('Sesja wygasła — zaloguj się ponownie.');
    }
    // Druga próba jest OSTATNIA. Gdyby i ona padła na tym samym, problemem nie
    // jest sesja i błąd ma polecieć w oryginalnej postaci — inaczej zapętlimy
    // się na czymś, czego odświeżanie nie naprawia.
    return await zapis();
  }
}

/** Czy błąd wygląda na „baza nie wie, kim jesteś", a nie na brak uprawnień. */
function czyMartwaSesja(blad: unknown): boolean {
  const tekst = blad instanceof Error ? blad.message : String(blad);
  return /row-level security|violates row-level|JWT|token is expired|invalid claim/i.test(tekst);
}
