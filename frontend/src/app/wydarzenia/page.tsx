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
import { getMyEvents, getPublicEvents } from '@/lib/events';
import type { EventItem } from '@/types';

const SPORT_EMOJI: Record<string, string> = {
  'piłka nożna': '⚽', koszykówka: '🏀', siatkówka: '🏐',
  'siatkówka plażowa': '🏖️', tenis: '🎾', 'piłka ręczna': '🤾', inne: '🏅',
};

// Futsal i gokarty usunięte z filtrów per spec
const SPORTS_FILTER = ['piłka nożna', 'siatkówka plażowa', 'siatkówka', 'koszykówka', 'piłka ręczna'];

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
  return (
    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
      <Users className="w-3 h-3" /> max {event.maxPlayers}
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-xl" role="img">
              {SPORT_EMOJI[event.sport] ?? '🏅'}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">{event.title || event.sport}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {event.fieldName}
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
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<'publiczne' | 'moje'>('publiczne');
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('');

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
      const [pub, mine] = await Promise.all([
        getPublicEvents(),
        user ? getMyEvents(user.id) : Promise.resolve([]),
      ]);
      setPublicEvents(pub);
      setMyEvents(mine);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Request browser geolocation
  function handleBrowserGeo() {
    if (!navigator.geolocation) { setGeoError('Twoja przeglądarka nie obsługuje geolokalizacji.'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationMode('browser');
        setGeoLoading(false);
      },
      () => {
        setGeoError('Nie udało się pobrać lokalizacji. Sprawdź uprawnienia przeglądarki.');
        setGeoLoading(false);
      },
      { timeout: 8000 },
    );
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

  const raw = tab === 'moje' ? myEvents : publicEvents;

  // Distances (only computed when geoPoint set)
  const withDistances = useMemo(() => {
    return raw.map((event) => {
      if (!geoPoint || event.lat == null || event.lng == null) return { event, distance: undefined };
      return { event, distance: haversineKm(geoPoint, { lat: event.lat!, lng: event.lng! }) };
    });
  }, [raw, geoPoint]);

  const filtered = useMemo(() => {
    let list = withDistances;
    if (sportFilter) list = list.filter(({ event }) => event.sport === sportFilter);
    if (geoPoint) list = list.filter(({ distance }) => distance !== undefined);
    if (geoPoint) list = [...list].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    return list;
  }, [withDistances, sportFilter, geoPoint]);

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

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab('publiczne')}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              tab === 'publiczne'
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400',
            ].join(' ')}
          >Wszystkie</button>
          {user && (
            <button
              onClick={() => setTab('moje')}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                tab === 'moje'
                  ? 'bg-primary-700 text-white border-primary-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400',
              ].join(' ')}
            >Moje</button>
          )}
        </div>

        {/* Sport filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          <button
            onClick={() => setSportFilter('')}
            className={[
              'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              !sportFilter
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
            ].join(' ')}
          >Każdy sport</button>
          {SPORTS_FILTER.map((s) => (
            <button
              key={s}
              onClick={() => setSportFilter(sportFilter === s ? '' : s)}
              className={[
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                sportFilter === s
                  ? 'bg-primary-700 text-white border-primary-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
              ].join(' ')}
            >{SPORT_EMOJI[s]} {s}</button>
          ))}
        </div>

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

        {!loading && (
          <div className="space-y-3">
            {filtered.map(({ event, distance }) => (
              <EventRow key={event.id} event={event} distance={distance} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            {sportFilter ? (
              <>
                <p className="text-lg font-medium text-ink">Brak wydarzeń pasujących do filtrów</p>
                <button
                  onClick={() => setSportFilter('')}
                  className="text-primary-700 text-sm underline mt-3"
                >Wyczyść filtry</button>
              </>
            ) : tab === 'moje' ? (
              <>
                <p className="text-lg font-medium text-ink">Nie masz jeszcze wydarzeń</p>
                <p className="text-sm mt-1 mb-5">Stwórz pierwsze i zaproś znajomych.</p>
                <Link href="/wydarzenia/nowe"><Button>Stwórz wydarzenie</Button></Link>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-ink">Brak publicznych wydarzeń</p>
                <p className="text-sm mt-1">Bądź pierwszy — stwórz publiczne wydarzenie.</p>
                {!authLoading && !user && (
                  <button onClick={() => signInWithGoogle()} className="text-primary-700 text-sm underline mt-4">
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
