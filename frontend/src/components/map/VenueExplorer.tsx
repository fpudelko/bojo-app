'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, Navigation, Check } from 'lucide-react';
import type { Field, EventItem } from '@/types';
import { getFields } from '@/lib/api';
import { getPublicEvents } from '@/lib/events';
import { getCurrentLocation } from '@/lib/geo';
import { venueThumbnail } from '@/lib/labels';
import { slugify } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import { POZNAN, fieldPin } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type DateRange = 'week' | 'today' | 'weekend';
type SelSource = 'map' | 'scroll' | 'init';

const SPORT_OPTIONS = [
  { value: '', label: 'Wszystkie sporty', emoji: '🏟️' },
  { value: 'piłka nożna', label: 'Piłka nożna', emoji: '⚽' },
  { value: 'siatkówka plażowa', label: 'Siatkówka plażowa', emoji: '🏖️' },
  { value: 'siatkówka', label: 'Siatkówka', emoji: '🏐' },
  { value: 'koszykówka', label: 'Koszykówka', emoji: '🏀' },
];

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'week', label: 'Ten tydzień' },
  { value: 'today', label: 'Dziś' },
  { value: 'weekend', label: 'Ten weekend' },
];

const DATE_SUFFIX: Record<DateRange, string> = {
  week: 'w tym tygodniu',
  today: 'dziś',
  weekend: 'w ten weekend',
};

// Polish plural for "gra / gry / gier"
function gamesWord(n: number): string {
  if (n === 1) return 'gra';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'gry';
  return 'gier';
}

// ---------------------------------------------------------------------------
// Map layer — markers + programmatic panning (lives inside MapContainer)
// ---------------------------------------------------------------------------
function MapLayer({
  fields,
  selectedId,
  onSelect,
}: {
  fields: Field[];
  selectedId: string | null;
  onSelect: (id: string, source: SelSource) => void;
}) {
  const map = useMap();
  const markersRef = useRef<Record<string, L.Marker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // (Re)build markers whenever the field set changes
  useEffect(() => {
    const layer = L.layerGroup();
    const markers: Record<string, L.Marker> = {};
    for (const f of fields) {
      const m = L.marker([f.lat, f.lng], { icon: fieldPin(f, f.id === selectedId) });
      m.on('click', () => onSelectRef.current(f.id, 'map'));
      markers[f.id] = m;
      layer.addLayer(m);
    }
    markersRef.current = markers;
    layer.addTo(map);
    return () => {
      layer.remove();
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, map]);

  // Update which marker looks selected
  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      const f = fields.find((x) => x.id === id);
      if (f) m.setIcon(fieldPin(f, id === selectedId));
    }
  }, [selectedId, fields]);

  // Pan to the selected venue (whatever triggered the selection)
  useEffect(() => {
    if (!selectedId) return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f) return;
    map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 14), { duration: 0.55 });
  }, [selectedId, fields, map]);

  return null;
}

// ---------------------------------------------------------------------------
// Filter pill with dropdown
// ---------------------------------------------------------------------------
function PillDropdown({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors',
          active ? 'border-primary-300 text-primary-700' : 'border-slate-200 text-ink',
        ].join(' ')}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[1200] mt-2 min-w-[200px] overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venue card (carousel item)
// ---------------------------------------------------------------------------
function VenueCard({
  field,
  games,
  dateRange,
}: {
  field: Field;
  games: number;
  dateRange: DateRange;
}) {
  const thumb = field.imageUrl || venueThumbnail(field.lat, field.lng, 320, 320, 16);
  const slug = slugify(field.name);

  return (
    <div className="flex h-full w-full gap-3.5 rounded-3xl bg-white p-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.25)]">
      <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-2xl bg-slate-100">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-display text-lg font-bold leading-tight text-primary-700 line-clamp-2">
          {field.name}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <span className="text-slate-400">👥</span>
          {games > 0
            ? `${games} ${gamesWord(games)} ${DATE_SUFFIX[dateRange]}`
            : `Brak gier ${DATE_SUFFIX[dateRange]}`}
        </p>
        <Link
          href={`/boisko/${slug}`}
          className="mt-auto flex items-center justify-between gap-2 rounded-2xl bg-primary-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
        >
          Zobacz boisko
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main explorer
// ---------------------------------------------------------------------------
export default function VenueExplorer({
  initialFields,
  initialEvents,
}: {
  initialFields?: Field[];
  initialEvents?: EventItem[];
} = {}) {
  const [allFields, setAllFields] = useState<Field[]>(initialFields ?? []);
  const [events, setEvents] = useState<EventItem[]>(initialEvents ?? []);
  const [sport, setSport] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [selected, setSelected] = useState<{ id: string | null; source: SelSource }>({
    id: null,
    source: 'init',
  });
  const selectedId = selected.id;

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const onSelect = useCallback((id: string, source: SelSource) => {
    setSelected({ id, source });
  }, []);

  // Fetch fields + events once (skipped when seeded with initial data, e.g. previews)
  useEffect(() => {
    if (initialFields || initialEvents) return;
    let cancelled = false;
    getFields({})
      .then((res) => {
        if (cancelled) return;
        setAllFields(res.fields.filter((f) => f.mapVisibility !== 'hidden'));
      })
      .catch(() => {});
    getPublicEvents()
      .then((evs) => {
        if (!cancelled) setEvents(evs.filter((e) => e.status !== 'cancelled'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Game counts per field id, within the selected date range
  const gameCounts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const inRange = (dateStr: string): boolean => {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      if (dateRange === 'today') return d.getTime() === now.getTime();
      if (dateRange === 'weekend') {
        const day = now.getDay();
        const sat = new Date(now);
        sat.setDate(now.getDate() + ((6 - day + 7) % 7));
        const sun = new Date(sat);
        sun.setDate(sat.getDate() + 1);
        return d.getTime() === sat.getTime() || d.getTime() === sun.getTime();
      }
      // this week — next 7 days inclusive
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      return d.getTime() >= now.getTime() && d.getTime() <= weekEnd.getTime();
    };
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (!e.fieldId || !inRange(e.date)) continue;
      counts[e.fieldId] = (counts[e.fieldId] ?? 0) + 1;
    }
    return counts;
  }, [events, dateRange]);

  // Filtered + sorted field list shown on map & carousel
  const fields = useMemo(() => {
    let list = allFields;
    if (sport) list = list.filter((f) => f.sport.includes(sport));
    if (geo) {
      const dist = (f: Field) =>
        (f.lat - geo.lat) ** 2 + (f.lng - geo.lng) ** 2;
      list = [...list].sort((a, b) => dist(a) - dist(b));
    } else {
      // Venues with games first, so the carousel opens on something lively
      list = [...list].sort(
        (a, b) => (gameCounts[b.id] ?? 0) - (gameCounts[a.id] ?? 0),
      );
    }
    return list;
  }, [allFields, sport, geo, gameCounts]);

  // Select the first venue once the list is ready / filters change
  useEffect(() => {
    if (fields.length === 0) return;
    if (!selectedIdRef.current || !fields.some((f) => f.id === selectedIdRef.current)) {
      setSelected({ id: fields[0].id, source: 'init' });
    }
  }, [fields]);

  // When selection comes from the map (or init), scroll the carousel to it
  useEffect(() => {
    if (!selectedId || selected.source === 'scroll') return;
    const el = cardRefs.current[selectedId];
    const c = scrollRef.current;
    if (el && c) {
      c.scrollTo({
        left: el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [selectedId, selected.source]);

  // Detect the centered card as the user scrolls the carousel
  const rafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const c = scrollRef.current;
      if (!c) return;
      const center = c.scrollLeft + c.clientWidth / 2;
      let best: string | null = null;
      let bestDist = Infinity;
      for (const [id, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(cardCenter - center);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
      if (best && best !== selectedIdRef.current) onSelect(best, 'scroll');
    });
  }, [onSelect]);

  async function handleGeo() {
    if (geo) {
      setGeo(null);
      return;
    }
    setGeoLoading(true);
    const res = await getCurrentLocation();
    setGeoLoading(false);
    if (res.ok) setGeo({ lat: res.lat, lng: res.lng });
  }

  const sportLabel = SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? 'Wszystkie sporty';
  const dateLabel = DATE_OPTIONS.find((o) => o.value === dateRange)?.label ?? 'Ten tydzień';

  const street = MAPBOX_TOKEN ? (
    <TileLayer
      attribution='&copy; Mapbox &copy; OpenStreetMap'
      url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512}
      zoomOffset={-1}
    />
  ) : (
    <TileLayer
      attribution='&copy; OpenStreetMap'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <MapContainer
        center={POZNAN}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {street}
        <MapLayer fields={fields} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>

      {/* Floating filter pills */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PillDropdown label={sportLabel} active={!!sport}>
            {(close) => (
              <>
                {SPORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      setSport(o.value);
                      close();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50"
                  >
                    <span className="text-base">{o.emoji}</span>
                    <span className="flex-1 text-left">{o.label}</span>
                    {sport === o.value && <Check className="h-4 w-4 text-primary-700" />}
                  </button>
                ))}
              </>
            )}
          </PillDropdown>

          <PillDropdown label={dateLabel} active={dateRange !== 'week'}>
            {(close) => (
              <>
                {DATE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      setDateRange(o.value);
                      close();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-slate-50"
                  >
                    <span className="flex-1 text-left">{o.label}</span>
                    {dateRange === o.value && <Check className="h-4 w-4 text-primary-700" />}
                  </button>
                ))}
              </>
            )}
          </PillDropdown>

          <button
            onClick={handleGeo}
            className={[
              'inline-flex shrink-0 items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors',
              geo ? 'border-primary-300 text-primary-700' : 'border-slate-200 text-ink',
            ].join(' ')}
          >
            <Navigation className={`h-3.5 w-3.5 ${geoLoading ? 'animate-pulse' : ''}`} />
            Blisko mnie
          </button>
        </div>
      </div>

      {/* Bottom carousel */}
      {fields.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[1100] pb-4">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {fields.map((f) => (
              <div
                key={f.id}
                ref={(el) => {
                  cardRefs.current[f.id] = el;
                }}
                onClick={() => onSelect(f.id, 'map')}
                className="h-[140px] w-[min(85vw,360px)] shrink-0 snap-center"
              >
                <VenueCard field={f} games={gameCounts[f.id] ?? 0} dateRange={dateRange} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
