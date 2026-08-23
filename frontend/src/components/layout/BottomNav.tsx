'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageCircle, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import IkonaWiadomosci from './IkonaWiadomosci';
import { hasPendingApprovalRequests, getNearbyEvents, maNoweWydarzeniaWPobolizu, policzNadchodzaceMoje, KLUCZ_WYDARZENIA_WIDZIANO } from '@/lib/events';
import { getMyGroups, getMyGroupsZTerminem, hasNewGroupEvents, getNewGroupEventGroup, kluczGrupyWidziano } from '@/lib/groups';
import { hasUnreadGroupMessages, getUnreadGroupName, rozmowyGrupZNieprzeczytanymi } from '@/lib/groupPosts';
import { nieprzeczytaneWMeczach } from '@/lib/comments';
import { hasGeolocationPermission, getCurrentLocation } from '@/lib/geo';
import { WARSTWA } from '@/lib/warstwy';
import { useDlugieWcisniecie } from '@/lib/useDlugieWcisniecie';
import PanelRozmow from './PanelRozmow';

/** Ile razy w życiu użytkownika pokazuje się dymek danego typu, zanim
 *  uznamy, że już wie, co ta kropka znaczy. */
const LIMIT_DYMKA = 5;
const CZAS_DYMKA_MS = 4000;

function kluczDymka(typ: string): string {
  return `bojo:dymek-pokazania:${typ}`;
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6.5 L10 10 L14 10 Z" />
      <path d="M10 10 L7 11.5 M14 10 L17 11.5 M10 10 L9 13.5 M14 10 L15 13.5 M9 13.5 L12 15 L15 13.5" />
    </svg>
  );
}

// PIĘĆ MIEJSC, PIĘĆ RÓŻNYCH RZECZY. Poprzedni układ (Znajdź grę · Mapa · +
// · Moje · Grupy) łamał trzy rzeczy naraz:
//
//  • „Znajdź grę" i „Mapa" odpowiadały na to samo pytanie — gdzie coś dla mnie
//    jest — tylko innym widokiem tych samych danych. Widok listy kontra mapy to
//    przełącznik WEWNĄTRZ jednego ekranu, nie dwa miejsca w pasku; zjadały 40%
//    nawigacji. Mapa ma teraz przełącznik na `/wydarzenia`.
//  • „Znajdź grę" było czasownikiem wśród samych miejsc.
//  • „Moje" nie miało dopełnienia (moje co?), a „Grupy" kłóciło się z „ekipą",
//    której produkt używa wszędzie indziej.
//
// Zwolnione miejsce dostają ROZMOWY. Pętla powrotu w tej aplikacji to „ktoś
// napisał" — a rozmowy nie miały własnego wejścia: panel wszystkich
// nieprzeczytanych otwierało PRZYTRZYMANIE „Moje", czyli gest, którego nikt
// nie odkryje sam. Różowa chmurka wisiała nad ikonami, które o wiadomościach
// nie mówiły nic.
const LEFT_ITEMS = [
  { href: '/mapa', label: 'Szukaj', Icon: BallIcon },
] as const;

const RIGHT_ITEMS = [
  { href: '/moje-gry', label: 'Moje mecze', Icon: CalendarDays },
  { href: '/grupy',    label: 'Ekipy',      Icon: UsersIcon },
] as const;

/** `/grupy/<uuid>` (nie `/grupy/nowe`, nie `/grupy/<uuid>/edytuj`) — wyłącznie
 *  strona konkretnej ekipy niesie kontekst grupy do kreatora meczu. */
function groupIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/grupy\/([^/]+)$/);
  if (!m || m[1] === 'nowe') return null;
  return m[1];
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const groupId = groupIdFromPathname(pathname);
  const nowyHref = groupId ? `/wydarzenia/nowe?group=${groupId}` : '/wydarzenia/nowe';

  // Leniwie przy każdej zmianie trasy — ten sam wzorzec "leniwego" odpalania
  // co reszta powiadomień w repo, bez kanału realtime dla zwykłej kropki.
  // `aktualne` w każdym z tych efektów odrzuca odpowiedź, która wróciła PO
  // tym, jak trasa zmieniła się ponownie — bez tego wolniejsza odpowiedź
  // z poprzedniej trasy mogła nadpisać świeższy, poprawny stan świeżo
  // odpalonego zapytania i zostawić kropkę zapaloną bez realnego powodu
  // (zgłoszone wprost: różowa kropka na „Moje" mimo braku jakiejkolwiek
  // nieprzeczytanej wiadomości).
  const [pendingApproval, setPendingApproval] = useState(false);
  useEffect(() => {
    if (!user) { setPendingApproval(false); return; }
    let aktualne = true;
    // Błąd zapytania NIE zostawia poprzedniej wartości — inaczej jeden
    // przejściowy błąd sieci (albo odświeżenie tokenu w trakcie) zapalał
    // kropkę na stałe, bo `.catch(() => {})` po prostu nic nie robił i stan
    // sprzed błędu zostawał zamrożony (zgłoszone wprost: kropka mimo braku
    // czegokolwiek do przeczytania). Brak pewności co do stanu = brak kropki,
    // nie „ostatnia znana wartość".
    hasPendingApprovalRequests(user.id)
      .then((v) => { if (aktualne) setPendingApproval(v); })
      .catch(() => { if (aktualne) setPendingApproval(false); });
    return () => { aktualne = false; };
  }, [user, pathname]);

  // Liczba nadchodzących meczów na „Moje". Kropka mówi tylko „coś tu jest";
  // liczba mówi, ile masz zaklepanych gier — i to jest informacja, po którą
  // ktoś sięga codziennie, a nie raz przy zapaleniu wskaźnika.
  const [ileMoich, setIleMoich] = useState(0);
  useEffect(() => {
    if (!user) { setIleMoich(0); return; }
    let aktualne = true;
    policzNadchodzaceMoje(user.id)
      .then((v) => { if (aktualne) setIleMoich(v); })
      .catch(() => { if (aktualne) setIleMoich(0); });
    return () => { aktualne = false; };
  }, [user, pathname]);

  // Różowe chmurki „nowe wiadomości" — osobne zapytanie od niebieskiej wyżej,
  // bo to inne znaczenie (patrz komentarz przy `dot` w `NavLink`), nie inny
  // poziom pilności.
  const [unreadEvents, setUnreadEvents] = useState(false);
  // Tytuł meczu z najświeższą nieprzeczytaną — wyłącznie do treści dymka.
  const [unreadEventTitle, setUnreadEventTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setUnreadEvents(false); setUnreadEventTitle(null); return; }
    let aktualne = true;
    nieprzeczytaneWMeczach(user.id)
      .then(({ ile, tytul }) => {
        if (!aktualne) return;
        setUnreadEvents(ile > 0);
        setUnreadEventTitle(tytul);
      })
      .catch(() => { if (aktualne) { setUnreadEvents(false); setUnreadEventTitle(null); } });
    return () => { aktualne = false; };
  }, [user, pathname]);

  const [unreadGroups, setUnreadGroups] = useState(false);
  const [newGroupEvents, setNewGroupEvents] = useState(false);
  // Nazwa ekipy z najświeższym nowym meczem — wyłącznie do treści dymka
  // „Nowa gra w grupie {nazwa}"; sama kropka nie potrzebuje nazwy, tylko bool.
  const [newGroup, setNewGroup] = useState<{ id: string; name: string } | null>(null);
  // Nazwa ekipy z nieprzeczytaną wiadomością — do dymka „Nowa wiadomość
  // w grupie {nazwa}". Sam wskaźnik jej nie potrzebuje, tylko bool.
  const [unreadGroupName, setUnreadGroupName] = useState<string | null>(null);
  // Czy w ogóle ma jakąkolwiek ekipę — samo `boolean`, do dymka odkrywającego
  // gest przytrzymania „Grupy" (patrz `gestGrupy` niżej). Bez ekipy gest i tak
  // nic ciekawego nie robi, więc nie ma sensu go zapowiadać.
  const [maGrupy, setMaGrupy] = useState(false);
  useEffect(() => {
    if (!user) { setUnreadGroups(false); setNewGroupEvents(false); setNewGroup(null); setUnreadGroupName(null); setMaGrupy(false); return; }
    let aktualne = true;
    getMyGroups(user.id).then((groups) => {
      if (aktualne) setMaGrupy(groups.length > 0);
      const ids = groups.map((g) => g.id);
      hasUnreadGroupMessages(user.id, ids)
        .then((v) => { if (aktualne) setUnreadGroups(v); })
        .catch(() => { if (aktualne) setUnreadGroups(false); });
      hasNewGroupEvents(ids)
        .then((v) => { if (aktualne) setNewGroupEvents(v); })
        .catch(() => { if (aktualne) setNewGroupEvents(false); });
      getNewGroupEventGroup(groups)
        .then((v) => { if (aktualne) setNewGroup(v); })
        .catch(() => { if (aktualne) setNewGroup(null); });
      getUnreadGroupName(user.id, groups)
        .then((v) => { if (aktualne) setUnreadGroupName(v); })
        .catch(() => { if (aktualne) setUnreadGroupName(null); });
    }).catch(() => { if (aktualne) { setUnreadGroups(false); setNewGroupEvents(false); setNewGroup(null); setUnreadGroupName(null); setMaGrupy(false); } });
    return () => { aktualne = false; };
  }, [user, pathname]);

  // Pomarańczowa kropka „nowe wydarzenia w pobliżu" przy „Znajdź grę" —
  // wyłącznie gdy zgoda na lokalizację jest JUŻ udzielona (`getCurrentLocation()`
  // wprost wywołałaby systemowe okno o zgodę bez kontekstu, przy każdej zmianie
  // trasy). Brak zgody = brak kropki, nie prośba o nią w tle.
  const [nearbyNew, setNearbyNew] = useState(false);
  useEffect(() => {
    let aktualne = true;
    (async () => {
      const granted = await hasGeolocationPermission();
      if (!granted) { if (aktualne) setNearbyNew(false); return; }
      const loc = await getCurrentLocation();
      if (!loc.ok) { if (aktualne) setNearbyNew(false); return; }
      const events = await getNearbyEvents(loc.lat, loc.lng, 5, 20).catch(() => []);
      const widziano = typeof window !== 'undefined' ? window.localStorage.getItem(KLUCZ_WYDARZENIA_WIDZIANO) : null;
      if (aktualne) setNearbyNew(maNoweWydarzeniaWPobolizu(events, widziano));
    })();
    return () => { aktualne = false; };
  }, [pathname]);

  // Przytrzymanie „Moje" → panel z listą wszystkich nieprzeczytanych rozmów
  // (mecze + ekipy), zgłoszone wprost. Hak żyje na poziomie komponentu, nie
  // wewnątrz `NavLink` — `NavLink` jest funkcją definiowaną w ciele
  // `BottomNav`, więc hak zdefiniowany w niej resetowałby się co render.
  const [panelRozmowOtwarty, setPanelRozmowOtwarty] = useState(false);

  // Przytrzymanie „Grupy" → od razu ekipa, o którą chodzi, zamiast listy
  // wszystkich (zgłoszone wprost). Priorytet: 1) ekipa z NAJBLIŻSZYM
  // wydarzeniem (`getMyGroupsZTerminem` sortuje dokładnie w tej kolejności —
  // ta sama funkcja karmi karty na `/grupy`), 2) w jej braku — ekipa
  // z najświeższą nieprzeczytaną wiadomością, 3) bez żadnego z tych dwóch —
  // zwykła lista `/grupy`, czyli to samo, co zrobiłoby tapnięcie. Zapytania
  // lecą NA ŻĄDANIE gestu, nie przy każdej zmianie trasy — inaczej doszłyby
  // dwa kolejne zapytania do i tak już długiej listy w tym pliku.
  const idacDoGrupy = useRef(false);
  const otworzNajlepszaGrupe = async () => {
    if (!user || idacDoGrupy.current) return;
    idacDoGrupy.current = true;
    try {
      const grupy = await getMyGroupsZTerminem(user.id);
      const zNajblizszym = grupy.find((g) => g.nextEvent);
      if (zNajblizszym) { router.push(`/grupy/${zNajblizszym.id}`); return; }
      const nieprzeczytane = await rozmowyGrupZNieprzeczytanymi(user.id, grupy);
      router.push(nieprzeczytane[0] ? `/grupy/${nieprzeczytane[0].id}` : '/grupy');
    } catch {
      router.push('/grupy');
    } finally {
      idacDoGrupy.current = false;
    }
  };
  const gestGrupy = useDlugieWcisniecie(otworzNajlepszaGrupe);

  // Dymki — krótkie wyjaśnienie znaczenia kropki, na moment, gdy się zapala.
  // Zawsze przypięty do konkretnej ikony (`href`) — stąd osobne typy dla
  // różowej na „Moje" i różowej na „Grupy", mimo identycznego tekstu; bez
  // tego nie dałoby się jednoznacznie wybrać, przy której ikonie pokazać
  // wspólny dymek „wiadomości". Widoczny jest NAJWYŻEJ JEDEN naraz —
  // `kolejkaDymkow` kolejkuje resztę zamiast pokazywać je równolegle, żeby
  // dwa dymki nigdy się nie zasłaniały (zgłoszone wprost). `poprzednieAktywne`
  // łapie WYŁĄCZNIE przejście false→true (nie każde przeliczenie przy
  // zmianie trasy, inaczej dymek wracałby za każdym przejściem między
  // ekranami, dopóki kropka świeci). Licznik pokazań w `localStorage` jest
  // per typ — po `LIMIT_DYMKA` przestaje się pojawiać, zakładamy że
  // użytkownik już wie, co ta kropka znaczy.
  const [dymekWidoczny, setDymekWidoczny] = useState<{ typ: string; tekst: string; href: string } | null>(null);
  const kolejkaDymkow = useRef<{ typ: string; tekst: string; href: string }[]>([]);
  const poprzednieAktywne = useRef<Record<string, boolean>>({});
  const timerDymka = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aktualnyDymek = useRef<{ typ: string; tekst: string; href: string } | null>(null);
  // Ref, nie sam stan: `pokazNastepnyDymek` woła się z `setTimeout`, więc
  // domknięcie sprzed 4 sekund widziałoby nieaktualną ekipę.
  const newGroupRef = useRef<{ id: string; name: string } | null>(null);
  useEffect(() => { newGroupRef.current = newGroup; }, [newGroup]);

  /**
   * Gasi wskaźnik, którego dymek właśnie zniknął.
   *
   * WYŁĄCZNIE pomarańczowe. Pomarańczowy znaczy „nowość, o której jeszcze nie
   * wiesz" (AGENTS.md, Konwencje) — dymek wymieniający ekipę albo promień
   * z nazwy dostarcza dokładnie tę wiadomość, więc kropka nie ma już czego
   * sygnalizować. Zapis idzie do tego samego klucza w `localStorage`, co
   * odwiedzenie strony ekipy, więc gaśnie też kropka na karcie na `/grupy`.
   *
   * Różowa (wiadomości) NIE gaśnie po dymku — świadomie. Ona nie mówi
   * „jest nowość", tylko „jest coś do przeczytania", a to znika dopiero po
   * przeczytaniu. Dymek trwa 4 sekundy i użytkownik może na niego nie
   * patrzeć; wiadomość zgubiona w ten sposób nie ma jak się upomnieć.
   */
  const wygasWskaznik = (typ: string) => {
    if (typeof window === 'undefined') return;
    const teraz = new Date().toISOString();
    if (typ === 'pobliskie-nowe') {
      window.localStorage.setItem(KLUCZ_WYDARZENIA_WIDZIANO, teraz);
      setNearbyNew(false);
      return;
    }
    if (typ === 'nowy-mecz-grupy' && newGroupRef.current) {
      window.localStorage.setItem(kluczGrupyWidziano(newGroupRef.current.id), teraz);
      setNewGroupEvents(false);
      setNewGroup(null);
    }
  };

  const pokazNastepnyDymek = () => {
    // Wskaźnik gaśnie razem ze swoim dymkiem, nie w chwili jego pokazania —
    // inaczej kropka znikałaby spod tekstu, który właśnie ją tłumaczy.
    if (aktualnyDymek.current) wygasWskaznik(aktualnyDymek.current.typ);
    const nastepny = kolejkaDymkow.current.shift() ?? null;
    aktualnyDymek.current = nastepny;
    setDymekWidoczny(nastepny);
    timerDymka.current = nastepny ? setTimeout(pokazNastepnyDymek, CZAS_DYMKA_MS) : null;
  };

  useEffect(() => {
    const proby: [string, boolean, string | null, string][] = [
      ['prosby', pendingApproval, 'Nowa prośba o dołączenie', '/moje-gry'],
      // Klucz typu ZMIENIONY z 'wiadomosci-moje': licznik pokazań siedzi
      // w localStorage per typ, więc stary klucz niósł zużyte pokazania dawnego,
      // ogólnikowego dymka „Nowe wiadomości". Nowy klucz = nowa treść dostaje
      // swoje pięć pokazań, zamiast milczeć u kogoś, kto tamten już wyczerpał.
      ['wiadomosc-w-meczu', unreadEvents,
        unreadEventTitle ? `Nowa wiadomość w meczu ${unreadEventTitle}` : 'Nowa wiadomość w Twoim meczu',
        '/moje-gry'],
      ['wiadomosci-grupy', unreadGroups, unreadGroupName ? `Nowa wiadomość w grupie ${unreadGroupName}` : 'Nowa wiadomość w Twojej ekipie', '/grupy'],
      ['nowy-mecz-grupy', newGroupEvents, newGroup ? `Nowa gra w grupie ${newGroup.name}` : 'Nowa gra w Twojej ekipie', '/grupy'],
      ['pobliskie-nowe', nearbyNew, 'Nowa gra w promieniu 5 km', '/mapa'],
      // Odkrywalność gestu przytrzymania — bez tego nikt by się nie
      // dowiedział, że panel istnieje. Zapala się razem z pierwszą chmurką
      // wiadomości (mecz albo ekipa), najwyżej `LIMIT_DYMKA` razy w życiu.
      ['przytrzymaj-rozmowy', unreadEvents || unreadGroups, 'Przytrzymaj „Moje" → wszystkie rozmowy', '/moje-gry'],
      // Ten sam wzorzec co wyżej, dla drugiego gestu w tym pasku — zapala się,
      // gdy jest w ogóle CO otworzyć skrótem (ktoś ma choć jedną ekipę).
      ['przytrzymaj-grupy', maGrupy, 'Przytrzymaj „Grupy" → najbliższa ekipa', '/grupy'],
    ];
    for (const [typ, aktywny, tekst, href] of proby) {
      const byloAktywne = poprzednieAktywne.current[typ] ?? false;
      poprzednieAktywne.current[typ] = aktywny;
      if (!aktywny || byloAktywne || !tekst || typeof window === 'undefined') continue;
      const klucz = kluczDymka(typ);
      const ile = Number(window.localStorage.getItem(klucz) ?? '0');
      if (ile >= LIMIT_DYMKA) continue;
      window.localStorage.setItem(klucz, String(ile + 1));
      kolejkaDymkow.current.push({ typ, tekst, href });
    }
    if (!dymekWidoczny && !timerDymka.current && kolejkaDymkow.current.length > 0) pokazNastepnyDymek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApproval, unreadEvents, unreadEventTitle, unreadGroups, newGroupEvents, newGroup, unreadGroupName, nearbyNew, maGrupy]);

  useEffect(() => () => { if (timerDymka.current) clearTimeout(timerDymka.current); }, []);

  function NavLink({
    href, label, Icon, dots = [], dymek, dymekAlign = 'center', licznik = 0, gest,
    naKlik, aktywny,
  }: {
    /** Pusty, gdy pozycja nie prowadzi do trasy (Rozmowy otwierają arkusz). */
    href?: string; label: string; Icon: React.ComponentType<{ className?: string }>;
    /** Wskaźniki — dziś "Moje" (niebieska kropka: oczekujące prośby o dołączenie
        z prawej; różowa CHMURKA: nieprzeczytane wiadomości z lewej), "Grupy"
        (różowa chmurka z lewej; pomarańczowa kropka: nowy mecz w ekipie z prawej)
        i "Znajdź grę" (pomarańczowa kropka: nowe wydarzenia w pobliżu, z prawej).
        Kolor niesie znaczenie w całej apce (patrz AGENTS.md, sekcja Konwencje):
        niebieski wyłącznie "wymaga akceptacji", różowy wyłącznie "wiadomości",
        pomarańczowy wyłącznie "nowość, o której jeszcze nie wiesz". Każdy
        wskaźnik ma swój róg, żeby dwa naraz na tej samej ikonie się nie nakładały.

        KSZTAŁT też niesie znaczenie: wiadomości dostają CHMURKĘ, nie kropkę.
        Kropka mówi wyłącznie "coś tu jest" i wymaga zapamiętania koloru;
        chmurka mówi "ktoś napisał" bez tłumaczenia (zgłoszone wprost:
        "różowa kropka oznacza że wiadomość nowa?"). Kolor zostaje ten sam,
        więc związek z plakietkami wiadomości na kartach nie znika.

        LICZBA nadchodzących meczów na "Moje" jest zielona, nie w żadnym
        z trzech znaczeniowych kolorów — bo nie znaczy ani "przeczytaj", ani
        "zdecyduj", ani "nowość". To stan, nie zdarzenie: liczba zaklepanych
        gier, którą patrzy się codziennie. Niebieska kropka "prośba o dołączenie"
        schodzi wtedy w dolny róg, żeby nie wpaść pod plakietkę — akcja do
        wykonania nie może zniknąć pod informacją. */
    dots?: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right'; ksztalt?: 'kropka' | 'chmurka' }[];
    /** Liczba nadchodzących meczów — plakietka w prawym górnym rogu ikony.
        0 nie renderuje nic (pusty pasek to nie jest informacja warta piksela),
        powyżej 9 pokazuje "9+", żeby plakietka nie rozpychała kolumny. */
    licznik?: number;
    /** Krótkie wyjaśnienie kropki, widoczne ~4 s przy pierwszym zapaleniu
        (patrz `dymekWidoczny`/kolejka wyżej) — max 5 razy w życiu
        użytkownika na typ, najwyżej jeden dymek na ekranie naraz. */
    dymek?: string;
    /** Wyśrodkowany dymek na skrajnej ikonie (pierwszej/ostatniej z pięciu
        kolumn) wystawał poza ekran (zgłoszone wprost, ze zrzutem). Skrajne
        ikony przypinają dymek do swojej wewnętrznej krawędzi zamiast go
        centrować nad ikoną. */
    dymekAlign?: 'left' | 'center' | 'right';
    /** Handlery przytrzymania (`useDlugieWcisniecie`) — na „Moje" (panel
        wszystkich nieprzeczytanych rozmów) i na „Grupy" (od razu najbliższa
        ekipa, patrz `gestGrupy`), stąd opcjonalne. Rozłożone wprost na `<Link>`. */
    gest?: Record<string, unknown>;
    /** Zamiast przejścia — otwarcie arkusza. Wyklucza się z `href`. */
    naKlik?: () => void;
    /** Stan „wybrane" dla pozycji bez trasy. */
    aktywny?: boolean;
  }) {
    // `/mapa` (Szukaj) nie ma dziś podtras — wyłączenie zostaje na wszelki
    // wypadek, gdyby kiedyś dostała (np. szczegóły obiektu pod tym prefiksem).
    const active = aktywny
      ?? (pathname === href || (!!href && href !== '/mapa' && pathname.startsWith(href + '/')));
    const widoczne = dots.filter(Boolean);
    const opisy = [
      ...(licznik > 0 ? [`${licznik} ${licznik === 1 ? 'nadchodzący mecz' : 'nadchodzących meczów'}`] : []),
      ...widoczne.map((d) => d.label),
    ];
    const ariaSuffix = opisy.length > 0 ? ` — ${opisy.join(', ')}` : '';
    // Ten sam kształt, dwa elementy: pozycja z trasą to `<Link>`, pozycja
    // otwierająca arkusz to `<button>` — a nie `<Link href="#">`, bo tamto
    // kłamie czytnikom ekranu i podmienia adres w pasku.
    const Element = (naKlik ? 'button' : Link) as React.ElementType;
    const wlasciwosci = naKlik
      ? { type: 'button' as const, onClick: naKlik, 'aria-expanded': !!aktywny }
      : { href: href! };
    return (
      <Element
        {...wlasciwosci}
        aria-label={ariaSuffix ? `${label}${ariaSuffix}` : undefined}
        className={clsx(
          'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
          active ? 'text-primary-700' : 'text-slate-400 hover:text-slate-600',
          gest && 'select-none [-webkit-touch-callout:none]',
        )}
        {...gest}
      >
        <span className="relative">
          {dymek && (
            <span
              role="status"
              className={clsx(
                // `bg-slate-800`, nie `bg-ink` — `ink` odwraca się w trybie
                // ciemnym (tekst → prawie biały tło), więc dymek z twardym
                // `text-white` znikał na własnym tle (zgłoszone wprost:
                // "średnio widać dymki w trybie ciemnym"). Dymek ma być ciemną
                // plakietką w OBU motywach, jak toast (`lib/toast.tsx`), nie
                // podążać za odwracającym się tokenem tekstu.
                'pointer-events-none absolute -top-9 z-[1020] w-max max-w-[130px] rounded-lg bg-slate-800 px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white shadow-lg',
                dymekAlign === 'left' && 'left-0',
                dymekAlign === 'right' && 'right-0',
                dymekAlign === 'center' && 'left-1/2 -translate-x-1/2',
              )}
            >
              {dymek}
              <span
                className={clsx(
                  'absolute top-full h-0 w-0 border-4 border-transparent border-t-slate-800',
                  dymekAlign === 'left' && 'left-2.5',
                  dymekAlign === 'right' && 'right-2.5',
                  dymekAlign === 'center' && 'left-1/2 -translate-x-1/2',
                )}
              />
            </span>
          )}
          <Icon className={clsx('w-5 h-5 transition-transform', active && 'scale-110')} />
          {/* Kropka zamiast pełnej plakietki — kolumna w gridzie dolnej
              nawigacji jest zbyt wąska na pełny badge. `aria-label` wyżej
              niesie tę samą informację dla czytników ekranu. */}
          {widoczne.map((d) => (
            d.ksztalt === 'chmurka' ? (
              // Chmurka jest większa od kropki, więc wychodzi dalej poza ikonę
              // i dostaje białą obwódkę — inaczej zlewa się z kreską ikony pod
              // spodem. `fill` razem ze `stroke`, bo sam kontur w tym rozmiarze
              // gubi się na tle.
              <IkonaWiadomosci
                key={d.position}
                className={clsx(
                  'absolute h-3.5 w-3.5 -top-2',
                  d.position === 'top-right' ? '-right-2' : '-left-2',
                  d.color,
                )}
              />
            ) : (
              <span
                key={d.position}
                className={clsx(
                  'absolute h-1.5 w-1.5 rounded-full',
                  d.position === 'top-right' && '-top-0.5 right-0',
                  d.position === 'top-left' && '-top-0.5 left-0',
                  d.position === 'bottom-right' && '-bottom-0.5 -right-0.5 ring-2 ring-white',
                  d.color,
                )}
                aria-hidden="true"
              />
            )
          ))}
          {licznik > 0 && (
            <span
              className="absolute -right-2.5 -top-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary-700 px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white"
              aria-hidden="true"
            >
              {licznik > 9 ? '9+' : licznik}
            </span>
          )}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </Element>
    );
  }

  return (
    // Bez elementu-dystansu. Wcześniej stał tu <div className="h-16 md:hidden" />,
    // ale BottomNavGate montuje się w app/layout.tsx PO {children}, czyli poza
    // kontenerem `min-h-screen` strony — dystans nie odsuwał treści, tylko
    // wydłużał dokument o 64 px na każdej stronie. Miejsce dla paska robi teraz
    // zmienna --bottom-nav-h w globals.css; jej wartość musi się zgadzać
    // z `h-14` niżej.
    <nav
      className={`md:hidden fixed bottom-0 inset-x-0 ${WARSTWA.nawigacjaDolna} bg-white/95 backdrop-blur-sm border-t border-slate-200/70`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Nawigacja dolna"
    >
      <div className="grid h-14 grid-cols-5 items-end">
        {LEFT_ITEMS.map((item, i) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right'; ksztalt?: 'kropka' | 'chmurka' }[] = [];
          if (item.href === '/mapa' && nearbyNew) {
            dots.push({ color: 'bg-orange-500', label: 'nowe wydarzenia w pobliżu', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Pierwsza kolumna to lewa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === 0 ? 'left' : 'center';
          return <NavLink key={item.href} {...item} dots={dots} dymek={dymek} dymekAlign={dymekAlign} />;
        })}

        {/* ROZMOWY. Panel istniał od dawna, ale otwierało go PRZYTRZYMANIE
            „Moje" — gest, którego nikt nie odkryje sam, więc funkcja praktycznie
            nie istniała. Chmurki nieprzeczytanych wisiały tymczasem nad „Moje"
            i „Grupy", czyli nad ikonami, które o wiadomościach nie mówią nic;
            teraz obie schodzą tutaj, na ikonę, która mówi wprost.

            Otwiera arkusz, nie prowadzi do trasy: panel pokazuje rozmowy
            z NIEPRZECZYTANYMI, więc jako osobny ekran bywałby pusty. Osobna
            strona ze WSZYSTKIMI rozmowami to zmiana na inny dzień — wymaga
            zapytań, których dziś nie ma. */}
        <NavLink
          label="Rozmowy"
          Icon={MessageCircle}
          naKlik={() => setPanelRozmowOtwarty(true)}
          aktywny={panelRozmowOtwarty}
          dots={(unreadEvents || unreadGroups)
            ? [{ color: 'text-pink-500', label: 'nowe wiadomości', position: 'top-left', ksztalt: 'chmurka' }]
            : []}
        />

        {/* Centre FAB — always accessible, can't be deselected. Na stronie
            konkretnej ekipy prowadzi do kreatora z już wybraną grupą — to jest
            "przycisk nowy tworzy mecz od razu przypisany do tej grupy". */}
        <Link
          href={nowyHref}
          aria-label="Stwórz nowy mecz"
          className="flex h-full flex-col items-center justify-center gap-0.5 pb-2 group"
        >
          <span className="flex h-12 w-12 -mt-4 items-center justify-center rounded-full bg-primary-700 text-white shadow-lg ring-4 ring-white group-active:scale-95 transition-transform">
            <Plus className="w-6 h-6" />
          </span>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wide">Nowy</span>
        </Link>

        {RIGHT_ITEMS.map((item, i) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right'; ksztalt?: 'kropka' | 'chmurka' }[] = [];
          if (item.href === '/moje-gry') {
            if (pendingApproval) dots.push({ color: 'bg-blue-500', label: 'nowe prośby o dołączenie', position: 'bottom-right' });
          }
          if (item.href === '/grupy') {
            if (newGroupEvents) dots.push({ color: 'bg-orange-500', label: 'nowy mecz w ekipie', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Ostatnia kolumna to prawa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === RIGHT_ITEMS.length - 1 ? 'right' : 'center';
          return (
            <NavLink
              key={item.href}
              {...item}
              dots={dots}
              dymek={dymek}
              dymekAlign={dymekAlign}
              licznik={item.href === '/moje-gry' ? ileMoich : 0}
              gest={item.href === '/grupy' ? gestGrupy : undefined}
            />
          );
        })}
      </div>
      {user && (
        <PanelRozmow
          otwarty={panelRozmowOtwarty}
          naZamknij={() => setPanelRozmowOtwarty(false)}
          userId={user.id}
        />
      )}
    </nav>
  );
}
