/**
 * Mecz jako plik `.ics` — „Dodaj do kalendarza" na stronie meczu.
 *
 * Po co: Bojo przypomina o meczu własnym kanałem (push, mail, `reminders.ts`),
 * ale kalendarz telefonu jest miejscem, w które człowiek PATRZY, planując
 * tydzień. Dopóki meczu tam nie ma, kolizja z czymkolwiek innym wychodzi
 * dopiero w czwartek o 17:40. Dla stałej ekipy grającej co tydzień — czyli
 * dla segmentu, który BACKLOG.md nazywa mięsem na start — to ta sama strata
 * powtarzana pięćdziesiąt razy w roku.
 *
 * Bez backendu i bez paczek: plik składa się w przeglądarce i schodzi jako
 * pobranie. iOS i Android otwierają `text/calendar` natywną aplikacją
 * kalendarza, więc jedno dotknięcie wystarcza.
 */

/** Domyślny czas gry, gdy mecz nie ma godziny końca. Mecz bez `endTime`
 *  istnieje w bazie (pole jest opcjonalne), a wpis kalendarza o zerowej
 *  długości część klientów rysuje jako całodniowy — czyli dokładnie odwrotnie
 *  niż trzeba. 90 minut to typowa gra i tyle proponuje kreator. */
const DOMYSLNY_CZAS_MIN = 90;

export type MeczDoKalendarza = {
  /** `events.id` — jedyne źródło `UID`. Patrz komentarz przy `UID` niżej. */
  id: string;
  tytul: string;
  /** `YYYY-MM-DD`, tak jak `events.date`. */
  data: string;
  /** `HH:MM`, tak jak `events.time`. */
  godzina: string;
  /** `HH:MM` albo brak — wtedy `DOMYSLNY_CZAS_MIN`. */
  godzinaKonca?: string | null;
  miejsce?: string | null;
  opis?: string | null;
  /** Pełny adres strony meczu — `eventUrl()` z `lib/eventShare.ts`. */
  url: string;
};

/**
 * Escapowanie pola TEXT wg RFC 5545 §3.3.11: odwrotny ukośnik, średnik,
 * przecinek i złamanie linii. Kolejność ma znaczenie — ukośnik pierwszy,
 * inaczej podwoiłby ukośniki wstawione przez kolejne reguły.
 *
 * To nie jest ozdoba: adres „Ośrodek Przywodny Rataje, ul. Piastowska 3"
 * ma przecinek, a nieuciekniety przecinek w SUMMARY albo LOCATION dzieli
 * wartość na dwie i część klientów odrzuca wtedy CAŁY plik. Opis meczu ma
 * do tysiąca znaków pisanych ręcznie, więc trafi się każdy z tych czterech.
 */
function escapujTekst(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Zawijanie długich linii wg RFC 5545 §3.1: powyżej 75 OKTETÓW linia idzie
 * dalej w następnej, zaczynającej się pojedynczą spacją.
 *
 * Liczymy oktety, nie znaki, bo polskie znaki diakrytyczne zajmują w UTF-8
 * po dwa bajty — „Ośrodek Przywodny Rataje — boisko piłkarskie" mieści się
 * w 45 znakach i w 52 bajtach, a tytuł meczu ma limit 80 ZNAKÓW, czyli do
 * 160 bajtów. Bez zawijania takie linie łamią pliki u części klientów.
 *
 * Nie wolno przeciąć sekwencji wielobajtowej w połowie, więc krok po znaku
 * z licznikiem bajtów, a nie `slice()` po indeksach bajtowych.
 */
function zawin(linia: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linia).length <= 75) return linia;

  const czesci: string[] = [];
  let biezaca = '';
  let bajty = 0;
  // Kontynuacja zaczyna się spacją, która też liczy się do limitu — stąd
  // 74 bajty treści dla każdej linii poza pierwszą.
  let limit = 75;

  for (const znak of linia) {
    const rozmiar = enc.encode(znak).length;
    if (bajty + rozmiar > limit) {
      czesci.push(biezaca);
      biezaca = '';
      bajty = 0;
      limit = 74;
    }
    biezaca += znak;
    bajty += rozmiar;
  }
  czesci.push(biezaca);

  return czesci.join('\r\n ');
}

/** `20260107T180000` — czas ŚCIENNY, bez `Z`. Używany razem z
 *  `TZID=Europe/Warsaw`, patrz komentarz przy `VTIMEZONE`. */
function stempelLokalny(data: string, godzina: string): string {
  const [y, m, d] = data.split('-');
  const [h, min] = godzina.split(':');
  return `${y}${m}${d}T${h.padStart(2, '0')}${min.padStart(2, '0')}00`;
}

/** `20260107T170000Z` — moment w UTC, do `DTSTAMP`. */
function stempelUtc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function dodajMinuty(godzina: string, minuty: number): string {
  const [h, m] = godzina.split(':').map(Number);
  const razem = h * 60 + m + minuty;
  // Modulo 24 h: mecz o 23:00 z domyślnymi 90 minutami kończy się 00:30
  // NASTĘPNEGO dnia. Data końca dostaje wtedy +1 dzień w `zbudujIcs`.
  const wDobie = ((razem % 1440) + 1440) % 1440;
  return `${String(Math.floor(wDobie / 60)).padStart(2, '0')}:${String(wDobie % 60).padStart(2, '0')}`;
}

function nastepnyDzien(data: string): string {
  const [y, m, d] = data.split('-').map(Number);
  // `Date.UTC`, nie lokalny konstruktor: tu liczymy wyłącznie kalendarz,
  // a strefa przeglądarki przesunęłaby datę o dzień przy północy.
  const dalej = new Date(Date.UTC(y, m - 1, d + 1));
  return dalej.toISOString().slice(0, 10);
}

/**
 * Definicja strefy wpisana do pliku, zamiast przeliczania na UTC.
 *
 * Cała aplikacja traktuje `events.date` + `events.time` jako czas ścienny
 * (`new Date(y, m-1, d, h, min)` w `lib/eventDates.ts`), a mecze grają się
 * w Polsce. Przeliczenie na UTC wymagałoby znajomości przesunięcia W DNIU
 * MECZU — a to zmienia się dwa razy w roku, więc mecz utworzony w marcu na
 * kwiecień wylądowałby w kalendarzu o godzinę obok.
 *
 * Sam `TZID` bez `VTIMEZONE` przyjmuje Google i Apple, ale nie jest zgodny
 * z RFC — a plik niezgodny odrzuca akurat ten klient, którego nikt nie
 * testował. Bloczek jest stały (CET/CEST, ostatnia niedziela marca
 * i października), więc kosztuje kilkanaście linii raz.
 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Warsaw',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
];

export function zbudujIcs(m: MeczDoKalendarza, teraz: Date = new Date()): string {
  const koniec = m.godzinaKonca?.slice(0, 5) || dodajMinuty(m.godzina, DOMYSLNY_CZAS_MIN);
  const przezPolnoc = koniec <= m.godzina.slice(0, 5);
  const dataKonca = przezPolnoc ? nastepnyDzien(m.data) : m.data;

  const linie = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bojo.pl//Bojo//PL',
    'CALSCALE:GREGORIAN',
    // `PUBLISH`, nie `REQUEST` — plik jest informacją o meczu, nie
    // zaproszeniem z odpowiedzią. `REQUEST` kazałby klientom pytać
    // „przyjmujesz?" i odsyłać odpowiedź na adres, którego nie ma.
    'METHOD:PUBLISH',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    // UID Z ID MECZU, nie losowy. Kalendarze rozpoznają po nim ten sam wpis,
    // więc pobranie pliku drugi raz — po zmianie godziny przez organizatora —
    // AKTUALIZUJE termin zamiast dokładać duplikat obok. Losowy `randomUUID()`
    // dawałby dwa mecze o różnych godzinach i żadnej wskazówki, który jest
    // prawdziwy.
    `UID:bojo-${m.id}@bojo.pl`,
    `DTSTAMP:${stempelUtc(teraz)}`,
    `DTSTART;TZID=Europe/Warsaw:${stempelLokalny(m.data, m.godzina)}`,
    `DTEND;TZID=Europe/Warsaw:${stempelLokalny(dataKonca, koniec)}`,
    `SUMMARY:${escapujTekst(m.tytul)}`,
    ...(m.miejsce ? [`LOCATION:${escapujTekst(m.miejsce)}`] : []),
    // Adres strony meczu dopisany do opisu, nie tylko w `URL:` — Kalendarz
    // Google pokazuje `DESCRIPTION`, a pole `URL` chowa albo pomija, więc
    // droga powrotna do składu i rozmowy zniknęłaby po drodze.
    `DESCRIPTION:${escapujTekst([m.opis?.trim(), m.url].filter(Boolean).join('\n\n'))}`,
    `URL:${escapujTekst(m.url)}`,
    // Bez `VALARM`. Przypomnienie o meczu wysyła Bojo (`lib/reminders.ts`,
    // push i mail) — alarm w kalendarzu dawałby drugie, o innej godzinie,
    // i nie dałoby się go wyłączyć w ustawieniach powiadomień, bo siedziałby
    // w telefonie, nie u nas.
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF, nie `\n` — wymaga tego RFC 5545 §3.1 i część klientów (m.in.
  // starszy Outlook) na samym `\n` odmawia wczytania pliku.
  return linie.map(zawin).join('\r\n');
}

/** Nazwa pobieranego pliku — bez znaków, które psują nazwy na Windowsie
 *  i w Androidzie. Sam mecz i tak ma nazwę w środku pliku. */
export function nazwaPliku(tytul: string): string {
  const rdzen = tytul
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return `${rdzen || 'mecz'}.ics`;
}

/** Zbuduj plik i podaj go przeglądarce do pobrania. Zwraca `false`, gdy
 *  wywołane poza przeglądarką — wywołujący nie musi tego sprawdzać sam. */
export function pobierzIcs(m: MeczDoKalendarza): boolean {
  if (typeof document === 'undefined') return false;

  const blob = new Blob([zbudujIcs(m)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nazwaPliku(m.tytul);
  // Element MUSI trafić do dokumentu przed kliknięciem — Firefox ignoruje
  // `click()` na węźle spoza drzewa, więc wersja bez `appendChild` nie robi
  // tam nic i to bez żadnego błędu w konsoli.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Zwolnienie od razu po `click()` potrafi wyścignąć pobranie w Safari —
  // stąd odłożenie o klatkę. Bez tego plik schodzi pusty albo wcale.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return true;
}
