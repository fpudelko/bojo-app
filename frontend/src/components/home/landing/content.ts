// Single source of truth for landing page copy. Kept out of JSX so it can be
// unit-tested (forbidden phrases, FAQ <-> JSON-LD parity) without rendering
// any component. Every claim here must be backed by working code — see
// docs/llm-context.md, section "Czego Bojo NIE robi", before adding a line.
//
// Geography: copy speaks about CAPABILITY ("stwórz mecz gdziekolwiek"), not
// about catalogue density. Placing a pin anywhere on the map already works
// today, so that promise has coverage even while the venue catalogue is
// still Poznań-heavy. Only the FAQ names Poznań, and only to disclose that
// honestly — see landingContent.test.ts, describe("zasięg — …").

import { KONTAKT_HREF } from '@/content/kontakt';

// Bezpośrednia odpowiedź na "czym jest Bojo" — renderowana serwerowo zaraz
// pod hero (LandingDirectAnswer.tsx), zanim cokolwiek inne na stronie mówi
// wprost, co to jest. Do 2026-08-24 pierwszy ekran ani razu nie nazywał
// produktu po imieniu w zdaniu opisowym: hero mówi "Zorganizuj mecz",
// nie "czym Bojo jest" — przy nazwie kolidującej z potocznym słowem "bojo"
// (= boisko, patrz docs/seo-geo-strategia.md §2c) to był najgorszy możliwy
// start dla modelu cytującego pierwszy fragment strony. Ten akapit jest
// tym fragmentem: nazwa encji na początku, cztery fakty, zero przymiotników.
export const LANDING_DIRECT_ANSWER =
  'Bojo to darmowa aplikacja webowa do organizowania amatorskich meczów. ' +
  'Zakładasz grę (sport, boisko z mapy, termin i liczba miejsc) i wysyłasz ' +
  'jeden link tam, gdzie Twoja ekipa już rozmawia. Osoba z linkiem zapisuje ' +
  'się bez zakładania konta, podając imię i e-mail. Bojo liczy zajęte ' +
  'miejsca, prowadzi listę rezerwową z widoczną kolejnością i dzieli koszt ' +
  'wynajmu obiektu na graczy.';

export const LANDING_CTA = {
  primary: { label: 'Zorganizuj mecz', href: '/wydarzenia/nowe' },
  secondary: { label: 'albo przejrzyj otwarte gry', href: '/wydarzenia' },
} as const;

export const LANDING_HERO = {
  // Rotates in the hero eyebrow slot (RotatingBadge). First entry is what
  // server-rendered HTML and reduced-motion visitors see.
  badges: [
    'Mecz gdziekolwiek w Polsce',
    'Skład i rezerwa liczą się same',
    'Rozliczenie w jednym miejscu',
  ],
  h1: ['Zorganizuj mecz', 'w dwie minuty'],
  lead:
    'Stwórz grę i wyślij ekipie jeden link. Brakuje ludzi do składu? ' +
    'Otwórz mecz publicznie: trafi na listę otwartych gier w Bojo.',
  trust: ['Za darmo', 'Google lub e-mail', 'Bez instalacji'],
} as const;

export const LANDING_STEPS = [
  {
    icon: 'CalendarPlus',
    title: 'Stwórz mecz',
    // Jedyny krok z odnośnikiem: to jest ta akcja, do której cała sekcja
    // prowadzi. Osobny przycisk pod listą był czwartym „Zorganizuj mecz"
    // na stronie i tylko rozmywał wezwanie z hero.
    href: '/wydarzenia/nowe',
    body: 'Sport, boisko z mapy, termin i liczba miejsc. Trzy kroki, dwie minuty.',
  },
  {
    icon: 'Share2',
    title: 'Wyślij jeden link',
    body:
      'Ekipa dołącza bez zakładania grupy na Messengerze. Kto gra, kto rezerwa i kto ' +
      'tylko obserwuje: widać od razu.',
  },
  {
    icon: 'Users',
    // Bojo jest na wczesnym etapie: otwartych gier bywa mało, więc obietnica
    // „społeczność dobierze skład" nie ma jeszcze pokrycia. Karta renderuje
    // się wyciszona, z plakietką — sprzedaje dalej, ale nie kłamie.
    wczesnyEtap: true,
    title: 'Brakuje ludzi? Otwórz mecz',
    body:
      'Ustaw mecz jako publiczny, a trafi na listę otwartych gier: gracze znajdą mecz, ' +
      'Ty znajdziesz brakujących do składu. Graczy szukających gry wciąż przybywa, na ' +
      'razie najpewniejszy skład zbierzesz linkiem do znajomych.',
  },
] as const;

export const LANDING_VALUES = [
  {
    icon: 'Zap',
    title: 'Kreator w trzech krokach',
    body:
      'Sport, boisko z mapy, termin. Mecz publiczny albo prywatny: dostępny wyłącznie ' +
      'przez link lub kod.',
  },
  {
    icon: 'ListChecks',
    title: 'Skład liczy się sam',
    body:
      'Twardy limit miejsc, lista rezerwowa, status „Obserwuję", opcjonalna akceptacja ' +
      'zapisów i goście bez konta. Koniec liczenia w wątku.',
  },
  {
    icon: 'UsersRound',
    title: 'Stała ekipa w grupie',
    body:
      'Grupa z linkiem zaproszenia zamiast wątku na Messengerze. Historia meczów ' +
      'i składów zostaje w jednym miejscu.',
  },
  {
    icon: 'Wallet',
    title: 'Wiadomo, kto ile płaci',
    body:
      'Koszt dzieli się na graczy, zniżki z Multisport, FitProfit i Medicover są ' +
      'uwzględniane, wpłaty odhaczasz jednym kliknięciem. Bojo pilnuje rozliczenia: ' +
      'pieniędzy nie przelewa.',
  },
  {
    icon: 'CalendarCheck',
    // `R-11`. To jest JEDYNA rzecz z tej listy, której post na grupie i ankieta
    // na WhatsAppie nie umieją w ogóle — reszta jest tam możliwa, tylko
    // niewygodna. Pokrycie w kodzie: przypomnienie dzień przed (migracja `129`)
    // oraz wiadomości o zmianie terminu, warunków i odwołaniu (`139`, `140`).
    //
    // UWAGA NA BRZMIENIE — to nie jest ostrożność stylistyczna, tylko reguła
    // z `content/zakazaneFrazy.ts`: landing NIE WYMIENIA KANAŁÓW (ani „push",
    // ani „mail", ani samego słowa o powiadomieniach), bo jest czysto
    // sprzedażowy i nie ma w nim miejsca na kontekst „gdzie to przychodzi".
    // Tłumaczą to `/faq` i `/jak-dziala-bojo`, i tam wolno nazwać rzecz po
    // imieniu. Dlatego ten kafelek mówi o SKUTKU („skład wie, że gra"),
    // a nie o mechanizmie — i dlatego ma ikonę kalendarza, nie dzwonka.
    // Dzwonek nazwałby kanał obrazkiem, skoro nie wolno go nazwać słowem.
    title: 'Skład wie, że gra',
    body:
      'Dzień przed meczem odzywamy się do każdego zapisanego: nie musisz nikogo ' +
      'obdzwaniać. Gdy zmienisz termin albo odwołasz mecz, cały skład dowiaduje się ' +
      'w tej samej chwili.',
  },
  {
    icon: 'MapPin',
    // Katalog ma lokalizacje kompletne, ale szczegóły nie: nawierzchnia jest
    // wypełniona w ok. 37% wierszy, typ obiektu w niecałych 2%. Obiecywanie
    // kompletu opisów spala zaufanie przy pierwszym otwartym boisku.
    wczesnyEtap: true,
    title: 'Boiska w jednym miejscu',
    body:
      'Dziesiątki tysięcy obiektów na mapie: lokalizacja, dojazd i nadchodzące mecze. ' +
      'Szczegóły (nawierzchnię, typ i zdjęcia) uzupełniamy obiekt po obiekcie.',
  },
] as const;

// Osiem pytań pokazywanych na stronie głównej — podzbiór jednego wspólnego
// źródła w `src/content/faq.ts` (tam też pełna lista dla `/faq`). Re-eksport,
// nie kopia: `LandingFaq.tsx`, `app/page.tsx` i `landingContent.test.ts` dalej
// czytają `LANDING_FAQ` bez zmian, a widoczna treść i `faqJsonLd()` nie mają
// jak się rozjechać z `/faq`.
export { FAQ_LANDING as LANDING_FAQ } from '@/content/faq';

export const LANDING_STATS = {
  sportsValue: '4',
  sportsLabel: 'dyscypliny dziś: piłka, siatka, plażówka, kosz',
  timeValue: '2 min',
  timeLabel: 'tyle zajmuje stworzenie meczu',
  priceValue: '0 zł',
  priceLabel: 'Bojo jest darmowe',
} as const;

// Misja na landingu — od 2026-09-18. Powód nie jest ozdobny: pierwszy kontakt
// z organizatorem (docs/outreach-organizatorzy.md) zaczyna się od misji i od
// tego, że Bojo robi konkretny, mały zespół. Kto klikał link po takiej
// wiadomości, lądował do tej pory na stronie, gdzie słowo „misja" nie padało
// ani razu, a za produktem nie stał żaden człowiek — czyli najmocniejszy hak
// rozmowy znikał w chwili największej uwagi.
//
// ŚWIADOMIE bez liczby osób i bez imion (decyzja właściciela 2026-09-18):
// "mały zespół" zamiast "dwie osoby" — konkretna liczba starzeje się przy
// pierwszej zmianie składu i nie wnosi nic ponad to, co "mały zespół" już mówi.
//
// Tekst jest STWIERDZENIEM, nie apelem. „Pomóż nam zbudować społeczność"
// odwraca kierunek korzyści i czyta się instrumentalnie (ten sam błąd opisany
// w outreach-organizatorzy.md §3B, "Uwaga na kierunek korzyści"). Mówimy, co
// organizator ma z tego, że nas przybędzie — nie prosimy go o pomoc
// w budowaniu naszej masy krytycznej. Testowane wprost w landingContent.test.ts.
export const LANDING_MISJA = {
  nadtytul: 'Po co to robimy',
  tytul: 'Bojo robi mały zespół, który sam zbiera składy',
  akapity: [
    'Misja Bojo jest jedna: łączyć ludzi przez najprostszy sposób organizowania ' +
    'i dołączania do amatorskich gier. Docelowo każdy, kto ma czas i ochotę zagrać, ' +
    'znajdzie w okolicy otwartą grę, a organizator znajdzie brakujące osoby do składu.',
    'Zaczynamy od organizatorów, bo to oni przyprowadzają resztę. Dziś Bojo zdejmuje ' +
    'z Ciebie liczenie składu, kolejkę chętnych i rozliczenie za obiekt. Im więcej ' +
    'organizatorów wystawia tu mecze, tym bliżej do tego, żeby brakującego gracza dało ' +
    'się dobrać bez obdzwaniania znajomych.',
  ],
  uczciwie: {
    tytul: 'Gdzie jesteśmy dziś, wprost',
    punkty: [
      'Działa: zakładanie meczu, zapis z linku bez konta, skład, rezerwa, podział ' +
      'kosztów, ekipa, wyniki i statystyki.',
      'Jeszcze nie działa w pełnej skali: dobranie brakujących graczy z okolicy. ' +
      'Otwartych meczów jest dziś za mało, żeby to obiecać bez zastrzeżenia.',
      'Katalog boisk to dziś lokalizacje na mapie w całej Polsce. Nawierzchnię, typ ' +
      'obiektu i zdjęcia uzupełniamy obiekt po obiekcie.',
    ],
  },
  cta: { label: 'Kto robi Bojo i co planujemy dalej', href: '/o-bojo' },
} as const;

// Zamknięcie landingu — powtórzenie MAŁEJ prośby z rozmowy z organizatorem
// („weź jedną gierkę na próbę"), nie dużej („przenieś ekipę"). Stoi PO sekcji
// FAQ, czyli po odpowiedzi na zastrzeżenia — dokładnie tak, jak rozmowa na
// Messengerze kończy się pytaniem dopiero po wyjaśnieniu, jak to działa.
//
// Pierwsze zdanie jest ZASTRZEŻENIEM, nie obietnicą, i to jest celowe:
// przyznanie się do braku PRZED obietnicą podnosi wiarygodność u kogoś, kto
// czyta uważnie (efekt pratfall, Aronson 1966; Ein-Gar/Shiv/Tormala, JCR 2012).
// Obiecanie tu podaży graczy kosztowałoby dokładnie tego organizatora, na
// którym najbardziej nam zależy. Testowane w landingContent.test.ts.
export const LANDING_ZAPROSZENIE = {
  nadtytul: 'Jesteśmy na początku',
  tytul: 'Zorganizuj następną gierkę na Bojo',
  body:
    'Nie obiecujemy Ci dziś, że przyślemy graczy, jest nas na to za wcześnie i nie ' +
    'będziemy tego ściemniać. Obiecujemy narzędzie, które zdejmuje z Ciebie liczenie ' +
    'składu, i odpowiedź od człowieka, kiedy coś nie zagra. Każdy mecz wystawiony ' +
    'tutaj przybliża moment, w którym brakującego gracza da się dobrać w okolicy.',
  cta: { label: 'Zorganizuj mecz', href: '/wydarzenia/nowe' },
  poboczne: [
    { label: 'Kto robi Bojo', href: '/o-bojo' },
    { label: 'Napisz do nas', href: KONTAKT_HREF },
  ],
} as const;
