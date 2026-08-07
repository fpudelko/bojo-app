'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import {
  Check, CalendarCheck, MapPin, Globe, Navigation, Search, SlidersHorizontal, Ticket,
  Trophy, Wallet, X,
} from 'lucide-react';
import { PillDropdown, TogglePill } from '@/components/ui/FilterPill';
import FilterSheet from '@/components/ui/FilterSheet';
import RangeSlider from '@/components/ui/RangeSlider';
import MobileIdentityRow from '@/components/layout/MobileIdentityRow';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { useMyInvites } from '@/lib/useMyInvites';
import type { Field, EventItem } from '@/types';
import {
  getExplorerFields, getFieldsByIds, getExplorerClusters, searchExplorerFields,
  type Kadr, type Skupisko,
} from '@/lib/api';
import { getPublicEvents } from '@/lib/events';
import { isEventJoinable } from '@/lib/eventDates';
import { fieldPhotoUrl, surfaceLabel } from '@/lib/labels';
import { slugify, externalUrl } from '@/lib/utils';
import { plural } from '@/lib/plural';
import { distanceKm, getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import { FOCUS_SPORTS, MAP_FILTER_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import {
  filterByMaxPrice, filterByMinFreeSpots, filterByRadius, matchesDateFilter, multiLabel,
  sortEvents, toggleInArray, type DateFilter, type EventRow, type SortBy,
} from '@/lib/eventFilters';
import { POLSKA, POLSKA_ZOOM, fieldPin, clusterDivIcon } from './mapIcons';
import KadrObserwator from './KadrObserwator';
import GamesMarkersLayer from './GamesMarkersLayer';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Od tego przybliżenia pobieramy konkretne obiekty. Niżej — same liczby
// w siatce. Próg dobrany na oko powiatu: przy 11 widać jedno miasto, więc
// liczba obiektów w kadrze jest już policzalna dla przeglądarki.
const ZOOM_SKUPISK = 11;

/**
 * Rozmiar komórki siatki w stopniach, liczony z przybliżenia.
 *
 * Tabela ze sztywnymi wartościami była zła w obie strony: przy widoku kraju
 * dawała ponad sto komórek, które nachodziły na siebie tak, że nie dało się
 * odczytać żadnej liczby. Wzór trzyma komórkę w stałym rozmiarze NA EKRANIE
 * (~120 px) niezależnie od przybliżenia, więc kółek jest zawsze tyle, ile
 * mieści się wygodnie w kadrze.
 *
 * 256 to rozmiar kafla, 360 to obwód świata w stopniach — czyli tyle stopni
 * przypada na piksel przy danym przybliżeniu.
 */
function krokSiatki(zoom: number): number {
  const PIKSELE_NA_KOMORKE = 120;
  return (PIKSELE_NA_KOMORKE * 360) / (256 * Math.pow(2, zoom));
}

// 'map' — kliknięcie pinezki albo karty na liście; 'init' — stan bez wyboru
// użytkownika, przy którym mapa NIE przesuwa kadru. Źródło 'scroll' zniknęło
// razem z karuzelą, która sama zaznaczała kartę najbliższą środka ekranu.
type SelSource = 'map' | 'init';

// Discovery filtering (map_visibility = 'public', relevant team sports) runs
// server-side in getExplorerFields().

function displayName(name: string): string {
  return name.replace(/^boisko\s*[-–—]\s*/i, '').trim() || name;
}

// Przeplot Mortona — porządkuje karuzelę tak, żeby sąsiednie karty leżały
// blisko siebie na mapie. Punkt zerowy obejmuje CAŁĄ Polskę: przy poprzednim
// (52.0 N, 16.5 E, dobranym pod Poznań) wszystko na południe od 52. równoleżnika
// wpadało w `Math.max(0, …)` i lądowało w jednym punkcie — czyli całe lubelskie
// miało identyczny klucz i traciło porządek przestrzenny.
function mortonKey(lat: number, lng: number): number {
  const x = Math.max(0, Math.round((lng - 14.0) * 1000)) & 0xffff;
  const y = Math.max(0, Math.round((lat - 49.0) * 1000)) & 0xffff;
  let key = 0;
  for (let i = 0; i < 16; i++) {
    key |= ((x >> i) & 1) << (2 * i);
    key |= ((y >> i) & 1) << (2 * i + 1);
  }
  return key;
}

/** „boisko / boiska / boisk" — polska odmiana po liczbie. */
function boiskoSlowo(n: number): string {
  if (n === 1) return 'boisko';
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'boiska';
  return 'boisk';
}

function gamesWord(n: number): string {
  if (n === 1) return 'gra';
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'gry';
  return 'gier';
}

const VENUE_TYPE_LABELS: Record<string, string> = {
  full_size:          'Pełnowymiarowe',
  seven_a_side:       'Siódemka',
  five_a_side:        'Piątka',
  orlik:              'Orlik',
  futsal_hall:        'Hala',
  basketball_full:    'Koszykówka pełna',
  basketball_half:    'Koszykówka',
  volleyball_outdoor: 'Siatkówka',
  volleyball_beach:   'Siatkówka plażowa',
  tennis_outdoor:     'Tenis',
  multi_sport:        'Wielofunkcyjne',
  other:              'Inne',
};

const VENUE_TYPE_OPTIONS = Object.entries(VENUE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

// Sport na mapie czerpie z lib/sports.ts (MAP_FILTER_SPORTS), nie z osobnej
// hardkodowanej listy — inaczej pinezka i filtr mogą się rozjechać (dokładnie
// to była przyczyna „ikonek, które się nie zgadzają": wielofunkcyjne i piłka
// ręczna miały już kolorowe pinezki, ale nie dało się ich wybrać w filtrze).
const SPORT_OPTIONS = MAP_FILTER_SPORTS.map((value) => ({ value, label: sportLabel(value), emoji: sportEmoji(value) }));

// Nawierzchnia ma dziś dane w 37% wierszy (reszta katalogu z importu OSM jej
// nie ma) — dużo bardziej użyteczny facet niż `venue_type` (98,3% NULL).
// Tylko wartości faktycznie występujące w bazie; etykiety przez surfaceLabel()
// z lib/labels.ts, bez osobnej tabeli.
const SURFACE_VALUES = ['grass', 'artificial', 'hardcourt', 'sand', 'concrete', 'clay'];
const SURFACE_OPTIONS = SURFACE_VALUES.map((value) => ({ value, label: surfaceLabel(value) }));

// Sportowy dropdown w trybie gier używa FOCUS_SPORTS (organizowalne sporty),
// nie MAP_FILTER_SPORTS (opisy obiektu) — patrz toggleShowGames niżej.
const GAMES_SPORT_OPTIONS = FOCUS_SPORTS.map((value) => ({ value, label: sportLabel(value), emoji: sportEmoji(value) }));

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'termin',    label: 'Najbliższy termin' },
  { value: 'odleglosc', label: 'Najbliżej mnie' },
  { value: 'miejsca',   label: 'Najwięcej wolnych miejsc' },
];

// Te same zakresy suwaków co na /wydarzenia (D3 planu) — jeden zestaw wartości,
// żeby tryb gier na mapie i lista miały identyczną semantykę filtrów.
const DATE_SLIDER_VALUES: DateFilter[] = ['dzisiaj', 'jutro', 'tydzien', 'miesiac', 'wszystkie'];
const DATE_SLIDER_LABELS = ['Dzisiaj', 'Jutro', 'Ten tydzień', 'Ten miesiąc', 'Wszystko'];
const RADIUS_MIN = 1;
const RADIUS_MAX = 20;
const PRICE_MIN = 0;
const PRICE_MAX = 100;
const PRICE_STEP = 5;
const MIN_SPOTS_MIN = 0;
const MIN_SPOTS_MAX = 14;

// ---------------------------------------------------------------------------
// WarstwaSkupisk — kółka z liczbami dla oddalonych widoków
// ---------------------------------------------------------------------------
function WarstwaSkupisk({ skupiska }: { skupiska: Skupisko[] }) {
  const map = useMap();
  const warstwaRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const grupa = L.layerGroup().addTo(map);
    warstwaRef.current = grupa;
    return () => { map.removeLayer(grupa); warstwaRef.current = null; };
  }, [map]);

  useEffect(() => {
    const grupa = warstwaRef.current;
    if (!grupa) return;
    grupa.clearLayers();
    for (const s of skupiska) {
      const znacznik = L.marker([s.lat, s.lng], { icon: clusterDivIcon(s.ile, s.sporty) });
      // Kliknięcie skupiska przybliża do niego — tak samo, jak zachowuje się
      // klaster liczony po stronie przeglądarki. Użytkownik nie ma powodu
      // wiedzieć, że to dwie różne rzeczy.
      znacznik.on('click', () => map.flyTo([s.lat, s.lng], Math.min(map.getZoom() + 3, 14), { duration: 0.5 }));
      grupa.addLayer(znacznik);
    }
  }, [skupiska, map]);

  return null;
}

// ---------------------------------------------------------------------------
// MapLayer
// ---------------------------------------------------------------------------
function MapLayer({ fields, selectedId, selectedSource, onSelect }: {
  fields: Field[]; selectedId: string | null; selectedSource: SelSource;
  onSelect: (id: string, source: SelSource) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const fieldsRef = useRef<Record<string, Field>>({});
  const prevSelectedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the cluster group once. Markers are added/removed incrementally so a
  // filter change never tears down and rebuilds every pin.
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      // Bigger radius → fewer, larger clusters → far fewer DOM nodes.
      maxClusterRadius: 60,
      iconCreateFunction: (c) => {
        const ms = c.getAllChildMarkers() as Array<L.Marker & { _sports?: string[] }>;
        return clusterDivIcon(c.getChildCount(), ms.flatMap((m) => m._sports ?? []));
      },
      spiderfyOnMaxZoom: true,
      // Keep clustering active much longer; at 13 every pin in view rendered
      // individually, which is what made dense areas crawl.
      disableClusteringAtZoom: 16,
      animate: true,
      // Add markers in chunks so the UI thread isn't blocked, and drop pins
      // outside the viewport from the DOM entirely.
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
      markersRef.current = {};
      fieldsRef.current = {};
    };
  }, [map]);

  // Sync markers with the current field set — only the difference is touched.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    const next: Record<string, Field> = {};
    for (const f of fields) next[f.id] = f;
    fieldsRef.current = next;

    const existing = markersRef.current;
    const toRemove: L.Marker[] = [];
    for (const id of Object.keys(existing)) {
      if (!next[id]) { toRemove.push(existing[id]); delete existing[id]; }
    }
    const toAdd: L.Marker[] = [];
    for (const f of fields) {
      if (existing[f.id]) continue;
      const m = L.marker([f.lat, f.lng], { icon: fieldPin(f, f.id === selectedId) }) as L.Marker & { _sports?: string[] };
      m._sports = f.sport;
      m.on('click', () => onSelectRef.current(f.id, 'map'));
      existing[f.id] = m;
      toAdd.push(m);
    }
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Repaint only the two pins that actually changed state (was O(n²) before).
  useEffect(() => {
    const markers = markersRef.current;
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedId) {
      const pf = fieldsRef.current[prev];
      if (pf && markers[prev]) markers[prev].setIcon(fieldPin(pf, false));
    }
    if (selectedId) {
      const sf = fieldsRef.current[selectedId];
      if (sf && markers[selectedId]) markers[selectedId].setIcon(fieldPin(sf, true));
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, fields]);

  useEffect(() => {
    if (!selectedId) return;
    // On first load ('init') keep the wide powiat view — don't zoom to a venue.
    if (selectedSource === 'init') return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f) return;
    map.stop();
    map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 14), { duration: 0.45 });
  }, [selectedId, selectedSource, fields, map]);

  return null;
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------
function VenueCard({ field, games, hasGameToday, selected, backTo }: {
  field: Field; games: number; hasGameToday: boolean; selected?: boolean;
  /** Dokąd ma wrócić strzałka „wstecz" na stronie boiska — `/mapa?boisko=<id>`,
   *  żeby powrót ustawił mapę z powrotem na tym obiekcie zamiast na widoku
   *  całego kraju. Bez tego VenueDetailClient wraca na goły `/mapa`. */
  backTo?: string;
}) {
  const thumb = fieldPhotoUrl(field, 320, 320);
  const slug = slugify(field.name);
  const name = displayName(field.name);
  const surface = field.surface ? surfaceLabel(field.surface) : null;
  const typeLabel = field.venueType ? VENUE_TYPE_LABELS[field.venueType] ?? field.venueType : null;
  const shortAddress = field.address
    ? field.address.split(',').slice(0, 2).join(',').trim()
    : null;

  return (
    // `items-stretch` zamiast `h-full`: karta bierze wysokość z treści, a
    // miniatura dociąga się do niej sama. Sztywna wysokość znaczyła, że karta
    // z dwuliniową nazwą wylewała się poza swój kontener i wchodziła pod dolną
    // nawigację — dopełnienie liczy się od kontenera, nie od tego, co z niego
    // wystaje.
    <div className={[
      'flex w-full items-stretch gap-3.5 rounded-3xl bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-shadow',
      selected ? 'ring-2 ring-primary-700' : '',
    ].join(' ')}>
      <div className="relative w-[100px] shrink-0 overflow-hidden rounded-2xl bg-slate-100">
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
        {field.isIndoor && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Hala
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-display text-[14px] font-bold leading-tight text-primary-700 line-clamp-2">
          {name}
        </p>
        {(typeLabel || surface) && (
          <p className="text-[11px] text-slate-500 truncate">
            {typeLabel && <span className="font-medium text-slate-600">{typeLabel}</span>}
            {typeLabel && surface && <span className="mx-1">·</span>}
            {surface && <span>{surface}</span>}
          </p>
        )}
        {shortAddress && (
          <p className="text-[11px] text-slate-400 truncate flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" />{shortAddress}
          </p>
        )}
        {games > 0 && (
          <p className="text-[11px] text-slate-400">
            👥 {games} {gamesWord(games)} / tydzień
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {hasGameToday && (
            <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-1.5 py-0.5">
              📅 Dziś
            </span>
          )}
          {field.bookingEnabled && (
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-1.5 py-0.5">
              Rezerwacja
            </span>
          )}
          {field.website && (
            <a
              href={externalUrl(field.website)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-1.5 py-0.5 hover:text-primary-700 hover:border-primary-200"
            >
              <Globe className="w-2.5 h-2.5" /> www
            </a>
          )}
        </div>
        <Link
          href={`/boisko/${slug}${backTo ? `?wroc=${encodeURIComponent(backTo)}` : ''}`}
          className="mt-auto flex items-center justify-between gap-2 rounded-2xl bg-primary-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          onClick={(e) => e.stopPropagation()}
        >
          Zobacz boisko <span aria-hidden="true">›</span>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared filter pills — rendered both in sidebar and mobile overlay
// ---------------------------------------------------------------------------
function FilterPills({
  showGames, onToggleShowGames,
  sports, setSports,
  onlyGamesToday, setOnlyGamesToday,
  filtersActive, onOpenFilters,
  gamesSortBy, onGamesSortSelect, gamesSortGeoBusy,
  gamesOnlyFreeSpots, setGamesOnlyFreeSpots,
  gamesOnlyNoCost, setGamesOnlyNoCost,
  wrap,
}: {
  /** „Pokaż gry" (D11) — przełącza cały pasek między trybem obiektów (dzisiejsze
   *  zachowanie) a trybem gier (identyczny układ co /wydarzenia). */
  showGames: boolean;
  onToggleShowGames: () => void;
  sports: string[]; setSports: (v: string[]) => void;
  onlyGamesToday: boolean; setOnlyGamesToday: (v: boolean) => void;
  /** Czy modal (Typ+Nawierzchnia w trybie obiektów, suwaki w trybie gier) ma
   *  dziś jakikolwiek wybór — steruje wyglądem przycisku „Filtry". */
  filtersActive: boolean;
  onOpenFilters: () => void;
  gamesSortBy: SortBy;
  onGamesSortSelect: (v: SortBy) => void;
  gamesSortGeoBusy: boolean;
  gamesOnlyFreeSpots: boolean; setGamesOnlyFreeSpots: (v: boolean) => void;
  gamesOnlyNoCost: boolean; setGamesOnlyNoCost: (v: boolean) => void;
  wrap?: boolean;
}) {
  const sportOptions = showGames ? GAMES_SPORT_OPTIONS : SPORT_OPTIONS;
  const sportPillLabel = multiLabel(sports, 'Wszystkie sporty', sportOptions);

  return (
    <div className={wrap
      ? 'flex flex-wrap gap-2'
      : 'flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    }>
      <TogglePill label="Pokaż gry" icon={<Trophy className="h-3.5 w-3.5 shrink-0" />}
        active={showGames} onClick={onToggleShowGames} />

      {showGames && (
        <PillDropdown label="Sortuj" active={gamesSortBy !== 'termin'}>
          {(close) => (
            <>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onGamesSortSelect(o.value); close(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50"
                >
                  {o.value === 'odleglosc' && <Navigation className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  <span className="flex-1 text-left">
                    {gamesSortGeoBusy && o.value === 'odleglosc' ? 'Szukam Cię…' : o.label}
                  </span>
                  {gamesSortBy === o.value && <Check className="h-4 w-4 text-primary-700" />}
                </button>
              ))}
            </>
          )}
        </PillDropdown>
      )}

      {!showGames && (
        <PillDropdown label={sportPillLabel} active={sports.length > 0}>
          {() => (
            <>
              <button onClick={() => setSports([])}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50 border-b border-slate-50">
                <span className="text-base">🏟️</span>
                <span className="flex-1 text-left">Wszystkie sporty</span>
                {sports.length === 0 && <Check className="h-4 w-4 text-primary-700" />}
              </button>
              {sportOptions.map((o) => (
                <button key={o.value} onClick={() => setSports(toggleInArray(sports, o.value))}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50">
                  <span className="text-base">{o.emoji}</span>
                  <span className="flex-1 text-left">{o.label}</span>
                  {sports.includes(o.value) && <Check className="h-4 w-4 text-primary-700" />}
                </button>
              ))}
            </>
          )}
        </PillDropdown>
      )}

      {/* Typ obiektu przeniesiony do modala (D9): venue_type ma dziś 98,3%
          wierszy NULL, jako zawsze widoczny dropdown wyglądał jak zepsuty
          filtr. Nawierzchnia (nowa, dane w 37% wierszy) dołącza tam samo. */}
      <button
        type="button"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        className={clsx(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
          filtersActive ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 text-ink',
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" /> Filtry
      </button>

      {showGames && (
        <PillDropdown label={sportPillLabel} active={sports.length > 0}>
          {() => (
            <>
              <button onClick={() => setSports([])}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50 border-b border-slate-50">
                <span className="text-base">🏟️</span>
                <span className="flex-1 text-left">Wszystkie sporty</span>
                {sports.length === 0 && <Check className="h-4 w-4 text-primary-700" />}
              </button>
              {sportOptions.map((o) => (
                <button key={o.value} onClick={() => setSports(toggleInArray(sports, o.value))}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50">
                  <span className="text-base">{o.emoji}</span>
                  <span className="flex-1 text-left">{o.label}</span>
                  {sports.includes(o.value) && <Check className="h-4 w-4 text-primary-700" />}
                </button>
              ))}
            </>
          )}
        </PillDropdown>
      )}

      {showGames ? (
        <>
          <TogglePill label="Wolne miejsca" icon={<Ticket className="h-3.5 w-3.5 shrink-0" />}
            active={gamesOnlyFreeSpots} onClick={() => setGamesOnlyFreeSpots(!gamesOnlyFreeSpots)} />
          <TogglePill label="Za darmo" icon={<Wallet className="h-3.5 w-3.5 shrink-0" />}
            active={gamesOnlyNoCost} onClick={() => setGamesOnlyNoCost(!gamesOnlyNoCost)} />
        </>
      ) : (
        <TogglePill label="Gry dziś" icon={<CalendarCheck className="h-3.5 w-3.5 shrink-0" />}
          active={onlyGamesToday} onClick={() => setOnlyGamesToday(!onlyGamesToday)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main explorer
// ---------------------------------------------------------------------------
export default function VenueExplorer({
  initialFields, initialEvents,
}: { initialFields?: Field[]; initialEvents?: EventItem[]; } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { statusFor } = useMyInvites();

  const [allFields, setAllFields] = useState<Field[]>(initialFields ?? []);
  const [events,    setEvents]    = useState<EventItem[]>(initialEvents ?? []);
  const [search,    setSearch]    = useState('');
  // Render only a window of cards to keep the list/carousel snappy (~1400 venues).
  const PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Filters live in the URL so they survive back-navigation
  const sports         = useMemo(() => searchParams.getAll('sport'), [searchParams]);
  const venueTypes     = useMemo(() => searchParams.getAll('type'), [searchParams]);
  const surfaces       = useMemo(() => searchParams.getAll('surface'), [searchParams]);
  const onlyGamesToday = searchParams.get('today') === '1';
  // „Pokaż gry" (D11/D12) — jedyny stan trybu gier trzymany w URL, tak jak
  // today. Reszta filtrów trybu gier zostaje lokalnym stanem, spójnie
  // z tym, że /wydarzenia też nie trzyma swoich filtrów w URL.
  const showGames = searchParams.get('gry') === '1';
  // Wejście z konkretnym obiektem: `/mapa?boisko=<id>`. Używa go przycisk
  // „Zobacz na mapie" na stronie boiska — mapa ma wtedy otworzyć się na tym
  // obiekcie z jego kartą, zamiast na widoku całego kraju.
  const boiskoZLinku = searchParams.get('boisko');

  function updateParams(patch: { sport?: string[]; type?: string[]; surface?: string[]; today?: boolean; gry?: boolean }) {
    const p = new URLSearchParams(searchParams.toString());
    if (patch.sport !== undefined) {
      p.delete('sport');
      patch.sport.forEach((s) => p.append('sport', s));
    }
    if (patch.type !== undefined) {
      p.delete('type');
      patch.type.forEach((t) => p.append('type', t));
    }
    if (patch.surface !== undefined) {
      p.delete('surface');
      patch.surface.forEach((s) => p.append('surface', s));
    }
    if (patch.today !== undefined) {
      if (patch.today) p.set('today', '1'); else p.delete('today');
    }
    if (patch.gry !== undefined) {
      if (patch.gry) p.set('gry', '1'); else p.delete('gry');
    }
    router.replace(`/mapa?${p.toString()}`, { scroll: false });
  }

  const setSports         = (v: string[]) => updateParams({ sport: v });
  const setVenueTypes     = (v: string[]) => updateParams({ type: v });
  const setSurfaces       = (v: string[]) => updateParams({ surface: v });
  const setOnlyGamesToday = (v: boolean) => updateParams({ today: v });

  // Przełącznik trybu — jeśli w sportach jest wartość spoza FOCUS_SPORTS
  // (np. „wielofunkcyjne"), włączenie trybu gier czyści ją: żaden mecz nigdy
  // nie ma takiego sportu, więc bez tego guarda filtr po cichu zerowałby wyniki.
  function toggleShowGames() {
    const next = !showGames;
    if (next && sports.some((s) => !(FOCUS_SPORTS as readonly string[]).includes(s))) {
      updateParams({ sport: [], gry: true });
      return;
    }
    updateParams({ gry: next });
  }

  // Modal Typ obiektu/Nawierzchnia — szkic w tym samym stylu co na
  // /wydarzenia: wybory aplikują się dopiero na „Pokaż N obiektów".
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTypes, setDraftTypes] = useState<string[]>(venueTypes);
  const [draftSurfaces, setDraftSurfaces] = useState<string[]>(surfaces);

  // Tryb gier (D11/D12) — lokalny stan filtrów, ten sam kształt co na
  // /wydarzenia (Sortuj natychmiastowy, reszta przez szkic modala).
  const [gamesSort, setGamesSort] = useState<SortBy>('termin');
  const [gamesDate, setGamesDate] = useState<DateFilter>('wszystkie');
  const [gamesRadius, setGamesRadius] = useState<number | null>(null);
  const [gamesMaxPriceGrosze, setGamesMaxPriceGrosze] = useState<number | null>(null);
  const [gamesMinFreeSpots, setGamesMinFreeSpots] = useState(0);
  const [gamesOnlyFreeSpots, setGamesOnlyFreeSpots] = useState(false);
  const [gamesOnlyNoCost, setGamesOnlyNoCost] = useState(false);
  const [gamesUserPos, setGamesUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gamesSortGeoBusy, setGamesSortGeoBusy] = useState(false);
  const [gamesGeoBusy, setGamesGeoBusy] = useState(false);
  const [gamesGeoError, setGamesGeoError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [draftGamesDate, setDraftGamesDate] = useState<DateFilter>(gamesDate);
  const [draftGamesRadius, setDraftGamesRadius] = useState<number | null>(gamesRadius);
  const [draftGamesMaxPricePln, setDraftGamesMaxPricePln] = useState<number | null>(
    gamesMaxPriceGrosze == null ? null : gamesMaxPriceGrosze / 100,
  );
  const [draftGamesMinFreeSpots, setDraftGamesMinFreeSpots] = useState(gamesMinFreeSpots);

  const openSheet = () => {
    setDraftTypes(venueTypes);
    setDraftSurfaces(surfaces);
    setDraftGamesDate(gamesDate);
    setDraftGamesRadius(gamesRadius);
    setDraftGamesMaxPricePln(gamesMaxPriceGrosze == null ? null : gamesMaxPriceGrosze / 100);
    setDraftGamesMinFreeSpots(gamesMinFreeSpots);
    setSheetOpen(true);
  };

  const applyGamesDraft = async () => {
    setGamesGeoError(null);
    setGamesDate(draftGamesDate);
    setGamesMaxPriceGrosze(draftGamesMaxPricePln == null ? null : draftGamesMaxPricePln * 100);
    setGamesMinFreeSpots(draftGamesMinFreeSpots);
    const needsGeo = draftGamesRadius != null && !gamesUserPos;
    if (!needsGeo) { setGamesRadius(draftGamesRadius); return; }
    setGamesGeoBusy(true);
    const res = await getCurrentLocation();
    setGamesGeoBusy(false);
    if (res.ok) {
      setGamesUserPos({ lat: res.lat, lng: res.lng });
      setGamesRadius(draftGamesRadius);
    } else {
      setGamesGeoError(geoErrorMessage(res.kind));
      setGamesRadius(null);
    }
  };

  const clearGamesDraft = () => {
    setDraftGamesDate('wszystkie');
    setDraftGamesRadius(null);
    setDraftGamesMaxPricePln(null);
    setDraftGamesMinFreeSpots(0);
  };

  // Instancja Leafleta wyciągnięta z MapContainera — potrzebna przyciskowi
  // „moja okolica", który stoi poza mapą i nie ma useMap().
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [locating, setLocating] = useState(false);

  const locateMe = useCallback(() => {
    if (!mapInstance || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 12);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, [mapInstance]);

  // Kadr i przybliżenie mapy. Od nich zależy, CO w ogóle pobieramy: przy
  // oddaleniu same liczby w siatce, przy przybliżeniu konkretne obiekty.
  const [kadr, setKadr] = useState<Kadr | null>(null);
  const [zoom, setZoom] = useState(POLSKA_ZOOM);
  const [skupiska, setSkupiska] = useState<Skupisko[]>([]);

  const [selected, setSelected] = useState<{ id: string | null; source: SelSource }>({ id: null, source: 'init' });
  const selectedId     = selected.id;
  const selectedSource = selected.source;

  // Desktop sidebar
  const sidebarRef      = useRef<HTMLDivElement>(null);
  const sidebarCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const onSelect = useCallback((id: string, source: SelSource) => {
    setSelected({ id, source });
  }, []);

  const onKadrZmiana = useCallback((k: Kadr, z: number) => {
    setKadr(k);
    setZoom(z);
  }, []);

  useEffect(() => {
    if (initialFields || initialEvents) return;
    let cancelled = false;
    getPublicEvents()
      .then((evs) => { if (!cancelled) setEvents(evs.filter((e) => e.status !== 'cancelled')); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Szukanie po tekście — poza bieżącym kadrem, w całym katalogu.
  //
  // Dawniej pole szukania filtrowało wyłącznie `allFields`, czyli to, co i
  // tak było już wczytane dla bieżącego kadru: przy oddaleniu (tryb skupisk)
  // ta lista jest pusta, więc szukanie nic nie znajdowało; przy przybliżeniu
  // ograniczało się do tego, co widać, więc wpisanie miasta spoza widoku też
  // nic nie dawało. `searchExplorerFields()` już istniała (używają jej
  // pickery lokalizacji), tylko nigdy nie była tu wpięta.
  const [searchResults, setSearchResults] = useState<Field[] | null>(null);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchExplorerFields(q, 60)
        .then((r) => { if (!cancelled) setSearchResults(r); })
        .catch(() => { if (!cancelled) setSearchResults([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  // Mapa dopasowuje się do wyników wyszukiwania — inaczej wynik potrafiłby
  // leżeć całkowicie poza aktualnie widocznym kadrem.
  useEffect(() => {
    if (!mapInstance || !searchResults || searchResults.length === 0) return;
    const bounds = L.latLngBounds(searchResults.map((f) => [f.lat, f.lng] as [number, number]));
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [mapInstance, searchResults]);

  // Obiekty albo skupiska — zależnie od przybliżenia i zawsze dla widocznego
  // kadru. Poniżej progu pobieranie pojedynczych obiektów nie ma sensu: przy
  // widoku kraju byłoby ich kilkadziesiąt tysięcy, a i tak zobaczyłbyś z nich
  // kilkanaście kółek z liczbami.
  useEffect(() => {
    if (initialFields || !kadr) return;
    // Aktywne szukanie ma własne źródło danych (searchExplorerFields) —
    // pobieranie po kadrze byłoby tu tylko zmarnowanym zapytaniem w tle.
    if (search.trim().length >= 2) return;
    let cancelled = false;

    if (zoom < ZOOM_SKUPISK) {
      // Krok siatki maleje z przybliżeniem: przy widoku kraju grube kwadraty,
      // przy widoku województwa drobniejsze.
      const krok = krokSiatki(zoom);
      getExplorerClusters(kadr, krok, sports, venueTypes)
        .then((s) => { if (!cancelled) { setSkupiska(s); setAllFields([]); } })
        .catch(() => {});
    } else {
      getExplorerFields(kadr)
        .then((f) => { if (!cancelled) { setAllFields(f); setSkupiska([]); } })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [kadr, zoom, sports, venueTypes, initialFields, search]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const fieldStats = useMemo(() => {
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const stats: Record<string, { count: number; today: boolean }> = {};
    for (const e of events) {
      if (!e.fieldId) continue;
      const d = new Date(e.date); d.setHours(0, 0, 0, 0);
      if (d < today || d > weekEnd) continue;
      if (!stats[e.fieldId]) stats[e.fieldId] = { count: 0, today: false };
      stats[e.fieldId].count++;
      if (d.getTime() === today.getTime()) stats[e.fieldId].today = true;
    }
    return stats;
  }, [events, today]);

  const fields = useMemo(() => {
    // Aktywne szukanie podmienia źródło: wyniki z całego katalogu zamiast
    // tego, co akurat wczytane dla bieżącego kadru (patrz searchResults wyżej).
    let list = searchResults ?? allFields;
    if (sports.length > 0)     list = list.filter((f) => f.sport.some((s) => sports.includes(s)));
    if (venueTypes.length > 0) list = list.filter((f) => venueTypes.includes(f.venueType ?? ''));
    if (surfaces.length > 0)   list = list.filter((f) => surfaces.includes(f.surface ?? ''));
    if (onlyGamesToday) list = list.filter((f) => fieldStats[f.id]?.today);
    // Lokalny filtr tekstowy zostaje jako dodatkowe zawężenie w obrębie
    // wyników z searchExplorerFields — bez efektu, gdy szukanie nieaktywne
    // (wtedy `q` filtruje to, co i tak jest w bieżącym kadrze, jak dawniej).
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q));
    list = [...list].sort((a, b) => mortonKey(a.lat, a.lng) - mortonKey(b.lat, b.lng));
    return list;
  }, [allFields, searchResults, sports, venueTypes, surfaces, onlyGamesToday, fieldStats, search]);

  // Tryb gier (D11) — reużywa `events`, już pobierane wyżej dla fieldStats,
  // zero nowego zapytania. Ten sam pipeline co /wydarzenia (matchesDateFilter,
  // filterByRadius/MaxPrice/MinFreeSpots, sortEvents), z lokalnym stanem gamesX.
  const gamesBaseFiltered = useMemo(() => {
    let list = events.filter((e) => e.status !== 'cancelled' && isEventJoinable(e));
    if (sports.length > 0) {
      const wanted = sports.includes('piłka nożna') ? [...sports, 'futsal'] : sports;
      list = list.filter((e) => wanted.includes(e.sport));
    }
    if (gamesOnlyFreeSpots) list = list.filter((e) => (e.participantsCount ?? 0) < (e.maxPlayers ?? 0));
    if (gamesOnlyNoCost) list = list.filter((e) => (e.costGrosze ?? 0) <= 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        e.title?.toLowerCase().includes(q) ||
        e.fieldName.toLowerCase().includes(q) ||
        e.district?.toLowerCase().includes(q));
    }
    return list;
  }, [events, sports, gamesOnlyFreeSpots, gamesOnlyNoCost, search]);

  const gamesDateFiltered = useMemo(() => {
    if (gamesDate === 'wszystkie') return gamesBaseFiltered;
    return gamesBaseFiltered.filter((e) => matchesDateFilter(e.date, gamesDate));
  }, [gamesBaseFiltered, gamesDate]);

  const gamesWithDistance = useMemo<EventRow[]>(() => {
    if (!gamesUserPos) return gamesDateFiltered.map((event) => ({ event }));
    return gamesDateFiltered.map((event) => ({
      event,
      distance: event.lat != null && event.lng != null
        ? distanceKm(gamesUserPos.lat, gamesUserPos.lng, event.lat, event.lng)
        : undefined,
    }));
  }, [gamesDateFiltered, gamesUserPos]);

  const gamesRadiusFiltered = useMemo(() => filterByRadius(gamesWithDistance, gamesRadius), [gamesWithDistance, gamesRadius]);
  const gamesPriceFiltered = useMemo(() => filterByMaxPrice(gamesRadiusFiltered, gamesMaxPriceGrosze), [gamesRadiusFiltered, gamesMaxPriceGrosze]);
  const gamesSpotsFiltered = useMemo(() => filterByMinFreeSpots(gamesPriceFiltered, gamesMinFreeSpots), [gamesPriceFiltered, gamesMinFreeSpots]);
  const gamesRows = useMemo(() => sortEvents(gamesSpotsFiltered, gamesSort), [gamesSpotsFiltered, gamesSort]);

  const gamesPreviewCount = useMemo(() => {
    let list = gamesBaseFiltered;
    if (draftGamesDate !== 'wszystkie') list = list.filter((e) => matchesDateFilter(e.date, draftGamesDate));
    const withDist = gamesUserPos
      ? list.map((event) => ({
          event,
          distance: event.lat != null && event.lng != null
            ? distanceKm(gamesUserPos.lat, gamesUserPos.lng, event.lat, event.lng)
            : undefined,
        }))
      : list.map((event) => ({ event }));
    let rows = filterByRadius(withDist, draftGamesRadius);
    rows = filterByMaxPrice(rows, draftGamesMaxPricePln == null ? null : draftGamesMaxPricePln * 100);
    rows = filterByMinFreeSpots(rows, draftGamesMinFreeSpots);
    return rows.length;
  }, [gamesBaseFiltered, draftGamesDate, draftGamesRadius, draftGamesMaxPricePln, draftGamesMinFreeSpots, gamesUserPos]);

  const selectedEventRow = selectedEventId ? gamesRows.find((r) => r.event.id === selectedEventId) ?? null : null;

  // Zaznaczone wydarzenie znika, gdy filtr wyrzuci je z wyników (jak przy
  // boiskach — patrz efekt niżej dla `selectedId`).
  useEffect(() => {
    if (selectedEventId && !gamesRows.some((r) => r.event.id === selectedEventId)) setSelectedEventId(null);
  }, [gamesRows, selectedEventId]);

  // Reset the render window whenever the result set changes (new search/filter).
  useEffect(() => { setVisibleCount(PAGE); }, [sports, venueTypes, surfaces, onlyGamesToday, search]);

  // The map plots every field, but the list/carousel render only a window. A pin
  // outside that window would select a venue whose card doesn't exist — the click
  // looked like it did nothing. Grow the window to include the selection.
  useEffect(() => {
    if (!selectedId) return;
    const idx = fields.findIndex((f) => f.id === selectedId);
    if (idx >= visibleCount) setVisibleCount(Math.ceil((idx + 1) / PAGE) * PAGE);
  }, [selectedId, fields, visibleCount]);

  const visibleFields = fields.slice(0, visibleCount);
  const hasMore = fields.length > visibleFields.length;
  // Szczegóły kart, które są na ekranie: zdjęcie, nawierzchnia, strona.
  // Pinezki przychodzą okrojone (siedem kolumn zamiast dziewiętnastu), więc
  // resztę dociągamy dla garstki widocznych obiektów, nie dla całego kraju.
  const [szczegoly, setSzczegoly] = useState<Record<string, Field>>({});
  const idsWidoczne = useMemo(() => {
    const lista = fields.slice(0, visibleCount).map((f) => f.id);
    if (selectedId && !lista.includes(selectedId)) lista.push(selectedId);
    return lista;
  }, [fields, visibleCount, selectedId]);

  useEffect(() => {
    const brakujace = idsWidoczne.filter((id) => !szczegoly[id]);
    if (brakujace.length === 0) return;
    let anulowane = false;
    getFieldsByIds(brakujace)
      .then((pelne) => {
        if (anulowane) return;
        setSzczegoly((prev) => {
          const next = { ...prev };
          for (const f of pelne) next[f.id] = f;
          return next;
        });
      })
      .catch(() => {});
    return () => { anulowane = true; };
    // `szczegoly` celowo poza zależnościami: efekt sam je uzupełnia i
    // dopisanie ich tutaj zapętliłoby go na każdej odpowiedzi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsWidoczne]);

  /** Pinezka wzbogacona o szczegóły, jeśli już przyszły. */
  const zKarta = useCallback(
    (f: Field): Field => (szczegoly[f.id] ? { ...f, ...szczegoly[f.id] } : f),
    [szczegoly],
  );

  // Przy oddaleniu mapa pokazuje skupiska, nie obiekty — pusta lista nie
  // znaczy wtedy „nic nie znaleziono", tylko „przybliż".
  // Aktywne szukanie zawsze pokazuje konkretne pinezki, niezależnie od
  // przybliżenia — kółka ze skupiskami nie odpowiadają na pytanie „gdzie jest
  // to, czego szukam".
  const trybSkupisk = search.trim().length < 2 && zoom < ZOOM_SKUPISK;

  // Ile obiektów widać w tym kadrze. Przy oddaleniu to jedyna liczba, jaką
  // użytkownik może dostać — sumowanie kilkunastu kółek wzrokiem nie jest
  // odpowiedzią na pytanie „ile ich w ogóle jest".
  const wKadrze = useMemo(
    () => (trybSkupisk ? skupiska.reduce((suma, s) => suma + s.ile, 0) : fields.length),
    [trybSkupisk, skupiska, fields.length],
  );

  const selectedField = selectedId ? fields.find((f) => f.id === selectedId) ?? null : null;

  // Clean up stale card refs
  useEffect(() => {
    const ids = new Set(fields.map((f) => f.id));
    for (const id of Object.keys(sidebarCardRefs.current)) { if (!ids.has(id)) delete sidebarCardRefs.current[id]; }
  }, [fields]);

  // Zaznaczenie znika, gdy filtr wyrzuci wybrany obiekt z wyników. Nic nie
  // zaznacza się samo: na mapie ogólnopolskiej „pierwszy z listy" to obiekt
  // przypadkowy, oddalony o pół kraju od tego, na co użytkownik patrzy.
  useEffect(() => {
    const id = selectedIdRef.current;
    if (id && !fields.some((f) => f.id === id)) setSelected({ id: null, source: 'init' });
  }, [fields]);

  // Obiekt wskazany w adresie — zaznaczany raz, gdy tylko pojawi się w danych.
  // Źródło 'map' jest tu celowe: to jedyny przypadek, w którym mapa MA przejechać
  // do obiektu bez kliknięcia, bo użytkownik sam o to poprosił linkiem.
  const linkObsluzony = useRef(false);
  useEffect(() => {
    if (linkObsluzony.current || !boiskoZLinku) return;
    if (!fields.some((f) => f.id === boiskoZLinku)) return;
    linkObsluzony.current = true;
    setSelected({ id: boiskoZLinku, source: 'map' });
  }, [boiskoZLinku, fields]);

  // Scroll desktop sidebar to selected (same reasoning for `visibleCount`).
  useEffect(() => {
    if (!selectedId) return;
    const el = sidebarCardRefs.current[selectedId];
    const c  = sidebarRef.current;
    if (!el || !c) return;
    const targetTop = el.offsetTop - (c.clientHeight - el.offsetHeight) / 2;
    c.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [selectedId, visibleCount]);

  // Modal aktywny: w trybie obiektów gdy Typ/Nawierzchnia mają wybór, w
  // trybie gier gdy którykolwiek z suwaków odbiega od wartości domyślnej —
  // steruje wyglądem przycisku „Filtry" w FilterPills.
  const modalFiltersActive = showGames
    ? (gamesDate !== 'wszystkie' || gamesRadius !== null || gamesMaxPriceGrosze !== null || gamesMinFreeSpots > 0)
    : (venueTypes.length > 0 || surfaces.length > 0);
  const previewFieldsCount = useMemo(() => {
    let list = searchResults ?? allFields;
    if (sports.length > 0) list = list.filter((f) => f.sport.some((s) => sports.includes(s)));
    if (draftTypes.length > 0) list = list.filter((f) => draftTypes.includes(f.venueType ?? ''));
    if (draftSurfaces.length > 0) list = list.filter((f) => draftSurfaces.includes(f.surface ?? ''));
    return list.length;
  }, [allFields, searchResults, sports, draftTypes, draftSurfaces]);

  /** Wybór „Najbliżej mnie" w pigułce Sortuj (tryb gier) pyta o lokalizację
   *  od razu przy kliknięciu — ten sam wzorzec co na /wydarzenia (D5). */
  const onGamesSortSelect = async (value: SortBy) => {
    if (value === 'odleglosc' && !gamesUserPos) {
      setGamesSortGeoBusy(true);
      const res = await getCurrentLocation();
      setGamesSortGeoBusy(false);
      if (res.ok) { setGamesUserPos({ lat: res.lat, lng: res.lng }); setGamesSort('odleglosc'); }
      else setGamesGeoError(geoErrorMessage(res.kind));
      return;
    }
    setGamesSort(value);
  };

  const filterProps = {
    showGames, onToggleShowGames: toggleShowGames,
    sports, setSports,
    onlyGamesToday, setOnlyGamesToday,
    filtersActive: modalFiltersActive,
    onOpenFilters: openSheet,
    gamesSortBy: gamesSort, onGamesSortSelect, gamesSortGeoBusy,
    gamesOnlyFreeSpots, setGamesOnlyFreeSpots,
    gamesOnlyNoCost, setGamesOnlyNoCost,
  };

  const filtersModal = showGames ? (
    <FilterSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title="Filtry"
      onApply={applyGamesDraft}
      onClear={clearGamesDraft}
      applyLabel={gamesGeoBusy ? 'Szukam Cię…' : `Pokaż ${gamesPreviewCount} ${plural(gamesPreviewCount, 'mecz', 'mecze', 'meczy')}`}
    >
      <div className="space-y-6">
        <RangeSlider
          label="Kiedy"
          min={0} max={4} step={1}
          value={DATE_SLIDER_VALUES.indexOf(draftGamesDate)}
          onChange={(i) => setDraftGamesDate(DATE_SLIDER_VALUES[i])}
          formatValue={(i) => DATE_SLIDER_LABELS[i]}
          minLabel="Dzisiaj" maxLabel="Wszystko"
        />
        <RangeSlider
          label="Odległość"
          min={RADIUS_MIN} max={RADIUS_MAX} step={1}
          value={draftGamesRadius ?? RADIUS_MAX}
          onChange={(km) => setDraftGamesRadius(km >= RADIUS_MAX ? null : km)}
          formatValue={(km) => (km >= RADIUS_MAX ? 'Bez limitu' : `do ${km} km`)}
          minLabel={`${RADIUS_MIN} km`} maxLabel="Bez limitu"
        />
        <RangeSlider
          label="Cena"
          min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP}
          value={draftGamesMaxPricePln ?? PRICE_MAX}
          onChange={(pln) => setDraftGamesMaxPricePln(pln >= PRICE_MAX ? null : pln)}
          formatValue={(pln) => (pln >= PRICE_MAX ? 'Bez limitu' : pln === 0 ? 'Za darmo' : `do ${pln} zł`)}
          minLabel="Za darmo" maxLabel="Bez limitu"
        />
        <RangeSlider
          label="Wolne miejsca"
          min={MIN_SPOTS_MIN} max={MIN_SPOTS_MAX} step={1}
          value={draftGamesMinFreeSpots}
          onChange={setDraftGamesMinFreeSpots}
          formatValue={(n) => (n === 0 ? 'Dowolna liczba' : `co najmniej ${n}`)}
          minLabel="Dowolna liczba" maxLabel="14+"
        />
      </div>
    </FilterSheet>
  ) : (
    <FilterSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title="Filtry"
      onApply={() => { setVenueTypes(draftTypes); setSurfaces(draftSurfaces); }}
      onClear={() => { setDraftTypes([]); setDraftSurfaces([]); }}
      applyLabel={`Pokaż ${previewFieldsCount} ${boiskoSlowo(previewFieldsCount)}`}
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Typ obiektu</h3>
          {VENUE_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setDraftTypes(toggleInArray(draftTypes, o.value))}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
            >
              <span className="flex-1 text-left">{o.label}</span>
              {draftTypes.includes(o.value) && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
            </button>
          ))}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Nawierzchnia</h3>
          {SURFACE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setDraftSurfaces(toggleInArray(draftSurfaces, o.value))}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
            >
              <span className="flex-1 text-left">{o.label}</span>
              {draftSurfaces.includes(o.value) && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
            </button>
          ))}
        </section>
      </div>
    </FilterSheet>
  );

  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Szukaj boiska po nazwie lub adresie…"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {search && (
        <button
          onClick={() => setSearch('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Wyczyść"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const street = MAPBOX_TOKEN ? (
    <TileLayer
      attribution='&copy; Mapbox &copy; OpenStreetMap'
      url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512} zoomOffset={-1}
    />
  ) : (
    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[380px] shrink-0 border-r border-slate-100 bg-[#FAF9F6] overflow-hidden">
        {/* Search + Filters */}
        <div className="px-3 pt-3 pb-3 border-b border-slate-100 space-y-3">
          {searchBox}
          <FilterPills {...filterProps} wrap />
          {showGames && gamesGeoError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{gamesGeoError}</p>
          )}
        </div>

        {/* Licznik */}
        <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">
          {showGames
            ? `${gamesRows.length} ${plural(gamesRows.length, 'mecz', 'mecze', 'meczy')}`
            : `${fields.length} ${boiskoSlowo(fields.length)}`}
        </div>

        {/* Scrollable list */}
        {showGames ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {gamesRows.map(({ event, distance }) => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="cursor-pointer">
                <EventBrowseCard event={event} distance={distance} relation={statusFor(event)} />
              </div>
            ))}
            {gamesRows.length === 0 && (
              <p className="text-sm text-slate-400 text-center pt-8">Brak meczów dla tych filtrów</p>
            )}
          </div>
        ) : (
          <div ref={sidebarRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {visibleFields.map((f) => (
              <div
                key={f.id}
                ref={(el) => { sidebarCardRefs.current[f.id] = el; }}
                onClick={() => onSelect(f.id, 'map')}
                className="cursor-pointer"
              >
                <VenueCard
                  field={zKarta(f)}
                  games={fieldStats[f.id]?.count ?? 0}
                  hasGameToday={fieldStats[f.id]?.today ?? false}
                  selected={f.id === selectedId}
                  backTo={`/mapa?boisko=${f.id}`}
                />
              </div>
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Pokaż więcej ({fields.length - visibleFields.length})
              </button>
            )}
            {fields.length === 0 && (searchResults ?? allFields).length > 0 && (
              <p className="text-sm text-slate-400 text-center pt-8">
                {trybSkupisk
                  ? `${wKadrze.toLocaleString('pl-PL')} ${boiskoSlowo(wKadrze)} w tym widoku — przybliż mapę, żeby zobaczyć pojedyncze`
                  : 'Brak boisk dla tych filtrów'}
              </p>
            )}
          </div>
        )}
      </aside>

      {/* Modal filtrów — jeden na komponent, nie po jednym na FilterPills
          (sidebar desktopu i overlay mobile), żeby oba przyciski „Filtry"
          otwierały ten sam, współdzielony stan szkicu. */}
      {filtersModal}

      {/* ── Map area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-w-0 min-h-0">
        <MapContainer
          center={POLSKA}
          zoom={POLSKA_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={setMapInstance}
        >
          <MapAttribution />
          {street}
          {showGames ? (
            <GamesMarkersLayer rows={gamesRows} selectedId={selectedEventId} onSelect={setSelectedEventId} />
          ) : (
            <>
              <KadrObserwator onZmiana={onKadrZmiana} />
              <WarstwaSkupisk skupiska={skupiska} />
              <MapLayer fields={fields} selectedId={selectedId} selectedSource={selectedSource} onSelect={onSelect} />
            </>
          )}
        </MapContainer>

        {/* Skok do okolicy użytkownika. Świadomie na kliknięcie, nie przy
            wejściu: pytanie o lokalizację od razu po otwarciu mapy odbija się
            od ludzi, a mapa Polski działa i bez zgody. */}
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          title="Pokaż moją okolicę"
          aria-label="Pokaż moją okolicę"
          className="absolute right-3 bottom-28 md:bottom-6 z-[600] flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <MapPin className={`h-5 w-5 ${locating ? 'text-slate-300' : 'text-primary-700'}`} />
        </button>

        {/* Mobile: search + filter overlay. Zalogowany dostaje tu też
            dzwonek+awatar — Header chowa dla niego swój pasek na tej trasie
            (patrz Header.tsx#hideMobileBarForUser), więc tożsamość musi mieć
            gdzie się pokazać. MobileIdentityRow sam zwraca null dla
            wylogowanego, więc wiersz wygląda dziś tak samo jak wcześniej. */}
        <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-[600] px-3 pt-3 space-y-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="min-w-0 flex-1">{searchBox}</div>
            <MobileIdentityRow />
          </div>
          <div className="pointer-events-auto">
            <FilterPills {...filterProps} />
          </div>
          {showGames && gamesGeoError && (
            <p className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-md">
              {gamesGeoError}
            </p>
          )}
        </div>

        {/* Mobile: jedna karta — ta, której pinezkę kliknięto.
            Wcześniej stała tu przewijana karuzela wszystkich wyników i to ona
            mieliła. Każde przesunięcie palcem liczyło odległość każdej karty od
            środka kadru, żeby zgadnąć, którą właśnie oglądasz, a taki wybór
            przewijał listę z powrotem — ruch palcem walczył z automatycznym
            przewijaniem.

            Karta jednego obiektu odpowiada na pytanie, które człowiek ma na
            mapie naprawdę: „co to za boisko?". Przeglądanie listą zostaje na
            desktopie, gdzie jest miejsce na pasek boczny.

            Dolne dopełnienie liczy się od krawędzi EKRANU, nie kontenera mapy:
            karta jest `fixed`, tak jak dolna nawigacja, więc obie mierzą od tego
            samego punktu nawet gdy przeglądarka zwija swój pasek adresu.
            Wysokość paska daje --bottom-nav-h (globals.css), która sama zeruje
            się tam, gdzie paska nie ma. */}
        {selectedField && !showGames && (
          <div
            // `fixed`, nie `absolute`: dolna nawigacja też jest `fixed`, więc
            // tylko tak obie rzeczy mierzą od tej samej krawędzi. Przy
            // `absolute` karta trzymała się dołu kontenera mapy, który po
            // zwinięciu paska przeglądarki nie pokrywa się z dołem ekranu.
            className="md:hidden fixed inset-x-0 bottom-0 z-[1001] px-3"
            // Wysokość paska bierzemy ze zmiennej --bottom-nav-h (globals.css),
            // a nie z zaszytego 4rem: zmienna zeruje się, gdy paska nie ma
            // (wylogowany, `md:` i wyżej), więc karta nie zostawia wtedy pustego
            // odstępu pod sobą. Zawiera już env(safe-area-inset-bottom).
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelected({ id: null, source: 'map' })}
                aria-label="Zamknij kartę boiska"
                className="absolute -top-2 right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 shadow-md transition-colors hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
              <VenueCard
                field={zKarta(selectedField)}
                games={fieldStats[selectedField.id]?.count ?? 0}
                hasGameToday={fieldStats[selectedField.id]?.today ?? false}
                backTo={`/mapa?boisko=${selectedField.id}`}
              />
            </div>
          </div>
        )}

        {/* Tryb gier: ta sama dolna karta, treść EventBrowseCard zamiast VenueCard. */}
        {selectedEventRow && showGames && (
          <div
            className="md:hidden fixed inset-x-0 bottom-0 z-[1001] px-3"
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                aria-label="Zamknij kartę meczu"
                className="absolute -top-2 right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 shadow-md transition-colors hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
              <EventBrowseCard
                event={selectedEventRow.event}
                distance={selectedEventRow.distance}
                relation={statusFor(selectedEventRow.event)}
              />
            </div>
          </div>
        )}

        {/* Podpowiedź, dopóki nic nie wybrano — bez niej dolna część mapy jest
            pusta i nie wiadomo, że pinezki są klikalne. */}
        {!showGames && !selectedField && (fields.length > 0 || trybSkupisk) && (
          <div
            className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-3"
            // Jak wyżej: `fixed` mierzy od tej samej krawędzi co pasek, a wysokość
            // paska bierzemy ze zmiennej zamiast z zaszytego 4rem.
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <p className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-md">
              {trybSkupisk
                ? `${wKadrze.toLocaleString('pl-PL')} ${boiskoSlowo(wKadrze)} w tym widoku · przybliż, żeby zobaczyć pojedyncze`
                : 'Dotknij pinezki, żeby zobaczyć boisko'}
            </p>
          </div>
        )}

        {showGames && !selectedEventRow && gamesRows.length > 0 && (
          <div
            className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-3"
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <p className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-md">
              Dotknij pinezki, żeby zobaczyć mecz
            </p>
          </div>
        )}

        {!showGames && fields.length === 0 && (searchResults ?? allFields).length > 0 && !trybSkupisk && (
          <div className="md:hidden absolute inset-x-0 bottom-6 z-[1100] flex justify-center">
            <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
              Brak boisk dla tych filtrów
            </div>
          </div>
        )}

        {showGames && gamesRows.length === 0 && (
          <div className="md:hidden absolute inset-x-0 bottom-6 z-[1100] flex justify-center">
            <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
              Brak meczów dla tych filtrów
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
