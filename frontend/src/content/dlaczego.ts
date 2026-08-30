// Treść /dlaczego-bojo — argumenty, którymi organizator przebija ścianę
// "moi gracze nie założą konta w kolejnej apce" i nawyk grupy na Messengerze.

/**
 * Direct Answer — 40-50 słów odpowiadające wprost na zapytanie "alternatywa dla
 * grupy na Facebooku / ankiety na WhatsAppie do organizowania meczów", zanim
 * czytelnik przewinie do listy bolączek. Wymienia encje wprost ("Bojo", nazwy
 * kart), bo w wynikach generatywnych ten akapit trafia do modelu wyrwany
 * z kontekstu reszty strony.
 */
export const DLACZEGO_ODPOWIEDZ =
  'Bojo to aplikacja webowa do organizowania amatorskich meczów, używana zamiast ' +
  'grupy na Facebooku i ankiety na WhatsAppie. Liczy zajęte miejsca zamiast „+1" ' +
  'w komentarzach, prowadzi listę rezerwową z kolejnością, dzieli koszt wynajmu ' +
  'obiektu i uwzględnia zniżki z kart Multisport, FitProfit i Medicover Sport. ' +
  'Organizator wysyła jeden link na czat ekipy.';

export const CO_UWIERA: readonly string[] = [
  'Liczenie „+1" w komentarzach pod postem — trzeba przewinąć cały wątek, żeby wiedzieć, ' +
  'ile osób realnie przyjdzie.',
  'Ludzie odpadający w środku wątku, którego nikt nie czyta do końca — organizator ' +
  'dowiaduje się o rezygnacji przypadkiem, na boisku.',
  '„Może wpadnę" nie do odróżnienia od „będę" — nie wiadomo, czy liczyć to miejsce, czy nie.',
  'Ankieta bez limitu miejsc i bez kolejki — chętnych ponad limit nikt nie porządkuje, ' +
  'wchodzi kto pierwszy kliknął.',
  'Kto ile oddał za wynajem — liczone w pamięci albo w osobnej notatce, która ginie razem ' +
  'z wątkiem.',
];

export interface WierszPorownania {
  co: string;
  fb: string;
  bojo: string;
}

export const TABELA_POROWNAWCZA: readonly WierszPorownania[] = [
  { co: 'Liczenie składu', fb: 'ręcznie, w komentarzach', bojo: 'licznik zajętych miejsc i twardy limit' },
  { co: 'Chętni ponad limit', fb: 'kto pierwszy, ten lepszy', bojo: 'lista rezerwowa z kolejnością' },
  { co: '„Może wpadnę"', fb: 'nie do odróżnienia od „będę"', bojo: 'osobny status „Obserwuję" — nie zajmuje miejsca' },
  { co: 'Bramkarz', fb: 'prośba w wątku', bojo: 'osobny limit miejsc dla bramkarzy' },
  { co: 'Kto ile płaci', fb: 'liczone w pamięci', bojo: 'koszt dzielony, zniżki z kart sportowych, odhaczanie wpłat' },
  { co: 'Kto jeszcze nie oddał', fb: 'przewijasz wątek', bojo: 'gotowa wiadomość jednym przyciskiem' },
  { co: 'Odwołanie meczu', fb: 'wiadomość, którą ktoś przegapi', bojo: 'wszyscy zapisani dostają powiadomienie w aplikacji' },
  { co: 'Historia gier', fb: 'przepada w wątku', bojo: 'lista meczów, składy i wyniki w jednym miejscu' },
  { co: 'Nowa osoba w ekipie', fb: 'musi wejść do grupy', bojo: 'wystarczy link' },
  { co: 'Dostęp dla obcych', fb: 'grupa albo publiczna, albo zamknięta', bojo: 'mecz publiczny (na liście) albo prywatny (tylko z linkiem)' },
];

export interface SekcjaProza {
  id: string;
  tytul: string;
  akapity: readonly string[];
}

/** Trzy pozostałe sekcje strony — proza, nie lista/tabela, ale tak samo
 *  wyciągnięta z JSX: reguła architektury (§A.1) jest "copy osobno od JSX,
 *  żeby dało się testować bez renderowania", i dotyczy każdej sekcji, nie
 *  tylko tych z niestandardowym markupem. */
export const DLACZEGO_PROZA: readonly SekcjaProza[] = [
  {
    // Pierwsza sekcja prozy, zaraz po tabeli porównawczej: tabela rozstrzyga
    // "Bojo kontra grupa na Facebooku", ta sekcja rozstrzyga inne, częstsze
    // pomylenie — z systemem rezerwacji obiektów. Bez niej model pytany "czym
    // to się różni od aplikacji do rezerwacji" nie miał gdzie znaleźć odpowiedzi.
    id: 'trzy-rzeczy',
    tytul: 'Trzy różne rzeczy, które ludzie mylą',
    akapity: [
      'System rezerwacji obiektu odpowiada na pytanie „czy hala jest wolna w czwartek ' +
      'o 20:00" i przyjmuje opłatę za termin. Komunikator (WhatsApp, Messenger) ' +
      'odpowiada na „kto idzie", ale liczyć trzeba samemu. Bojo jest trzecią rzeczą: ' +
      'przyjmuje zapisy na konkretny, już ustalony termin, liczy skład i rezerwę i dzieli ' +
      'koszt na graczy. Bojo nie rezerwuje obiektu i nie zastępuje czatu ekipy — działa ' +
      'obok jednego i drugiego.',
    ],
  },
  {
    id: 'nie-chca-kolejnej-apki',
    tytul: '„Moi gracze nie założą konta w kolejnej apce"',
    akapity: [
      'Nie muszą. Osoba z linkiem podaje imię i e-mail i jest w składzie. Bez hasła, bez ' +
      'potwierdzania adresu, bez instalowania aplikacji — Bojo działa w przeglądarce. ' +
      'Konto zakłada ten, kto sam zechce zobaczyć swoją historię i statystyki, i może to ' +
      'zrobić po meczu, nie przed nim.',
    ],
  },
  {
    id: 'czego-nie-zastapi',
    tytul: 'Czego Bojo nie zastąpi',
    akapity: [
      'Bojo nie jest komunikatorem. Nie wyśle SMS-a ani maila o meczu — jedyny kanał to ' +
      'powiadomienia w aplikacji, pod dzwonkiem. Czat ekipy zostaje tam, gdzie jest; Bojo ' +
      'daje jeden link, który się w tym czacie wkleja i który liczy to, czego czat ' +
      'policzyć nie umie.',
    ],
  },
  {
    id: 'wczesny-etap',
    tytul: 'Misja Bojo i na jakim etapie dziś jesteśmy',
    akapity: [
      'Misja Bojo: łączyć ludzi przez najprostszy sposób organizowania i dołączania do ' +
      'amatorskich gier sportowych. Docelowo każdy, kto ma czas i ochotę zagrać, znajdzie ' +
      'w okolicy otwartą grę do dołączenia — nie tylko organizuje własną. Im więcej ' +
      'organizatorów i graczy korzysta z Bojo, tym więcej takich gier jest do wyboru.',
      'Dziś jesteśmy na początku tej drogi: publicznych gier na liście otwartych meczów ' +
      'bywa mało, więc najpewniejszy skład zbierzesz linkiem do swoich, nie licząc na to, ' +
      'że dopiszą się obcy. Katalog obejmuje ponad 30 000 obiektów sportowych w całej ' +
      'Polsce, ale szczegóły — nawierzchnię, typ obiektu, zdjęcia — uzupełniamy obiekt po ' +
      'obiekcie.',
    ],
  },
];
