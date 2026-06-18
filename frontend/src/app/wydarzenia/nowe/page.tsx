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
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';
import type { Visibility } from '@/types';

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', checked ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
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

  const [step, setStep] = useState(1);

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
  const [requireApproval, setRequireApproval] = useState(false);
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Attach the new event to a group when arriving via ?group=
  const groupId = searchParams.get('group') || undefined;
  const [groupName, setGroupName] = useState<string | null>(null);
  useEffect(() => {
    if (!groupId) return;
    import('@/lib/groups').then(({ getGroup }) =>
      getGroup(groupId).then((g) => {
        if (!g) return;
        setGroupName(g.name);
        if (g.sport) setSport(g.sport);
      }).catch(() => {}),
    );
  }, [groupId]);

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

    const errs: Record<string, string> = {};
    if (!location.venue && location.lat === null) errs.location = 'Wskaż lokalizację na mapie lub wpisz adres.';
    if (!date) errs.date = 'Podaj datę meczu.';
    if (endTime && endTime <= time) errs.endTime = 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // scroll to first error
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
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
          requireApproval,
          groupId,
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
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  const goToStep2 = () => {
    const errs: Record<string, string> = {};
    if (!location.venue && location.lat === null) errs.location = 'Wskaż lokalizację na mapie lub wpisz adres.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setFieldErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep3 = () => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Podaj datę meczu.';
    if (endTime && endTime <= time) errs.endTime = 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setFieldErrors({});
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={[
            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all',
            step >= n ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-400',
          ].join(' ')}
        >
          {n}
        </div>
      ))}
      <span className="ml-2 text-sm text-slate-500">
        {step === 1 ? 'Co i gdzie' : step === 2 ? 'Kiedy i ile' : 'Opcje'}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Nowe wydarzenie</h1>

        {groupName && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
            <Users className="w-4 h-4 shrink-0" />
            Mecz w grupie <span className="font-semibold">{groupName}</span>
          </div>
        )}

        {stepIndicator}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Sport chips */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sport</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SPORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSport(s);
                        if (location.venue && !location.venue.sport.includes(s)) {
                          setLocation(EMPTY_LOCATION);
                        }
                      }}
                      className={[
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
                        sport === s
                          ? 'bg-primary-700 text-white border-primary-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-primary-400',
                      ].join(' ')}
                    >
                      <span>{sportEmoji(s)}</span>
                      <span>{sportLabel(s)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Unified location picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lokalizacja
                </label>
                {fieldErrors.location && (
                  <p data-field-error className="mb-2 text-xs font-medium text-red-600 flex items-center gap-1">
                    <span aria-hidden>⚠</span> {fieldErrors.location}
                  </p>
                )}
                <p className="text-xs text-slate-500 mb-2">
                  Kliknij boisko na mapie, wyszukaj adres lub kliknij dowolne miejsce.
                </p>
                <div className="h-80 rounded-xl overflow-hidden border border-slate-200">
                  <UnifiedLocationPicker
                    sport={sport}
                    value={location}
                    onChange={(v) => { setLocation(v); setFieldErrors((f) => ({ ...f, location: '' })); }}
                  />
                </div>

                {/* Selected location summary */}
                {location.venue && (
                  <div className="mt-2 flex gap-3 items-center bg-slate-50 rounded-lg p-2">
                    {venueThumbnail(location.venue.lat, location.venue.lng, 160, 100) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={venueThumbnail(location.venue.lat, location.venue.lng, 160, 100)!}
                        alt={location.venue.name}
                        className="w-20 h-14 object-cover rounded-md shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{location.venue.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {location.venue.address}
                      </p>
                      {location.venue.surface && (
                        <p className="text-xs text-slate-400">{surfaceLabel(location.venue.surface)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocation(EMPTY_LOCATION)}
                      className="ml-auto text-slate-300 hover:text-slate-500"
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
                      className="ml-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </p>
                )}
              </div>

              <Button type="button" size="lg" className="w-full" onClick={goToStep2}>
                Dalej →
              </Button>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* Date / time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setFieldErrors((f) => ({ ...f, date: '' })); }}
                    className={[inputCls, fieldErrors.date ? 'border-red-400 ring-1 ring-red-400' : ''].join(' ')}
                  />
                  {fieldErrors.date && (
                    <p data-field-error className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                      <span aria-hidden>⚠</span> {fieldErrors.date}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rozpoczęcie</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Zakończenie <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    min={time}
                    onChange={(e) => { setEndTime(e.target.value); setFieldErrors((f) => ({ ...f, endTime: '' })); }}
                    className={[inputCls, fieldErrors.endTime ? 'border-red-400 ring-1 ring-red-400' : ''].join(' ')}
                  />
                  {fieldErrors.endTime && (
                    <p data-field-error className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                      <span aria-hidden>⚠</span> {fieldErrors.endTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Max players stepper */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Liczba miejsc
                </label>
                <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = Math.max(2, maxPlayers - 1);
                      setMaxPlayers(v);
                      if (externalCount > v) setExternalCount(v);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    disabled={maxPlayers <= 2}
                    aria-label="Zmniejsz liczbę miejsc"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg font-semibold text-slate-900 tabular-nums">
                    {maxPlayers}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMaxPlayers((v) => Math.min(30, v + 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    disabled={maxPlayers >= 30}
                    aria-label="Zwiększ liczbę miejsc"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Players already committed outside the app */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Macie już graczy spoza aplikacji? <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
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
                    className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {externalCount > 0 && (
                    <span className="text-sm text-primary-700 font-medium">
                      Szukasz jeszcze {Math.max(0, maxPlayers - externalCount)} {maxPlayers - externalCount === 1 ? 'gracza' : 'graczy'}
                    </span>
                  )}
                </div>
              </div>

              {/* Cost per player */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Koszt uczestnictwa (zł)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={costPln}
                  onChange={(e) => setCostPln(e.target.value)}
                  placeholder="0 = za darmo"
                  className={inputCls}
                />
              </div>

              {/* Organizer participates */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Biorę udział</p>
                  <p className="text-xs text-slate-500">Zapisz mnie jako uczestnika tej gry</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrganizerParticipates((v) => !v)}
                  className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', organizerParticipates ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
                  role="switch"
                  aria-checked={organizerParticipates}
                >
                  <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', organizerParticipates ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
                </button>
              </div>

              <Button type="button" size="lg" className="w-full" onClick={goToStep3}>
                Dalej →
              </Button>
              <button
                type="button"
                onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full text-center text-sm text-slate-500 hover:text-ink py-1 transition-colors"
              >
                ← Wróć
              </button>
            </>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tytuł <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Czwartkowa ligówka" className={inputCls} maxLength={80}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Opis <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Poziom, zasady, co zabrać…" rows={3} className={inputCls}
                />
              </div>

              {/* Visibility — public / private */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Widoczność</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button" onClick={() => setVisibility('public')}
                    className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'].join(' ')}
                  >
                    <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">Publiczne</span>
                      <span className="block text-xs text-slate-500">Widoczne dla wszystkich, każdy może dołączyć</span>
                    </span>
                  </button>
                  <button
                    type="button" onClick={() => setVisibility('private')}
                    className={['flex items-start gap-2 p-3 rounded-lg border text-left transition-colors', visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'].join(' ')}
                  >
                    <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">Prywatne</span>
                      <span className="block text-xs text-slate-500">Tylko przez link — nie pojawia się na liście</span>
                    </span>
                  </button>
                </div>

                {/* Approval toggle — applies to both public and private events */}
                <div className="mt-3 rounded-lg border border-slate-200 px-4">
                  <ToggleRow
                    label="Wymagaj akceptacji"
                    desc="Każdą prośbę o dołączenie zatwierdzasz ręcznie, zanim gracz wejdzie do składu"
                    checked={requireApproval}
                    onChange={setRequireApproval}
                  />
                </div>
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

              {/* Advanced */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdvOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Ustawienia zaawansowane
                  {advOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {advOpen && (
                  <div className="px-4 pb-2 border-t border-slate-100 divide-y divide-slate-100">
                    <ToggleRow label="Śledzenie obecności" desc="Śledź kto przyszedł, a kto nie" checked={trackAttendance} onChange={setTrackAttendance} />
                    <ToggleRow label="Śledzenie płatności" desc="Rejestruj wpłaty uczestników" checked={trackPayments} onChange={setTrackPayments} />
                    {trackPayments && (
                      <div className="py-3">
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
                Opublikuj mecz →
              </Button>
              <button
                type="button"
                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="w-full text-center text-sm text-slate-500 hover:text-ink py-1 transition-colors"
              >
                ← Wróć
              </button>
            </>
          )}

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
