// Miasta, dla których powstaje landing lokalny /[sport]/[miasto].
//
// Rozszerzenie tej listy to decyzja produktowa, nie cichy dopisek: każde miasto
// tworzy tyle nowych stron, ile jest sportów w FOCUS_SPORT_BY_SLUG, a strona bez
// meczów i bez boisk w okolicy szkodzi bardziej, niż pomaga.
//
// Współrzędne to centrum miasta, ten sam punkt, wokół którego liczy się promień
// dla getNearbyEvents() i kadr dla katalogu boisk.

export interface OdmianaMiasta {
  slug: string;
  /** "Poznań" — nagłówki, w których miasto stoi samo. */
  mianownik: string;
  /**
   * Pełna fraza z przyimkiem: "w Poznaniu", ale "we Wrocławiu". Przyimek jest
   * częścią danych, bo reguła "w " + forma miejscownika łamie się na miastach
   * zaczynających się od zbitki spółgłosek.
   */
  miejscownik: string;
  lat: number;
  lng: number;
}

export const MIASTA: readonly OdmianaMiasta[] = [
  { slug: 'poznan', mianownik: 'Poznań', miejscownik: 'w Poznaniu', lat: 52.37, lng: 16.97 },
  { slug: 'warszawa', mianownik: 'Warszawa', miejscownik: 'w Warszawie', lat: 52.23, lng: 21.01 },
  { slug: 'krakow', mianownik: 'Kraków', miejscownik: 'w Krakowie', lat: 50.06, lng: 19.94 },
];

export function znajdzMiasto(slug: string): OdmianaMiasta | undefined {
  return MIASTA.find((m) => m.slug === slug);
}

/**
 * Promień wokół centrum, w którym szukamy otwartych meczów. Na tyle szeroki,
 * żeby nie gubić meczów na obrzeżach, na tyle wąski, żeby nazwa miasta w
 * nagłówku została prawdą, a nie marketingowym naciąganiem.
 */
export const PROMIEN_KM = 15;

/**
 * Direct Answer — akapit, który odpowiada wprost na zapytanie, zanim czytelnik
 * (albo model) przewinie stronę. Trzyma się 40-50 słów: krócej nie mieści
 * mechaniki, dłużej przestaje być odpowiedzią, a zaczyna być wstępem.
 */
export function odpowiedzMiasta(dopelniaczSportu: string, miejscownik: string): string {
  return (
    `Szukasz graczy na mecz ${dopelniaczSportu} ${miejscownik}? Bojo zbiera skład ` +
    'przez jeden link wklejony na czacie ekipy: liczy zajęte miejsca, prowadzi listę ' +
    'rezerwową i dzieli koszt wynajmu obiektu na graczy, z uwzględnieniem zniżek dla ' +
    'posiadaczy kart Multisport, FitProfit i Medicover Sport. Gracz dołącza bez ' +
    'zakładania konta.'
  );
}

/**
 * Odróżnienie od systemów rezerwacji. Bez tego zdania modele mieszają Bojo z
 * platformami wynajmu obiektów i polecają je przy zapytaniu "jak wynająć orlik",
 * gdzie Bojo nic nie wnosi — zamiast przy "jak zebrać ludzi na orlik".
 *
 * Uwaga na kolejność słów: "rezerw(uj|acj[aeę]) boisk" jest na liście
 * ZAKAZANE_WSZEDZIE, więc przeczenie musi paść w oknie 20 znaków przed frazą
 * (patrz tresciStron.test.ts).
 */
export const CZYM_BOJO_NIE_JEST =
  'Bojo nie jest systemem do rezerwacji boisk ani wypożyczalnią obiektów — nie ' +
  'wynajmiesz tu hali i nie zapłacisz za termin. Bojo zaczyna się tam, gdzie ' +
  'obiekt jest już zarezerwowany: przy zbieraniu składu, kolejce rezerwowej ' +
  'i podziale kosztu między graczy.';

/** Zdanie o pokryciu katalogu, składane z liczbą policzoną na żywo. */
export function zdanieOKatalogu(ile: number, miejscownik: string): string {
  return (
    `W katalogu Bojo jest ${ile} obiektów sportowych w okolicy — z mapy wybierzesz ` +
    `miejsce, zakładając mecz ${miejscownik}.`
  );
}
