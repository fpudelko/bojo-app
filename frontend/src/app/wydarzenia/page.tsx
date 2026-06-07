'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Plus, Lock, Globe, Navigation, Search, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth';
import { getPublicEvents } from '@/lib/events';
import { getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import type { EventItem } from '@/types';
import { sportEmoji } from '@/lib/sports';


// Futsal i gokarty usunięte z filtrów per spec
const SPORTS_FILTER: { sport: string; label: string }[] = [
  { sport: 'piłka nożna',       label: 'Piłka nożna' },
  { sport: 'siatkówka plażowa', label: 'Siatkówka plażowa' },
  { sport: 'siatkówka',         label: 'Siatkówka' },
  { sport: 'koszykówka',        label: 'Koszykówka' },
  { sport: 'piłka ręczna',      label: 'Piłka ręczna' },
];

type LocationMode = 'none' | 'browser' | 'address';
interface GeoPoint { lat: number; lng: number }

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function statusBadge(event: EventItem) {
  const taken = event.externalCount ?? 0;
  const max = event.maxPlayers ?? 0;
  const label = taken > 0 && max > 0 ? `${taken}/${max} miejsc` : `max ${max}`;
  const full = max > 0 && taken >= max;
  return (
    <span className={[
      'text-xs font-medium flex items-center gap-1',
      full ? 'text-red-600' : 'text-slate-600',
    ].join(' ')}>
      <Users className="w-3 h-3" /> {label}
    </span>
  );
}

function DistanceBadge({ km }: { km: number }) {
  const label = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return (
    <span className="text-xs text-primary-700 font-medium flex items-center gap-1">
      <Navigation className="w-3 h-3" /> {label}
    </span>
  );
}

function EventRow({ event, distance }: { event: EventItem; distance?: number }) {
  let dateStr = event.date;
  try { dateStr = format(parseISO(event.date), 'd MMM', { locale: pl }); } catch {}

  return (
    <Link href={`/wydarzenia/${event.id}`}>
      <Card className="hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 border-slate-200/80" padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-xl"
              role="img"
              aria-label={event.sport}
            >
              {sportEmoji(event.sport)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">
                {event.title || `${event.sport}${event.district ? ` · ${event.district}` : ''}`}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {event.fieldName}
                {event.district && event.title && <span className="text-slate-400">· {event.district}</span>}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-ink flex items-center gap-1 justify-end">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {dateStr}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1 justify-end mt-0.5">
              <Clock className="w-3 h-3" /> {event.time?.slice(0, 5)}
              {event.endTime && <span className="text-slate-400">–{event.endTime.slice(0, 5)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          {statusBadge(event)}
          <span className="flex items-center gap-1">
            {event.visibility === 'public'
              ? <><Globe className="w-3 h-3" /> Publiczne</>
              : <><Lock className="w-3 h-3" /> Prywatne</>}
          </span>
          {distance !== undefined && <DistanceBadge km={distance} />}
        </div>
      </Card>
    </Link>
  );
}

export default function EventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');

  // Location filter
  const [locationMode, setLocationMode] = useState<LocationMode>('none');
  const [geoPoint, setGeoPoint] = useState<GeoPoint | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pub = await getPublicEvents();
      setPublicEvents(pub);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Request browser geolocation
  async function handleBrowserGeo() {
    setGeoLoading(true);
    setGeoError(null);
    const result = await getCurrentLocation();
    setGeoLoading(false);
    if (result.ok) {
      setGeoPoint({ lat: result.lat, lng: result.lng });
      setLocationMode('browser');
    } else {
      setGeoError(geoErrorMessage(result.kind));
      // Offer the manual address field as a fallback
      if (result.kind !== 'unsupported') setLocationMode('address');
    }
  }

  // Geocode typed address via Nominatim (debounced)
  function handleAddressChange(val: string) {
    setAddressInput(val);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (!val.trim()) { setGeoPoint(null); return; }
    addressDebounceRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=1&countrycodes=pl`,
          { headers: { 'Accept-Language': 'pl' } },
        );
        const results = await resp.json();
        if (results[0]) {
          setGeoPoint({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          setLocationMode('address');
        }
      } catch { /* ignore */ }
      finally { setAddressLoading(false); }
    }, 700);
  }

  function clearLocation() {
    setLocationMode('none');
    setGeoPoint(null);
    setAddressInput('');
    setGeoError(null);
  }

  const raw = publicEvents;

  // Distances (only computed when geoPoint set)
  const withDistances = useMemo(() => {
    return raw.map((event) => {
      if (!geoPoint || event.lat == null || event.lng == null) return { event, distance: undefined };
      return { event, distance: haversineKm(geoPoint, { lat: event.lat!, lng: event.lng! }) };
    });
  }, [raw, geoPoint]);

  const districtOptions = useMemo(() => {
    const s = new Set<string>();
    raw.forEach((e) => { if (e.district) s.add(e.district); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [raw]);

  const filtered = useMemo(() => {
    let list = withDistances;
    if (sportFilter) list = list.filter(({ event }) => event.sport === sportFilter);
    if (districtFilter) list = list.filter(({ event }) => event.district === districtFilter);
    if (geoPoint) list = list.filter(({ distance }) => distance !== undefined);
    if (geoPoint) list = [...list].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    return list;
  }, [withDistances, sportFilter, districtFilter, geoPoint]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Znajdź grę</h1>
          {user && (
            <Link href="/wydarzenia/nowe">
              <Button className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nowe</Button>
            </Link>
          )}
        </div>

        {/* Sport filter — emoji + visible label */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSportFilter('')}
            aria-pressed={!sportFilter}
            className={[
              'shrink-0 px-3.5 h-10 rounded-xl text-sm font-medium border transition-colors',
              !sportFilter
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
            ].join(' ')}
          >Wszystkie</button>
          {SPORTS_FILTER.map(({ sport, label }) => {
            const active = sportFilter === sport;
            return (
              <button
                key={sport}
                onClick={() => setSportFilter(active ? '' : sport)}
                aria-pressed={active}
                className={[
                  'shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-medium border transition-colors',
                  active
                    ? 'bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400',
                ].join(' ')}
              >
                <span aria-hidden="true" className="text-lg leading-none">{sportEmoji(sport)}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* District filter */}
        {districtOptions.length > 0 && (
          <div className="mb-4">
            <select
              aria-label="Filtruj po dzielnicy"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full px-3 h-10 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="">Wszystkie dzielnice</option>
              {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* Location filter */}
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sortuj od najbliższych</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={locationMode === 'browser' ? clearLocation : handleBrowserGeo}
              disabled={geoLoading}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
                locationMode === 'browser'
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-primary-300',
              ].join(' ')}
            >
              <Navigation className="w-4 h-4" />
              {geoLoading ? 'Pobieranie…' : locationMode === 'browser' ? 'Blisko mnie ✓' : 'Blisko mnie'}
            </button>
            <button
              onClick={() => {
                if (locationMode === 'address') { clearLocation(); }
                else { setLocationMode('address'); }
              }}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
                locationMode === 'address'
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-primary-300',
              ].join(' ')}
            >
              <Search className="w-4 h-4" /> Blisko adresu
            </button>
            {locationMode !== 'none' && (
              <button onClick={clearLocation} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2">
                <X className="w-3.5 h-3.5" /> Wyczyść
              </button>
            )}
          </div>

          {locationMode === 'address' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                aria-label="Adres do wyszukania pobliskich wydarzeń"
                value={addressInput}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="np. ul. Dąbrowskiego 7, Poznań"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
              {addressLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
              )}
            </div>
          )}

          {geoError && <p className="text-xs text-red-500">{geoError}</p>}
          {geoPoint && locationMode !== 'none' && (
            <p className="text-xs text-primary-700 font-medium">
              Pokazuję wydarzenia posortowane od najbliższych.
            </p>
          )}
        </div>

        {/* List */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />)}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <GroupedEventList items={filtered} />
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            {sportFilter || districtFilter ? (
              <>
                <p className="text-lg font-medium text-ink">Brak wydarzeń pasujących do filtrów</p>
                <button
                  onClick={() => { setSportFilter(''); setDistrictFilter(''); }}
                  className="text-primary-700 text-sm underline mt-3"
                >Wyczyść filtry</button>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-ink">Brak publicznych wydarzeń</p>
                <p className="text-sm mt-1">Bądź pierwszy — stwórz publiczne wydarzenie.</p>
                {!authLoading && !user && (
                  <button onClick={() => { window.location.href = `/logowanie?next=${encodeURIComponent(window.location.pathname)}`; }} className="text-primary-700 text-sm underline mt-4">
                    Zaloguj się, aby tworzyć
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Groups events by relative date bucket — easier to scan than a flat list. */
function GroupedEventList({ items }: { items: { event: EventItem; distance?: number }[] }) {
  const groups = useMemo(() => groupByDateBucket(items), [items]);
  return (
    <div className="space-y-6">
      {groups.map(([label, rows]) => (
        <section key={label}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
            {label} <span className="text-slate-400 font-normal">· {rows.length}</span>
          </h2>
          <div className="space-y-3">
            {rows.map(({ event, distance }) => (
              <EventRow key={event.id} event={event} distance={distance} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByDateBucket(
  items: { event: EventItem; distance?: number }[],
): [string, { event: EventItem; distance?: number }[]][] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + (7 - today.getDay() || 7));

  const buckets = new Map<string, { event: EventItem; distance?: number }[]>();
  const order = ['Dziś', 'Jutro', 'W tym tygodniu', 'Później'];
  order.forEach((k) => buckets.set(k, []));

  for (const row of items) {
    let bucket = 'Później';
    try {
      const [y, m, d] = row.event.date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getTime() === today.getTime()) bucket = 'Dziś';
      else if (dt.getTime() === tomorrow.getTime()) bucket = 'Jutro';
      else if (dt <= weekEnd) bucket = 'W tym tygodniu';
    } catch { /* keep default */ }
    buckets.get(bucket)!.push(row);
  }
  return order
    .map((k) => [k, buckets.get(k)!] as [string, { event: EventItem; distance?: number }[]])
    .filter(([, rows]) => rows.length > 0);
}
