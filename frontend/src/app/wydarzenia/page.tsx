'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { isThisWeek, isThisMonth } from 'date-fns';
import { ArrowLeft, Plus, Search, X, Navigation, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { getPublicEvents, getMyParticipatedEvents } from '@/lib/events';
import { getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import type { EventItem } from '@/types';
import { sportEmoji, FOCUS_SPORTS } from '@/lib/sports';
import { EventBrowseCard } from '@/components/EventBrowseCard';
import { isEventJoinable } from '@/components/EventCard';
import { useRouter } from 'next/navigation';

const SPORT_CHIPS = [
  { value: 'piłka nożna' },
  { value: 'siatkówka' },
  { value: 'siatkówka plażowa' },
  { value: 'koszykówka' },
] as const;

type DateBucket = 'dzisiaj' | 'jutro' | 'tydzien' | 'wszystkie';
const DATE_CHIPS: { value: DateBucket; label: string }[] = [
  { value: 'dzisiaj',   label: 'Dzisiaj' },
  { value: 'jutro',     label: 'Jutro' },
  { value: 'tydzien',   label: 'Ten tydzień' },
  { value: 'wszystkie', label: 'Wszystkie' },
];

interface GeoPoint { lat: number; lng: number }

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function dateBucket(dateStr: string): DateBucket {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (dt.getTime() === today.getTime()) return 'dzisiaj';
    if (dt.getTime() === tomorrow.getTime()) return 'jutro';
    if (isThisWeek(dt, { weekStartsOn: 1 })) return 'tydzien';
    return 'wszystkie';
  } catch { return 'wszystkie'; }
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [allEvents, setAllEvents] = useState<{ event: EventItem; distance?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateBucket>('wszystkie');
  const [query, setQuery] = useState('');
  const [showGeoBar, setShowGeoBar] = useState(false);
  const [geoPoint, setGeoPoint] = useState<GeoPoint | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pub = await getPublicEvents();
      setAllEvents(pub.map((event) => ({ event })));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recompute distances when geoPoint changes
  useEffect(() => {
    setAllEvents((prev) => prev.map(({ event }) => ({
      event,
      distance: geoPoint && event.lat != null && event.lng != null
        ? haversineKm(geoPoint, { lat: event.lat!, lng: event.lng! })
        : undefined,
    })));
  }, [geoPoint]);

  async function handleBrowserGeo() {
    setGeoLoading(true);
    setGeoError(null);
    const result = await getCurrentLocation();
    setGeoLoading(false);
    if (result.ok) {
      setGeoPoint({ lat: result.lat, lng: result.lng });
    } else {
      setGeoError(geoErrorMessage(result.kind));
    }
  }

  function handleAddressChange(val: string) {
    setAddressInput(val);
    setGeoError(null);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (!val.trim()) { setGeoPoint(null); return; }
    addressDebounceRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const q = /pozna/i.test(val) ? val : `${val}, Poznań`;
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pl`,
        );
        const results = await resp.json();
        if (results?.[0]) {
          setGeoPoint({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
        } else {
          setGeoPoint(null);
          setGeoError('Nie znaleziono adresu.');
        }
      } catch { setGeoError('Błąd połączenia.'); }
      finally { setAddressLoading(false); }
    }, 600);
  }

  function clearGeo() {
    setGeoPoint(null);
    setAddressInput('');
    setGeoError(null);
    setShowGeoBar(false);
  }

  const filtered = useMemo(() => {
    let list = allEvents.filter(({ event }) =>
      event.status !== 'cancelled' && isEventJoinable(event),
    );
    if (sportFilter) {
      const matchSports = sportFilter === 'piłka nożna' ? ['piłka nożna', 'futsal'] : [sportFilter];
      list = list.filter(({ event }) => matchSports.includes(event.sport));
    }
    if (dateFilter !== 'wszystkie') {
      list = list.filter(({ event }) => {
        const b = dateBucket(event.date);
        if (dateFilter === 'tydzien') return b === 'dzisiaj' || b === 'jutro' || b === 'tydzien';
        return b === dateFilter;
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(({ event }) =>
        event.title?.toLowerCase().includes(q) ||
        event.sport.toLowerCase().includes(q) ||
        event.fieldName?.toLowerCase().includes(q),
      );
    }
    if (geoPoint) list = [...list].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    return list;
  }, [allEvents, sportFilter, dateFilter, query, geoPoint]);

  const hasFilters = !!sportFilter || dateFilter !== 'wszystkie' || !!query || !!geoPoint;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            aria-label="Wróć"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-base font-bold text-ink">Szukaj meczu</span>
          <button
            type="button"
            aria-label="Filtruj po lokalizacji"
            onClick={() => setShowGeoBar((v) => !v)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {geoPoint && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-500" />
            )}
          </button>
          {user && (
            <Link
              href="/wydarzenia/nowe"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-primary-950 hover:bg-accent-400 transition-colors"
              aria-label="Nowy mecz"
            >
              <Plus className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-2xl">
        {/* Search bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po nazwie lub boisku…"
              className="w-full rounded-2xl bg-slate-100 py-2.5 pl-10 pr-9 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Geo bar (collapsible) */}
        {showGeoBar && (
          <div className="mx-4 mb-2 rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={geoPoint ? clearGeo : handleBrowserGeo}
                disabled={geoLoading}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium border transition-colors ${
                  geoPoint ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                }`}
              >
                <Navigation className="h-4 w-4" />
                {geoLoading ? 'Pobieranie…' : geoPoint ? 'Blisko mnie ✓' : 'Blisko mnie'}
              </button>
              {geoPoint && (
                <button type="button" onClick={clearGeo} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2">
                  <X className="h-3.5 w-3.5" /> Wyczyść
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={addressInput}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="lub wpisz adres: Rataje, ul. Główna…"
                className="w-full rounded-xl border border-slate-200 bg-canvas pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              {addressLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>}
            </div>
            {geoError && <p className="text-xs text-red-500">{geoError}</p>}
          </div>
        )}

        {/* Sport chips — emoji only, no "Wszystkie" (empty = all) */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPORT_CHIPS.map(({ value }) => {
            const active = sportFilter === value;
            const emoji = sportEmoji(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSportFilter(active ? '' : value)}
                title={value}
                className={`flex shrink-0 items-center justify-center h-9 w-9 rounded-full text-lg transition-colors ${
                  active
                    ? 'bg-primary-700 ring-2 ring-primary-700 ring-offset-1'
                    : 'bg-white ring-1 ring-slate-200 hover:ring-primary-300'
                }`}
                aria-pressed={active}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            );
          })}
        </div>

        {/* Date chips */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DATE_CHIPS.map(({ value, label }) => {
            const active = dateFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setDateFilter(value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-primary-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Results count */}
        {!loading && (
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[13px] text-slate-500">
              {filtered.length > 0 ? `${filtered.length} ${filtered.length === 1 ? 'mecz' : filtered.length < 5 ? 'mecze' : 'meczy'}` : 'Brak meczy'}
            </span>
            {geoPoint && (
              <span className="text-[11px] font-medium text-primary-700">posortowane od najbliższych</span>
            )}
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-3 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3 px-4 pb-24">
            {filtered.map(({ event, distance }) => (
              <EventBrowseCard key={event.id} event={event} distance={distance} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <span className="text-5xl mb-4">⚽</span>
            <p className="text-base font-bold text-slate-700">Brak meczy</p>
            <p className="mt-1 text-sm text-slate-500">Zmień filtr lub stwórz własny mecz.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSportFilter(''); setDateFilter('wszystkie'); setQuery(''); clearGeo(); }}
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
      </main>

      {/* FAB */}
      {user && filtered.length > 0 && (
        <Link
          href="/wydarzenia/nowe"
          aria-label="Nowy mecz"
          className="fixed bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-primary-950 shadow-lg shadow-black/15 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
