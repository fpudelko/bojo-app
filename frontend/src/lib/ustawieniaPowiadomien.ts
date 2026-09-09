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
    // Para do powyższego (migracja `135`). Wygaśnięcie oferty było dotąd
    // CAŁKOWICIE CICHE: gracz nie dowiadywał się, że miejsce przepadło, ani że
    // wraca do kolejki. Stoi zaraz pod ofertą, bo to ta sama sprawa widziana
    // z drugiej strony.
    typ: 'oferta_wygasla',
    nazwa: 'Czas na przyjęcie miejsca minął',
    opis: 'Nie zdążyłeś odpowiedzieć — miejsce poszło dalej, a Ty wracasz na koniec kolejki',
    wazne: true,
  },
  {
    typ: 'mecz_odwolany',
    nazwa: 'Mecz odwołany',
    opis: 'Organizator odwołał mecz, w którym grasz',
    wazne: true,
  },
  {
    // Para do powyższego (migracja `139`). Stoi bezpośrednio pod odwołaniem,
    // bo to ta sama sprawa widziana z drugiej strony — i bo wyłączenie
    // samego sprostowania, przy włączonym odwołaniu, jest ustawieniem
    // „powiedz mi tylko złe wiadomości". Nikt tego świadomie nie chce, ale
    // rozdzielone o dziesięć pozycji dałoby się w to wpaść przypadkiem.
    typ: 'mecz_przywrocony',
    nazwa: 'Mecz jednak się odbędzie',
    opis: 'Organizator cofnął odwołanie meczu, o którego odwołaniu już wiesz',
    wazne: true,
  },
  {
    // DWA TYPY, KTÓRYCH TU NIE BYŁO, choć realnie przychodzą od migracji `065`
    // i `114` — czyli nie dało się ich wyłączyć nawet dla pusha, a od `140`
    // chodzą także pocztą. Stoją przy odwołaniu, bo to ta sama rodzina:
    // „coś, co unieważnia Twoje plany na ten wieczór".
    typ: 'zmiana_terminu',
    nazwa: 'Zmiana terminu meczu',
    opis: 'Organizator przesunął mecz na inny dzień albo godzinę',
    wazne: true,
  },
  {
    typ: 'zmiana_warunkow_meczu',
    nazwa: 'Zmiana miejsca lub kosztu',
    opis: 'Mecz przeniesiony na inne boisko albo zmieniona cena od osoby',
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

/**
 * Rodzaje, które chodzą TAKŻE POCZTĄ (migracja `140`) — wąska lista, ta sama
 * co w wyzwalaczu `wyslij_mail_po_powiadomieniu()`.
 *
 * DLACZEGO TYLKO TYLE. Poczta jest kanałem, który przerywa dzień; wysyłana
 * przy byle czym przestaje być czytana, a wtedy przestaje działać także przy
 * rzeczach ważnych. Zostają więc te cztery, przy których niedoręczenie kończy
 * się CZYIMŚ WYJAZDEM NA BOISKO — i tylko one.
 *
 * Ta lista MUSI zgadzać się z warunkiem w migracji `140`; pilnuje tego test
 * `ustawieniaPowiadomien.test.ts`. Rozjazd oznaczałby ekran, który obiecuje
 * wyłączenie maila, jaki i tak przyjdzie — albo odwrotnie.
 */
export const RODZAJE_MAILOWE = [
  'mecz_odwolany',
  'zmiana_terminu',
  'zmiana_warunkow_meczu',
  'mecz_przywrocony',
] as const;

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

// ---------------------------------------------------------------------------
// Kanał pocztowy (migracja `140`)
// ---------------------------------------------------------------------------
// OSOBNA KOLUMNA, nie wspólna z `push_wylaczone`. To są dwa różne kanały
// o różnej cenie pomyłki: wyłączenie pusha znaczy „nie zawracaj mi telefonu",
// wyłączenie poczty — „nie pisz do mnie". Wspólna lista kazałaby wybierać oba
// naraz, a to nie jest ta sama decyzja.

export async function pobierzMailWylaczone(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('mail_wylaczone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.mail_wylaczone as string[] | null) ?? [];
}

export async function zapiszMailWylaczone(userId: string, wylaczone: string[]): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ mail_wylaczone: wylaczone })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Rodzaje mailowe w kolejności i z opisami z `RODZAJE_POWIADOMIEN` — żeby ten
 *  sam typ nazywał się na obu listach tak samo. */
export function rodzajeMailowe(): RodzajPowiadomienia[] {
  return RODZAJE_POWIADOMIEN.filter((r) => (RODZAJE_MAILOWE as readonly string[]).includes(r.typ));
}
