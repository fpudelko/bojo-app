'use client';

import { useState, useEffect } from 'react';
import { Navigation, Loader2, Bell, BellRing } from 'lucide-react';
import { getNearbyEvents } from '@/lib/events';
import { getMyAlert } from '@/lib/alerts';
import { getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import { EventCard } from '@/components/EventCard';
import AlertSetupDialog from './AlertSetupDialog';
import type { EventItem, GameAlert } from '@/types';
import { useAuth } from '@/lib/auth';

type GeoState = 'idle' | 'loading' | 'ok' | 'denied';

const LS_KEY = 'bojo_last_location';

interface SavedLocation { lat: number; lng: number; label: string; ts: number }

function loadSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed: SavedLocation = JSON.parse(raw);
    // Expire after 7 days
    if (Date.now() - parsed.ts > 7 * 24 * 3600 * 1000) return null;
    return parsed;
  } catch { return null; }
}

function saveLocation(lat: number, lng: number, label: string) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ lat, lng, label, ts: Date.now() })); } catch {}
}

export default function NearbyGames() {
  const { user } = useAuth();
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [location,  setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [events,    setEvents]   = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [alert,     setAlert]    = useState<GameAlert | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [geoError,  setGeoError] = useState<string | null>(null);

  // Restore saved location
  useEffect(() => {
    const saved = loadSavedLocation();
    if (saved) {
      setLocation(saved);
      setGeoState('ok');
    }
  }, []);

  // Load existing alert
  useEffect(() => {
    if (user) getMyAlert().then(setAlert).catch(() => {});
  }, [user]);

  // Fetch nearby events when location changes
  useEffect(() => {
    if (!location) return;
    setLoadingEvents(true);
    getNearbyEvents(location.lat, location.lng, 5, 4)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [location]);

  const requestGps = async () => {
    setGeoState('loading');
    setGeoError(null);
    const result = await getCurrentLocation();
    if (result.ok) {
      const loc = { lat: result.lat, lng: result.lng, label: 'Moja lokalizacja' };
      setLocation(loc);
      saveLocation(loc.lat, loc.lng, loc.label);
      setGeoState('ok');
    } else {
      setGeoError(geoErrorMessage(result.kind));
      setGeoState('denied');
    }
  };

  // ── idle / denied: show prompt button ──
  if (geoState === 'idle' || geoState === 'denied') {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-slate-200 p-5 text-center">
        <Navigation className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-600 mb-1">Gry w Twojej okolicy</p>
        <p className="text-xs text-slate-400 mb-4">
          {geoState === 'denied'
            ? (geoError ?? 'Brak dostępu do lokalizacji. Możesz podać ją ręcznie przy ustawianiu alertu.')
            : 'Pokaż otwarte mecze w pobliżu i ustaw powiadomienie na nowe.'}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {geoState !== 'denied' && (
            <button
              onClick={requestGps}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
            >
              <Navigation className="w-4 h-4" /> Pokaż gry w pobliżu
            </button>
          )}
          <button
            onClick={() => setShowDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Bell className="w-4 h-4" />
            {alert ? 'Edytuj alert' : 'Ustaw alert'}
          </button>
        </div>
        {showDialog && (
          <AlertSetupDialog
            onClose={() => setShowDialog(false)}
            onSaved={(a) => setAlert(a)}
          />
        )}
      </section>
    );
  }

  // ── loading GPS ──
  if (geoState === 'loading') {
    return (
      <section className="mt-6 flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Pobieranie lokalizacji…
      </section>
    );
  }

  // ── location ok ──
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Gry w pobliżu · 5 km
        </h2>
        <button
          onClick={() => setShowDialog(true)}
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            alert
              ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          ].join(' ')}
        >
          {alert ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          {alert ? 'Alert włączony' : 'Ustaw alert'}
        </button>
      </div>

      {loadingEvents ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Ładuję gry…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-600">Brak otwartych gier w promieniu 5 km</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Ustaw alert — dostaniesz powiadomienie gdy ktoś stworzy grę w Twoim rejonie.
          </p>
          {!alert && (
            <button
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Bell className="w-4 h-4" /> Ustaw alert
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} isOrganizer={false} />
          ))}
        </div>
      )}

      {showDialog && (
        <AlertSetupDialog
          defaultLat={location?.lat}
          defaultLng={location?.lng}
          defaultLabel={location?.label}
          onClose={() => setShowDialog(false)}
          onSaved={(a) => setAlert(a)}
        />
      )}
    </section>
  );
}
