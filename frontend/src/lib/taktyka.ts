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
  /** Skrót roli na koszulce: BR, OB, PM, NA. */
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

const NAZWY_LINII = [
  { rola: 'BR', nazwa: 'Bramkarz' },
  { rola: 'OB', nazwa: 'Obrona' },
  { rola: 'PM', nazwa: 'Pomoc' },
  { rola: 'NA', nazwa: 'Atak' },
];

/**
 * Nazwa linii przy schematach z dodatkową linią pomocy (np. `1-4-2-3-1`).
 * Linie środkowe dostają „Pomoc", ostatnia zawsze „Atak" — inaczej
 * `1-4-2-3-1` miałoby napastnika opisanego jako pomocnika.
 */
function opisLinii(indeks: number, ile: number) {
  if (indeks === 0) return NAZWY_LINII[0];
  if (indeks === ile - 1) return NAZWY_LINII[3];
  if (indeks === 1) return NAZWY_LINII[1];
  return NAZWY_LINII[2];
}

/**
 * Współrzędne pozycji dla schematu.
 *
 * Bramkarz stoi na `y = 6`, ostatnia linia na `y = 86`, reszta w równych
 * odstępach. W poziomie linia jest rozłożona symetrycznie względem środka,
 * z marginesem 12% na skrzydła — bez marginesu skrajny obrońca lądował na
 * samej krawędzi i jego nazwisko wychodziło poza boisko.
 */
export function pozycjeZeSchematu(schemat: string): Pozycja[] {
  const linie = schemat.split('-').map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (linie.length === 0) return [];

  const pozycje: Pozycja[] = [];
  let slot = 0;

  linie.forEach((ilu, i) => {
    const { rola, nazwa } = opisLinii(i, linie.length);
    // Jedna linia = jedna „wysokość". Pierwsza (bramkarz) nisko, ostatnia
    // wysoko, reszta równo pomiędzy.
    const y = linie.length === 1 ? 50 : 6 + (i * (86 - 6)) / (linie.length - 1);

    for (let j = 0; j < ilu; j += 1) {
      // Jeden gracz w linii staje na środku; kilku rozkłada się równo
      // w pasie 12–88% szerokości.
      const x = ilu === 1 ? 50 : 12 + (j * (88 - 12)) / (ilu - 1);
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
  krycie?: 'strefa' | 'na-wlasnego';
  wyjscie?: 'krotko' | 'dlugo';
  pressing?: 'wysoki' | 'sredni' | 'niski';
  tempo?: 'szybko' | 'spokojnie';
}

export const OPCJE_TAKTYKI: {
  klucz: keyof Taktyka;
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
    klucz: 'pressing',
    pytanie: 'Kiedy atakujemy rywala',
    opcje: [
      { wartosc: 'wysoki', label: 'Od razu', opis: 'Naciskamy pod ich bramką — męczące, ale duszy rywala' },
      { wartosc: 'sredni', label: 'Od połowy', opis: 'Ustawiamy się i czekamy na środku' },
      { wartosc: 'niski', label: 'Na swojej połowie', opis: 'Cofamy się, gramy z kontry' },
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

/** Taktyka jednym zdaniem — do nagłówka i do wiadomości w czacie drużyny. */
export function opisTaktyki(t: Taktyka | null | undefined): string {
  if (!t) return '';
  const czesci = OPCJE_TAKTYKI
    .map(({ klucz, opcje }) => opcje.find((o) => o.wartosc === t[klucz])?.label)
    .filter(Boolean);
  return czesci.join(' · ');
}
