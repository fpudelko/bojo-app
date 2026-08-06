'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { ChevronDown, Check, CalendarCheck, MapPin, Globe, Search, X } from 'lucide-react';
import type { Field, EventItem } from '@/types';
import { getExplorerFields } from '@/lib/api';
import { getPublicEvents } from '@/lib/events';
import { fieldPhotoUrl, surfaceLabel } from '@/lib/labels';
import { slugify, externalUrl } from '@/lib/utils';
import { POLSKA, POLSKA_ZOOM, fieldPin, clusterDivIcon } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

const SPORT_OPTIONS = [
  { value: 'piłka nożna',       label: 'Piłka nożna',         emoji: '⚽' },
  { value: 'siatkówka plażowa', label: 'Siatkówka plażowa',    emoji: '🏖️' },
  { value: 'siatkówka',         label: 'Siatkówka',            emoji: '🏐' },
  { value: 'koszykówka',        label: 'Koszykówka',           emoji: '🏀' },
];

/** Label for a multi-select pill: "Wszystkie X" / single label / "N wybrane". */
function multiLabel(selected: string[], allLabel: string, options: { value: string; label: string }[]): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? allLabel;
  return `${selected.length} wybrane`;
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
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
// PillDropdown — portal escapes overflow-x-auto clipping
// ---------------------------------------------------------------------------
function PillDropdown({ label, active, children }: {
  label: string; active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="shrink-0">
      <button ref={btnRef} onClick={toggle}
        className={[
          'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
          active ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 text-ink',
        ].join(' ')}
      >
        {label}<ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && mounted && createPortal(
        <div ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[200px] max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function TogglePill({ label, icon, active, loading, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; loading?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
        active ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-ink',
      ].join(' ')}
    >
      <span className={loading ? 'animate-pulse' : ''}>{icon}</span>{label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------
function VenueCard({ field, games, hasGameToday, selected }: {
  field: Field; games: number; hasGameToday: boolean; selected?: boolean;
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
          href={`/boisko/${slug}`}
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
  sports, setSports, venueTypes, setVenueTypes,
  onlyGamesToday, setOnlyGamesToday,
  wrap,
}: {
  sports: string[]; setSports: (v: string[]) => void;
  venueTypes: string[]; setVenueTypes: (v: string[]) => void;
  onlyGamesToday: boolean; setOnlyGamesToday: (v: boolean) => void;
  wrap?: boolean;
}) {
  const sportLabel = multiLabel(sports, 'Wszystkie sporty', SPORT_OPTIONS);
  const typeLabel  = multiLabel(venueTypes, 'Wszystkie typy', VENUE_TYPE_OPTIONS);

  return (
    <div className={wrap
      ? 'flex flex-wrap gap-2'
      : 'flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    }>
      <PillDropdown label={sportLabel} active={sports.length > 0}>
        {() => (
          <>
            <button onClick={() => setSports([])}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50 border-b border-slate-50">
              <span className="text-base">🏟️</span>
              <span className="flex-1 text-left">Wszystkie sporty</span>
              {sports.length === 0 && <Check className="h-4 w-4 text-primary-700" />}
            </button>
            {SPORT_OPTIONS.map((o) => (
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

      <PillDropdown label={typeLabel} active={venueTypes.length > 0}>
        {() => (
          <>
            <button onClick={() => setVenueTypes([])}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50 border-b border-slate-50">
              <span className="flex-1 text-left">Wszystkie typy</span>
              {venueTypes.length === 0 && <Check className="h-4 w-4 text-primary-700" />}
            </button>
            {VENUE_TYPE_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setVenueTypes(toggleInArray(venueTypes, o.value))}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50">
                <span className="flex-1 text-left">{o.label}</span>
                {venueTypes.includes(o.value) && <Check className="h-4 w-4 text-primary-700" />}
              </button>
            ))}
          </>
        )}
      </PillDropdown>

      <TogglePill label="Gry dziś" icon={<CalendarCheck className="h-3.5 w-3.5 shrink-0" />}
        active={onlyGamesToday} onClick={() => setOnlyGamesToday(!onlyGamesToday)} />
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

  const [allFields, setAllFields] = useState<Field[]>(initialFields ?? []);
  const [events,    setEvents]    = useState<EventItem[]>(initialEvents ?? []);
  const [search,    setSearch]    = useState('');
  // Render only a window of cards to keep the list/carousel snappy (~1400 venues).
  const PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Filters live in the URL so they survive back-navigation
  const sports         = useMemo(() => searchParams.getAll('sport'), [searchParams]);
  const venueTypes     = useMemo(() => searchParams.getAll('type'), [searchParams]);
  const onlyGamesToday = searchParams.get('today') === '1';
  // Wejście z konkretnym obiektem: `/mapa?boisko=<id>`. Używa go przycisk
  // „Zobacz na mapie" na stronie boiska — mapa ma wtedy otworzyć się na tym
  // obiekcie z jego kartą, zamiast na widoku całego kraju.
  const boiskoZLinku = searchParams.get('boisko');

  function updateParams(patch: { sport?: string[]; type?: string[]; today?: boolean }) {
    const p = new URLSearchParams(searchParams.toString());
    if (patch.sport !== undefined) {
      p.delete('sport');
      patch.sport.forEach((s) => p.append('sport', s));
    }
    if (patch.type !== undefined) {
      p.delete('type');
      patch.type.forEach((t) => p.append('type', t));
    }
    if (patch.today !== undefined) {
      if (patch.today) p.set('today', '1'); else p.delete('today');
    }
    router.replace(`/mapa?${p.toString()}`, { scroll: false });
  }

  const setSports        = (v: string[]) => updateParams({ sport: v });
  const setVenueTypes    = (v: string[]) => updateParams({ type: v });
  const setOnlyGamesToday = (v: boolean) => updateParams({ today: v });

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

  useEffect(() => {
    if (initialFields || initialEvents) return;
    let cancelled = false;
    // Filtering (powiat bbox, relevant sport, "has info", not hidden) happens
    // server-side now — only the venues we'd show are transferred.
    getExplorerFields()
      .then((fields) => { if (!cancelled) setAllFields(fields); })
      .catch(() => {});
    getPublicEvents()
      .then((evs) => { if (!cancelled) setEvents(evs.filter((e) => e.status !== 'cancelled')); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    let list = allFields;
    if (sports.length > 0)     list = list.filter((f) => f.sport.some((s) => sports.includes(s)));
    if (venueTypes.length > 0) list = list.filter((f) => venueTypes.includes(f.venueType ?? ''));
    if (onlyGamesToday) list = list.filter((f) => fieldStats[f.id]?.today);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q));
    list = [...list].sort((a, b) => mortonKey(a.lat, a.lng) - mortonKey(b.lat, b.lng));
    return list;
  }, [allFields, sports, venueTypes, onlyGamesToday, fieldStats, search]);

  // Reset the render window whenever the result set changes (new search/filter).
  useEffect(() => { setVisibleCount(PAGE); }, [sports, venueTypes, onlyGamesToday, search]);

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

  const filterProps = {
    sports, setSports, venueTypes, setVenueTypes,
    onlyGamesToday, setOnlyGamesToday,
  };

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
        </div>

        {/* Venue count */}
        <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">
          {fields.length} {fields.length === 1 ? 'boisko' : fields.length < 5 ? 'boiska' : 'boisk'}
        </div>

        {/* Scrollable list */}
        <div ref={sidebarRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {visibleFields.map((f) => (
            <div
              key={f.id}
              ref={(el) => { sidebarCardRefs.current[f.id] = el; }}
              onClick={() => onSelect(f.id, 'map')}
              className="cursor-pointer"
            >
              <VenueCard
                field={f}
                games={fieldStats[f.id]?.count ?? 0}
                hasGameToday={fieldStats[f.id]?.today ?? false}
                selected={f.id === selectedId}
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
          {fields.length === 0 && allFields.length > 0 && (
            <p className="text-sm text-slate-400 text-center pt-8">Brak boisk dla tych filtrów</p>
          )}
        </div>
      </aside>

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
          <MapLayer fields={fields} selectedId={selectedId} selectedSource={selectedSource} onSelect={onSelect} />
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

        {/* Mobile: search + filter overlay */}
        <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-[600] px-3 pt-3 space-y-2">
          <div className="pointer-events-auto">{searchBox}</div>
          <div className="pointer-events-auto">
            <FilterPills {...filterProps} />
          </div>
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

            Dolne dopełnienie ustępuje nawigacji: strona mapy jest h-screen
            i overflow-hidden, więc dystans (h-16) z BottomNav nie działa —
            pasek (fixed, z-1000) po prostu kładzie się na karcie. */}
        {selectedField && (
          <div
            // `fixed`, nie `absolute`: dolna nawigacja też jest `fixed`, więc
            // tylko tak obie rzeczy mierzą od tej samej krawędzi. Przy
            // `absolute` karta trzymała się dołu kontenera mapy, który po
            // zwinięciu paska przeglądarki nie pokrywa się z dołem ekranu.
            className="md:hidden fixed inset-x-0 bottom-0 z-[1001] px-3"
            // 4rem to wysokość dolnej nawigacji, 1.25rem to odstęp — bez niego
            // karta ociera się o pasek i wygląda, jakby spod niego wystawała.
            style={{ paddingBottom: 'calc(4rem + 1.25rem + env(safe-area-inset-bottom))' }}
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
                field={selectedField}
                games={fieldStats[selectedField.id]?.count ?? 0}
                hasGameToday={fieldStats[selectedField.id]?.today ?? false}
              />
            </div>
          </div>
        )}

        {/* Podpowiedź, dopóki nic nie wybrano — bez niej dolna część mapy jest
            pusta i nie wiadomo, że pinezki są klikalne. */}
        {!selectedField && fields.length > 0 && (
          <div
            className="md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-3"
            // 4rem to wysokość dolnej nawigacji, 1.25rem to odstęp — bez niego
            // karta ociera się o pasek i wygląda, jakby spod niego wystawała.
            style={{ paddingBottom: 'calc(4rem + 1.25rem + env(safe-area-inset-bottom))' }}
          >
            <p className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-slate-500 shadow-md">
              Dotknij pinezki, żeby zobaczyć boisko
            </p>
          </div>
        )}

        {fields.length === 0 && allFields.length > 0 && (
          <div className="md:hidden absolute inset-x-0 bottom-6 z-[1100] flex justify-center">
            <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
              Brak boisk dla tych filtrów
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
