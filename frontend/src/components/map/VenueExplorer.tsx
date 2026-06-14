'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import MapAttribution from './MapAttribution';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { ChevronDown, Check, CalendarCheck, MapPin, Globe } from 'lucide-react';
import type { Field, EventItem } from '@/types';
import { getFields } from '@/lib/api';
import { getPublicEvents } from '@/lib/events';
import { fieldPhotoUrl, surfaceLabel } from '@/lib/labels';
import { slugify, externalUrl } from '@/lib/utils';
import { POZNAN, fieldPin, clusterDivIcon } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type SelSource = 'map' | 'scroll' | 'init';

const POWIAT_BOUNDS = { latMin: 52.05, latMax: 52.70, lngMin: 16.55, lngMax: 17.35 };
function inPowiat(lat: number, lng: number) {
  return lat >= POWIAT_BOUNDS.latMin && lat <= POWIAT_BOUNDS.latMax
      && lng >= POWIAT_BOUNDS.lngMin && lng <= POWIAT_BOUNDS.lngMax;
}

function hasUsefulInfo(f: Field) {
  return !!(f.phone || f.website || f.email || f.description || f.bookingEnabled || f.imageUrl);
}

// Only show venues built for the team sports BOJO supports — keeps gyms,
// tennis-only courts, karting tracks and other noise off the discovery map.
const RELEVANT_SPORTS = new Set([
  'piłka nożna', 'futsal', 'siatkówka', 'siatkówka plażowa', 'koszykówka', 'piłka ręczna',
]);
function isRelevantVenue(f: Field) {
  return f.sport.some((s) => RELEVANT_SPORTS.has(s));
}

function displayName(name: string): string {
  return name.replace(/^boisko\s*[-–—]\s*/i, '').trim() || name;
}

function mortonKey(lat: number, lng: number): number {
  const x = Math.max(0, Math.round((lng - 16.5) * 1000)) & 0xffff;
  const y = Math.max(0, Math.round((lat - 52.0) * 1000)) & 0xffff;
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
  const markersRef = useRef<Record<string, L.Marker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 22,
      iconCreateFunction: (c) => {
        const ms = c.getAllChildMarkers() as Array<L.Marker & { _sports?: string[] }>;
        return clusterDivIcon(c.getChildCount(), ms.flatMap((m) => m._sports ?? []));
      },
      spiderfyOnMaxZoom: true, disableClusteringAtZoom: 13, animate: true,
    });
    const markers: Record<string, L.Marker> = {};
    for (const f of fields) {
      const m = L.marker([f.lat, f.lng], { icon: fieldPin(f, f.id === selectedId) }) as L.Marker & { _sports?: string[] };
      m._sports = f.sport;
      m.on('click', () => onSelectRef.current(f.id, 'map'));
      markers[f.id] = m;
      cluster.addLayer(m);
    }
    markersRef.current = markers;
    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); markersRef.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, map]);

  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      const f = fields.find((x) => x.id === id);
      if (f) m.setIcon(fieldPin(f, id === selectedId));
    }
  }, [selectedId, fields]);

  useEffect(() => {
    if (!selectedId) return;
    // On first load ('init') keep the wide powiat view — don't zoom to a venue.
    if (selectedSource === 'init') return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f) return;
    map.stop();
    if (selectedSource === 'scroll') {
      map.panTo([f.lat, f.lng], { animate: true, duration: 0.3 });
    } else {
      map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 14), { duration: 0.45 });
    }
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
    <div className={[
      'flex h-full w-full gap-3.5 rounded-3xl bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)] transition-shadow',
      selected ? 'ring-2 ring-primary-700' : '',
    ].join(' ')}>
      <div className="relative h-full w-[100px] shrink-0 overflow-hidden rounded-2xl bg-slate-100">
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
  const [allFields, setAllFields] = useState<Field[]>(initialFields ?? []);
  const [events,    setEvents]    = useState<EventItem[]>(initialEvents ?? []);

  const [sports,         setSports]        = useState<string[]>([]);
  const [venueTypes,     setVenueTypes]    = useState<string[]>([]);
  const [onlyGamesToday, setOnlyGamesToday] = useState(false);

  const [selected, setSelected] = useState<{ id: string | null; source: SelSource }>({ id: null, source: 'init' });
  const selectedId     = selected.id;
  const selectedSource = selected.source;

  // Mobile carousel
  const scrollRef    = useRef<HTMLDivElement>(null);
  const cardRefs     = useRef<Record<string, HTMLDivElement | null>>({});
  // Desktop sidebar
  const sidebarRef      = useRef<HTMLDivElement>(null);
  const sidebarCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelect = useCallback((id: string, source: SelSource) => {
    setSelected({ id, source });
  }, []);

  useEffect(() => {
    if (initialFields || initialEvents) return;
    let cancelled = false;
    getFields({})
      .then((res) => {
        if (cancelled) return;
        setAllFields(res.fields.filter(
          (f) => f.mapVisibility !== 'hidden' && inPowiat(f.lat, f.lng) && hasUsefulInfo(f) && isRelevantVenue(f),
        ));
      })
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
    list = [...list].sort((a, b) => mortonKey(a.lat, a.lng) - mortonKey(b.lat, b.lng));
    return list;
  }, [allFields, sports, venueTypes, onlyGamesToday, fieldStats]);

  // Clean up stale card refs
  useEffect(() => {
    const ids = new Set(fields.map((f) => f.id));
    for (const id of Object.keys(cardRefs.current))     { if (!ids.has(id)) delete cardRefs.current[id]; }
    for (const id of Object.keys(sidebarCardRefs.current)) { if (!ids.has(id)) delete sidebarCardRefs.current[id]; }
  }, [fields]);

  // Auto-select first field
  useEffect(() => {
    if (fields.length === 0) return;
    if (!selectedIdRef.current || !fields.some((f) => f.id === selectedIdRef.current)) {
      setSelected({ id: fields[0].id, source: 'init' });
    }
  }, [fields]);

  // Scroll mobile carousel to selected
  useEffect(() => {
    if (!selectedId || selected.source === 'scroll') return;
    const el = cardRefs.current[selectedId];
    const c  = scrollRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [selectedId, selected.source]);

  // Scroll desktop sidebar to selected
  useEffect(() => {
    if (!selectedId) return;
    const el = sidebarCardRefs.current[selectedId];
    const c  = sidebarRef.current;
    if (!el || !c) return;
    const targetTop = el.offsetTop - (c.clientHeight - el.offsetHeight) / 2;
    c.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [selectedId]);

  const handleScroll = useCallback(() => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const c = scrollRef.current;
      if (!c) return;
      const viewCenter = c.scrollLeft + c.clientWidth / 2;
      let best: string | null = null; let bestDist = Infinity;
      for (const [id, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - viewCenter);
        if (d < bestDist) { bestDist = d; best = id; }
      }
      if (best && best !== selectedIdRef.current) onSelect(best, 'scroll');
    }, 100);
  }, [onSelect]);

  const filterProps = {
    sports, setSports, venueTypes, setVenueTypes,
    onlyGamesToday, setOnlyGamesToday,
  };

  const CARD_W = 'min(85vw, 360px)';

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
        {/* Filters */}
        <div className="px-3 pt-3 pb-3 border-b border-slate-100">
          <FilterPills {...filterProps} wrap />
        </div>

        {/* Venue count */}
        <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">
          {fields.length} {fields.length === 1 ? 'boisko' : fields.length < 5 ? 'boiska' : 'boisk'}
        </div>

        {/* Scrollable list */}
        <div ref={sidebarRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {fields.map((f) => (
            <div
              key={f.id}
              ref={(el) => { sidebarCardRefs.current[f.id] = el; }}
              onClick={() => onSelect(f.id, 'map')}
              className="h-[160px] cursor-pointer"
            >
              <VenueCard
                field={f}
                games={fieldStats[f.id]?.count ?? 0}
                hasGameToday={fieldStats[f.id]?.today ?? false}
                selected={f.id === selectedId}
              />
            </div>
          ))}
          {fields.length === 0 && allFields.length > 0 && (
            <p className="text-sm text-slate-400 text-center pt-8">Brak boisk dla tych filtrów</p>
          )}
        </div>
      </aside>

      {/* ── Map area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-w-0 min-h-0">
        <MapContainer center={POZNAN} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <MapAttribution />
          {street}
          <MapLayer fields={fields} selectedId={selectedId} selectedSource={selectedSource} onSelect={onSelect} />
        </MapContainer>

        {/* Mobile: filter overlay */}
        <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-[600] px-3 pt-3">
          <div className="pointer-events-auto">
            <FilterPills {...filterProps} />
          </div>
        </div>

        {/* Mobile: carousel */}
        {fields.length > 0 && (
          <div className="md:hidden absolute inset-x-0 bottom-0 z-[600] pb-4">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                scrollPaddingLeft:  `calc((100% - ${CARD_W}) / 2)`,
                scrollPaddingRight: `calc((100% - ${CARD_W}) / 2)`,
              }}
              className="flex snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="shrink-0" style={{ width: `calc((100% - ${CARD_W}) / 2)` }} />
              {fields.map((f) => (
                <div
                  key={f.id}
                  ref={(el) => { cardRefs.current[f.id] = el; }}
                  onClick={() => onSelect(f.id, 'map')}
                  style={{ width: CARD_W }}
                  className="shrink-0 snap-center px-1.5 h-[160px] cursor-pointer"
                >
                  <VenueCard
                    field={f}
                    games={fieldStats[f.id]?.count ?? 0}
                    hasGameToday={fieldStats[f.id]?.today ?? false}
                  />
                </div>
              ))}
              <div className="shrink-0" style={{ width: `calc((100% - ${CARD_W}) / 2)` }} />
            </div>
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
