'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Lock, Globe, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import VenuePicker from '@/components/map/VenuePicker';
import LocationPicker from '@/components/map/LocationPicker';
import { useAuth, displayName } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import type { Field, Visibility, TeamMode } from '@/types';

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', checked ? 'bg-primary-600' : 'bg-gray-200'].join(' ')}
        role="switch"
        aria-checked={checked}
      >
        <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
    </div>
  );
}

const SPORTS = [
  'piłka nożna',
  'futsal',
  'koszykówka',
  'siatkówka',
  'siatkówka plażowa',
  'piłka ręczna',
  'inne',
];

type LocationMode = 'venue' | 'address' | 'map';

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=pl`,
      { headers: { 'User-Agent': 'bojo-app/1.0' } },
    );
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng), display_name: data[0].display_name };
  } catch { return null; }
}

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signInWithGoogle } = useAuth();

  const [sport, setSport] = useState('piłka nożna');
  const [locationMode, setLocationMode] = useState<LocationMode>('venue');
  const [field, setField] = useState<Field | null>(null);
  // Custom location state
  const [customName, setCustomName] = useState('');
  const [customAddressInput, setCustomAddressInput] = useState('');
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced settings
  const [advOpen, setAdvOpen] = useState(false);
  const [requireSmsConfirmation, setRequireSmsConfirmation] = useState(false);
  const [trackAttendance, setTrackAttendance] = useState(false);
  const [teamMode, setTeamMode] = useState<TeamMode>('brak');
  const [trackPayments, setTrackPayments] = useState(false);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [trackResults, setTrackResults] = useState(false);
  const [confirmationDeadlineH, setConfirmationDeadlineH] = useState(24);
  const [costPln, setCostPln] = useState('');

  const preFieldId = searchParams.get('fieldId');
  useEffect(() => {
    if (!preFieldId || field) return;
    getField(preFieldId)
      .then(setField)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preFieldId]);

  if (!loading && !user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Zaloguj się, aby tworzyć wydarzenia</h1>
            <p className="text-gray-500 text-sm mt-2 mb-6">
              Potrzebujesz konta, żeby organizować mecze i zarządzać uczestnikami.
            </p>
            <Button onClick={() => signInWithGoogle()}>Zaloguj się przez Google</Button>
          </div>
        </main>
      </div>
    );
  }

  async function handleGeocode() {
    if (!customAddressInput.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    const result = await geocodeAddress(customAddressInput.trim());
    setGeocoding(false);
    if (!result) {
      setGeocodeError('Nie znaleziono adresu. Spróbuj bardziej szczegółowo.');
      return;
    }
    setCustomLat(result.lat);
    setCustomLng(result.lng);
    setCustomAddressInput(result.display_name);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (locationMode === 'venue' && !field) {
      setError('Wybierz boisko na mapie.');
      return;
    }
    if (locationMode !== 'venue' && !customName.trim()) {
      setError('Podaj nazwę miejsca.');
      return;
    }
    if (locationMode !== 'venue' && customLat === null) {
      setError('Wskaż lokalizację na mapie lub wyszukaj adres.');
      return;
    }
    if (locationMode !== 'venue' && customLat !== null && !locationConsent) {
      setError('Zaznacz zgodę na zapisanie współrzędnych lokalizacji.');
      return;
    }
    if (!date) { setError('Podaj datę.'); return; }
    if (endTime && endTime <= time) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const id = await createEvent(
        locationMode === 'venue'
          ? {
              sport,
              fieldId: field!.id,
              fieldName: field!.name,
              lat: field!.lat,
              lng: field!.lng,
              title: title || undefined,
              description: description || undefined,
              date,
              time,
              endTime: endTime || undefined,
              maxPlayers,
              visibility,
              requireSmsConfirmation,
              trackAttendance,
              teamMode,
              trackPayments,
              showPaymentStatus: trackPayments ? showPaymentStatus : false,
              trackResults,
              confirmationDeadlineH,
              costGrosze: Math.round(parseFloat(costPln || '0') * 100),
            }
          : {
              sport,
              fieldId: undefined,
              fieldName: customName.trim(),
              lat: customLat ?? undefined,
              lng: customLng ?? undefined,
              customLocationName: customName.trim(),
              customAddress: customAddressInput || undefined,
              title: title || undefined,
              description: description || undefined,
              date,
              time,
              endTime: endTime || undefined,
              maxPlayers,
              visibility,
              requireSmsConfirmation,
              trackAttendance,
              teamMode,
              trackPayments,
              showPaymentStatus: trackPayments ? showPaymentStatus : false,
              trackResults,
              confirmationDeadlineH,
              costGrosze: Math.round(parseFloat(costPln || '0') * 100),
            },
        user.id,
        displayName(user),
        organizerParticipates,
      );
      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć wydarzenia');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const locationModes: { value: LocationMode; label: string; desc: string }[] = [
    { value: 'venue', label: 'Boisko z bazy', desc: 'Wybierz z mapy boisk' },
    { value: 'address', label: 'Wpisz adres', desc: 'Geokoduj przez OpenStreetMap' },
    { value: 'map', label: 'Kliknij na mapie', desc: 'Wskaż punkt na mapie' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowe wydarzenie</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Location mode selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lokalizacja</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {locationModes.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLocationMode(value)}
                  className={[
                    'flex flex-col items-center p-2.5 rounded-lg border text-center transition-colors',
                    locationMode === value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>

            {/* Mode: venue picker */}
            {locationMode === 'venue' && (
              <>
                <p className="text-xs text-gray-500 mb-2">Kliknij pinezkę na mapie, aby wybrać boisko.</p>
                <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
                  <VenuePicker selectedId={field?.id} onSelect={setField} />
                </div>
                {field && (
                  <div className="mt-2 flex gap-3 items-center bg-gray-50 rounded-lg p-2">
                    {venueThumbnail(field.lat, field.lng, 160, 100) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={venueThumbnail(field.lat, field.lng, 160, 100)!}
                        alt={field.name}
                        className="w-20 h-14 object-cover rounded-md shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{field.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {field.address}
                      </p>
                      {field.surface && (
                        <p className="text-xs text-gray-400">{surfaceLabel(field.surface)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setField(null)}
                      className="ml-auto text-gray-300 hover:text-gray-500"
                      aria-label="Usuń wybrane boisko"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Mode: address input */}
            {locationMode === 'address' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nazwa miejsca</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="np. Osiedlowe boisko przy szkole"
                    className={inputCls}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Adres</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customAddressInput}
                      onChange={(e) => { setCustomAddressInput(e.target.value); setGeocodeError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
                      placeholder="np. ul. Dąbrowskiego 10, Poznań"
                      className={inputCls}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeocode}
                      isLoading={geocoding}
                      className="shrink-0"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  {geocodeError && (
                    <p className="text-xs text-red-500 mt-1">{geocodeError}</p>
                  )}
                  {customLat !== null && (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Znaleziono: {customLat.toFixed(4)}, {customLng?.toFixed(4)}
                    </p>
                  )}
                </div>
                {/* Location consent — unchecked by default */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationConsent}
                    onChange={(e) => setLocationConsent(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-primary-600"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Wyrażam zgodę na zapisanie współrzędnych tej lokalizacji.
                    Adres będzie widoczny dla uczestników wydarzenia.
                  </span>
                </label>
              </div>
            )}

            {/* Mode: map click */}
            {locationMode === 'map' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nazwa miejsca</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="np. Prywatne boisko"
                    className={inputCls}
                    maxLength={100}
                  />
                </div>
                <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
                  <LocationPicker
                    lat={customLat}
                    lng={customLng}
                    onSelect={(lat, lng, address) => {
                      setCustomLat(lat);
                      setCustomLng(lng);
                      setCustomAddressInput(address);
                    }}
                  />
                </div>
                {customLat !== null && (
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {customAddressInput || `${customLat.toFixed(5)}, ${customLng?.toFixed(5)}`}
                  </p>
                )}
                {/* Location consent — unchecked by default */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationConsent}
                    onChange={(e) => setLocationConsent(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-primary-600"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Wyrażam zgodę na zapisanie dokładnych współrzędnych wybranego miejsca.
                    Będą widoczne dla uczestników wydarzenia.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Date / start time / end time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rozpoczęcie</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zakończenie <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                type="time" value={endTime} min={time}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liczba miejsc: <span className="text-primary-600 font-semibold">{maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={30} value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Organizer participates toggle */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Biorę udział</p>
              <p className="text-xs text-gray-500">Zapisz mnie jako uczestnika tej gry</p>
            </div>
            <button
              type="button"
              onClick={() => setOrganizerParticipates((v) => !v)}
              className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', organizerParticipates ? 'bg-primary-600' : 'bg-gray-200'].join(' ')}
              role="switch"
              aria-checked={organizerParticipates}
            >
              <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', organizerParticipates ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tytuł <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Czwartkowa ligówka" className={inputCls} maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Poziom, zasady, co zabrać…" rows={3} className={inputCls}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => setVisibility('private')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
                ].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Prywatne</span>
                  <span className="block text-xs text-gray-500">Tylko przez link</span>
                </span>
              </button>
              <button
                type="button" onClick={() => setVisibility('public')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
                ].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Publiczne</span>
                  <span className="block text-xs text-gray-500">Widoczne dla wszystkich</span>
                </span>
              </button>
            </div>
          </div>

          {/* Advanced settings accordion */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Ustawienia zaawansowane
              {advOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {advOpen && (
              <div className="px-4 pb-2 border-t border-gray-100 divide-y divide-gray-100">
                <ToggleRow label="Potwierdzenie SMS" desc="Zaproszeni gracze potwierdzają przez SMS" checked={requireSmsConfirmation} onChange={setRequireSmsConfirmation} />
                {requireSmsConfirmation && (
                  <div className="py-3">
                    <label className="block text-xs text-gray-600 mb-1">Termin potwierdzenia (h przed meczem)</label>
                    <input type="number" min={1} max={168} value={confirmationDeadlineH}
                      onChange={(e) => setConfirmationDeadlineH(Number(e.target.value))}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                )}
                <ToggleRow label="Śledzenie obecności" desc="Śledź kto przyszedł, a kto nie" checked={trackAttendance} onChange={setTrackAttendance} />
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Tryb drużyn</p>
                    <p className="text-xs text-gray-500 mt-0.5">Jak są tworzone składy</p>
                  </div>
                  <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as TeamMode)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="brak">Brak</option>
                    <option value="reczne">Ręczne</option>
                    <option value="kapitanowie">Kapitanowie</option>
                    <option value="losowe">Losowe</option>
                  </select>
                </div>
                <ToggleRow label="Śledzenie płatności" desc="Rejestruj wpłaty uczestników" checked={trackPayments} onChange={setTrackPayments} />
                {trackPayments && (
                  <div className="py-3 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Koszt uczestnictwa (PLN)</label>
                      <input type="number" min={0} step={0.5} value={costPln}
                        onChange={(e) => setCostPln(e.target.value)}
                        placeholder="0.00"
                        className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <ToggleRow label="Pokaż status płatności uczestnikom" checked={showPaymentStatus} onChange={setShowPaymentStatus} />
                  </div>
                )}
                <ToggleRow label="Wyniki i statystyki" desc="Wpisuj wyniki meczu i bramki graczy" checked={trackResults} onChange={setTrackResults} />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" isLoading={submitting} className="w-full">
            Utwórz wydarzenie
          </Button>
        </form>
      </main>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventForm />
    </Suspense>
  );
}
