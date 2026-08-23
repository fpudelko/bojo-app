/**
 * Które sekcje strony meczu są rozwinięte na wejściu.
 *
 * DLACZEGO SEKCJE, A NIE ZAKŁADKI. Na tej stronie pytania się PRZEPLATAJĄ:
 * „czy się odbędzie" to licznik, skład i minimum naraz. Zakładka rozdziela to,
 * co trzeba widzieć razem, a do tego cztery z sześciu dotychczasowych zakładek
 * pojawiały się warunkowo — pasek potrafił mieć od dwóch do sześciu pozycji.
 * Najgorszy przypadek: „Taktyka" pokazywała się dopiero komuś, kto MA już
 * przypisaną drużynę, więc gracz, który nie wiedział, w której jest, nie miał
 * jak tego sprawdzić.
 *
 * DLACZEGO KOLEJNOŚĆ JEST STAŁA. Kuszące jest przestawianie sekcji zależnie od
 * fazy meczu („dzień przed pokaż najpierw drużyny"). To zły pomysł i został
 * odrzucony świadomie: ludzie zapamiętują POŁOŻENIE („kasa jest na dole"),
 * a ruchoma kolejność psuje tę pamięć, powrót na tę samą pozycję po przewinięciu
 * i każdą instrukcję zaczynającą się od „przewiń do…". Zmienia się wyłącznie to,
 * co jest ROZWINIĘTE.
 *
 * REGUŁA MIEŚCI SIĘ W JEDNYM ZDANIU:
 *
 *   Rozwinięte jest to, co czeka na decyzję TWOJĄ.
 *   Zwinięte — to, co załatwione albo puste.
 *
 * Nie „co ważne ogólnie", tylko „co moje". Dzięki temu ta sama reguła daje inny
 * ekran organizatorowi i graczowi, bez ani jednego wyjątku per rola.
 *
 * DWIE BARIERY, bez których to zamienia się w walkę z użytkownikiem (pilnuje
 * ich `EventDetailClient`, nie ta funkcja):
 *   1. nigdy nie zwijamy tego, co człowiek sam otworzył — automat ustala tylko
 *      stan startowy,
 *   2. zwinięcie jest zapamiętane per mecz, więc decyzja człowieka wygrywa
 *      z regułą przy następnym wejściu.
 *
 * I zasada twarda: ŻADNA SEKCJA NIE ZNIKA. Zwinięta „Kasa" przy meczu za darmo
 * mówi „Mecz za darmo — nie ma czego dzielić". Znikające elementy to najgorszy
 * rodzaj interfejsu: uczysz się, gdzie coś jest, a potem tego nie ma.
 */

export type SekcjaMeczu = 'druzyny' | 'kasa' | 'wynik' | 'ustawienia';

export interface StanMeczu {
  /** Godziny do rozpoczęcia; ujemne = mecz już był. */
  godzinDoMeczu: number;
  /** Mecz się odbył i wolno wpisać wynik. */
  poMeczu: boolean;
  odwolany: boolean;

  /** Czy patrzący zarządza tym meczem (organizator albo delegat od edycji). */
  zarzadza: boolean;
  /** Prośby o dołączenie czekające na decyzję — tylko dla zarządzającego. */
  prosbyDoDecyzji: number;

  /** Składy opublikowane. */
  druzynyOpublikowane: boolean;
  /** Nieobejrzane propozycje składu od graczy — dla zarządzającego. */
  propozycjeSkladu: number;

  /** Mecz kosztuje. */
  platny: boolean;
  /** Ja zalegam. */
  zalegam: boolean;
  /** Ktoś nie oddał — tylko dla zarządzającego. */
  ktosNieOddal: boolean;

  /** Wynik niewpisany. */
  wynikBrakuje: boolean;
}

/**
 * Zbiór sekcji rozwiniętych na wejściu.
 *
 * Odwołany mecz nie rozwija niczego: nie ma decyzji do podjęcia, a rozwinięte
 * sekcje sugerowałyby, że jest.
 */
export function sekcjeRozwiniete(s: StanMeczu): Set<SekcjaMeczu> {
  const otwarte = new Set<SekcjaMeczu>();
  if (s.odwolany) return otwarte;

  // DRUŻYNY — gdy jest co czytać (składy stoją) albo gdy to Ty masz je ustalić.
  // Doba przed meczem jest tu progiem, bo wtedy podział przestaje być abstrakcją.
  if (s.druzynyOpublikowane) otwarte.add('druzyny');
  if (s.zarzadza && s.propozycjeSkladu > 0) otwarte.add('druzyny');
  if (s.zarzadza && !s.druzynyOpublikowane && s.godzinDoMeczu <= 24 && s.godzinDoMeczu > -1) {
    otwarte.add('druzyny');
  }

  // KASA — wyłącznie gdy pieniądze są TWOIM problemem. Sam fakt, że mecz jest
  // płatny, nie wystarcza: opłacony mecz nie wymaga niczego.
  if (s.platny && s.zalegam && s.godzinDoMeczu <= 24) otwarte.add('kasa');
  if (s.zarzadza && s.platny && s.poMeczu && s.ktosNieOddal) otwarte.add('kasa');

  // WYNIK — po meczu i tylko dla tego, kto może go wpisać.
  if (s.zarzadza && s.poMeczu && s.wynikBrakuje) otwarte.add('wynik');

  // USTAWIENIA nie rozwijają się NIGDY. To nie jest decyzja, która na Ciebie
  // czeka — to szuflada, do której wchodzi się z zamiarem.
  return otwarte;
}

/** Ile godzin do rozpoczęcia meczu; ujemne = już był. Osobno, bo tę samą
 *  arytmetykę robiło dotąd kilka miejsc na stronie, każde po swojemu. */
export function godzinDoMeczu(date: string, time: string | null, teraz = Date.now()): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time ?? '00:00').split(':').map(Number);
  const ms = new Date(y, m - 1, d, h, min).getTime();
  // `new Date(NaN, …)` NIE rzuca wyjątkiem — oddaje `Invalid Date`, czyli NaN.
  // Sam `try/catch` niczego by tu nie złapał, a NaN jest gorszy niż wyjątek:
  // każde porównanie z nim jest fałszem, więc po cichu wyłączyłby wszystkie
  // reguły czasowe i sekcje przestałyby się rozwijać bez śladu w logu.
  // Nieznany termin traktujemy jak odległy: nic nie ponagla.
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return (ms - teraz) / 3_600_000;
}
