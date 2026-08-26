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
  Check, CalendarCheck, CalendarPlus, MapPin, Globe, Search, SlidersHorizontal, Ticket,
  Wallet, X,
} from 'lucide-react';
import { TogglePill } from '@/components/ui/FilterPill';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import FilterSheet from '@/components/ui/FilterSheet';
import RangeSlider from '@/components/ui/RangeSlider';
import MobileIdentityRow from '@/components/layout/MobileIdentityRow';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { useMyInvites } from '@/lib/useMyInvites';
import type { Field, EventItem } from '@/types';
import {
  getExplorerFields, getFieldsByIds, getExplorerClusters, searchExplorerFields,
  policzBoiskaWMiastach, getFieldsWMiescie, kadrWokol,
  type Kadr, type Skupisko,
} from '@/lib/api';
import { NAJWIEKSZE_MIASTA, miastaDoPokazania } from '@/lib/miasta';
import PustaListaObiektow from './PustaListaObiektow';
import { getPublicEvents } from '@/lib/events';
import { zapiszPowrot } from '@/lib/powrot';
import { isEventJoinable } from '@/lib/eventDates';
import { fieldPhotoUrl, surfaceLabel } from '@/lib/labels';
import { slugBoiska, externalUrl } from '@/lib/utils';
import { plural } from '@/lib/plural';
import { distanceKm, getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import { FOCUS_SPORTS, MAP_FILTER_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import {
  filterByMaxPrice, filterByMinFreeSpots, filterByRadius, matchesDateFilter,
  sortEvents, swipeEventId, toggleInArray, type DateFilter, type EventRow, type SortBy,
} from '@/lib/eventFilters';
import { POLSKA, POLSKA_ZOOM, fieldPin, clusterDivIcon } from './mapIcons';
import KadrObserwator from './KadrObserwator';
import GamesMarkersLayer from './GamesMarkersLayer';
import LocateMeButton from './LocateMeButton';
import { useSwipe } from '@/lib/useSwipe';

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

  // Przelot do zaznaczonego obiektu — DOKŁADNIE RAZ na zaznaczenie.
  //
  // `fields` było wcześniej w zależnościach i to zapętlało mapę: przelot kończy
  // się zdarzeniem `moveend`, obserwator kadru zgłasza nowy prostokąt, przychodzi
  // świeża lista obiektów (nowa tablica, choćby o tej samej treści), efekt rusza
  // ponownie i leci jeszcze raz w to samo miejsce. Z zewnątrz wyglądało to jak
  // drganie całej mapy po kliknięciu pinezki.
  const ostatniPrzelot = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) { ostatniPrzelot.current = null; return; }
    // Przy pierwszym wejściu ('init') zostaje szeroki widok — nie przybliżamy.
    if (selectedSource === 'init') return;
    if (ostatniPrzelot.current === selectedId) return;

    const f = fields.find((x) => x.id === selectedId);
    if (!f) return;                      // obiekt jeszcze nie dojechał
    ostatniPrzelot.current = selectedId;
    map.stop();
    map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 14), { duration: 0.45 });
    // `fields` zostaje w zależnościach, bo przy wejściu z linku `?boisko=`
    // obiekt dociera dopiero po pierwszym pobraniu. Pętli już nie ma —
    // pilnuje jej `ostatniPrzelot`.
  }, [selectedId, selectedSource, fields, map]);

  return null;
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------
function VenueCard({ field, games, hasGameToday, selected, backTo }: {
  field: Field; games: number; hasGameToday: boolean; selected?: boolean;
  /** Dokąd ma wrócić strzałka „wstecz" na stronie boiska.
   *
   *  FUNKCJA, NIE GOTOWY NAPIS: adres powrotu niesie bieżący środek i
   *  przybliżenie mapy, a te zmieniają się przy każdym przesunięciu. Napis
   *  policzony przy renderze byłby kadrem sprzed przewijania — czytamy go
   *  dopiero w chwili kliknięcia. */
  backTo?: () => string;
}) {
  const thumb = fieldPhotoUrl(field, 320, 320);
  // Nazwa + końcówka id: nazwy rodzajowe z OSM powtarzają się tysiące razy,
  // więc sam slug otwierał zawsze to samo boisko. Patrz `slugBoiska`.
  const slug = slugBoiska(field.name, field.id);
  const name = displayName(field.name);
  const surface = field.surface ? surfaceLabel(field.surface) : null;
  const typeLabel = field.venueType ? VENUE_TYPE_LABELS[field.venueType] ?? field.venueType : null;
  const fullAddress = field.address?.trim() || null;

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
        {/* Sporty — pierwsza rzecz, o którą się pyta („da się tu zagrać w to,
            w co gram?"), a kafelek jej dotąd nie mówił wcale. Pinezki
            przychodzą okrojone; pełne dane dociąga `szczegoly` dla widocznych
            kart, więc tu po prostu może ich jeszcze nie być. */}
        {field.sport?.length > 0 && (
          <p className="text-[11px] font-medium text-slate-600 truncate">
            {field.sport.join(' · ')}
          </p>
        )}
        {(typeLabel || surface) && (
          <p className="text-[11px] text-slate-500 truncate">
            {typeLabel && <span>{typeLabel}</span>}
            {typeLabel && surface && <span className="mx-1">·</span>}
            {surface && <span>{surface}</span>}
          </p>
        )}
        {/* Adres w dwóch linijkach zamiast przyciętego do dwóch członów:
            „Swarzędz, ul. Pawia" bez numeru nie prowadzi pod właściwy budynek,
            a to jedyne miejsce na mapie, w którym adres w ogóle widać. */}
        {fullAddress && (
          <p className="text-[11px] text-slate-400 line-clamp-2 flex items-start gap-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0 mt-[3px]" />{fullAddress}
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
        {/* DWIE DROGI Z KAFELKA, nie jedna. Dotąd jedyne wyjście prowadziło do
            opisu obiektu, skąd drogi do kreatora trzeba było szukać na własną
            rękę — mimo że mapa odpowiada na pytanie „gdzie zagrać".

            KOLEJNOŚĆ: „Zobacz boisko" zostaje główne, „Zorganizuj tutaj" jest
            skrótem obok. Nie z ostrożności przed nadmiarem meczów — te i tak
            rodzą się w wieloetapowym kreatorze, nie na kafelku — tylko dlatego,
            że mecz umawiany na obiekcie, którego się nie sprawdziło, to
            dokładnie ten mecz, który się nie odbędzie. Oświetlenie, nawierzchnia,
            to czy obiekt wymaga rezerwacji i czy ktoś już tam gra o tej porze
            — wszystko to stoi na stronie obiektu, a strona obiektu ma własne,
            szerokie „Zorganizuj tutaj". Domyślna droga prowadzi więc przez
            informację, skrót zostaje dla tych, którzy to boisko znają.

            Jeden pod drugim, nie obok siebie: przy 100-pikselowej miniaturze
            na wąskim telefonie na guziki zostaje ~185 px, w które dwa napisy
            tej długości się nie mieszczą — a skracanie ich do „Zorganizuj"
            i „Szczegóły" gubi to, co mówią. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Link
            href={`/boisko/${slug}`}
            className="flex items-center justify-between gap-2 rounded-2xl bg-primary-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-800"
            onClick={(e) => {
              e.stopPropagation();
              // Cel „wstecz" jedzie w sessionStorage, nie w URL-u — patrz
              // lib/powrot.ts. Link do boiska zostaje czystym, kanonicznym
              // adresem zamiast wariantu z ?wroc=.
              if (backTo) zapiszPowrot(backTo());
            }}
          >
            Zobacz boisko <span aria-hidden="true">›</span>
          </Link>
          <Link
            href={`/wydarzenia/nowe?fieldId=${field.id}`}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarPlus className="h-3.5 w-3.5" strokeWidth={2.5} /> Zorganizuj tutaj
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pasek wyszukiwarki — JEDEN wiersz, rendered zarówno w sidebarze desktopu,
// jak i w nakładce mobile.
// ---------------------------------------------------------------------------
// Trzy kontrolki, bo odpowiadają na trzy różne pytania — ten sam podział co
// na dawnym /wydarzenia (poz. 8 przeglądu), teraz wspólny dla gier i obiektów:
//  • `Gry | Obiekty` — NA CO patrzę. Zmienia dane, dostaje pełny przełącznik.
//  • `Lista | Mapa` — JAK patrzę. Świadomie ODRĘBNY, WIDOCZNY przełącznik
//    (ten sam komponent co powyżej, w mniejszym wariancie), nie mały guzik
//    z ikoną — guzik nie mówił, w jakim stanie jest teraz, przełącznik mówi
//    to od razu, dwoma podpisanymi opcjami naraz.
//  • Ikona filtrów — CZEGO SZUKAM. Reszta (sport, cena, odległość, typ
//    obiektu…) zjeżdża do arkusza; ikona niesie LICZBĘ aktywnych, żeby
//    schowanie ich nie znaczyło „zapomnij, co ustawiłeś".
// Sport, „Wolne miejsca", „Za darmo", „Gry dziś" i Typ/Nawierzchnia siedzą
// dziś WYŁĄCZNIE w arkuszu filtrów (patrz `filtersModal` niżej) — nie w tym
// pasku. Przełączenie Gry↔Obiekty nie przestawia już kontrolek miejscami.
function SearchToolbar({
  showGames, onToggleShowGames,
  widok, setWidok,
  liczbaFiltrow, onOpenFilters,
  wrap,
}: {
  showGames: boolean;
  onToggleShowGames: () => void;
  widok: 'lista' | 'mapa';
  setWidok: (v: 'lista' | 'mapa') => void;
  liczbaFiltrow: number;
  onOpenFilters: () => void;
  wrap?: boolean;
}) {
  return (
    <div className={wrap ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-2'}>
      {/* Dwa tryby mapy są równorzędne — przełącznik pokazuje oba naraz zamiast
          chować „obiekty" za wyłączonym pillem „Pokaż gry". Semantyka i URL
          (`?gry=1`) bez zmian: „Gry" to dotychczasowe `showGames === true`. */}
      <SegmentedToggle
        ariaLabel="Co pokazać"
        value={showGames ? 'gry' : 'obiekty'}
        onChange={(v) => { if ((v === 'gry') !== showGames) onToggleShowGames(); }}
        options={[{ value: 'gry', label: 'Gry' }, { value: 'obiekty', label: 'Obiekty' }] as const}
      />

      <div className="ml-auto flex items-center gap-2">
        <SegmentedToggle
          ariaLabel="Jak pokazać"
          size="sm"
          value={widok}
          onChange={setWidok}
          options={[{ value: 'lista', label: 'Lista' }, { value: 'mapa', label: 'Mapa' }] as const}
        />

        <button
          type="button"
          onClick={onOpenFilters}
          aria-haspopup="dialog"
          aria-label={liczbaFiltrow > 0 ? `Filtry — ${liczbaFiltrow} aktywne` : 'Filtry'}
          className={clsx(
            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white shadow-md transition-colors',
            liczbaFiltrow > 0 ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 text-ink',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {liczbaFiltrow > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-extrabold leading-none text-primary-950 ring-2 ring-white">
              {liczbaFiltrow}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main explorer
// ---------------------------------------------------------------------------
export default function VenueExplorer({
  initialFields, initialEvents, widzianoWczesniej,
}: {
  initialFields?: Field[]; initialEvents?: EventItem[];
  /** Ostatnia wizyta na tej trasie (`KLUCZ_WYDARZENIA_WIDZIANO`) — mecz
   *  powstały PO tym znaczniku dostaje plakietkę „Nowość" w trybie gier.
   *  Ta sama reguła co dawniej na /wydarzenia (`EventsListView`), teraz
   *  tutaj, bo to ta trasa gasi pomarańczową kropkę „Szukaj" na dole. */
  widzianoWczesniej?: string | null;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { statusFor } = useMyInvites();

  const [allFields, setAllFields] = useState<Field[]>(initialFields ?? []);
  const [events,    setEvents]    = useState<EventItem[]>(initialEvents ?? []);
  const [search,    setSearch]    = useState('');
  // Render only a window of cards to keep the list/carousel snappy (katalog: ponad 30 000 obiektów w całej Polsce).
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
  // Kadr zapamiętany przy wyjściu na stronę obiektu: `lat`, `lng`, `z`.
  // Bez tego powrót lądował na widoku całego kraju z samą zaznaczoną kartą —
  // filtry (sport, typ, nawierzchnia, tryb gier) też przepadały, bo adres
  // powrotu składał się z jednego parametru `boisko`, a reszta stanu mapy
  // siedzi właśnie w adresie.
  const widokZLinku = useMemo(() => {
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    const z = Number(searchParams.get('z'));
    const komplet = searchParams.has('lat') && searchParams.has('lng') && searchParams.has('z');
    return komplet && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)
      ? { lat, lng, z }
      : null;
  }, [searchParams]);

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

  // JAK patrzę — lista czy mapa. Wyłącznie lokalny stan (bez zmiany trybu
  // nie ma nawigacji między trasami, więc nie ma czego synchronizować z URL).
  //
  // DOMYŚLNY WIDOK IDZIE ZA RODZAJEM DANYCH, nie jest jeden dla całej trasy:
  //
  // • GRY → lista. Mecz to przede wszystkim TERMIN i wolne miejsca, a tego
  //   pinezka nie mówi — trzeba w nią kliknąć, żeby się dowiedzieć, czy w ogóle
  //   jest o czym rozmawiać. Lista odpowiada na „w co mogę zagrać" od razu,
  //   bez przybliżania i bez zgody na lokalizację: `getPublicEvents()` pobiera
  //   wszystkie otwarte mecze naraz, niezależnie od kadru mapy. Otwartych
  //   meczów są dziesiątki, więc lista się nie zapycha.
  // • OBIEKTY → mapa. „Gdzie jest boisko" to pytanie z gruntu przestrzenne,
  //   a katalog liczy dziesiątki tysięcy pozycji — lista jest tu narzędziem
  //   drugiego wyboru, nie pierwszego.
  //
  // Wejście z dolnej nawigacji („Szukaj" → `/mapa?gry=1`) trafia więc od razu
  // na listę otwartych meczów.
  const [widok, setWidok] = useState<'lista' | 'mapa'>(showGames ? 'lista' : 'mapa');

  // Modal Typ obiektu/Nawierzchnia/Sport — szkic w tym samym stylu co na
  // dawnym /wydarzenia: wybory aplikują się dopiero na „Pokaż N obiektów".
  // Sport dołączył tu z paska (D-scalenie): przełączenie Gry↔Obiekty
  // przestawiało dawniej pigułkę sportu razem z resztą paska, a teraz pasek
  // ma stały kształt niezależnie od trybu.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftTypes, setDraftTypes] = useState<string[]>(venueTypes);
  const [draftSurfaces, setDraftSurfaces] = useState<string[]>(surfaces);
  const [draftSports, setDraftSports] = useState<string[]>(sports);

  // Tryb gier (D11/D12) — lokalny stan filtrów, ten sam kształt co na
  // /wydarzenia, minus Sortuj: /mapa jest zawsze mapą, więc kolejność
  // pinezek/listy sidebara zostaje chronologiczna na stałe, bez UI do zmiany.
  const gamesSort: SortBy = 'termin';
  const [gamesDate, setGamesDate] = useState<DateFilter>('wszystkie');
  const [gamesRadius, setGamesRadius] = useState<number | null>(null);
  const [gamesMaxPriceGrosze, setGamesMaxPriceGrosze] = useState<number | null>(null);
  const [gamesMinFreeSpots, setGamesMinFreeSpots] = useState(0);
  const [gamesOnlyFreeSpots, setGamesOnlyFreeSpots] = useState(false);
  const [gamesOnlyNoCost, setGamesOnlyNoCost] = useState(false);
  const [gamesUserPos, setGamesUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gamesGeoBusy, setGamesGeoBusy] = useState(false);
  const [gamesGeoError, setGamesGeoError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [draftGamesDate, setDraftGamesDate] = useState<DateFilter>(gamesDate);
  const [draftGamesRadius, setDraftGamesRadius] = useState<number | null>(gamesRadius);
  const [draftGamesMaxPricePln, setDraftGamesMaxPricePln] = useState<number | null>(
    gamesMaxPriceGrosze == null ? null : gamesMaxPriceGrosze / 100,
  );
  const [draftGamesMinFreeSpots, setDraftGamesMinFreeSpots] = useState(gamesMinFreeSpots);
  const [draftOnlyGamesToday, setDraftOnlyGamesToday] = useState(onlyGamesToday);
  const [draftGamesOnlyFreeSpots, setDraftGamesOnlyFreeSpots] = useState(gamesOnlyFreeSpots);
  const [draftGamesOnlyNoCost, setDraftGamesOnlyNoCost] = useState(gamesOnlyNoCost);

  const openSheet = () => {
    setDraftTypes(venueTypes);
    setDraftSurfaces(surfaces);
    setDraftSports(sports);
    setDraftOnlyGamesToday(onlyGamesToday);
    setDraftGamesDate(gamesDate);
    setDraftGamesRadius(gamesRadius);
    setDraftGamesMaxPricePln(gamesMaxPriceGrosze == null ? null : gamesMaxPriceGrosze / 100);
    setDraftGamesMinFreeSpots(gamesMinFreeSpots);
    setDraftGamesOnlyFreeSpots(gamesOnlyFreeSpots);
    setDraftGamesOnlyNoCost(gamesOnlyNoCost);
    setSheetOpen(true);
  };

  const applyGamesDraft = async () => {
    setGamesGeoError(null);
    setSports(draftSports);
    setGamesDate(draftGamesDate);
    setGamesMaxPriceGrosze(draftGamesMaxPricePln == null ? null : draftGamesMaxPricePln * 100);
    setGamesMinFreeSpots(draftGamesMinFreeSpots);
    setGamesOnlyFreeSpots(draftGamesOnlyFreeSpots);
    setGamesOnlyNoCost(draftGamesOnlyNoCost);
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
    setDraftSports([]);
    setDraftGamesDate('wszystkie');
    setDraftGamesRadius(null);
    setDraftGamesMaxPricePln(null);
    setDraftGamesMinFreeSpots(0);
    setDraftGamesOnlyFreeSpots(false);
    setDraftGamesOnlyNoCost(false);
  };

  // Instancja Leafleta wyciągnięta z MapContainera — potrzebna
  // LocateMeButton, który stoi poza mapą i nie ma useMap().
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Powrót z widoku „Lista": kontener mapy miał przez chwilę `display: none`
  // (zerowy rozmiar), a Leaflet mierzy go raz przy montowaniu i potem ufa
  // własnemu cache'owi. Bez `invalidateSize()` mapa zostawała ucięta do
  // rozmiaru sprzed schowania — kafelki renderowały się tylko w lewym górnym
  // rogu. `setTimeout(0)`: przełącznik musi najpierw zdjąć klasę `hidden`
  // (przeglądarka przeliczyć layout), zanim Leaflet zmierzy nowy rozmiar.
  useEffect(() => {
    if (widok !== 'mapa' || !mapInstance) return;
    const id = setTimeout(() => mapInstance.invalidateSize(), 0);
    return () => clearTimeout(id);
  }, [widok, mapInstance]);

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
    // Kadr ląduje też w ADRESIE, przez `replaceState`.
    //
    // Po co, skoro „wstecz" w aplikacji dostaje gotowy cel z `budujPowrot`:
    // bo na telefonie ludzie cofają się gestem i systemowym przyciskiem, a te
    // wracają do adresu, który stał w historii — czyli do mapy bez kadru.
    // `replaceState` nadpisuje BIEŻĄCY wpis historii zamiast dokładać nowy,
    // więc przesuwanie mapy nie zapycha „wstecz" dziesiątkami kroków, a powrót
    // trafia w kadr sprzed wyjścia. Przy okazji adres mapy staje się
    // udostępnialny — dotąd wysłanie mapy komuś znaczyło wysłanie widoku
    // całego kraju.
    //
    // Poza Reactem (`router.replace` przeładowałby dane przy każdym drgnięciu
    // mapy), więc `searchParams` tego nie zobaczy — i nie musi: czytamy to
    // wyłącznie przy wejściu na stronę.
    if (typeof window === 'undefined') return;
    try {
      const p = new URLSearchParams(window.location.search);
      p.set('lat', ((k.latMin + k.latMax) / 2).toFixed(5));
      p.set('lng', ((k.lngMin + k.lngMax) / 2).toFixed(5));
      p.set('z', String(z));
      window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
    } catch { /* stary przeglądarkowy wyjątek — kadr po prostu się nie zapisze */ }
  }, []);

  // Przywrócenie kadru z adresu — RAZ, przy pierwszym dostępnym Leaflecie.
  // Później mapą rządzi już użytkownik; powtórzenie tego przy każdej zmianie
  // adresu (a ten zmienia się przy każdym kliknięciu filtra) odrzucałoby go
  // z powrotem tam, skąd wrócił.
  const kadrPrzywrocony = useRef(false);
  useEffect(() => {
    if (!mapInstance || !widokZLinku || kadrPrzywrocony.current) return;
    kadrPrzywrocony.current = true;
    mapInstance.setView([widokZLinku.lat, widokZLinku.lng], widokZLinku.z);
  }, [mapInstance, widokZLinku]);

  /**
   * Adres powrotu ze strony obiektu: CAŁY bieżący stan mapy, nie sam obiekt.
   *
   * Filtry siedzą w adresie (`sport`, `type`, `surface`, `today`, `gry`), więc
   * przepisujemy je w komplecie; kadr i przybliżenie w adresie nie siedzą, więc
   * dokładamy je ze świeżej instancji Leafleta. Pięć miejsc po przecinku to
   * około metra — więcej nie ma sensu, a adres robi się nieczytelny.
   */
  const budujPowrot = useCallback((fieldId: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('boisko', fieldId);
    const srodek = mapInstance?.getCenter();
    if (srodek) {
      p.set('lat', srodek.lat.toFixed(5));
      p.set('lng', srodek.lng.toFixed(5));
      p.set('z', String(mapInstance!.getZoom()));
    }
    return `/mapa?${p.toString()}`;
  }, [searchParams, mapInstance]);

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

  // ── Pusty stan listy: „blisko mnie" i miasta ──────────────────────────
  // Obie drogi kończą się w `setSearchResults()`, czyli w tej samej ścieżce co
  // szukanie po nazwie: lista bierze wtedy źródło z wyników zamiast z kadru,
  // a efekt wyżej sam dopasowuje mapę do tego, co przyszło. Zero nowej
  // maszynerii na coś, co już działa.
  const [liczbyMiast, setLiczbyMiast] = useState<Record<string, number> | null>(null);
  const [ladujeBlisko, setLadujeBlisko] = useState(false);
  const [bladGeoListy, setBladGeoListy] = useState<string | null>(null);

  const trybSkupiskTeraz = zoom < ZOOM_SKUPISK;
  useEffect(() => {
    // Liczby ciągniemy raz i dopiero, gdy pusty stan naprawdę jest na ekranie
    // — to kilkanaście zapytań `head`, nie ma powodu robić ich na wejściu.
    if (!trybSkupiskTeraz || liczbyMiast !== null) return;
    let anulowane = false;
    policzBoiskaWMiastach([...NAJWIEKSZE_MIASTA])
      .then((l) => { if (!anulowane) setLiczbyMiast(l); })
      .catch(() => { if (!anulowane) setLiczbyMiast({}); });
    return () => { anulowane = true; };
  }, [trybSkupiskTeraz, liczbyMiast]);

  const pokazBliskoMnie = async () => {
    setBladGeoListy(null);
    setLadujeBlisko(true);
    const res = await getCurrentLocation();
    if (!res.ok) {
      setLadujeBlisko(false);
      setBladGeoListy(geoErrorMessage(res.kind));
      return;
    }
    try {
      // 15 km: tyle, ile realnie da się dojechać na mecz po pracy. Przy
      // mniejszym promieniu na wsi wychodzi pusto, przy większym w mieście
      // lista przestaje być listą „blisko".
      const znalezione = await getExplorerFields(kadrWokol(res.lat, res.lng, 15));
      // Kwadrat, nie koło (patrz `kadrWokol`) — sortowanie po prawdziwej
      // odległości robi z tego użyteczną kolejność.
      znalezione.sort((a, b) =>
        distanceKm(res.lat, res.lng, a.lat, a.lng) - distanceKm(res.lat, res.lng, b.lat, b.lng));
      setSearchResults(znalezione);
      if (znalezione.length === 0) setBladGeoListy('W promieniu 15 km nie ma jeszcze żadnego obiektu w katalogu.');
    } catch {
      setBladGeoListy('Nie udało się pobrać obiektów. Spróbuj jeszcze raz.');
    }
    setLadujeBlisko(false);
  };

  const pokazMiasto = async (nazwa: string) => {
    try {
      setSearchResults(await getFieldsWMiescie(nazwa));
    } catch {
      setBladGeoListy('Nie udało się pobrać obiektów. Spróbuj jeszcze raz.');
    }
  };

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

  const jestNowe = (event: EventItem) => (
    widzianoWczesniej != null && new Date(event.createdAt).getTime() > new Date(widzianoWczesniej).getTime()
  );

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

  // Swipe w panelu meczu przełącza na kolejny/poprzedni w tej samej
  // kolejności co pinezki (gamesRows) — ten sam wzorzec co GamesMapCanvas.
  const gamesCardSwipe = useSwipe(
    () => selectedEventRow && setSelectedEventId(swipeEventId(gamesRows, selectedEventRow.event.id, 1)),
    () => selectedEventRow && setSelectedEventId(swipeEventId(gamesRows, selectedEventRow.event.id, -1)),
  );

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

  // Liczba aktywnych filtrów — steruje plakietką na ikonie „Filtry" w
  // `SearchToolbar` (ten sam wzorzec co dawne /wydarzenia). Sport dołączył
  // tu razem z przenosinami do arkusza (patrz komentarz przy `draftSports`).
  const liczbaFiltrow = showGames
    ? [sports.length > 0, gamesOnlyFreeSpots, gamesOnlyNoCost, gamesDate !== 'wszystkie',
        gamesRadius !== null, gamesMaxPriceGrosze !== null, gamesMinFreeSpots > 0].filter(Boolean).length
    : [sports.length > 0, venueTypes.length > 0, surfaces.length > 0, onlyGamesToday].filter(Boolean).length;
  // W trybie skupisk (oddalona mapa) `allFields` jest zawsze puste — obiekty
  // pobiera się dopiero po przybliżeniu (patrz komentarz przy `trybSkupisk`).
  // Liczenie z pustej tablicy dawało zawsze „Pokaż 0 boisk", nawet gdy w
  // kadrze realnie było ich tysiące. Typ obiektu/Nawierzchnia i tak nie mają
  // efektu w tym trybie (nie ma per-obiektowego rozbicia w danych ze skupisk),
  // więc podgląd pokazuje `wKadrze` — sumę z kółek, uwzględniającą już sport
  // (jedyny filtr, który RPC `mapa_skupiska` faktycznie stosuje).
  //
  // `draftSports`, nie `sports`: sport jest teraz częścią tego samego arkusza
  // co Typ/Nawierzchnia, więc podgląd „Pokaż N" ma liczyć to, co user WŁAŚNIE
  // wybiera w arkuszu, nie to, co było zastosowane przed jego otwarciem.
  const previewFieldsCount = useMemo(() => {
    if (trybSkupisk) return wKadrze;
    let list = searchResults ?? allFields;
    if (draftSports.length > 0) list = list.filter((f) => f.sport.some((s) => draftSports.includes(s)));
    if (draftTypes.length > 0) list = list.filter((f) => draftTypes.includes(f.venueType ?? ''));
    if (draftSurfaces.length > 0) list = list.filter((f) => draftSurfaces.includes(f.surface ?? ''));
    return list.length;
  }, [trybSkupisk, wKadrze, allFields, searchResults, draftSports, draftTypes, draftSurfaces]);

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
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Sport</h3>
          <button
            type="button"
            onClick={() => setDraftSports([])}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
          >
            <span className="text-base">🏟️</span>
            <span className="flex-1 text-left">Wszystkie sporty</span>
            {draftSports.length === 0 && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
          </button>
          {GAMES_SPORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setDraftSports(toggleInArray(draftSports, o.value))}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
            >
              <span className="text-base">{o.emoji}</span>
              <span className="flex-1 text-left">{o.label}</span>
              {draftSports.includes(o.value) && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
            </button>
          ))}
        </section>

        <section className="flex flex-wrap gap-2">
          <TogglePill label="Wolne miejsca" icon={<Ticket className="h-3.5 w-3.5 shrink-0" />}
            active={draftGamesOnlyFreeSpots} onClick={() => setDraftGamesOnlyFreeSpots((v) => !v)} />
          <TogglePill label="Za darmo" icon={<Wallet className="h-3.5 w-3.5 shrink-0" />}
            active={draftGamesOnlyNoCost} onClick={() => setDraftGamesOnlyNoCost((v) => !v)} />
        </section>

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
      onApply={() => {
        setVenueTypes(draftTypes);
        setSurfaces(draftSurfaces);
        setSports(draftSports);
        setOnlyGamesToday(draftOnlyGamesToday);
      }}
      onClear={() => { setDraftTypes([]); setDraftSurfaces([]); setDraftSports([]); setDraftOnlyGamesToday(false); }}
      applyLabel={`Pokaż ${previewFieldsCount} ${boiskoSlowo(previewFieldsCount)}`}
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Sport</h3>
          <button
            type="button"
            onClick={() => setDraftSports([])}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
          >
            <span className="text-base">🏟️</span>
            <span className="flex-1 text-left">Wszystkie sporty</span>
            {draftSports.length === 0 && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
          </button>
          {SPORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setDraftSports(toggleInArray(draftSports, o.value))}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-slate-50"
            >
              <span className="text-base">{o.emoji}</span>
              <span className="flex-1 text-left">{o.label}</span>
              {draftSports.includes(o.value) && <Check className="h-4 w-4 shrink-0 text-primary-700" />}
            </button>
          ))}
        </section>

        <section>
          <TogglePill label="Gry dziś" icon={<CalendarCheck className="h-3.5 w-3.5 shrink-0" />}
            active={draftOnlyGamesToday} onClick={() => setDraftOnlyGamesToday((v) => !v)} />
        </section>

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

  /* Geometria pola (zaokrąglenie, wcięcia, pozycja lupki) CELOWO taka sama
     jak w `EventsListView` — komponent, który do 2026-08-23 stał pod „Szukaj"
     na dolnej nawigacji, zanim scaliła się z tą trasą (patrz komentarz przy
     `MapaPage`/`BottomNav`). Różni się tylko tło: tutaj białe z cieniem, bo
     pole leży NA mapie i musi się od niej odciąć.

     Tekst podpowiedzi jest krótki, bo długi się ucinał w połowie słowa
     („Szukaj boiska po nazwie lub a…") — czyli mówił mniej niż krótszy, który
     się mieści. */
  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={showGames ? 'Szukaj meczu' : 'Szukaj boiska'}
        placeholder={showGames ? 'Nazwa albo boisko' : 'Nazwa boiska albo adres'}
        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600"
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

      {/* ── Sidebar / lista ──────────────────────────────────────────
          Na desktopie widoczna zawsze (mapa dokłada się obok niej, wzorem
          Booking/Airbnb). Na mobile widoczna WYŁĄCZNIE w widoku „Lista" —
          w widoku „Mapa" mobile dostaje mapę na cały ekran plus jedną kartę
          wybranego obiektu (patrz niżej), bo przewijana lista NIE mieści się
          obok mapy na 360 px. */}
      <aside className={clsx(
        'flex-col overflow-hidden bg-[#FAF9F6]',
        widok === 'lista'
          ? 'flex w-full'
          : 'hidden md:flex md:w-[380px] md:shrink-0 md:border-r md:border-slate-100',
      )}>
        {/* Search + Filters. Wiersz tożsamości (dzwonek+awatar) dokłada się
            WYŁĄCZNIE na mobile: na desktopie ten sam zestaw pokazuje już
            Header, a tu byłby zdublowany. Na mobile ten pasek jest teraz
            jedynym miejscem, gdzie widok „Lista" pokazuje tożsamość — mapa ma
            swoją WŁASNĄ kopię niżej (nakładka nad canvasem), bo canvas nie
            może być rodzicem elementów DOM w tym samym miejscu co lista. */}
        <div className="px-3 pt-3 pb-3 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">{searchBox}</div>
            <div className="md:hidden"><MobileIdentityRow /></div>
          </div>
          <SearchToolbar
            showGames={showGames} onToggleShowGames={toggleShowGames}
            widok={widok} setWidok={setWidok}
            liczbaFiltrow={liczbaFiltrow} onOpenFilters={openSheet}
            wrap
          />
          {showGames && gamesGeoError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{gamesGeoError}</p>
          )}
        </div>

        {/* Licznik.

            `wKadrze`, nie `fields.length`: przy oddaleniu mapa pobiera SKUPISKA
            zamiast pojedynczych obiektów, więc `allFields` jest wtedy celowo
            puste (patrz efekt z `getExplorerClusters`). Licznik liczony z
            `fields` pokazywał w tej sytuacji „0 boisk" nad listą, choć w kadrze
            stoi ich kilka tysięcy — a mapa obok rysowała je poprawnie jako
            kółka z liczbami. `wKadrze` sumuje skupiska, a poza trybem skupisk
            jest po prostu równe `fields.length`. */}
        <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">
          {showGames
            ? `${gamesRows.length} ${plural(gamesRows.length, 'mecz', 'mecze', 'meczy')}`
            : `${wKadrze.toLocaleString('pl-PL')} ${boiskoSlowo(wKadrze)}`}
        </div>

        {/* Scrollable list */}
        {showGames ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {gamesRows.map(({ event, distance }) => (
              <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="cursor-pointer">
                <EventBrowseCard event={event} distance={distance} relation={statusFor(event)} isNew={jestNowe(event)} />
              </div>
            ))}
            {/* PUSTA LISTA GIER JEST TERAZ EKRANEM POWITALNYM, nie skrajnym
                przypadkiem: „Szukaj" wchodzi wprost tutaj, więc ktoś bez
                otwartych meczów w okolicy zobaczy to jako PIERWSZĄ rzecz
                w aplikacji. Samo „Brak meczów" byłoby wtedy ślepym końcem
                dokładnie w chwili największej ciekawości.
                Rozdzielamy dwie różne przyczyny pustki — własne filtry (do
                zdjęcia) kontra brak meczów w ogóle (nie ma czego zdejmować) —
                i w obu wypadkach dajemy wyjście dalej. */}
            {gamesRows.length === 0 && (
              <div className="pt-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {liczbaFiltrow > 0 ? 'Żaden mecz nie pasuje do filtrów' : 'Nie ma teraz otwartych meczów'}
                </p>
                <p className="mx-auto mt-1 max-w-[15rem] text-xs text-slate-400">
                  {liczbaFiltrow > 0
                    ? 'Poluzuj filtry albo zorganizuj własny mecz.'
                    : 'Zorganizuj własny — zajmie minutę i pokaże się tu innym.'}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <Link
                    href="/wydarzenia/nowe"
                    className="rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
                  >
                    Zorganizuj mecz
                  </Link>
                  <button
                    type="button"
                    onClick={toggleShowGames}
                    className="text-sm font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800"
                  >
                    Zobacz boiska w okolicy
                  </button>
                </div>
              </div>
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
                  backTo={() => budujPowrot(f.id)}
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
            {/* W TRYBIE SKUPISK LISTA JEST PUSTA Z ZAŁOŻENIA, nie z braku
                wyników. Warunek `(searchResults ?? allFields).length > 0`
                wykluczał dokładnie ten przypadek — `allFields` jest wtedy
                celowo puste — więc gałąź `trybSkupisk` poniżej nigdy się nie
                renderowała i zostawała goła lista pod napisem „0 boisk".

                „Przybliż" jest przyciskiem, nie zdaniem: w widoku „Lista" mapa
                jest schowana (`display: none`), więc rada „przybliż mapę" nie
                ma czego dotyczyć — nie ma czego chwycić palcem. Przycisk
                przybliża instancję Leafleta do progu, przy którym pobierają
                się pojedyncze obiekty, i lista wypełnia się bez wychodzenia
                z listy. */}
            {fields.length === 0 && trybSkupisk && (
              <PustaListaObiektow
                miasta={liczbyMiast ? miastaDoPokazania(liczbyMiast) : []}
                ladujeMiasta={liczbyMiast === null}
                ladujeBlisko={ladujeBlisko}
                bladGeo={bladGeoListy}
                naBliskoMnie={pokazBliskoMnie}
                naMiasto={pokazMiasto}
                naPrzyblizenie={() => {
                  if (!mapInstance) return;
                  // Celujemy w NAJWIĘKSZE skupisko, nie w środek kadru.
                  // Samo `setZoom` trzyma środek, a środek widoku całej Polski
                  // to pole pod Łodzią — przybliżenie kończyłoby się wtedy
                  // listą „0 boisk", czyli dokładnie tym, co ma naprawić.
                  const najwieksze = skupiska.reduce<Skupisko | null>(
                    (naj, s) => (naj && naj.ile >= s.ile ? naj : s), null);
                  if (najwieksze) mapInstance.setView([najwieksze.lat, najwieksze.lng], ZOOM_SKUPISK);
                  else mapInstance.setZoom(ZOOM_SKUPISK);
                }}
              />
            )}
            {fields.length === 0 && !trybSkupisk && (searchResults ?? allFields).length > 0 && (
              <p className="text-sm text-slate-400 text-center pt-8">Brak boisk dla tych filtrów</p>
            )}
          </div>
        )}
      </aside>

      {/* Modal filtrów — jeden na komponent, nie po jednym na FilterPills
          (sidebar desktopu i overlay mobile), żeby oba przyciski „Filtry"
          otwierały ten sam, współdzielony stan szkicu. */}
      {filtersModal}

      {/* ── Map area ─────────────────────────────────────────────────── */}
      {/* `hidden`, nie unmount: Leaflet trzyma tu kadr i przybliżenie w swojej
          WŁASNEJ instancji (nie w React state), więc odmontowanie zerowałoby
          widok do `POLSKA`/`POLSKA_ZOOM` przy każdym powrocie z listy.
          `invalidateSize()` niżej doprowadza canvas do stanu po powrocie z
          `display: none`, gdzie miał zerowy rozmiar. */}
      <div className={clsx('relative flex-1 min-w-0 min-h-0', widok === 'lista' && 'hidden')}>
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
        <LocateMeButton map={mapInstance} className="absolute right-3 bottom-28 md:bottom-6 z-[600]" />

        {/* Mobile: search + filter overlay. Zalogowany dostaje tu też
            dzwonek+awatar — Header chowa dla niego swój pasek na tej trasie
            (patrz Header.tsx#hideMobileBarForUser), więc tożsamość musi mieć
            gdzie się pokazać. MobileIdentityRow sam zwraca null dla
            wylogowanego, więc wiersz wygląda dziś tak samo jak wcześniej. */}
        {/* `px-4 pt-5` — identycznie jak wiersz szukania w „Znajdź grę"
            (`EventsListView`). Wcześniej było `px-3 pt-3`, czyli pole skakało
            o 8 px w pionie i 4 px w bok przy każdym przejściu między
            zakładkami. */}
        <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-[600] px-4 pt-5 space-y-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="min-w-0 flex-1">{searchBox}</div>
            <MobileIdentityRow />
          </div>
          <div className="pointer-events-auto">
            <SearchToolbar
              showGames={showGames} onToggleShowGames={toggleShowGames}
              widok={widok} setWidok={setWidok}
              liczbaFiltrow={liczbaFiltrow} onOpenFilters={openSheet}
            />
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

            Karta jednego obiektu odpowiada na pytanie, które człowiek ma
            NA MAPIE naprawdę: „co to za boisko?" — dotyczy wyłącznie widoku
            „Mapa" (`widok === 'mapa'`). Przeglądanie listą ma dziś WŁASNY,
            pełnoekranowy widok na telefonie (przełącznik „Lista | Mapa" w
            pasku wyżej), nie jest już wyłącznością desktopu.

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
                backTo={() => budujPowrot(selectedField.id)}
              />
            </div>
          </div>
        )}

        {/* Tryb gier: ta sama dolna karta, treść EventBrowseCard zamiast VenueCard. */}
        {selectedEventRow && showGames && (
          <div
            className="md:hidden fixed inset-x-0 bottom-0 z-[1001] px-3"
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
            {...gamesCardSwipe}
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
          <div
            className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-3"
            // Nad paskiem nawigacji, nie pod nim: `absolute bottom-6` mierzyło
            // od dołu kontenera mapy (`h-[100dvh]`), czyli od dołu ekranu —
            // dokładnie tam, gdzie stoi pasek `z-[1200]`, który to przykrywał.
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
              Brak boisk dla tych filtrów
            </div>
          </div>
        )}

        {showGames && gamesRows.length === 0 && (
          <div
            className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-3"
            // Nad paskiem nawigacji, nie pod nim: `absolute bottom-6` mierzyło
            // od dołu kontenera mapy (`h-[100dvh]`), czyli od dołu ekranu —
            // dokładnie tam, gdzie stoi pasek `z-[1200]`, który to przykrywał.
            style={{ paddingBottom: 'calc(var(--bottom-nav-h) + 1.25rem)' }}
          >
            <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
              Brak meczów dla tych filtrów
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
