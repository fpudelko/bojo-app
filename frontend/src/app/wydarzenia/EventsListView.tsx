'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Check, MailOpen, Navigation, Plus, Search, SlidersHorizontal, Ticket, Wallet, X } from 'lucide-react';
import { getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { TogglePill } from '@/components/ui/FilterPill';
import FilterSheet from '@/components/ui/FilterSheet';
import MobileIdentityRow from '@/components/layout/MobileIdentityRow';
import { useAuth } from '@/lib/auth';
import { useMyInvites } from '@/lib/useMyInvites';
import { isEventJoinable } from '@/lib/eventDates';
import { foldText, foldedIncludes } from '@/lib/searchText';
import { plural } from '@/lib/plural';
import { distanceKm, getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import {
  DAY_GROUP_LABEL, filterByRadius, groupByDay, matchesDateFilter, sortEvents,
  type DateFilter, type EventRow, type SortBy,
} from '@/lib/eventFilters';

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'wszystkie', label: 'Kiedykolwiek' },
  { value: 'dzisiaj',   label: 'Dzisiaj' },
  { value: 'jutro',     label: 'Jutro' },
  { value: 'tydzien',   label: 'Ten tydzień' },
  { value: 'weekend',   label: 'Weekend' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'termin',    label: 'Najbliższy termin' },
  { value: 'odleglosc', label: 'Najbliżej mnie' },
  { value: 'miejsca',   label: 'Najwięcej wolnych miejsc' },
];

/** Promień w km — chipsy zamiast suwaka: mniej kosztu niż dostępny komponent
 *  range tylko dla jednego filtra, a reużywa tego samego języka wizualnego
 *  co pigułki sportu. */
const RADIUS_OPTIONS = [1, 2, 5, 10, 15];

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
  const [sportFilter, setSportFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('wszystkie');
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [onlyFreeSpots, setOnlyFreeSpots] = useState(false);
  const [onlyNoCost, setOnlyNoCost] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('termin');

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Modal filtrów — wybory są szkicem, aplikują się dopiero na „Pokaż N meczów"
  // (styl Booking: wybierz kilka rzeczy, potem zatwierdź). Zamknięcie przez
  // tło/X/Escape odrzuca szkic bez dotykania prawdziwego stanu.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<DateFilter>(dateFilter);
  const [draftSort, setDraftSort] = useState<SortBy>(sortBy);
  const [draftRadius, setDraftRadius] = useState<number | null>(radiusKm);

  const openSheet = () => {
    setDraftDate(dateFilter);
    setDraftSort(sortBy);
    setDraftRadius(radiusKm);
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

  /** Commit szkicu z modala filtrów. „Najbliżej mnie" i promień wymagają
   *  zgody na lokalizację — pytamy o nią raz, dopiero tutaj (nie przy każdym
   *  dotknięciu opcji w modalu). Przy odmowie wracamy do sortowania po
   *  terminie i wyłączamy promień, żeby lista nie została w niespójnym stanie. */
  const applyDraft = async () => {
    setGeoError(null);
    setDateFilter(draftDate);
    const needsGeo = (draftSort === 'odleglosc' || draftRadius != null) && !userPos;
    if (!needsGeo) {
      setSortBy(draftSort);
      setRadiusKm(draftRadius);
      return;
    }
    setGeoBusy(true);
    const res = await getCurrentLocation();
    setGeoBusy(false);
    if (res.ok) {
      setUserPos({ lat: res.lat, lng: res.lng });
      setSortBy(draftSort);
      setRadiusKm(draftRadius);
    } else {
      setGeoError(geoErrorMessage(res.kind));
      setSortBy('termin');
      setRadiusKm(null);
    }
  };

  const clearDraft = () => {
    setDraftDate('wszystkie');
    setDraftSort('termin');
    setDraftRadius(null);
  };

  const filtered = useMemo(() => {
    const q = foldText(query);

    let list = allEvents.filter((e) => e.status !== 'cancelled' && isEventJoinable(e));

    if (sportFilter) {
      // Futsal to w interfejsie odmiana piłki nożnej — filtr po piłce łapie oba.
      const wanted = sportFilter === 'piłka nożna' ? ['piłka nożna', 'futsal'] : [sportFilter];
      list = list.filter((e) => wanted.includes(e.sport));
    }
    if (dateFilter !== 'wszystkie') {
      list = list.filter((e) => matchesDateFilter(e.date, dateFilter));
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
  }, [allEvents, sportFilter, dateFilter, onlyFreeSpots, onlyNoCost, query]);

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
  const sorted = useMemo(() => sortEvents(radiusFiltered, sortBy), [radiusFiltered, sortBy]);

  // Licznik wraca do początku przy każdej zmianie filtrów — inaczej po
  // zawężeniu listy zostawałby "Pokaż więcej" dla wyników, których już nie ma.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sportFilter, dateFilter, radiusKm, onlyFreeSpots, onlyNoCost, query, sortBy]);

  const visible = sorted.slice(0, visibleCount);

  /** Podział na dni ma sens tylko wtedy, gdy lista jest ułożona czasem.
   *  Przy sortowaniu po odległości lub liczbie miejsc dwa porządki naraz
   *  wprowadzałyby w błąd. */
  const grouped = useMemo(
    () => (sortBy === 'termin' ? groupByDay(visible) : null),
    [visible, sortBy],
  );

  const hasFilters = !!sportFilter || dateFilter !== 'wszystkie' || radiusKm !== null || !!query || onlyFreeSpots || onlyNoCost;
  const clearFilters = () => {
    setSportFilter('');
    setDateFilter('wszystkie');
    setRadiusKm(null);
    setQuery('');
    setOnlyFreeSpots(false);
    setOnlyNoCost(false);
  };

  // Podgląd na żywo w modalu filtrów — liczony z draftu, ale bez promienia,
  // dopóki `userPos` nie jest znane (zgoda na lokalizację jeszcze nie zapadła;
  // po zatwierdzeniu przelicza się dokładnie).
  const previewRows = useMemo(() => {
    let list = filtered;
    if (draftDate !== 'wszystkie') list = list.filter((e) => matchesDateFilter(e.date, draftDate));
    if (draftRadius != null && userPos) {
      list = list.filter((e) =>
        e.lat != null && e.lng != null && distanceKm(userPos.lat, userPos.lng, e.lat, e.lng) <= draftRadius);
    }
    return list;
  }, [filtered, draftDate, draftRadius, userPos]);

  const filtersActive = dateFilter !== 'wszystkie' || sortBy !== 'termin' || radiusKm !== null;

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

      {/* Sporty — z nazwami. Same emoji nie dawały się odczytać: jedyną
          podpowiedzią był tooltip, którego na telefonie nie ma. */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSportFilter('')}
          aria-pressed={sportFilter === ''}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
            sportFilter === ''
              ? 'bg-primary-700 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-primary-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
          }`}
        >
          Wszystkie
        </button>
        {FOCUS_SPORTS.map((sport) => {
          const active = sportFilter === sport;
          return (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(active ? '' : sport)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-primary-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              <span aria-hidden="true">{sportEmoji(sport)}</span>
              {sportLabel(sport)}
            </button>
          );
        })}
      </div>

      {/* Filtry — przycisk otwiera modal (Kiedy/Sortuj/Odległość), obok
          zostają tylko dwa najczęściej używane przełączniki, jak na Booking. */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Kiedy</h3>
            {DATE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDraftDate(o.value)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <span className="flex-1 text-left">{o.label}</span>
                {draftDate === o.value && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
              </button>
            ))}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Sortuj</h3>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDraftSort(o.value)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {o.value === 'odleglosc' && <Navigation className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <span className="flex-1 text-left">{o.label}</span>
                {draftSort === o.value && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
              </button>
            ))}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Odległość</h3>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setDraftRadius(draftRadius === km ? null : km)}
                  aria-pressed={draftRadius === km}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                    draftRadius === km ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-ink',
                  )}
                >
                  {`< ${km} km`}
                </button>
              ))}
            </div>
          </section>
        </div>
      </FilterSheet>

      {geoError && (
        <p className="mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {geoError}
        </p>
      )}

      {/* Licznik wyników */}
      {!loading && !loadError && (
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[13px] text-slate-500 dark:text-slate-400">
            {sorted.length > 0
              ? `${sorted.length} ${plural(sorted.length, 'mecz', 'mecze', 'meczy')}`
              : 'Brak meczów'}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-primary-700 underline hover:text-primary-800"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      )}

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
    </div>
  );
}
