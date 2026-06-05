'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Loader2, Bell, BellOff, Navigation } from 'lucide-react';
import { getMyAlert, saveAlert, deleteMyAlert, geocodeCity, type AlertInput } from '@/lib/alerts';
import { getCurrentLocation, geoErrorMessage } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import type { GameAlert } from '@/types';

const SPORTS = [
  { value: '',              label: 'Dowolny sport' },
  { value: 'piłka nożna',  label: 'Piłka nożna' },
  { value: 'koszykówka',   label: 'Koszykówka' },
  { value: 'siatkówka',    label: 'Siatkówka' },
  { value: 'siatkówka plażowa', label: 'Siatkówka plażowa' },
  { value: 'piłka ręczna', label: 'Piłka ręczna' },
  { value: 'inne',         label: 'Inne' },
];

const DAYS = [
  { n: 1, short: 'Pn' }, { n: 2, short: 'Wt' }, { n: 3, short: 'Śr' },
  { n: 4, short: 'Cz' }, { n: 5, short: 'Pt' }, { n: 6, short: 'Sb' }, { n: 7, short: 'Nd' },
];

interface Props {
  onClose: () => void;
  onSaved?: (alert: GameAlert) => void;
  defaultLat?: number;
  defaultLng?: number;
  defaultLabel?: string;
}

export default function AlertSetupDialog({ onClose, onSaved, defaultLat, defaultLng, defaultLabel }: Props) {
  const { user } = useAuth();

  const [existing, setExisting] = useState<GameAlert | null>(null);
  const [sport,    setSport]    = useState('');
  const [days,     setDays]     = useState<number[]>([]);
  const [lat,      setLat]      = useState<number | null>(defaultLat ?? null);
  const [lng,      setLng]      = useState<number | null>(defaultLng ?? null);
  const [label,    setLabel]    = useState(defaultLabel ?? '');
  const [cityInput,setCityInput]= useState('');
  const [radius,   setRadius]   = useState(15);

  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [gpsError,     setGpsError]     = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [saved,        setSaved]        = useState(false);

  // Load existing alert
  useEffect(() => {
    if (!user) return;
    getMyAlert().then((a) => {
      if (!a) return;
      setExisting(a);
      setSport(a.sport ?? '');
      setDays(a.daysOfWeek);
      setLat(a.lat);
      setLng(a.lng);
      setLabel(a.cityLabel ?? '');
      setRadius(a.radiusKm);
    });
  }, [user]);

  const hasLocation = lat !== null && lng !== null;

  const handleGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    const result = await getCurrentLocation();
    setGpsLoading(false);
    if (result.ok) {
      setLat(result.lat);
      setLng(result.lng);
      if (!label) setLabel('Moja lokalizacja');
    } else {
      setGpsError(geoErrorMessage(result.kind));
    }
  };

  const handleGeocode = async () => {
    if (!cityInput.trim()) return;
    setGeoLoading(true);
    const result = await geocodeCity(cityInput.trim());
    if (result) {
      setLat(result.lat);
      setLng(result.lng);
      setLabel(result.label);
    }
    setGeoLoading(false);
  };

  const toggleDay = (n: number) =>
    setDays((prev) => prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort());

  const handleSave = async () => {
    if (!user || !hasLocation) return;
    setSaving(true);
    try {
      const input: AlertInput = {
        sport:      sport || undefined,
        daysOfWeek: days,
        lat:        lat!,
        lng:        lng!,
        radiusKm:   radius,
        cityLabel:  label || undefined,
      };
      const saved = await saveAlert(user.id, input);
      setExisting(saved);
      setSaved(true);
      onSaved?.(saved);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setDeleting(true);
    await deleteMyAlert(existing.id);
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-700" />
            <h2 className="text-base font-bold text-ink">
              {existing ? 'Twój alert na gierki' : 'Ustaw alert na gierki'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Sport */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Sport</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSport(s.value)}
                  className={[
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                    sport === s.value
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days of week */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Kiedy <span className="normal-case font-normal text-slate-400">(puste = dowolny dzień)</span>
            </p>
            <div className="flex gap-2">
              {DAYS.map(({ n, short }) => (
                <button
                  key={n}
                  onClick={() => toggleDay(n)}
                  className={[
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border',
                    days.includes(n)
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-primary-300',
                  ].join(' ')}
                >
                  {short}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Gdzie</p>

            {hasLocation ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-200 px-3 py-2.5">
                <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                <span className="text-sm font-medium text-primary-800 truncate flex-1">{label || 'Wybrana lokalizacja'}</span>
                <button
                  onClick={() => { setLat(null); setLng(null); setLabel(''); }}
                  className="text-primary-500 hover:text-primary-700 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleGps}
                  disabled={gpsLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-60"
                >
                  {gpsLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Navigation className="w-4 h-4" />}
                  Użyj mojej lokalizacji GPS
                </button>

                <div className="flex gap-2">
                  <input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
                    placeholder="lub wpisz miasto / dzielnicę…"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button
                    onClick={handleGeocode}
                    disabled={geoLoading || !cityInput.trim()}
                    className="px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Szukaj'}
                  </button>
                </div>

                {gpsError && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {gpsError}
                  </p>
                )}
              </div>
            )}

            {/* Radius slider — only when location is set */}
            {hasLocation && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Promień</span>
                  <span className="font-semibold text-ink">{radius} km</span>
                </div>
                <input
                  type="range" min={3} max={30} step={1}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-primary-700"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>3 km</span><span>30 km</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-2">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-50 text-green-700 font-semibold text-sm">
              <Bell className="w-4 h-4" /> Alert zapisany!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !hasLocation}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {existing ? 'Zaktualizuj alert' : 'Zapisz alert'}
            </button>
          )}

          {existing && !saved && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              <BellOff className="w-4 h-4" />
              {deleting ? 'Usuwam…' : 'Usuń alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
