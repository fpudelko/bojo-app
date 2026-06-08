'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, Navigation, Check, BookOpen, CircleDot } from 'lucide-react';
import type { Field, EventItem } from '@/types';
import { getFields } from '@/lib/api';
import { getPublicEvents } from '@/lib/events';
import { getCurrentLocation } from '@/lib/geo';
import { venueThumbnail } from '@/lib/labels';
import { slugify } from '@/lib/utils';
import { sportEmoji } from '@/lib/sports';
import { POZNAN, fieldPin } from './mapIcons';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type SelSource = 'map' | 'scroll' | 'init';

const SPORT_OPTIONS = [
  { value: '', label: 'Wszystkie sporty', emoji: '🏟️' },
  { value: 'piłka nożna', label: 'Piłka nożna', emoji: '⚽' },
  { value: 'siatkówka plażowa', label: 'Siatkówka plażowa', emoji: '🏖️' },
  { value: 'siatkówka', label: 'Siatkówka', emoji: '🏐' },
  { value: 'koszykówka', label: 'Koszykówka', emoji: '🏀' },
];

// Polish plural for "gra / gry / gier"
function gamesWord(n: number): string {
  if (n === 1) return 'gra';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'gry';
  return 'gier';
}

// ---------------------------------------------------------------------------
// MapLayer — markers + pan/fly on selection change
// lives inside <MapContainer> so it can call useMap()
// ---------------------------------------------------------------------------
function MapLayer({
  fields,
  selectedId,
  selectedSource,
  onSelect,
}: {
  fields: Field[];
  selectedId: string | null;
  selectedSource: SelSource;
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

  // Highlight the selected pin
  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      const f = fields.find((x) => x.id === id);
      if (f) m.setIcon(fieldPin(f, id === selectedId));
    }
  }, [selectedId, fields]);

  // Pan/fly on selection change — but only pan (no zoom) when triggered by carousel scroll
  useEffect(() => {
    if (!selectedId) return;
    const f = fields.find((x) => x.id === selectedId);
    if (!f) return;
    if (selectedSource === 'scroll') {
      map.panTo([f.lat, f.lng], { animate: true, duration: 0.35 });
    } else {
      map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
    }
  }, [selectedId, selectedSource, fields, map]);

  return null;
}

// ---------------------------------------------------------------------------
// PillDropdown
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
          'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
          active ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-slate-200 text-ink',
        ].join(' ')}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[1200] mt-2 min-w-[200px] overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// Toggle pill (for boolean filters)
function TogglePill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium shadow-md transition-colors whitespace-nowrap',
        active ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-ink',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------
function VenueCard({ field, games }: { field: Field; games: number }) {
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
          {games > 0 ? `${games} ${gamesWord(games)} w tym tygodniu` : 'Brak gier w tym tygodniu'}
        </p>
        {(field.bookingEnabled || field.available) && (
          <div className="mt-1 flex items-center gap-1.5">
            {field.bookingEnabled && (
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                Rezerwacja online
              </span>
            )}
            {field.available && (
              <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                Wolne
              </span>
            )}
          </div>
        )}
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

  // Filters
  const [sport, setSport] = useState('');
  const [onlyBookable, setOnlyBookable] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Selection: id + source so MapLayer knows how to animate
  const [selected, setSelected] = useState<{ id: string | null; source: SelSource }>({ id: null, source: 'init' });
  const selectedId = selected.id;
  const selectedSource = selected.source;

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelect = useCallback((id: string, source: SelSource) => {
    setSelected({ id, source });
  }, []);

  // Fetch fields + events once (skipped when seeded with initialFields/initialEvents)
  useEffect(() => {
    if (initialFields || initialEvents) return;
    let cancelled = false;
    getFields({})
      .then((res) => { if (!cancelled) setAllFields(res.fields.filter((f) => f.mapVisibility !== 'hidden')); })
      .catch(() => {});
    getPublicEvents()
      .then((evs) => { if (!cancelled) setEvents(evs.filter((e) => e.status !== 'cancelled')); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Game counts for the next 7 days per field
  const gameCounts = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
    const counts: Record<string, number> = {};
    for (const e of events) {
      if (!e.fieldId) continue;
      const d = new Date(e.date); d.setHours(0, 0, 0, 0);
      if (d >= now && d <= weekEnd) counts[e.fieldId] = (counts[e.fieldId] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  // Filtered + sorted field list
  const fields = useMemo(() => {
    let list = allFields;
    if (sport) list = list.filter((f) => f.sport.includes(sport));
    if (onlyBookable) list = list.filter((f) => f.bookingEnabled);
    if (onlyAvailable) list = list.filter((f) => f.available);
    if (geo) {
      const dist = (f: Field) => (f.lat - geo.lat) ** 2 + (f.lng - geo.lng) ** 2;
      list = [...list].sort((a, b) => dist(a) - dist(b));
    } else {
      // Most active venues first
      list = [...list].sort((a, b) => (gameCounts[b.id] ?? 0) - (gameCounts[a.id] ?? 0));
    }
    return list;
  }, [allFields, sport, onlyBookable, onlyAvailable, geo, gameCounts]);

  // Clean up stale card refs when the filtered list changes
  useEffect(() => {
    const currentIds = new Set(fields.map((f) => f.id));
    for (const id of Object.keys(cardRefs.current)) {
      if (!currentIds.has(id)) delete cardRefs.current[id];
    }
  }, [fields]);

  // When the filtered list changes, if selected id is no longer in it, jump to first
  useEffect(() => {
    if (fields.length === 0) return;
    if (!selectedIdRef.current || !fields.some((f) => f.id === selectedIdRef.current)) {
      setSelected({ id: fields[0].id, source: 'init' });
    }
  }, [fields]);

  // When selection comes from map click or init, scroll the carousel to center that card
  useEffect(() => {
    if (!selectedId || selected.source === 'scroll') return;
    const el = cardRefs.current[selectedId];
    const c = scrollRef.current;
    if (!el || !c) return;
    // Use scrollTo so snap doesn't fight — align the card's center with the container's center
    c.scrollTo({ left: el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [selectedId, selected.source]);

  // Scroll handler: debounce → detect centered card → pan map (don't flyTo from scroll)
  const handleScroll = useCallback(() => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const c = scrollRef.current;
      if (!c) return;
      const viewCenter = c.scrollLeft + c.clientWidth / 2;
      let best: string | null = null;
      let bestDist = Infinity;
      for (const [id, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(cardCenter - viewCenter);
        if (d < bestDist) { bestDist = d; best = id; }
      }
      if (best && best !== selectedIdRef.current) onSelect(best, 'scroll');
    }, 100);
  }, [onSelect]);

  async function handleGeo() {
    if (geo) { setGeo(null); return; }
    setGeoLoading(true);
    const res = await getCurrentLocation();
    setGeoLoading(false);
    if (res.ok) setGeo({ lat: res.lat, lng: res.lng });
  }

  const sportLabel = SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? 'Wszystkie sporty';

  const street = MAPBOX_TOKEN ? (
    <TileLayer
      attribution='&copy; Mapbox &copy; OpenStreetMap'
      url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`}
      tileSize={512} zoomOffset={-1}
    />
  ) : (
    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  );

  // Card width used for scroll-padding so first/last cards center correctly
  const CARD_W = 'min(85vw, 360px)';

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <MapContainer center={POZNAN} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        {street}
        <MapLayer
          fields={fields}
          selectedId={selectedId}
          selectedSource={selectedSource}
          onSelect={onSelect}
        />
      </MapContainer>

      {/* Floating filter pills */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Sport */}
          <PillDropdown label={sportLabel} active={!!sport}>
            {(close) => (
              <>
                {SPORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSport(o.value); close(); }}
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

          {/* Rezerwacja online */}
          <TogglePill
            label="Rezerwacja"
            icon={<BookOpen className={`h-3.5 w-3.5 shrink-0 ${onlyBookable ? 'text-white' : 'text-blue-500'}`} />}
            active={onlyBookable}
            onClick={() => setOnlyBookable((v) => !v)}
          />

          {/* Wolne boiska */}
          <TogglePill
            label="Wolne"
            icon={<CircleDot className={`h-3.5 w-3.5 shrink-0 ${onlyAvailable ? 'text-white' : 'text-green-600'}`} />}
            active={onlyAvailable}
            onClick={() => setOnlyAvailable((v) => !v)}
          />

          {/* Blisko mnie */}
          <TogglePill
            label="Blisko mnie"
            icon={<Navigation className={`h-3.5 w-3.5 shrink-0 ${geoLoading ? 'animate-pulse' : ''}`} />}
            active={!!geo}
            onClick={handleGeo}
          />
        </div>
      </div>

      {/* Bottom carousel — scroll-padding makes first/last cards center properly */}
      {fields.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[1100] pb-4">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ scrollPaddingLeft: `calc((100% - ${CARD_W}) / 2)`, scrollPaddingRight: `calc((100% - ${CARD_W}) / 2)` }}
            className="flex snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Left spacer so first card can snap to center */}
            <div className="shrink-0" style={{ width: `calc((100% - ${CARD_W}) / 2)` }} />

            {fields.map((f) => (
              <div
                key={f.id}
                ref={(el) => { cardRefs.current[f.id] = el; }}
                onClick={() => onSelect(f.id, 'map')}
                style={{ width: CARD_W }}
                className="shrink-0 snap-center px-1.5 h-[140px] cursor-pointer"
              >
                <VenueCard field={f} games={gameCounts[f.id] ?? 0} />
              </div>
            ))}

            {/* Right spacer so last card can snap to center */}
            <div className="shrink-0" style={{ width: `calc((100% - ${CARD_W}) / 2)` }} />
          </div>
        </div>
      )}

      {fields.length === 0 && allFields.length > 0 && (
        <div className="absolute inset-x-0 bottom-6 z-[1100] flex justify-center">
          <div className="rounded-2xl bg-white px-5 py-3 shadow-xl text-sm text-slate-500">
            Brak boisk dla tych filtrów
          </div>
        </div>
      )}
    </div>
  );
}
