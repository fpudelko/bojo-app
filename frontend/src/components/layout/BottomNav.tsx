'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageCircle, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import { hasPendingApprovalRequests, getNearbyEvents, maNoweWydarzeniaWPobolizu, policzNadchodzaceMoje, KLUCZ_WYDARZENIA_WIDZIANO } from '@/lib/events';
import { getMyGroups, getMyGroupsZTerminem, hasNewGroupEvents, getNewGroupEventGroup, kluczGrupyWidziano } from '@/lib/groups';
import { rozmowyGrupZNieprzeczytanymi } from '@/lib/groupPosts';
import { pobierzRozmowy, policzNieprzeczytane, najswiezszaNieprzeczytana, type WpisRozmowy } from '@/lib/rozmowy';
import { hasGeolocationPermission, getCurrentLocation } from '@/lib/geo';
import { withCount } from '@/lib/plural';
import { WARSTWA } from '@/lib/warstwy';
import { useDlugieWcisniecie } from '@/lib/useDlugieWcisniecie';

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
//    nawigacji. „Szukaj" prowadzi dziś na `/mapa` (Lista/Mapa i Gry/Obiekty
//    w jednym pasku), `/wydarzenia` zostaje żywe, ale przestaje być celem paska.
//  • „Znajdź grę" było czasownikiem wśród samych miejsc.
//  • „Moje" nie miało dopełnienia (moje co?), a „Grupy" kłóciło się z „ekipą",
//    której produkt używa wszędzie indziej.
//
// Zwolnione miejsce dostają ROZMOWY. Pętla powrotu w tej aplikacji to „ktoś
// napisał" — a rozmowy nie miały własnego wejścia: panel wszystkich
// nieprzeczytanych otwierało PRZYTRZYMANIE „Moje", czyli gest, którego nikt
// nie odkryje sam. Wskaźnik nieprzeczytanych wisiał nad ikonami, które
// o wiadomościach nie mówiły nic; dziś siedzi na ikonie podpisanej „Rozmowy",
// jako różowa plakietka z LICZBĄ.
// KOLEJNOŚĆ: Mecze · Szukaj · ＋ · Rozmowy · Ekipy.
//
// „Moje mecze" na PIERWSZEJ pozycji, bo to jest dom zalogowanego. Człowiek
// wraca do Bojo, żeby zobaczyć SWOJĄ grę — czy się odbędzie, kto doszedł, o
// której się zbieramy — a nie żeby szukać nowej. Szukanie to czynność
// jednorazowa na ekipę; oglądanie swojego meczu powtarza się co drugi dzień.
//
// „Rozmowy" tuż przy środkowym „＋", bo to drugi najczęstszy powód otwarcia
// aplikacji („ktoś wypadł?", „o której jutro?").
//
// Zastrzeżenie, świadomie przyjęte: świeże konto zobaczy na pierwszej pozycji
// pusty ekran. Pusty stan da się napisać dobrze — złej kolejności nie da się
// nadrobić niczym.
// „Szukaj" prowadzi na `/mapa?gry=1`, czyli od razu do OTWARTYCH MECZÓW, nie do
// katalogu boisk. Pytanie, z którym człowiek tu wchodzi, brzmi „w co mogę dziś
// zagrać", a nie „jakie są w okolicy boiska" — boisko bez meczu to informacja
// dopiero na drugim kroku. Lista gier jest przy tym gotowa od razu:
// `getPublicEvents()` pobiera wszystkie otwarte mecze naraz, niezależnie od
// kadru mapy, więc nie wymaga ani przybliżania, ani zgody na lokalizację.
//
// `href` zostaje CZYSTĄ ŚCIEŻKĄ (`/mapa`) — po nim idzie dopasowanie stanu
// „wybrane", kropki i dymki niżej. Adres z parametrem siedzi osobno, w
// `hrefPelny`, żeby `?gry=1` nie rozsypało tamtych porównań.
const LEFT_ITEMS = [
  { href: '/moje-gry',   label: 'Mecze',  Icon: CalendarDays },
  { href: '/mapa', hrefPelny: '/mapa?gry=1', label: 'Szukaj', Icon: BallIcon },
] as const;

const RIGHT_ITEMS = [
  { href: '/rozmowy', label: 'Rozmowy', Icon: MessageCircle },
  { href: '/grupy',   label: 'Ekipy',   Icon: UsersIcon },
] as const;

/** `/grupy/<uuid>` (nie `/grupy/nowe`, nie `/grupy/<uuid>/edytuj`) — wyłącznie
 *  strona konkretnej ekipy niesie kontekst grupy do kreatora meczu. */
function groupIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/grupy\/([^/]+)$/);
  if (!m || m[1] === 'nowe') return null;
  return m[1];
}

export default function BottomNav({ hidden = false }: { hidden?: boolean }) {
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

  // WSZYSTKIE rozmowy zalogowanego — mecze, ekipy I rozmowy prywatne — jednym
  // zapytaniem, tą samą funkcją, która karmi ekran `/rozmowy` (`lib/rozmowy.ts`).
  // Zastąpiło trzy osobne zapytania liczące trzy różne rzeczy: liczbę MECZÓW
  // z nieprzeczytanymi, `true/false` dla ekip i nazwę ekipy do dymka — przy
  // czym rozmowy prywatne nie były sprawdzane w ogóle, więc DM nie zapalał
  // wskaźnika. Plakietka z LICZBĄ nie może pokazywać czegoś innego, niż
  // człowiek zobaczy po jej dotknięciu.
  const [rozmowy, setRozmowy] = useState<WpisRozmowy[]>([]);
  const [newGroupEvents, setNewGroupEvents] = useState(false);
  // Nazwa ekipy z najświeższym nowym meczem — wyłącznie do treści dymka
  // „Nowa gra w grupie {nazwa}"; sama kropka nie potrzebuje nazwy, tylko bool.
  const [newGroup, setNewGroup] = useState<{ id: string; name: string } | null>(null);
  // Czy w ogóle ma jakąkolwiek ekipę — samo `boolean`, do dymka odkrywającego
  // gest przytrzymania „Grupy" (patrz `gestGrupy` niżej). Bez ekipy gest i tak
  // nic ciekawego nie robi, więc nie ma sensu go zapowiadać.
  const [maGrupy, setMaGrupy] = useState(false);
  useEffect(() => {
    if (!user) { setRozmowy([]); setNewGroupEvents(false); setNewGroup(null); setMaGrupy(false); return; }
    let aktualne = true;
    getMyGroups(user.id).then((groups) => {
      if (aktualne) setMaGrupy(groups.length > 0);
      const ids = groups.map((g) => g.id);
      pobierzRozmowy(user.id, groups)
        .then((v) => { if (aktualne) setRozmowy(v); })
        .catch(() => { if (aktualne) setRozmowy([]); });
      hasNewGroupEvents(ids)
        .then((v) => { if (aktualne) setNewGroupEvents(v); })
        .catch(() => { if (aktualne) setNewGroupEvents(false); });
      getNewGroupEventGroup(groups)
        .then((v) => { if (aktualne) setNewGroup(v); })
        .catch(() => { if (aktualne) setNewGroup(null); });
    }).catch(() => { if (aktualne) { setRozmowy([]); setNewGroupEvents(false); setNewGroup(null); setMaGrupy(false); } });
    return () => { aktualne = false; };
  }, [user, pathname]);

  // Wyliczane z jednej listy, żeby plakietka i dymki nie mogły się rozjechać.
  const nieprzeczytaneWiadomosci = policzNieprzeczytane(rozmowy);
  const unreadEventTitle = najswiezszaNieprzeczytana(rozmowy, 'mecz')?.tytul ?? null;
  const unreadGroupName = najswiezszaNieprzeczytana(rozmowy, 'grupa')?.tytul ?? null;
  const unreadEvents = unreadEventTitle !== null;
  const unreadGroups = unreadGroupName !== null;

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
      // OBA DYMKI O WIADOMOŚCIACH STOJĄ NAD „ROZMOWY". Wcześniej celowały
      // w „Moje" i „Grupy" — ikony, nad którymi wskaźnika wiadomości już nie
      // ma (zszedł na „Rozmowy" razem z przebudową paska). Dymek tłumaczy
      // wskaźnik, więc musi stać nad tym, który się właśnie zapalił.
      ['wiadomosc-w-meczu', unreadEvents,
        unreadEventTitle ? `Nowa wiadomość w meczu ${unreadEventTitle}` : 'Nowa wiadomość w Twoim meczu',
        '/rozmowy'],
      ['wiadomosci-grupy', unreadGroups, unreadGroupName ? `Nowa wiadomość w grupie ${unreadGroupName}` : 'Nowa wiadomość w Twojej ekipie', '/rozmowy'],
      ['nowy-mecz-grupy', newGroupEvents, newGroup ? `Nowa gra w grupie ${newGroup.name}` : 'Nowa gra w Twojej ekipie', '/grupy'],
      ['pobliskie-nowe', nearbyNew, 'Nowa gra w promieniu 5 km', '/mapa'],
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
    href, hrefPelny, label, Icon, dots = [], dymek, dymekAlign = 'center', licznik = 0, licznikKolor = 'bg-primary-700', licznikOpis, gest,
  }: {
    href: string;
    /** Adres do przejścia, gdy różni się od `href` — bo `href` służy tu także
        za tożsamość pozycji (stan „wybrane", kropki, dymki) i musi zostać
        czystą ścieżką. Dziś tylko „Szukaj": `/mapa` kontra `/mapa?gry=1`. */
    hrefPelny?: string;
    label: string; Icon: React.ComponentType<{ className?: string }>;
    /** Kropki — dziś "Mecze" (niebieska: oczekujące prośby o dołączenie,
        dolny róg), "Ekipy" (pomarańczowa: nowy mecz w ekipie) i "Szukaj"
        (pomarańczowa: nowe wydarzenia w pobliżu). Kolor niesie znaczenie
        w całej apce (patrz AGENTS.md, sekcja Konwencje): niebieski wyłącznie
        "wymaga akceptacji", pomarańczowy wyłącznie "nowość, o której jeszcze
        nie wiesz". Każdy wskaźnik ma swój róg, żeby dwa naraz na tej samej
        ikonie się nie nakładały.

        KROPKA ZOSTAJE DLA RZECZY NIEPOLICZALNYCH. "Coś nowego jest w pobliżu"
        nie ma sensownej liczby — "3 nowe boiska w promieniu 5 km" brzmi jak
        zadanie do odhaczenia, a to jest zaproszenie, nie skrzynka odbiorcza.
        Rzeczy policzalne (mecze, wiadomości) dostają plakietkę z liczbą niżej.

        DWIE PLAKIETKI Z LICZBĄ, TEN SAM KSZTAŁT, RÓŻNE KOLORY: zielona na
        "Mecze" (ile masz zaklepanych gier — stan, nie zdarzenie) i różowa na
        "Rozmowy" (ile nieprzeczytanych wiadomości). Różowy w całej apce znaczy
        wyłącznie "wiadomości", więc plakietka wiąże się wprost z tymi na
        kartach meczów i ekip. Niebieska kropka "prośba o dołączenie" schodzi
        wtedy w dolny róg, żeby nie wpaść pod plakietkę — akcja do wykonania
        nie może zniknąć pod informacją. */
    dots?: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right' }[];
    /** Liczba na plakietce w prawym górnym rogu ikony. 0 nie renderuje nic
        (pusty pasek to nie jest informacja warta piksela), powyżej 9 pokazuje
        "9+", żeby plakietka nie rozpychała kolumny. Dziś dwie: nadchodzące
        mecze na "Mecze" i nieprzeczytane wiadomości na "Rozmowy". */
    licznik?: number;
    /** Tło plakietki. TEN SAM KSZTAŁT, INNY KOLOR — kształt mówi "policzalna
        rzecz", kolor mówi JAKA (AGENTS.md, Konwencje): zielony = stan (ile
        masz zaklepanych gier), różowy = wiadomości. Dwie różne geometrie dla
        dwóch liczb kazałyby uczyć się obu osobno. */
    licznikKolor?: string;
    /** Co ta liczba znaczy, dla czytnika ekranu — bez tego "3" przy Rozmowach
        czyta się tak samo jak "3" przy Meczach. */
    licznikOpis?: (n: number) => string;
    /** Krótkie wyjaśnienie kropki, widoczne ~4 s przy pierwszym zapaleniu
        (patrz `dymekWidoczny`/kolejka wyżej) — max 5 razy w życiu
        użytkownika na typ, najwyżej jeden dymek na ekranie naraz. */
    dymek?: string;
    /** Wyśrodkowany dymek na skrajnej ikonie (pierwszej/ostatniej z pięciu
        kolumn) wystawał poza ekran (zgłoszone wprost, ze zrzutem). Skrajne
        ikony przypinają dymek do swojej wewnętrznej krawędzi zamiast go
        centrować nad ikoną. */
    dymekAlign?: 'left' | 'center' | 'right';
    /** Handlery przytrzymania (`useDlugieWcisniecie`) — dziś tylko na „Ekipy"
        (skok do najbliższej ekipy, patrz `gestGrupy`), stąd opcjonalne.
        Rozłożone wprost na `<Link>`. */
    gest?: Record<string, unknown>;
  }) {
    const active = pathname === href || (href !== '/mapa' && pathname.startsWith(href + '/'));
    const widoczne = dots.filter(Boolean);
    const opisy = [
      ...(licznik > 0 ? [licznikOpis ? licznikOpis(licznik) : `${licznik} ${licznik === 1 ? 'nadchodzący mecz' : 'nadchodzących meczów'}`] : []),
      ...widoczne.map((d) => d.label),
    ];
    const ariaSuffix = opisy.length > 0 ? ` — ${opisy.join(', ')}` : '';
    return (
      <Link
        href={hrefPelny ?? href}
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
          ))}
          {licznik > 0 && (
            <span
              className={clsx(
                'absolute -right-2.5 -top-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white',
                licznikKolor,
              )}
              aria-hidden="true"
            >
              {licznik > 9 ? '9+' : licznik}
            </span>
          )}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </Link>
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
      className={clsx(
        'fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-slate-200/70',
        WARSTWA.nawigacjaDolna,
        // `hidden`, nie odmontowanie — patrz komentarz w BottomNavGate.tsx.
        // `md:hidden` zostaje osobno: pasek i tak jest tylko na telefonie.
        hidden ? 'hidden' : 'md:hidden',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Nawigacja dolna"
    >
      <div className="grid h-14 grid-cols-5 items-end">
        {LEFT_ITEMS.map((item, i) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right' }[] = [];
          if (item.href === '/moje-gry' && pendingApproval) {
            dots.push({ color: 'bg-blue-500', label: 'nowe prośby o dołączenie', position: 'bottom-right' });
          }
          if (item.href === '/mapa' && nearbyNew) {
            dots.push({ color: 'bg-orange-500', label: 'nowe wydarzenia w pobliżu', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Pierwsza kolumna to lewa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === 0 ? 'left' : 'center';
          return (
            <NavLink
              key={item.href}
              {...item}
              dots={dots}
              dymek={dymek}
              dymekAlign={dymekAlign}
              licznik={item.href === '/moje-gry' ? ileMoich : 0}
            />
          );
        })}


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
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' | 'bottom-right' }[] = [];
          if (item.href === '/grupy' && newGroupEvents) {
            dots.push({ color: 'bg-orange-500', label: 'nowy mecz w ekipie', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Ostatnia kolumna to prawa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === RIGHT_ITEMS.length - 1 ? 'right' : 'center';
          // ROZMOWY: LICZBA, NIE CHMURKA. Chmurka mówiła „ktoś napisał" i na
          // tym kończyła — nad ikoną podpisaną „Rozmowy" powtarzała słowo,
          // które i tak stoi obok. Liczba odpowiada na pytanie, które człowiek
          // faktycznie zadaje przed dotknięciem: ILE tego jest, czyli czy to
          // moment na przeczytanie, czy na później. Różowy zostaje — kolor
          // dalej niesie „wiadomości" w całej apce, więc związek z plakietkami
          // na kartach meczów i ekip jest zachowany.
          const licznik = item.href === '/rozmowy' ? nieprzeczytaneWiadomosci : 0;
          return (
            <NavLink
              key={item.href}
              {...item}
              dots={dots}
              dymek={dymek}
              dymekAlign={dymekAlign}
              licznik={licznik}
              licznikKolor="bg-pink-500"
              licznikOpis={(n) => withCount(n, 'nieprzeczytana wiadomość', 'nieprzeczytane wiadomości', 'nieprzeczytanych wiadomości')}
              gest={item.href === '/grupy' ? gestGrupy : undefined}
            />
          );
        })}
      </div>
    </nav>
  );
}
