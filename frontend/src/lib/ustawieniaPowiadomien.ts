import { supabase } from './supabase';

/**
 * Czego użytkownik chce (i nie chce) dostawać na telefon.
 *
 * PRZECHOWUJEMY WYŁĄCZONE, NIE WŁĄCZONE. Domyślnie pusta lista = wszystko
 * działa, więc nowy rodzaj powiadomienia nie wymaga „obudzenia" nikomu
 * ustawień. Przy odwrotnym zapisie każdy nowy rodzaj byłby domyślnie wyłączony
 * dla wszystkich, którzy kiedykolwiek dotknęli tego ekranu — czyli funkcja
 * wchodziłaby martwa.
 *
 * DOTYCZY WYŁĄCZNIE PUSHA. Dzwonek w aplikacji pokazuje wszystko: to jest
 * historia tego, co się wydarzyło, a nie kanał, który przerywa komuś dzień.
 * „Wyłączone" znaczy „nie zawracaj mi telefonu", nie „ukryj to przede mną".
 */

export interface RodzajPowiadomienia {
  typ: string;
  nazwa: string;
  opis: string;
  /** Rzeczy, których wyłączenie prawie zawsze jest pomyłką — oznaczone, żeby
   *  wyłączenie było świadome, a nie przypadkowe przy przelatywaniu listy. */
  wazne?: boolean;
}

/**
 * Kolejność jest treścią: od rzeczy, które wymagają REAKCJI TERAZ, przez
 * zmiany w meczu, po rozmowy. Kto przewinie do połowy i przestanie czytać,
 * i tak zobaczy to, co najważniejsze.
 */
export const RODZAJE_POWIADOMIEN: RodzajPowiadomienia[] = [
  {
    typ: 'reserve_claim_offered',
    nazwa: 'Zwolniło się miejsce',
    opis: 'Jesteś na rezerwie i ktoś się wypisał — masz miejsce do przyjęcia',
    wazne: true,
  },
  {
    typ: 'mecz_odwolany',
    nazwa: 'Mecz odwołany',
    opis: 'Organizator odwołał mecz, w którym grasz',
    wazne: true,
  },
  {
    typ: 'pytanie_o_udzial',
    nazwa: 'Pytanie, czy grasz',
    opis: 'Organizator pyta ekipę, kto wchodzi',
    wazne: true,
  },
  {
    typ: 'zaproszenie_na_mecz',
    nazwa: 'Zaproszenie na mecz',
    opis: 'Ktoś zaprosił Cię imiennie',
    wazne: true,
  },
  {
    typ: 'prosba_o_dolaczenie',
    nazwa: 'Prośba o dołączenie',
    opis: 'Ktoś chce wejść do Twojego meczu i czeka na zgodę',
    wazne: true,
  },
  {
    // Migracja `129`. Pierwsze powiadomienie w Bojo, które powstaje SAMO,
    // z zegara — reszta jest reakcją na czyjeś kliknięcie. Dla organizatora
    // niesie dodatkowo liczbę brakujących osób, bo dzień wcześniej to ostatni
    // moment, w którym da się z tym cokolwiek zrobić.
    typ: 'przypomnienie_o_meczu',
    nazwa: 'Przypomnienie dzień przed',
    opis: 'Jutro grasz — godzina, miejsce i stan składu',
    wazne: true,
  },
  {
    typ: 'po_meczu_do_domkniecia',
    nazwa: 'Po meczu: wynik i rozliczenie',
    opis: 'Dostaje organizator dzień po meczu i tylko wtedy, gdy zostało coś do domknięcia',
  },
  {
    typ: 'sklady_opublikowane',
    nazwa: 'Są składy',
    opis: 'Organizator opublikował podział na drużyny',
  },
  {
    typ: 'nowy_mecz_w_grupie',
    nazwa: 'Nowy mecz w ekipie',
    opis: 'Ktoś z Twojej ekipy założył mecz',
  },
  {
    typ: 'wiadomosc_w_meczu',
    nazwa: 'Wiadomości w meczu',
    opis: 'Ktoś napisał w rozmowie meczu, w którym grasz — najwyżej raz na godzinę',
  },
  {
    typ: 'wiadomosc_w_grupie',
    nazwa: 'Wiadomości w ekipie',
    opis: 'Ktoś napisał na tablicy Twojej ekipy — najwyżej raz na godzinę',
  },
  {
    typ: 'ogloszenie_w_grupie',
    nazwa: 'Ogłoszenia ekipy',
    opis: 'Przypięty wpis, czyli coś, co kapitan uznał za ważne',
  },
];

export async function pobierzWylaczone(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('push_wylaczone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.push_wylaczone as string[] | null) ?? [];
}

/**
 * Zapis całej listy naraz, nie pojedynczego przełącznika.
 *
 * Kolumna jest tablicą, więc dopisywanie i usuwanie po jednym elemencie
 * z dwóch kart naraz kończyłoby się nadpisaniem cudzej zmiany. Przy jednym
 * ekranie ustawień to teoretyczne, ale zapis całości jest tak samo prosty
 * i nie ma tego problemu w ogóle.
 */
export async function zapiszWylaczone(userId: string, wylaczone: string[]): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_wylaczone: wylaczone })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Czysta funkcja do przełączania — testowalna bez bazy. */
export function przelacz(wylaczone: string[], typ: string, wlaczyc: boolean): string[] {
  if (wlaczyc) return wylaczone.filter((x) => x !== typ);
  return wylaczone.includes(typ) ? wylaczone : [...wylaczone, typ];
}
