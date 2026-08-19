/**
 * Ustawienia i taktyka drużyny.
 *
 * SCHEMAT JEST TEKSTEM, POZYCJE SĄ WYLICZANE. `'1-4-4-2'` to pełna definicja
 * ustawienia — z niej powstają współrzędne każdej pozycji na boisku. Ręczne
 * wpisanie kilkudziesięciu par x/y dla kilkunastu schematów byłoby nie tylko
 * nudne: przy każdym nowym schemacie ktoś musiałby zgadywać, gdzie „powinien"
 * stać środkowy pomocnik, i po pięciu schematach nic by się ze sobą nie
 * zgadzało. Tutaj rozstaw jest jedną regułą, więc wszystkie ustawienia
 * wyglądają jak z jednej rodziny.
 *
 * UKŁAD WSPÓŁRZĘDNYCH: `x` i `y` w procentach pola. `y = 0` to własna bramka,
 * `y = 100` bramka przeciwnika. Dzięki temu widok rysuje boisko pionowo (tak
 * się patrzy na telefonie) bez żadnego przeliczania.
 */

export type Sport = 'pilka-nozna' | 'siatkowka' | 'koszykowka' | 'inny';

export interface Pozycja {
  /** Numer pozycji w ustawieniu — klucz do przypisania gracza. Stały dla
   *  danego schematu, żeby zmiana ustawienia nie przemieszała ludzi losowo. */
  slot: number;
  x: number;
  y: number;
  /** Skrót pozycji: BR, LO, ŚO, PO, ŚPD, LP, ŚPO, LN, N… */
  rola: string;
  /** Pełna nazwa — do etykiety pod pozycją i dla czytników ekranu. */
  nazwa: string;
}

export interface Ustawienie {
  /** Zapisywane w bazie, np. `'1-4-4-2'`. */
  schemat: string;
  /** Ilu graczy obsługuje, razem z bramkarzem. */
  ilu: number;
  /** Krótkie „po co to komu" — bez tego wybór schematu jest wróżeniem. */
  opis: string;
}

/**
 * Nazwa pozycji: linia + strona boiska.
 *
 * Wcześniej wszyscy obrońcy byli po prostu „OB", a pomocnicy „PM" — czyli
 * plakietka mówiła to samo, co i tak widać po wysokości na boisku, i nic
 * ponadto. Piłkarz mówi „lewy obrońca" i „defensywny pomocnik", więc tak samo
 * nazywa je teraz Bojo (zgłoszone wprost).
 *
 * STRONA bierze się z miejsca w linii: skrajny lewy to L, skrajny prawy to P,
 * wszystko pomiędzy to Ś. Przy dwóch graczach w linii nie ma środka — są lewy
 * i prawy.
 *
 * DEFENSYWNY/OFENSYWNY tylko wtedy, gdy pomoc ma DWIE linie (np. `1-4-2-3-1`):
 * przy jednej linii pomocy dopisek niczego nie rozróżnia, a wydłuża skrót.
 */
function stronaWLinii(indeks: number, ilu: number): 'L' | 'Ś' | 'P' {
  if (ilu === 1) return 'Ś';
  if (indeks === 0) return 'L';
  if (indeks === ilu - 1) return 'P';
  return 'Ś';
}

const SLOWO_STRONY: Record<'L' | 'Ś' | 'P', string> = { L: 'Lewy', 'Ś': 'Środkowy', P: 'Prawy' };

function opisPozycji(
  indeksLinii: number,
  ileLinii: number,
  indeksWLinii: number,
  iluWLinii: number,
): { rola: string; nazwa: string } {
  if (indeksLinii === 0) return { rola: 'BR', nazwa: 'Bramkarz' };

  const strona = stronaWLinii(indeksWLinii, iluWLinii);
  const slowo = SLOWO_STRONY[strona];
  const ostatnia = indeksLinii === ileLinii - 1;

  if (ostatnia) {
    // Jeden napastnik nie potrzebuje strony — jest po prostu napastnikiem.
    if (iluWLinii === 1) return { rola: 'N', nazwa: 'Napastnik' };
    return { rola: `${strona}N`, nazwa: `${slowo} napastnik` };
  }

  if (indeksLinii === 1) {
    return { rola: `${strona}O`, nazwa: `${slowo} obrońca` };
  }

  // Linie pomocy: pierwsza z nich defensywna, ostatnia ofensywna — ale tylko
  // gdy jest ich więcej niż jedna.
  const pierwszaPomoc = 2;
  const ostatniaPomoc = ileLinii - 2;
  const kilkaLiniiPomocy = ostatniaPomoc > pierwszaPomoc;

  if (kilkaLiniiPomocy && indeksLinii === pierwszaPomoc) {
    return { rola: `${strona}PD`, nazwa: `${slowo} pomocnik defensywny` };
  }
  if (kilkaLiniiPomocy && indeksLinii === ostatniaPomoc) {
    return { rola: `${strona}PO`, nazwa: `${slowo} pomocnik ofensywny` };
  }
  return { rola: `${strona}P`, nazwa: `${slowo} pomocnik` };
}

/**
 * Współrzędne pozycji dla schematu.
 *
 * Bramkarz stoi na `y = 6`, ostatnia linia na `y = 86`, reszta w równych
 * odstępach. W poziomie linia jest rozłożona symetrycznie względem środka,
 * z marginesem 20% na skrzydła.
 *
 * MARGINES BYŁ 12% I BYŁ ZA MAŁY: kółko skrajnego gracza dotykało linii
 * bocznej, a jego imię wychodziło poza murawę (zgłoszone wprost). 20% zostawia
 * miejsce na kółko i podpis po obu stronach, kosztem odrobiny „rozstawienia" —
 * to nie jest mapa taktyczna w skali, tylko czytelny obrazek na telefonie.
 */
export function pozycjeZeSchematu(schemat: string): Pozycja[] {
  const linie = schemat.split('-').map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (linie.length === 0) return [];

  const pozycje: Pozycja[] = [];
  let slot = 0;

  linie.forEach((ilu, i) => {
    // Jedna linia = jedna „wysokość". Pierwsza (bramkarz) nisko, ostatnia
    // wysoko, reszta równo pomiędzy.
    const y = linie.length === 1 ? 50 : 6 + (i * (86 - 6)) / (linie.length - 1);

    for (let j = 0; j < ilu; j += 1) {
      // Jeden gracz w linii staje na środku; kilku rozkłada się równo
      // w pasie 20–80% szerokości.
      const x = ilu === 1 ? 50 : 20 + (j * (80 - 20)) / (ilu - 1);
      const { rola, nazwa } = opisPozycji(i, linie.length, j, ilu);
      pozycje.push({ slot, x: Math.round(x), y: Math.round(y), rola, nazwa });
      slot += 1;
    }
  });

  return pozycje;
}

/**
 * Katalog ustawień piłkarskich.
 *
 * Zaczyna się od pięciu na orliku, nie od jedenastu: w Bojo mecz 5v5 albo 6v6
 * jest regułą, a pełny skład wyjątkiem. Opisy mówią, co dane ustawienie
 * naprawdę robi na boisku — „1-2-2" nie mówi nikomu nic, „mocna obrona,
 * wychodzimy kontrą" mówi wszystko.
 */
export const USTAWIENIA_PILKA: Ustawienie[] = [
  { schemat: '1-1-2',     ilu: 4,  opis: 'Czwórka: jeden z tyłu, dwóch z przodu — dużo biegania' },
  { schemat: '1-2-1',     ilu: 4,  opis: 'Czwórka: dwóch z tyłu, jeden na szpicy' },
  { schemat: '1-2-2',     ilu: 5,  opis: 'Klasyk na orlik: równo z tyłu i z przodu' },
  { schemat: '1-1-2-1',   ilu: 5,  opis: 'Diament: jeden kryje, dwóch na bokach, jeden pod bramką' },
  { schemat: '1-3-1',     ilu: 5,  opis: 'Trzech z tyłu i szpica — dla obrony wyniku' },
  { schemat: '1-2-2-1',   ilu: 6,  opis: 'Najbezpieczniejsze sześć — wyraźne linie' },
  { schemat: '1-3-2',     ilu: 6,  opis: 'Mur z tyłu, dwóch szuka kontry' },
  { schemat: '1-2-3',     ilu: 6,  opis: 'Trzech z przodu — atakujemy, ryzykujemy z tyłu' },
  { schemat: '1-3-2-1',   ilu: 7,  opis: 'Siódemka najczęściej grana: stabilnie, jeden na szpicy' },
  { schemat: '1-2-3-1',   ilu: 7,  opis: 'Szeroko przez skrzydła, jeden w polu karnym' },
  { schemat: '1-3-1-2',   ilu: 7,  opis: 'Dwóch napastników, jeden rozgrywa między liniami' },
  { schemat: '1-3-3-1',   ilu: 8,  opis: 'Ósemka z mocnym środkiem' },
  { schemat: '1-4-2-1',   ilu: 8,  opis: 'Czterech z tyłu — dla drużyny, która broni wyniku' },
  { schemat: '1-3-3-2',   ilu: 9,  opis: 'Dziewiątka ofensywna' },
  { schemat: '1-4-3-1',   ilu: 9,  opis: 'Dziewiątka zachowawcza' },
  { schemat: '1-4-3-2',   ilu: 10, opis: 'Dziesiątka z dwoma napastnikami' },
  { schemat: '1-4-4-2',   ilu: 11, opis: 'Najbardziej znane ustawienie — dwie równe linie po czterech' },
  { schemat: '1-4-3-3',   ilu: 11, opis: 'Skrzydłowi wysoko, pressing od przodu' },
  { schemat: '1-4-2-3-1', ilu: 11, opis: 'Dwóch kryjących, trójka pod napastnikiem' },
  { schemat: '1-3-5-2',   ilu: 11, opis: 'Środek pola na przewagę, wahadłowi na bokach' },
  { schemat: '1-5-3-2',   ilu: 11, opis: 'Piątka z tyłu — gramy z mocniejszym rywalem' },
];

/** Siatkówka: nie ma „ustawień", jest rotacja — sześć stałych pozycji. */
export const USTAWIENIA_SIATKA: Ustawienie[] = [
  { schemat: '3-3', ilu: 6, opis: 'Rotacja: trzech w ataku (P4, P3, P2), trzech w obronie (P5, P6, P1)' },
];

export const USTAWIENIA_KOSZ: Ustawienie[] = [
  { schemat: '1-2-2', ilu: 5, opis: 'Rozgrywający, dwóch rzucających, dwóch podkoszowych' },
  { schemat: '2-3',   ilu: 5, opis: 'Dwóch obwodowych, trzech blisko kosza' },
  { schemat: '1-2',   ilu: 3, opis: 'Trójka: rozgrywający i dwóch na skrzydłach' },
];

export function ustawieniaDlaSportu(sport: string | undefined): Ustawienie[] {
  if (sport === 'siatkowka' || sport === 'siatkówka') return USTAWIENIA_SIATKA;
  if (sport === 'koszykowka' || sport === 'koszykówka') return USTAWIENIA_KOSZ;
  return USTAWIENIA_PILKA;
}

/**
 * Ustawienia sensowne dla drużyny tej wielkości.
 *
 * Pokazujemy dokładnie pasujące ORAZ mniejsze o jednego — bo w amatorskim
 * meczu ktoś zawsze się spóźnia, a ustawienie na siedmiu przy sześciu obecnych
 * jest użyteczniejsze niż pusta lista. Większych nie proponujemy: pozycji, na
 * której nikt nie stanie, nie da się „trochę" obsadzić.
 */
export function ustawieniaDlaSkladu(sport: string | undefined, ilu: number): Ustawienie[] {
  const wszystkie = ustawieniaDlaSportu(sport);
  const pasujace = wszystkie.filter((u) => u.ilu === ilu || u.ilu === ilu + 1);
  // Zero pasujących (np. 2 osoby albo 15) — oddajemy najbliższe rozmiarem,
  // zamiast pustej listy, która wygląda jak zepsuty ekran.
  if (pasujace.length > 0) return pasujace;
  const najblizszy = wszystkie.reduce((a, b) => (
    Math.abs(b.ilu - ilu) < Math.abs(a.ilu - ilu) ? b : a
  ), wszystkie[0]);
  return wszystkie.filter((u) => u.ilu === najblizszy.ilu);
}

/** Domyślne ustawienie dla składu — pierwsze pasujące, żeby zakładka
 *  otwierała się z czymś na boisku, a nie z pustym pytaniem. */
export function domyslneUstawienie(sport: string | undefined, ilu: number): string {
  return ustawieniaDlaSkladu(sport, ilu)[0]?.schemat ?? '1-2-2';
}

// ---------------------------------------------------------------------------
// Taktyka — cztery decyzje, które w amatorskim meczu naprawdę się podejmuje
// ---------------------------------------------------------------------------
/**
 * Świadomie MAŁO i świadomie WYBÓR Z LISTY, nie pole tekstowe.
 *
 * Pole tekstowe „taktyka" zostaje puste albo dostaje „gramy swoje". Cztery
 * pytania z gotowymi odpowiedziami zajmują cztery kliknięcia i dają coś, co
 * da się przeczytać w szatni. Piąta decyzja — kto bije stałe fragmenty —
 * została notatką, bo to nazwiska, a nie wybór z listy.
 */
export interface Taktyka {
  krycie?: 'strefa' | 'na-wlasnego' | 'inne';
  wyjscie?: 'krotko' | 'dlugo' | 'inne';
  pressing?: 'wysoki' | 'sredni' | 'niski' | 'inne';
  tempo?: 'szybko' | 'spokojnie' | 'inne';
  /** Treść wpisana po wybraniu „Inne" — po jednej na pytanie. */
  wlasne?: Partial<Record<'krycie' | 'wyjscie' | 'pressing' | 'tempo', string>>;
}

export type KluczTaktyki = 'krycie' | 'wyjscie' | 'pressing' | 'tempo';

export const OPCJE_TAKTYKI: {
  klucz: KluczTaktyki;
  pytanie: string;
  opcje: { wartosc: string; label: string; opis: string }[];
}[] = [
  {
    klucz: 'krycie',
    pytanie: 'Jak bronimy',
    opcje: [
      { wartosc: 'strefa', label: 'Strefa', opis: 'Każdy pilnuje swojego kawałka boiska' },
      { wartosc: 'na-wlasnego', label: 'Każdy swojego', opis: 'Bierzesz jednego rywala i się go trzymasz' },
    ],
  },
  {
    klucz: 'wyjscie',
    pytanie: 'Wyjście od bramkarza',
    opcje: [
      { wartosc: 'krotko', label: 'Krótko', opis: 'Rozgrywamy od tyłu, obrońcy się otwierają' },
      { wartosc: 'dlugo', label: 'Długo', opis: 'Wybicie na przód, walczymy o drugą piłkę' },
    ],
  },
  {
    // GDZIE odbieramy piłkę — nie „jak bronimy". Pierwsza wersja miała tu
    // „Od razu / Od połowy / Na swojej połowie", czyli dwie ostatnie opisywały
    // to samo cofnięcie i różniły się wyłącznie sformułowaniem (zgłoszone
    // wprost). Zostają dwie odpowiedzi, które naprawdę się wykluczają:
    // ruszamy pod ich bramkę albo czekamy u siebie.
    klucz: 'pressing',
    pytanie: 'Gdzie odbieramy piłkę',
    opcje: [
      { wartosc: 'wysoki', label: 'Pod ich bramką', opis: 'Naciskamy od razu po stracie — męczące, ale dusi rywala' },
      { wartosc: 'niski', label: 'U siebie', opis: 'Cofamy się, ustawiamy blok i gramy z kontry' },
    ],
  },
  {
    klucz: 'tempo',
    pytanie: 'Tempo gry',
    opcje: [
      { wartosc: 'szybko', label: 'Szybko do przodu', opis: 'Pierwsze podanie zawsze szuka przodu' },
      { wartosc: 'spokojnie', label: 'Spokojnie', opis: 'Przytrzymujemy piłkę, czekamy na miejsce' },
    ],
  },
];

/**
 * „Inne" jest przy KAŻDYM pytaniu i otwiera pole tekstowe.
 *
 * Lista zamknięta zakłada, że przewidzieliśmy wszystko, co ekipa może ustalić
 * — a nie przewidzieliśmy. Bez tej furtki jedyną odpowiedzią na „my gramy
 * inaczej" jest nieodpowiadanie wcale, czyli puste pytanie i wrażenie, że
 * aplikacja nie rozumie, jak gracie.
 */
export const WARTOSC_INNE = 'inne';

/** Odpowiedź na jedno pytanie, gotowa do wyświetlenia. Dla „Inne" oddaje
 *  wpisany tekst, a nie słowo „Inne" — to ono jest odpowiedzią. */
export function odpowiedzTaktyki(t: Taktyka | null | undefined, klucz: KluczTaktyki): string {
  if (!t) return '';
  const wybor = t[klucz];
  if (!wybor) return '';
  if (wybor === WARTOSC_INNE) return t.wlasne?.[klucz]?.trim() ?? '';
  return OPCJE_TAKTYKI.find((o) => o.klucz === klucz)?.opcje.find((x) => x.wartosc === wybor)?.label ?? '';
}

/** Taktyka jednym zdaniem — do nagłówka i do wiadomości w czacie drużyny. */
export function opisTaktyki(t: Taktyka | null | undefined): string {
  if (!t) return '';
  return OPCJE_TAKTYKI
    .map(({ klucz }) => odpowiedzTaktyki(t, klucz))
    .filter((x) => x.length > 0)
    .join(' · ');
}

/**
 * Inicjały do kółka na boisku — pierwsza litera imienia i pierwsza nazwiska.
 *
 * Wcześniej były to dwie pierwsze litery całego napisu, czyli „MA" dla
 * „Mateusza" i „MA" dla „Marcina": w drużynie z dwoma Mateuszami kółka
 * wychodziły identyczne. Imię + nazwisko rozróżnia ich od razu.
 *
 * Jedno słowo (pseudonim, gość dopisany jako „Kuba") zostaje przy dwóch
 * pierwszych literach — nie ma z czego wziąć drugiej inicjału.
 */
export function inicjaly(nazwa: string): string {
  const czlony = nazwa.trim().split(/\s+/).filter(Boolean);
  if (czlony.length === 0) return '?';
  if (czlony.length === 1) return czlony[0].slice(0, 2).toUpperCase();
  return (czlony[0][0] + czlony[czlony.length - 1][0]).toUpperCase();
}
