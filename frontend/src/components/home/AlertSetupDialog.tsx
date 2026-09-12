'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Loader2, Bell, BellOff, Navigation } from 'lucide-react';
import {
  getMyAlert, saveAlert, deleteMyAlert, geocodeCity,
  PROMIEN_MIN, PROMIEN_MAX, PROMIEN_DOMYSLNY, type AlertInput,
} from '@/lib/alerts';
import { getCurrentLocation, geoErrorMessage, pozycjaBezPytania } from '@/lib/geo';
import { useAuth } from '@/lib/auth';
import { FOCUS_SPORTS, sportEmoji, sportLabel } from '@/lib/sports';
import SportChip from '@/components/ui/SportChip';
import RangeSlider from '@/components/ui/RangeSlider';
import type { GameAlert } from '@/types';
import { WARSTWA } from '@/lib/warstwy';

const DAYS = [
  { n: 1, short: 'Pn' }, { n: 2, short: 'Wt' }, { n: 3, short: 'Śr' },
  { n: 4, short: 'Cz' }, { n: 5, short: 'Pt' }, { n: 6, short: 'Sb' }, { n: 7, short: 'Nd' },
];

interface Props {
  onClose: () => void;
  onSaved?: (alert: GameAlert) => void;
  defaultSport?: string;
  defaultRadiusKm?: number;
  defaultLat?: number;
  defaultLng?: number;
  defaultLabel?: string;
}

export default function AlertSetupDialog({
  onClose, onSaved, defaultSport, defaultRadiusKm, defaultLat, defaultLng, defaultLabel,
}: Props) {
  const { user } = useAuth();

  const [existing, setExisting] = useState<GameAlert | null>(null);
  const [sport,    setSport]    = useState(defaultSport ?? '');
  const [days,     setDays]     = useState<number[]>([]);
  const [lat,      setLat]      = useState<number | null>(defaultLat ?? null);
  const [lng,      setLng]      = useState<number | null>(defaultLng ?? null);
  const [label,    setLabel]    = useState(defaultLabel ?? '');
  const [cityInput,setCityInput]= useState('');
  const [radius,   setRadius]   = useState(defaultRadiusKm ?? PROMIEN_DOMYSLNY);

  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [gpsError,     setGpsError]     = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [saved,        setSaved]        = useState(false);

  // Istniejący alert wygrywa z wartościami przyniesionymi z filtrów — to jego
  // edycja, nie zakładanie nowego. Gdy alertu nie ma i nikt nie podał miejsca,
  // bierzemy pozycję, ale WYŁĄCZNIE przy już udzielonej zgodzie
  // (`pozycjaBezPytania`): samo otwarcie okna nie jest powodem, żeby
  // przeglądarka wyskoczyła z systemową prośbą o lokalizację.
  useEffect(() => {
    let zywe = true;
    (async () => {
      const a = user ? await getMyAlert().catch(() => null) : null;
      if (!zywe) return;
      if (a) {
        setExisting(a);
        setSport(a.sport ?? '');
        setDays(a.daysOfWeek);
        setLat(a.lat);
        setLng(a.lng);
        setLabel(a.cityLabel ?? '');
        setRadius(a.radiusKm);
        return;
      }
      if (defaultLat != null) return;
      const poz = await pozycjaBezPytania();
      if (!zywe || !poz) return;
      setLat(poz.lat);
      setLng(poz.lng);
      setLabel('Moja lokalizacja');
    })();
    return () => { zywe = false; };
    // `defaultLat` czytane raz, przy otwarciu — okno nie przestawia się w locie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const zapisany = await saveAlert(user.id, input);
      setExisting(zapisany);
      setSaved(true);
      onSaved?.(zapisany);
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
    <div className={`fixed inset-0 ${WARSTWA.modal} flex items-end sm:items-center justify-center p-0 sm:p-4`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-700" />
            <h2 className="text-base font-bold text-ink">
              {existing ? 'Twój alert na gierki' : 'Powiadom mnie o nowych meczach'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Sport */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Sport</p>
            <div className="flex flex-wrap gap-2">
              <SportChip
                emoji="🏟️"
                label="Dowolny sport"
                selected={sport === ''}
                onClick={() => setSport('')}
              />
              {FOCUS_SPORTS.map((s) => (
                <SportChip
                  key={s}
                  emoji={sportEmoji(s)}
                  label={sportLabel(s)}
                  selected={sport === s}
                  onClick={() => setSport(s)}
                />
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
                  aria-pressed={days.includes(n)}
                  className={[
                    'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border',
                    days.includes(n)
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-primary-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
                  ].join(' ')}
                >
                  {short}
                </button>
              ))}
            </div>
          </div>

          {/* Gdzie — miejsce, a zaraz pod nim zasięg. Promień jest dopowiedzeniem
              do miejsca („15 km OD CZEGO"), więc stoi razem z nim i tylko tu:
              drugie pytanie o kilometry gdzie indziej w oknie znaczyłoby dla
              czytającego dwie różne odległości. */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Gdzie</p>

            {hasLocation ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-200 px-3 py-2.5 dark:bg-primary-950 dark:border-primary-800">
                <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                <span className="text-sm font-medium text-primary-800 truncate flex-1 dark:text-primary-200">
                  {label || 'Wybrana lokalizacja'}
                </span>
                <button
                  onClick={() => { setLat(null); setLng(null); setLabel(''); }}
                  aria-label="Zmień lokalizację"
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
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
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <button
                    onClick={handleGeocode}
                    disabled={geoLoading || !cityInput.trim()}
                    className="px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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

            {hasLocation && (
              <div className="mt-3">
                <RangeSlider
                  label="Jak daleko"
                  min={PROMIEN_MIN}
                  max={PROMIEN_MAX}
                  value={radius}
                  onChange={setRadius}
                  formatValue={(km) => `${km} km`}
                  minLabel={`${PROMIEN_MIN} km`}
                  maxLabel={`${PROMIEN_MAX} km`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-2 dark:border-slate-700">
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
