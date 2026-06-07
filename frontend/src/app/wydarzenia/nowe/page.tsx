'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Lock, Globe, ChevronDown, ChevronUp, X, Users } from 'lucide-react';
import { countAlertSeekers } from '@/lib/alerts';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import UnifiedLocationPicker from '@/components/map/UnifiedLocationPicker';
import type { LocationResult } from '@/components/map/UnifiedLocationPicker';
import { useAuth, displayName } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { FOCUS_SPORTS, sportLabel } from '@/lib/sports';
import type { Visibility } from '@/types';

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

const SPORTS = FOCUS_SPORTS;

const EMPTY_LOCATION: LocationResult = { venue: null, lat: null, lng: null, address: '' };

function NewEventForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [sport, setSport] = useState('piłka nożna');
  const [location, setLocation] = useState<LocationResult>(EMPTY_LOCATION);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [externalCount, setExternalCount] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seekerCount, setSeekerCount] = useState(0);

  // Count users with matching alerts — shown near visibility picker
  useEffect(() => {
    const lat = location.lat;
    const lng = location.lng;
    if (!lat || !lng || !date) { setSeekerCount(0); return; }
    const dow = (() => { const d = new Date(date).getDay(); return d === 0 ? 7 : d; })();
    countAlertSeekers(lat, lng, sport, dow).then(setSeekerCount).catch(() => {});
  }, [location.lat, location.lng, sport, date]);

  const [advOpen, setAdvOpen] = useState(false);
  const [trackAttendance, setTrackAttendance] = useState(false);
  const [trackPayments, setTrackPayments] = useState(false);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [costPln, setCostPln] = useState('');

  // Pre-select field from URL ?fieldId=
  const preFieldId = searchParams.get('fieldId');
  useEffect(() => {
    if (!preFieldId || location.venue) return;
    getField(preFieldId)
      .then((f) => setLocation({ venue: f, lat: f.lat, lng: f.lng, address: f.address }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preFieldId]);

  if (!loading && !user) {
    const loginHref = typeof window !== 'undefined'
      ? `/logowanie?next=${encodeURIComponent(window.location.pathname)}`
      : '/logowanie?next=/wydarzenia/nowe';
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Zorganizuj mecz
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Wybierz boisko, ustaw termin i wrzuć link na grupę.
          </p>

          <ul className="mt-5 grid gap-2 text-sm text-slate-700">
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Lista zapisów aktualizuje się na żywo</li>
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Przypomnienia o meczu dla wszystkich uczestników</li>
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Brakujące miejsca? Zapiszą się chętni z okolicy.</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                <Lock className="w-4 h-4 text-primary-700" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">Zaloguj się, żeby opublikować mecz</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Logujesz się przez Google — bez rejestracji.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full mt-4"
              onClick={() => { window.location.href = loginHref; }}
            >
              Zaloguj się i kontynuuj
            </Button>
          </div>

          {/* Preview kreatora pod blurem */}
          <div className="relative mt-8 rounded-2xl border border-slate-200 bg-white overflow-hidden select-none pointer-events-none" aria-hidden="true">
            <div className="p-5 space-y-4 blur-[1.5px] opacity-75">
              <div className="h-8 w-32 rounded bg-slate-200" />
              <div className="grid grid-cols-5 gap-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg bg-slate-100" />)}
              </div>
              <div className="h-32 rounded-xl bg-slate-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 rounded-lg bg-slate-100" />
                <div className="h-10 rounded-lg bg-slate-100" />
              </div>
              <div className="h-20 rounded-lg bg-slate-100" />
              <div className="h-11 rounded-xl bg-primary-200" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/40 to-white/90" />
            <p className="absolute bottom-3 inset-x-0 text-center text-xs text-slate-500 font-medium">
              ↑ tak wygląda kreator po zalogowaniu
            </p>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!location.venue && location.lat === null) {
      setError('Wskaż lokalizację — kliknij boisko na mapie, wpisz adres lub kliknij dowolne miejsce.');
      return;
    }
    if (!date) { setError('Podaj datę.'); return; }
    if (endTime && endTime <= time) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    const fieldName = location.venue
      ? location.venue.name
      : (location.address.split(',')[0].trim() || 'Nieznana lokalizacja');

    setSubmitting(true);
    setError(null);
    try {
      const id = await createEvent(
        {
          sport,
          fieldId: location.venue?.id,
          fieldName,
          lat: location.lat ?? undefined,
          lng: location.lng ?? undefined,
          customLocationName: location.venue ? undefined : fieldName,
          customAddress: location.venue ? undefined : location.address || undefined,
          title: title || undefined,
          description: description || undefined,
          date,
          time,
          endTime: endTime || undefined,
          maxPlayers,
          externalCount,
          visibility,
          requireSmsConfirmation: false,
          trackAttendance,
          teamMode: 'brak',
          trackPayments,
          showPaymentStatus: trackPayments ? showPaymentStatus : false,
          trackResults: true,
          confirmationDeadlineH: 24,
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowe wydarzenie</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select
              value={sport}
              onChange={(e) => {
                setSport(e.target.value);
                // clear venue if it doesn't match new sport
                if (location.venue && !location.venue.sport.includes(e.target.value)) {
                  setLocation(EMPTY_LOCATION);
                }
              }}
              className={inputCls}
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>{sportLabel(s)}</option>
              ))}
            </select>
          </div>

          {/* Unified location picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lokalizacja
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Kliknij boisko na mapie, wyszukaj adres lub kliknij dowolne miejsce.
            </p>
            <div className="h-80 rounded-xl overflow-hidden border border-gray-200">
              <UnifiedLocationPicker
                sport={sport}
                value={location}
                onChange={setLocation}
              />
            </div>

            {/* Selected location summary */}
            {location.venue && (
              <div className="mt-2 flex gap-3 items-center bg-gray-50 rounded-lg p-2">
                {venueThumbnail(location.venue.lat, location.venue.lng, 160, 100) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(location.venue.lat, location.venue.lng, 160, 100)!}
                    alt={location.venue.name}
                    className="w-20 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{location.venue.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {location.venue.address}
                  </p>
                  {location.venue.surface && (
                    <p className="text-xs text-gray-400">{surfaceLabel(location.venue.surface)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLocation(EMPTY_LOCATION)}
                  className="ml-auto text-gray-300 hover:text-gray-500"
                  aria-label="Wyczyść lokalizację"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {!location.venue && location.lat !== null && (
              <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {location.address || `${location.lat?.toFixed(5)}, ${location.lng?.toFixed(5)}`}
                <button
                  type="button"
                  onClick={() => setLocation(EMPTY_LOCATION)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </p>
            )}
          </div>

          {/* Date / time */}
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
              <input type="time" value={endTime} min={time} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liczba miejsc: <span className="text-primary-600 font-semibold">{maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={30} value={maxPlayers}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxPlayers(v);
                if (externalCount > v) setExternalCount(v);
              }}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Players already committed outside the app — "dograj skład" */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Macie już graczy spoza aplikacji? <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Wpisz, ilu graczy macie już zebranych (np. ze swojej ekipy). Aplikacja będzie szukać tylko brakujących.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={maxPlayers}
                value={externalCount === 0 ? '' : externalCount}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(maxPlayers, Math.floor(Number(e.target.value) || 0)));
                  setExternalCount(v);
                }}
                placeholder="0"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {externalCount > 0 && (
                <span className="text-sm text-primary-700 font-medium">
                  Szukasz jeszcze {Math.max(0, maxPlayers - externalCount)} {maxPlayers - externalCount === 1 ? 'gracza' : 'graczy'}
                </span>
              )}
            </div>
          </div>

          {/* Organizer participates */}
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

          {/* Seeker count nudge — appears when we have location + date */}
          {seekerCount >= 2 && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <Users className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{seekerCount} {seekerCount === 1 ? 'osoba szuka' : seekerCount < 5 ? 'osoby szukają' : 'osób szuka'}</span>
                {' '}podobnej gry w tym rejonie — rozważ otwarcie zapisów publicznie!
              </p>
            </div>
          )}

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => setVisibility('private')}
                className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Prywatne</span>
                  <span className="block text-xs text-gray-500">Tylko przez link</span>
                </span>
              </button>
              <button
                type="button" onClick={() => setVisibility('public')}
                className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-gray-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Publiczne</span>
                  <span className="block text-xs text-gray-500">Widoczne dla wszystkich</span>
                </span>
              </button>
            </div>
          </div>

          {/* Advanced */}
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
                <ToggleRow label="Śledzenie obecności" desc="Śledź kto przyszedł, a kto nie" checked={trackAttendance} onChange={setTrackAttendance} />
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
