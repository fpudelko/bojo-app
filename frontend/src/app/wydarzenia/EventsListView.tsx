'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Check, List, MailOpen, Map as MapIcon, Navigation, Plus, Search, SlidersHorizontal,
  Ticket, Wallet, X,
} from 'lucide-react';
import { getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { PillDropdown, TogglePill } from '@/components/ui/FilterPill';
import FilterSheet from '@/components/ui/FilterSheet';
import RangeSlider from '@/components/ui/RangeSlider';
import MobileIdentityRow from '@/components/layout/MobileIdentityRow';
import { useAuth } from '@/lib/auth';
import { useMyInvites } from '@/lib/useMyInvites';
import { isEventJoinable } from '@/lib/eventDates';
import { foldText, foldedIncludes } from '@/lib/searchText';
import { plural } from '@/lib/plural';
import { distanceKm, getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import {
  DAY_GROUP_LABEL, filterByMaxPrice, filterByMinFreeSpots, filterByRadius, groupByDay,
  matchesDateFilter, multiLabel, sortEvents, toggleInArray,
  type DateFilter, type EventRow, type SortBy,
} from '@/lib/eventFilters';

// react-leaflet wymaga window — ładowany tylko po stronie klienta, dopiero
// gdy użytkownik faktycznie przełączy się na widok mapy.
const GamesMapCanvas = dynamic(() => import('@/components/map/GamesMapCanvas'), {
  ssr: false,
  loading: () => <div className="mx-4 mt-3 flex h-[65vh] min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">Ładowanie mapy…</div>,
});

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'termin',    label: 'Najbliższy termin' },
  { value: 'odleglosc', label: 'Najbliżej mnie' },
  { value: 'miejsca',   label: 'Najwięcej wolnych miejsc' },
];

const SPORT_OPTIONS = FOCUS_SPORTS.map((s) => ({ value: s, label: sportLabel(s) }));

// Cztery suwaki modala filtrów — zakresy ustalone raz, żeby nie były dowolnością
// przy każdej zmianie. Skrajna prawa pozycja = brak ograniczenia (D2/D3 planu).
const DATE_SLIDER_VALUES: DateFilter[] = ['dzisiaj', 'jutro', 'tydzien', 'miesiac', 'wszystkie'];
const DATE_SLIDER_LABELS = ['Dzisiaj', 'Jutro', 'Ten tydzień', 'Ten miesiąc', 'Wszystko'];
const RADIUS_MIN = 1;
const RADIUS_MAX = 20;
const PRICE_MIN = 0;
const PRICE_MAX = 100;
const PRICE_STEP = 5;
const MIN_SPOTS_MIN = 0;
const MIN_SPOTS_MAX = 14;

const PAGE_SIZE = 20;

/**
 * Lista publicznych meczów — sama treść, bez <Header/> i bez `min-h-screen`.
 *
 * Rozdzielona od EventsListClient, bo ten sam widok służy za tło ekranu
 * logowania (components/auth/LoginBackdrop.tsx). Gdyby renderował własny
 * nagłówek, na /logowanie byłyby dwa.
 */
export default function EventsListView() {
  // Jedno źródło relacji do meczu. Wcześniej strona wołała useMyParticipation()
  // ORAZ useMyInvites(), a oba pobierają getMyParticipationMap — to samo
  // zapytanie leciało dwa razy na każde wejście.
  //
  // Uwaga przy ewentualnej zmianie: useMyParticipation zwracało `undefined`
  // dla wylogowanego, a to `statusFor` zawsze zwraca obiekt ze statusem 'none'.
  // Render wychodzi ten sam, bo STATUS_CHIP w EventBrowseCard nie ma klucza
  // 'none' — gdyby kiedyś doszedł, ta równoważność przestaje działać.
  const { user } = useAuth();
  const { statusFor, openCount: inviteCount } = useMyInvites();

  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [query, setQuery] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('wszystkie');
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [maxPriceGrosze, setMaxPriceGrosze] = useState<number | null>(null);
  const [minFreeSpots, setMinFreeSpots] = useState(0);
  const [onlyFreeSpots, setOnlyFreeSpots] = useState(false);
  const [onlyNoCost, setOnlyNoCost] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('termin');

  // Mobile-only przełącznik lista/mapa (D9) — desktop zawsze pokazuje listę,
  // ma już osobny link „Mapa boisk" w nawigacji.
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Geolokalizacja żądana z osobnej pigułki „Sortuj" ma własny stan zajętości,
  // niezależny od geoBusy modala (promień) — to dwa różne triggery (D5).
  const [sortGeoBusy, setSortGeoBusy] = useState(false);

  // Modal filtrów — wybory są szkicem, aplikują się dopiero na „Pokaż N meczów"
  // (styl Booking: wybierz kilka rzeczy, potem zatwierdź). Zamknięcie przez
  // tło/X/Escape odrzuca szkic bez dotykania prawdziwego stanu. Sortuj już nie
  // jest tu draftowane — ma własną, natychmiast-aplikującą pigułkę (D5).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<DateFilter>(dateFilter);
  const [draftRadius, setDraftRadius] = useState<number | null>(radiusKm);
  const [draftMaxPricePln, setDraftMaxPricePln] = useState<number | null>(
    maxPriceGrosze == null ? null : maxPriceGrosze / 100,
  );
  const [draftMinFreeSpots, setDraftMinFreeSpots] = useState(minFreeSpots);

  const openSheet = () => {
    setDraftDate(dateFilter);
    setDraftRadius(radiusKm);
    setDraftMaxPricePln(maxPriceGrosze == null ? null : maxPriceGrosze / 100);
    setDraftMinFreeSpots(minFreeSpots);
    setSheetOpen(true);
  };

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setAllEvents(await getPublicEvents());
    } catch {
      // Wcześniej błąd był połykany i wyglądał identycznie jak „brak meczów" —
      // użytkownik nie miał jak odróżnić awarii sieci od pustej listy.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Commit szkicu z modala filtrów. Tylko promień wymaga tu zgody na
   *  lokalizację (sortowanie „Najbliżej mnie" pyta o nią osobno, z własnej
   *  pigułki — patrz onClick w pasku Sortuj). Przy odmowie promień wyłącza
   *  się, żeby lista nie została w niespójnym stanie. */
  const applyDraft = async () => {
    setGeoError(null);
    setDateFilter(draftDate);
    setMaxPriceGrosze(draftMaxPricePln == null ? null : draftMaxPricePln * 100);
    setMinFreeSpots(draftMinFreeSpots);
    const needsGeo = draftRadius != null && !userPos;
    if (!needsGeo) {
      setRadiusKm(draftRadius);
      return;
    }
    setGeoBusy(true);
    const res = await getCurrentLocation();
    setGeoBusy(false);
    if (res.ok) {
      setUserPos({ lat: res.lat, lng: res.lng });
      setRadiusKm(draftRadius);
    } else {
      setGeoError(geoErrorMessage(res.kind));
      setRadiusKm(null);
    }
  };

  const clearDraft = () => {
    setDraftDate('wszystkie');
    setDraftRadius(null);
    setDraftMaxPricePln(null);
    setDraftMinFreeSpots(0);
  };

  /** Baza filtrowania wspólna dla wyniku realnego i podglądu w modalu — bez
   *  filtra daty, bo `previewRows` nakłada `draftDate` osobno (patrz niżej). */
  const baseForPreview = useMemo(() => {
    const q = foldText(query);
    let list = allEvents.filter((e) => e.status !== 'cancelled' && isEventJoinable(e));
    if (sports.length > 0) {
      // Futsal to w interfejsie odmiana piłki nożnej — filtr po piłce łapie oba.
      const wanted = sports.includes('piłka nożna') ? [...sports, 'futsal'] : sports;
      list = list.filter((e) => wanted.includes(e.sport));
    }
    if (onlyFreeSpots) {
      list = list.filter((e) => (e.participantsCount ?? 0) < (e.maxPlayers ?? 0));
    }
    if (onlyNoCost) {
      list = list.filter((e) => (e.costGrosze ?? 0) <= 0);
    }
    if (q) {
      list = list.filter((e) =>
        foldedIncludes(e.title, q) ||
        foldedIncludes(e.sport, q) ||
        foldedIncludes(e.fieldName, q) ||
        foldedIncludes(e.district, q),
      );
    }
    return list;
  }, [allEvents, sports, onlyFreeSpots, onlyNoCost, query]);

  const filtered = useMemo(() => {
    if (dateFilter === 'wszystkie') return baseForPreview;
    return baseForPreview.filter((e) => matchesDateFilter(e.date, dateFilter));
  }, [baseForPreview, dateFilter]);

  /** Odległość liczona tylko gdy jest po co — mecz bez współrzędnych dostaje
   *  `undefined` i ląduje na końcu listy, zamiast z niej wypaść. */
  const withDistance = useMemo<EventRow[]>(() => {
    if (!userPos) return filtered.map((event) => ({ event }));
    return filtered.map((event) => ({
      event,
      distance: event.lat != null && event.lng != null
        ? distanceKm(userPos.lat, userPos.lng, event.lat, event.lng)
        : undefined,
    }));
  }, [filtered, userPos]);

  const radiusFiltered = useMemo(() => filterByRadius(withDistance, radiusKm), [withDistance, radiusKm]);
  const priceFiltered = useMemo(() => filterByMaxPrice(radiusFiltered, maxPriceGrosze), [radiusFiltered, maxPriceGrosze]);
  const spotsFiltered = useMemo(() => filterByMinFreeSpots(priceFiltered, minFreeSpots), [priceFiltered, minFreeSpots]);
  const sorted = useMemo(() => sortEvents(spotsFiltered, sortBy), [spotsFiltered, sortBy]);

  // Licznik wraca do początku przy każdej zmianie filtrów — inaczej po
  // zawężeniu listy zostawałby "Pokaż więcej" dla wyników, których już nie ma.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sports, dateFilter, radiusKm, maxPriceGrosze, minFreeSpots, onlyFreeSpots, onlyNoCost, query, sortBy]);

  const visible = sorted.slice(0, visibleCount);

  /** Podział na dni ma sens tylko wtedy, gdy lista jest ułożona czasem.
   *  Przy sortowaniu po odległości lub liczbie miejsc dwa porządki naraz
   *  wprowadzałyby w błąd. */
  const grouped = useMemo(
    () => (sortBy === 'termin' ? groupByDay(visible) : null),
    [visible, sortBy],
  );

  const hasFilters = sports.length > 0 || dateFilter !== 'wszystkie' || radiusKm !== null
    || maxPriceGrosze !== null || minFreeSpots > 0 || !!query || onlyFreeSpots || onlyNoCost;
  const clearFilters = () => {
    setSports([]);
    setDateFilter('wszystkie');
    setRadiusKm(null);
    setMaxPriceGrosze(null);
    setMinFreeSpots(0);
    setQuery('');
    setOnlyFreeSpots(false);
    setOnlyNoCost(false);
    setSortBy('termin');
  };

  // Podgląd na żywo w modalu filtrów — liczony od `baseForPreview` (bez
  // dzisiejszego dateFilter), więc rozszerzenie zakresu dat w szkicu nie jest
  // zaniżane przez już-zaaplikowany, węższy filtr realny. Promień/cena/wolne
  // miejsca liczone bez promienia, dopóki `userPos` nie jest znane.
  const previewRows = useMemo(() => {
    let list = baseForPreview;
    if (draftDate !== 'wszystkie') list = list.filter((e) => matchesDateFilter(e.date, draftDate));
    const withDist = userPos
      ? list.map((event) => ({
          event,
          distance: event.lat != null && event.lng != null
            ? distanceKm(userPos.lat, userPos.lng, event.lat, event.lng)
            : undefined,
        }))
      : list.map((event) => ({ event }));
    let rows = filterByRadius(withDist, draftRadius);
    rows = filterByMaxPrice(rows, draftMaxPricePln == null ? null : draftMaxPricePln * 100);
    rows = filterByMinFreeSpots(rows, draftMinFreeSpots);
    return rows;
  }, [baseForPreview, draftDate, draftRadius, draftMaxPricePln, draftMinFreeSpots, userPos]);

  const filtersActive = dateFilter !== 'wszystkie' || radiusKm !== null || maxPriceGrosze !== null || minFreeSpots > 0;

  const cards = (rows: EventRow[]) => (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {rows.map(({ event, distance }) => (
        <EventBrowseCard key={event.id} event={event} distance={distance} relation={statusFor(event)} />
      ))}
    </div>
  );

  const searchInput = (placeholder: string, idSuffix: string) => (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Szukaj meczu"
        id={`wydarzenia-szukaj-${idSuffix}`}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-slate-100 py-2.5 pl-10 pr-9 text-sm text-ink transition-colors placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-slate-700 dark:placeholder:text-slate-500 dark:focus:bg-slate-700"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // Treść trybu lista — jedna zmienna JSX, wstawiana zarówno do gałęzi
  // "zawsze widoczna na desktopie", jak i do mobilnej gałęzi lista/mapa (D9) —
  // bez duplikowania kodu, tylko referencja do tego samego węzła.
  const listContent = (
    <>
      {/* Ładowanie */}
      {loading && (
        <div className="space-y-3 px-4 pt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      )}

      {/* Błąd — osobno od pustego stanu */}
      {!loading && loadError && (
        <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-base font-semibold text-ink">Nie udało się wczytać meczów</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sprawdź połączenie i spróbuj jeszcze raz.</p>
          <button
            type="button"
            onClick={load}
            className="mt-1 text-sm font-semibold text-primary-700 underline hover:text-primary-800"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Lista */}
      {!loading && !loadError && sorted.length > 0 && (
        <div className="px-4 pb-8 pt-3">
          {grouped ? (
            <div className="space-y-6">
              {grouped.map(({ group, rows }) => (
                <section key={group}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {DAY_GROUP_LABEL[group]}
                    <span className="ml-1.5 font-normal normal-case tracking-normal">{rows.length}</span>
                  </h2>
                  {cards(rows)}
                </section>
              ))}
            </div>
          ) : (
            cards(visible)
          )}

          {visibleCount < sorted.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-primary-700 transition-colors hover:border-primary-200 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-800"
            >
              Pokaż więcej ({sorted.length - visibleCount})
            </button>
          )}

          {/* Wylogowany nie ma dolnej nawigacji (BottomNavGate), a pływające „+"
              żyje tylko na stronie głównej — więc oglądając NIEPUSTĄ listę cudzych
              meczów nie miał stąd żadnego wejścia do kreatora. Pusty stan niżej
              ma swoje CTA od dawna; brakowało go dokładnie w tym przypadku.
              Mobile-first: przycisk pełnej szerokości, w rzędzie dopiero od sm:. */}
          {!user && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
              <p className="font-semibold text-ink">Nie ma Twojej gry?</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Wystaw własną — kreator ma trzy kroki i zajmuje dwie minuty.
              </p>
              <Link
                href="/wydarzenia/nowe"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-primary-950 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Zorganizuj mecz
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Pusto */}
      {!loading && !loadError && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <span className="mb-4 text-5xl">⚽</span>
          <p className="text-base font-bold text-slate-700 dark:text-slate-300">Brak meczów</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {hasFilters ? 'Zmień filtr albo wrzuć własny mecz.' : 'Wrzuć własny — zobaczą go gracze z okolicy.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-semibold text-primary-700 underline"
            >
              Wyczyść filtry
            </button>
          )}
          <Link
            href="/wydarzenia/nowe"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-bold text-primary-950"
          >
            <Plus className="h-4 w-4" /> Stwórz mecz
          </Link>
        </div>
      )}
    </>
  );

  const inviteBadge = inviteCount > 0 && (
    <Link
      href="/moje-gry?tab=zaproszenia"
      aria-label={`Zaproszenia: ${inviteCount}`}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-100 px-3 text-xs font-bold text-primary-900 ring-1 ring-accent-200 transition-colors hover:bg-accent-200"
    >
      <MailOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
      Zaproszenia
      <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-700 px-1 text-[11px] text-white tabular-nums">
        {inviteCount}
      </span>
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
      {/* Zalogowany na telefonie: Header chowa swój pasek (patrz
          Header.tsx#hideMobileBarForUser), więc ten wiersz łączy szukanie
          z tożsamością — dokładnie to, co pasek by pokazywał. Plakietka
          zaproszeń schodzi do osobnego, cienkiego wiersza pod spodem: na
          360px szerokości pole + dzwonek + awatar + plakietka nie mieszczą
          się bezpiecznie w jednej linii. */}
      {user && (
        <div className="md:hidden">
          <div className="flex items-center gap-2 px-4 pt-5">
            {searchInput('Znajdź grę', 'mobile')}
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'lista' ? 'mapa' : 'lista'))}
              aria-label={viewMode === 'lista' ? 'Pokaż na mapie' : 'Pokaż listę'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {viewMode === 'lista' ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
            <MobileIdentityRow />
          </div>
          {inviteBadge && <div className="px-4 pt-2">{inviteBadge}</div>}
        </div>
      )}

      {/* Nagłówek klasyczny — zawsze na desktopie, na mobile tylko gdy
          wylogowany (Header tam nie chowa swojego paska). Bez strzałki
          „wstecz": to jest cel nawigacji (zakładka w dolnym pasku), nie
          widok szczegółu, z którego się wraca. */}
      <div className={clsx('flex items-center gap-3 px-4 pt-5', user && 'hidden md:flex')}>
        <h1 className="flex-1 font-display text-2xl font-bold text-ink sm:text-3xl">Znajdź grę</h1>
        {inviteBadge}
      </div>
      <div className={clsx('px-4 pt-3', user && 'hidden md:block')}>
        {searchInput('Nazwa, boisko albo dzielnica…', 'classic')}
      </div>

      {/* Jeden pasek kafelków: Sortuj / Filtry / Sport / Wolne miejsca / Za darmo
          (D7 planu) — scrolluje się w bok, gdy nie mieści się w jednej linii. */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Na widoku mapy nie ma czego sortować — pigułka chowa się razem
            z przełączeniem viewMode, sortBy zostaje bez zmian (pinezki i
            tak korzystają z `sorted`, kolejność po prostu nie jest wtedy
            eksponowana w UI). */}
        {viewMode !== 'mapa' && (
        <PillDropdown label="Sortuj" active={sortBy !== 'termin'}>
          {(close) => (
            <>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={async () => {
                    if (o.value === 'odleglosc' && !userPos) {
                      setSortGeoBusy(true);
                      const res = await getCurrentLocation();
                      setSortGeoBusy(false);
                      if (res.ok) {
                        setUserPos({ lat: res.lat, lng: res.lng });
                        setSortBy('odleglosc');
                      } else {
                        setGeoError(geoErrorMessage(res.kind));
                      }
                      close();
                      return;
                    }
                    setSortBy(o.value);
                    close();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {o.value === 'odleglosc' && <Navigation className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  <span className="flex-1 text-left">
                    {sortGeoBusy && o.value === 'odleglosc' ? 'Szukam Cię…' : o.label}
                  </span>
                  {sortBy === o.value && <Check className="h-4 w-4 text-primary-700" />}
                </button>
              ))}
            </>
          )}
        </PillDropdown>
        )}

        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
            filtersActive ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-ink',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" /> Filtry
        </button>

        <PillDropdown label={multiLabel(sports, 'Wszystkie sporty', SPORT_OPTIONS)} active={sports.length > 0}>
          {() => (
            <>
              <button
                type="button"
                onClick={() => setSports([])}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50"
              >
                <span className="text-base">🏟️</span>
                <span className="flex-1 text-left">Wszystkie sporty</span>
                {sports.length === 0 && <Check className="h-4 w-4 text-primary-700" />}
              </button>
              {FOCUS_SPORTS.map((sport) => (
                <button
                  key={sport}
                  type="button"
                  onClick={() => setSports(toggleInArray(sports, sport))}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50"
                >
                  <span className="text-base">{sportEmoji(sport)}</span>
                  <span className="flex-1 text-left">{sportLabel(sport)}</span>
                  {sports.includes(sport) && <Check className="h-4 w-4 text-primary-700" />}
                </button>
              ))}
            </>
          )}
        </PillDropdown>

        <TogglePill
          label="Wolne miejsca"
          icon={<Ticket className="h-3.5 w-3.5 shrink-0" />}
          active={onlyFreeSpots}
          onClick={() => setOnlyFreeSpots((v) => !v)}
        />
        <TogglePill
          label="Za darmo"
          icon={<Wallet className="h-3.5 w-3.5 shrink-0" />}
          active={onlyNoCost}
          onClick={() => setOnlyNoCost((v) => !v)}
        />
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtry"
        onApply={applyDraft}
        onClear={clearDraft}
        applyLabel={geoBusy ? 'Szukam Cię…' : `Pokaż ${previewRows.length} ${plural(previewRows.length, 'mecz', 'mecze', 'meczy')}`}
      >
        <div className="space-y-6">
          <RangeSlider
            label="Kiedy"
            min={0}
            max={4}
            step={1}
            value={DATE_SLIDER_VALUES.indexOf(draftDate)}
            onChange={(i) => setDraftDate(DATE_SLIDER_VALUES[i])}
            formatValue={(i) => DATE_SLIDER_LABELS[i]}
            minLabel="Dzisiaj"
            maxLabel="Wszystko"
          />
          <RangeSlider
            label="Odległość"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={1}
            value={draftRadius ?? RADIUS_MAX}
            onChange={(km) => setDraftRadius(km >= RADIUS_MAX ? null : km)}
            formatValue={(km) => (km >= RADIUS_MAX ? 'Bez limitu' : `do ${km} km`)}
            minLabel={`${RADIUS_MIN} km`}
            maxLabel="Bez limitu"
          />
          <RangeSlider
            label="Cena"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={draftMaxPricePln ?? PRICE_MAX}
            onChange={(pln) => setDraftMaxPricePln(pln >= PRICE_MAX ? null : pln)}
            formatValue={(pln) => (pln >= PRICE_MAX ? 'Bez limitu' : pln === 0 ? 'Za darmo' : `do ${pln} zł`)}
            minLabel="Za darmo"
            maxLabel="Bez limitu"
          />
          <RangeSlider
            label="Wolne miejsca"
            min={MIN_SPOTS_MIN}
            max={MIN_SPOTS_MAX}
            step={1}
            value={draftMinFreeSpots}
            onChange={setDraftMinFreeSpots}
            formatValue={(n) => (n === 0 ? 'Dowolna liczba' : `co najmniej ${n}`)}
            minLabel="Dowolna liczba"
            maxLabel="14+"
          />
        </div>
      </FilterSheet>

      {geoError && (
        <p className="mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {geoError}
        </p>
      )}

      {/* Licznik meczów usunięty (mylił, gdy filtr Kiedy z modala jeszcze nie
          był zaaplikowany) — zostaje tylko „Wyczyść filtry", gdy jest co czyścić. */}
      {!loading && !loadError && hasFilters && (
        <div className="flex items-center justify-end px-4 pt-3">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-primary-700 underline hover:text-primary-800"
          >
            Wyczyść filtry
          </button>
        </div>
      )}

      {/* Desktop: zawsze lista, bez zmian. Mobile: przełącznik lista/mapa (D9),
          ten sam listContent wstawiony w obu miejscach jako referencja, nie
          duplikat. */}
      <div className="hidden md:block">{listContent}</div>
      <div className="md:hidden">
        {viewMode === 'lista' ? listContent : <GamesMapCanvas rows={sorted} statusFor={statusFor} />}
      </div>
    </div>
  );
}
