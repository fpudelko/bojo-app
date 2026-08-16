'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Plus, CalendarDays, Users as UsersIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/lib/auth';
import { hasPendingApprovalRequests, getNearbyEvents, maNoweWydarzeniaWPobolizu, KLUCZ_WYDARZENIA_WIDZIANO } from '@/lib/events';
import { getMyGroups, hasNewGroupEvents, getNewGroupEventGroupName } from '@/lib/groups';
import { hasUnreadGroupMessages } from '@/lib/groupPosts';
import { hasUnreadEventMessages } from '@/lib/comments';
import { hasGeolocationPermission, getCurrentLocation } from '@/lib/geo';
import { WARSTWA } from '@/lib/warstwy';

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

const LEFT_ITEMS = [
  { href: '/wydarzenia', label: 'Znajdź grę', Icon: BallIcon },
  { href: '/mapa',       label: 'Mapa',       Icon: Map },
] as const;

const RIGHT_ITEMS = [
  { href: '/moje-gry', label: 'Moje',   Icon: CalendarDays },
  { href: '/grupy',    label: 'Grupy',  Icon: UsersIcon },
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

  // Różowe kropki „nowe wiadomości" — osobne zapytanie od niebieskiej wyżej,
  // bo to inne znaczenie (patrz komentarz przy `dot` w `NavLink`), nie inny
  // poziom pilności.
  const [unreadEvents, setUnreadEvents] = useState(false);
  useEffect(() => {
    if (!user) { setUnreadEvents(false); return; }
    let aktualne = true;
    hasUnreadEventMessages(user.id)
      .then((v) => { if (aktualne) setUnreadEvents(v); })
      .catch(() => { if (aktualne) setUnreadEvents(false); });
    return () => { aktualne = false; };
  }, [user, pathname]);

  const [unreadGroups, setUnreadGroups] = useState(false);
  const [newGroupEvents, setNewGroupEvents] = useState(false);
  // Nazwa ekipy z najświeższym nowym meczem — wyłącznie do treści dymka
  // „Nowa gra w grupie {nazwa}"; sama kropka nie potrzebuje nazwy, tylko bool.
  const [newGroupName, setNewGroupName] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setUnreadGroups(false); setNewGroupEvents(false); setNewGroupName(null); return; }
    let aktualne = true;
    getMyGroups(user.id).then((groups) => {
      const ids = groups.map((g) => g.id);
      hasUnreadGroupMessages(user.id, ids)
        .then((v) => { if (aktualne) setUnreadGroups(v); })
        .catch(() => { if (aktualne) setUnreadGroups(false); });
      hasNewGroupEvents(ids)
        .then((v) => { if (aktualne) setNewGroupEvents(v); })
        .catch(() => { if (aktualne) setNewGroupEvents(false); });
      getNewGroupEventGroupName(groups)
        .then((v) => { if (aktualne) setNewGroupName(v); })
        .catch(() => { if (aktualne) setNewGroupName(null); });
    }).catch(() => { if (aktualne) { setUnreadGroups(false); setNewGroupEvents(false); setNewGroupName(null); } });
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

  const pokazNastepnyDymek = () => {
    const nastepny = kolejkaDymkow.current.shift();
    setDymekWidoczny(nastepny ?? null);
    timerDymka.current = nastepny ? setTimeout(pokazNastepnyDymek, CZAS_DYMKA_MS) : null;
  };

  useEffect(() => {
    const proby: [string, boolean, string | null, string][] = [
      ['prosby', pendingApproval, 'Nowa prośba o dołączenie', '/moje-gry'],
      ['wiadomosci-moje', unreadEvents, 'Nowe wiadomości', '/moje-gry'],
      ['wiadomosci-grupy', unreadGroups, 'Nowe wiadomości', '/grupy'],
      ['nowy-mecz-grupy', newGroupEvents, newGroupName ? `Nowa gra w grupie ${newGroupName}` : 'Nowa gra w Twojej ekipie', '/grupy'],
      ['pobliskie-nowe', nearbyNew, 'Nowa gra w promieniu 5 km', '/wydarzenia'],
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
  }, [pendingApproval, unreadEvents, unreadGroups, newGroupEvents, newGroupName, nearbyNew]);

  useEffect(() => () => { if (timerDymka.current) clearTimeout(timerDymka.current); }, []);

  function NavLink({
    href, label, Icon, dots = [], dymek, dymekAlign = 'center',
  }: {
    href: string; label: string; Icon: React.ComponentType<{ className?: string }>;
    /** Kropki — dziś "Moje" (niebieska: oczekujące prośby o dołączenie z prawej;
        różowa: nieprzeczytane wiadomości z lewej), "Grupy" (różowa: nieprzeczytane
        wiadomości z lewej; pomarańczowa: nowy mecz w ekipie z prawej) i
        "Znajdź grę" (pomarańczowa: nowe wydarzenia w pobliżu, z prawej). Kolor
        niesie znaczenie w całej apce (patrz AGENTS.md, sekcja Konwencje):
        niebieski wyłącznie "wymaga akceptacji", różowy wyłącznie "wiadomości",
        pomarańczowy wyłącznie "nowość, o której jeszcze nie wiesz". Każda kropka
        ma swój róg, żeby dwie naraz na tej samej ikonie się nie nakładały. */
    dots?: { color: string; label: string; position: 'top-right' | 'top-left' }[];
    /** Krótkie wyjaśnienie kropki, widoczne ~4 s przy pierwszym zapaleniu
        (patrz `dymekWidoczny`/kolejka wyżej) — max 5 razy w życiu
        użytkownika na typ, najwyżej jeden dymek na ekranie naraz. */
    dymek?: string;
    /** Wyśrodkowany dymek na skrajnej ikonie (pierwszej/ostatniej z pięciu
        kolumn) wystawał poza ekran (zgłoszone wprost, ze zrzutem). Skrajne
        ikony przypinają dymek do swojej wewnętrznej krawędzi zamiast go
        centrować nad ikoną. */
    dymekAlign?: 'left' | 'center' | 'right';
  }) {
    const active = pathname === href || (href !== '/wydarzenia' && pathname.startsWith(href + '/'));
    const widoczne = dots.filter(Boolean);
    const ariaSuffix = widoczne.length > 0 ? ` — ${widoczne.map((d) => d.label).join(', ')}` : '';
    return (
      <Link
        href={href}
        aria-label={ariaSuffix ? `${label}${ariaSuffix}` : undefined}
        className={clsx(
          'flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-colors',
          active ? 'text-primary-700' : 'text-slate-400 hover:text-slate-600',
        )}
      >
        <span className="relative">
          {dymek && (
            <span
              role="status"
              className={clsx(
                'pointer-events-none absolute -top-9 z-[1020] w-max max-w-[130px] rounded-lg bg-ink px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white shadow-lg',
                dymekAlign === 'left' && 'left-0',
                dymekAlign === 'right' && 'right-0',
                dymekAlign === 'center' && 'left-1/2 -translate-x-1/2',
              )}
            >
              {dymek}
              <span
                className={clsx(
                  'absolute top-full h-0 w-0 border-4 border-transparent border-t-ink',
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
                d.position === 'top-right' ? '-top-0.5 right-0' : '-top-0.5 left-0',
                d.color,
              )}
              aria-hidden="true"
            />
          ))}
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
      className={`md:hidden fixed bottom-0 inset-x-0 ${WARSTWA.nawigacjaDolna} bg-white/95 backdrop-blur-sm border-t border-slate-200/70`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Nawigacja dolna"
    >
      <div className="grid h-14 grid-cols-5 items-end">
        {LEFT_ITEMS.map((item, i) => {
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' }[] = [];
          if (item.href === '/wydarzenia' && nearbyNew) {
            dots.push({ color: 'bg-orange-500', label: 'nowe wydarzenia w pobliżu', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Pierwsza kolumna to lewa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === 0 ? 'left' : 'center';
          return <NavLink key={item.href} {...item} dots={dots} dymek={dymek} dymekAlign={dymekAlign} />;
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
          const dots: { color: string; label: string; position: 'top-right' | 'top-left' }[] = [];
          if (item.href === '/moje-gry') {
            if (pendingApproval) dots.push({ color: 'bg-blue-500', label: 'nowe prośby o dołączenie', position: 'top-right' });
            if (unreadEvents) dots.push({ color: 'bg-pink-500', label: 'nowe wiadomości', position: 'top-left' });
          }
          if (item.href === '/grupy') {
            if (unreadGroups) dots.push({ color: 'bg-pink-500', label: 'nowe wiadomości', position: 'top-left' });
            if (newGroupEvents) dots.push({ color: 'bg-orange-500', label: 'nowy mecz w ekipie', position: 'top-right' });
          }
          const dymek = dymekWidoczny?.href === item.href ? dymekWidoczny.tekst : undefined;
          // Ostatnia kolumna to prawa krawędź ekranu — dymek wystawałby poza nią.
          const dymekAlign = i === RIGHT_ITEMS.length - 1 ? 'right' : 'center';
          return <NavLink key={item.href} {...item} dots={dots} dymek={dymek} dymekAlign={dymekAlign} />;
        })}
      </div>
    </nav>
  );
}
