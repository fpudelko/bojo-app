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
    'Otwórz mecz publicznie — zobaczą go gracze z okolicy.',
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
      'tylko obserwuje — widać od razu.',
  },
  {
    icon: 'Users',
    // Bojo jest na wczesnym etapie: otwartych gier bywa mało, więc obietnica
    // „społeczność dobierze skład" nie ma jeszcze pokrycia. Karta renderuje
    // się wyciszona, z plakietką — sprzedaje dalej, ale nie kłamie.
    wczesnyEtap: true,
    title: 'Brakuje ludzi? Otwórz mecz',
    body:
      'Ustaw mecz jako publiczny, a trafi na listę otwartych gier. Graczy szukających ' +
      'gry wciąż przybywa — na razie najpewniejszy skład zbierzesz linkiem do znajomych.',
  },
] as const;

export const LANDING_VALUES = [
  {
    icon: 'Zap',
    title: 'Kreator w trzech krokach',
    body:
      'Sport, boisko z mapy, termin. Mecz publiczny albo prywatny — dostępny wyłącznie ' +
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
      'uwzględniane, wpłaty odhaczasz jednym kliknięciem. Bojo pilnuje rozliczenia — ' +
      'pieniędzy nie przelewa.',
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
      'Szczegóły — nawierzchnię, typ i zdjęcia — uzupełniamy obiekt po obiekcie.',
  },
] as const;

export const LANDING_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Czy Bojo jest darmowe?',
    a: 'Tak. Tworzenie meczów, dołączanie do gier, grupy i mapa boisk są bezpłatne. ' +
      'Nie ma abonamentu ani opłat od organizatora.',
  },
  {
    q: 'Ile zajmuje zorganizowanie meczu?',
    a: 'Kreator ma trzy kroki: sport i boisko, termin i liczba miejsc, opcje. ' +
      'W praktyce dwie minuty. Boisko wybierasz z mapy — nie wpisujesz adresu ręcznie.',
  },
  {
    q: 'Czy muszę mieć konto, żeby przeglądać boiska i mecze?',
    a: 'Nie. Mapa boisk, strony obiektów i lista publicznych meczów są dostępne bez ' +
      'logowania. Konto jest potrzebne dopiero, żeby stworzyć mecz albo się na niego zapisać.',
  },
  {
    q: 'Czym różni się mecz publiczny od prywatnego?',
    a: 'Mecz publiczny widnieje na liście gier i każdy zalogowany może dołączyć. Mecz ' +
      'prywatny jest dostępny wyłącznie dla osób z linkiem albo kodem dołączenia.',
  },
  {
    q: 'Co się dzieje, gdy zbierze się komplet?',
    a: 'Kolejne zapisy trafiają na listę rezerwową. Bojo nie awansuje rezerwowych ' +
      'automatycznie — gdy ktoś się wypisze, organizator sam decyduje, kogo wpuścić.',
  },
  {
    q: 'Czy przez Bojo zapłacę za wynajem boiska?',
    a: 'Nie. Bojo dzieli koszt na graczy, uwzględnia zniżki z kart sportowych i pozwala ' +
      'odhaczyć, kto już oddał pieniądze — ale samego przelewu nie obsługuje. ' +
      'Rozliczacie się jak dotąd, tylko bez liczenia w pamięci.',
  },
  {
    q: 'Gdzie działa Bojo?',
    a: 'W całej Polsce. Mecz stworzysz w dowolnym miejscu — wskazując je na mapie albo ' +
      'wybierając obiekt z katalogu, który obejmuje boiska z całego kraju.',
  },
  {
    q: 'Jak zaprosić stałą ekipę?',
    a: 'Zakładasz grupę i wysyłasz link zaproszenia. Członkowie widzą mecze grupy ' +
      'i historię wspólnych składów w jednym miejscu.',
  },
];

export const LANDING_STATS = {
  sportsValue: '4',
  sportsLabel: 'dyscypliny dziś — piłka, siatka, plażówka, kosz',
  timeValue: '2 min',
  timeLabel: 'tyle zajmuje stworzenie meczu',
  priceValue: '0 zł',
  priceLabel: 'Bojo jest darmowe',
} as const;
