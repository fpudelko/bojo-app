'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Lock, Globe, ChevronDown, X, Users, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { countAlertSeekers } from '@/lib/alerts';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import TimeSelect from '@/components/ui/TimeSelect';
import UnifiedLocationPicker from '@/components/map/UnifiedLocationPicker';
import type { LocationResult } from '@/components/map/UnifiedLocationPicker';
import { useAuth, displayName } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { FOCUS_SPORTS, sportLabel, sportEmoji } from '@/lib/sports';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SPORTS_CARD_PROVIDERS, SPORTS_CARD_LABELS } from '@/lib/payments';
import { validateStep1, validateStep2, validateStep } from '@/lib/eventWizard';
import { HideBottomNav } from '@/lib/bottomNavVisibility';
import type { Visibility, PaymentMethod, SportsCardProvider } from '@/types';

// Sports where a goalkeeper / field-player distinction makes sense.
const GK_SPORTS = ['piłka nożna', 'futsal'];

const STEP_TITLES = ['Co i gdzie', 'Kiedy i ile', 'Opcje'] as const;

/** Tomorrow as YYYY-MM-DD — the default match date; "today" usually means a rush. */
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** HH:MM plus N minutes; null when it would roll past midnight (no end time then). */
function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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

  const [date, setDate] = useState(tomorrowStr);
  const [time, setTime] = useState('18:00');
  // Match length instead of a free end-time picker — one obvious control,
  // the end time is derived from it.
  const [durationMin, setDurationMin] = useState(90);
  const [maxPlayers, setMaxPlayers] = useState(14);  // domyślny sport to piłka nożna
  const [maxPlayersTouched, setMaxPlayersTouched] = useState(false);
  const [goalkeepersEnabled, setGoalkeepersEnabled] = useState(true);
  const [reserveClaimHours, setReserveClaimHours] = useState(3);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [requireApproval, setRequireApproval] = useState(false);
  const [organizerParticipates, setOrganizerParticipates] = useState(true);
  const [organizerRole, setOrganizerRole] = useState<'field' | 'gk'>('field');
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

  const [costPln, setCostPln] = useState('');
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethod[]>([]);
  const [blikPhone, setBlikPhone] = useState('');
  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(false);
  const [cardDiscountPln, setCardDiscountPln] = useState('');
  const [acceptedSportsCards, setAcceptedSportsCards] = useState<SportsCardProvider[]>([]);
  const [sportsCardOtherName, setSportsCardOtherName] = useState('');

  // Attach the new event to a group when arriving via ?group=
  const groupId = searchParams.get('group') || undefined;
  const preFieldId = searchParams.get('fieldId');
  const [groupName, setGroupName] = useState<string | null>(null);
  useEffect(() => {
    if (!groupId) return;
    import('@/lib/groups').then(({ getGroup }) =>
      getGroup(groupId).then((g) => {
        if (!g) return;
        setGroupName(g.name);
        if (g.sport) setSport(g.sport);
        // Prefill the group's home venue (unless a field was passed explicitly).
        if (g.fieldId && !preFieldId) {
          getField(g.fieldId)
            .then((f) => setLocation((cur) => cur.venue || cur.lat !== null ? cur : { venue: f, lat: f.lat, lng: f.lng, address: f.address }))
            .catch(() => {});
        }
      }).catch(() => {}),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Pre-select field from URL ?fieldId=
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
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Skład, rezerwa i podział kosztów liczą się same</li>
            <li className="flex items-start gap-2"><span aria-hidden="true">✓</span> Otwórz mecz publicznie, a zobaczą go gracze z okolicy</li>
          </ul>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                <Lock className="w-4 h-4 text-primary-700" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">Zaloguj się, żeby opublikować mecz</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Google, e-mail albo link bez hasła.
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

          {/* Preview kreatora — prawdziwe etykiety i emoji sportów zamiast
              generycznych szarych belek, żeby faktycznie było widać, co jest
              pod blurem. */}
          <div className="relative mt-8 rounded-2xl border border-slate-200 bg-white overflow-hidden select-none pointer-events-none" aria-hidden="true">
            <div className="p-5 space-y-4 blur-[1.5px] opacity-90">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Sport</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FOCUS_SPORTS.map((s, i) => (
                    <div
                      key={s}
                      className={[
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium',
                        i === 0
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-slate-200 text-slate-600',
                      ].join(' ')}
                    >
                      <span>{sportEmoji(s)}</span>
                      <span>{sportLabel(s)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Lokalizacja</p>
                <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 via-slate-50 to-primary-50">
                  <div
                    className="absolute inset-0 text-slate-400 opacity-40"
                    style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '14px 14px' }}
                  />
                  <MapPin className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary-700" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">Data meczu</div>
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">18:00</div>
              </div>

              <div className="flex h-11 items-center justify-center rounded-xl bg-primary-700 text-sm font-semibold text-white">
                Dalej →
              </div>
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

  /**
   * Enter w polu tekstowym wysyła formularz — przeglądarka robi to sama, gdy
   * formularz ma przycisk `type="submit"`. Na kroku 3 są pola „Tytuł" i „Opis"
   * ORAZ „Opublikuj mecz", więc Enter po wpisaniu tytułu publikował mecz
   * natychmiast, bez pytania. Z perspektywy organizatora wyglądało to tak,
   * jakby kreator sam przeskoczył dalej.
   *
   * Blokujemy tylko pola jednoliniowe: w `<textarea>` Enter ma robić nową
   * linię, a przyciski muszą działać z klawiatury (dostępność).
   */
  const blokujEnter = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'submit') {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    // Druga linia obrony: publikuje wyłącznie krok 3. Gdyby jakakolwiek inna
    // droga wywołała submit, mecz nie powstanie przypadkiem.
    if (step !== 3) return;

    const errs: Record<string, string> = { ...validateStep1(location), ...validateStep2(date, time) };
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // scroll to first error
      setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    const endTime = addMinutes(time, durationMin);

    const fieldName = location.venue
      ? location.venue.name
      : (location.address.split(',')[0].trim() || 'Nieznana lokalizacja');
    const hasCost = parseFloat(costPln || '0') > 0;

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
          endTime: endTime ?? undefined,
          maxPlayers,
          maxGoalkeepers: 2,
          goalkeepersEnabled: GK_SPORTS.includes(sport) ? goalkeepersEnabled : false,
          reserveClaimHours,
          visibility,
          requireSmsConfirmation: false,
          // No "advanced" section: paid match tracks payments and shows the
          // status to players; attendance is always on. One decision fewer.
          trackAttendance: true,
          teamMode: 'brak',
          trackPayments: hasCost,
          showPaymentStatus: hasCost,
          trackResults: true,
          confirmationDeadlineH: 24,
          costGrosze: Math.round(parseFloat(costPln || '0') * 100),
          acceptedPaymentMethods: hasCost ? acceptedPaymentMethods : [],
          blikPhone: hasCost && acceptedPaymentMethods.includes('blik') ? blikPhone : undefined,
          acceptedSportsCards: hasCost && cardDiscountEnabled ? acceptedSportsCards : [],
          sportsCardDiscountGrosze: hasCost && cardDiscountEnabled && cardDiscountPln
            ? Math.round(parseFloat(cardDiscountPln) * 100)
            : null,
          sportsCardOtherName: hasCost && cardDiscountEnabled && acceptedSportsCards.includes('inne')
            ? sportsCardOtherName
            : undefined,
          requireApproval,
          groupId,
        },
        user.id,
        displayName(user),
        organizerParticipates,
        organizerParticipates && GK_SPORTS.includes(sport) && goalkeepersEnabled && organizerRole === 'gk',
      );
      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć wydarzenia');
      setSubmitting(false);
    }
  };

  // Domyślny skład per sport — tyle, ile realnie schodzi na amatorskim meczu
  // w Polsce, żeby stepper był poprawką, a nie obowiązkowym krokiem.
  // Stosowane tylko dopóki organizator sam nie ruszy licznika.
  const SPORT_PLAYERS: Record<string, number> = {
    'piłka nożna': 14,          // 7v7 — format orlika
    futsal: 10,                 // 5v5
    siatkówka: 12,              // 6v6
    'siatkówka plażowa': 4,     // 2v2
    koszykówka: 10,             // 5v5
    'piłka ręczna': 14,         // 7v7
  };
  const sportDefaultPlayers = (s: string) => SPORT_PLAYERS[s] ?? 10;
  const selectSport = (s: string) => {
    setSport(s);
    if (!maxPlayersTouched) setMaxPlayers(sportDefaultPlayers(s));
    if (location.venue && !location.venue.sport.includes(s)) {
      setLocation(EMPTY_LOCATION);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  /**
   * Handles both "Dalej" and clicking a step number directly. Going back is
   * always allowed without validation. Going forward validates every step
   * between the current one and the target, stopping (and showing the same
   * inline error as today) at the first one that blocks — so jumping from
   * step 1 straight to step 3 behaves exactly like clicking "Dalej" twice.
   */
  const attemptGoToStep = (target: number) => {
    if (target === step) return;

    if (target < step) {
      setFieldErrors({});
      setStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let s = step; s < target; s++) {
      const errs = validateStep(s, { location, date, time });
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setStep(s);
        setTimeout(() => document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        return;
      }
    }
    setFieldErrors({});
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <HideBottomNav />
      <Header />

      {/* Step indicator — sticky under the header. Numbers are clickable:
          jumping ahead runs the same validation as "Dalej" and stops on the
          first step that blocks. */}
      <div className="sticky top-16 z-[900] border-b border-slate-200 bg-canvas dark:border-slate-700">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          {[1, 2, 3].map((n) => {
            const done = n < step;
            const current = n === step;
            return (
              <button
                key={n}
                type="button"
                onClick={() => attemptGoToStep(n)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Krok ${n}: ${STEP_TITLES[n - 1]}`}
                className={clsx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2',
                  (current || done) && 'bg-primary-700 text-white',
                  current && 'ring-4 ring-primary-100 dark:ring-primary-900',
                  !current && !done && 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
              </button>
            );
          })}
          <span className="ml-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {STEP_TITLES[step - 1]}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {groupName && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
            <Users className="w-4 h-4 shrink-0" />
            Mecz w grupie <span className="font-semibold">{groupName}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={blokujEnter} className="space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Sport — one scrollable row of chips plus a compact dropdown,
                  so "Dalej" stays above the fold on a phone. */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-2 overflow-x-auto pb-1 -mb-1 [-webkit-overflow-scrolling:touch]">
                  {SPORTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectSport(s)}
                      className={[
                        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
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
                {/* Native select disguised as a small button — opens the system
                    picker, useful when the wanted sport is scrolled out of view. */}
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                  <select
                    value={sport}
                    onChange={(e) => selectSport(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Wybierz sport"
                  >
                    {SPORTS.map((s) => (
                      <option key={s} value={s}>{sportEmoji(s)} {sportLabel(s)}</option>
                    ))}
                  </select>
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
                <div className="h-64 sm:h-80 rounded-xl overflow-hidden border border-slate-200">
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
                    min={new Date().toISOString().slice(0, 10)}
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
                  <TimeSelect value={time} onChange={setTime} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Czas gry</label>
                  <select
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className={inputCls}
                  >
                    {[60, 90, 120, 150, 180].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                  {addMinutes(time, durationMin) && (
                    <p className="mt-1 text-xs text-slate-500">Koniec o {addMinutes(time, durationMin)}</p>
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
                    onClick={() => { setMaxPlayersTouched(true); setMaxPlayers((v) => Math.max(2, v - 1)); }}
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
                    onClick={() => { setMaxPlayersTouched(true); setMaxPlayers((v) => Math.min(30, v + 1)); }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    disabled={maxPlayers >= 30}
                    aria-label="Zwiększ liczbę miejsc"
                  >
                    +
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Kolejni chętni trafią na listę rezerwową.</p>
              </div>

              {/* Goalkeeper distinction — sports with a goalkeeper only */}
              {GK_SPORTS.includes(sport) && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div className="pr-3">
                    <p className="text-sm font-medium text-slate-900">Rozróżniaj bramkarzy</p>
                    <p className="text-xs text-slate-500">
                      Gracze wybierają: bramkarz lub zawodnik z pola. Max 2 bramkarzy
                      i {Math.max(0, maxPlayers - 2)} zawodników z pola — kolejni trafią na rezerwę.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoalkeepersEnabled((v) => !v)}
                    className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', goalkeepersEnabled ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
                    role="switch"
                    aria-checked={goalkeepersEnabled}
                  >
                    <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', goalkeepersEnabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
                  </button>
                </div>
              )}

              {/* Ile czasu ma rezerwowy na przyjęcie zwolnionego miejsca */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Czas na decyzję z rezerwy
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Gdy ktoś się wypisze, miejsce dostaje pierwsza osoba z rezerwy. Tyle ma
                  na kliknięcie „Wchodzę", zanim przejdzie do kolejnej.
                </p>
                <select
                  value={reserveClaimHours}
                  onChange={(e) => setReserveClaimHours(Number(e.target.value))}
                  className={`${inputCls} max-w-[160px]`}
                >
                  <option value={1}>1 godzina</option>
                  <option value={3}>3 godziny</option>
                  <option value={6}>6 godzin</option>
                  <option value={12}>12 godzin</option>
                  <option value={24}>24 godziny</option>
                </select>
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

              {/* Payment options — only relevant once the match actually costs something */}
              {parseFloat(costPln || '0') > 0 && (
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Jak można zapłacić?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAcceptedPaymentMethods((cur) =>
                            cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m])}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                            acceptedPaymentMethods.includes(m)
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {PAYMENT_METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {acceptedPaymentMethods.includes('blik') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Numer telefonu do BLIKA
                      </label>
                      <input
                        type="tel"
                        value={blikPhone}
                        onChange={(e) => setBlikPhone(e.target.value)}
                        placeholder="np. 600 123 456"
                        className={inputCls}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Zniżka z kartą sportową</p>
                      <p className="text-xs text-slate-500">Multisport, FitProfit, Medicover Sport…</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardDiscountEnabled((v) => !v)}
                      className={['relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', cardDiscountEnabled ? 'bg-primary-600' : 'bg-slate-200'].join(' ')}
                      role="switch"
                      aria-checked={cardDiscountEnabled}
                    >
                      <span className={['pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', cardDiscountEnabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
                    </button>
                  </div>

                  {cardDiscountEnabled && (
                    <div className="space-y-3 pl-1">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Zniżka (zł) <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          max={costPln || undefined}
                          value={cardDiscountPln}
                          onChange={(e) => setCardDiscountPln(e.target.value)}
                          placeholder="np. 20"
                          className={`${inputCls} max-w-[140px]`}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Zostaw puste, jeśli zniżka zależy od dnia, limitu wejść itp. — gracze zobaczą,
                          że karta daje zniżkę, i dopytają Cię o szczegóły.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Które karty akceptujesz?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SPORTS_CARD_PROVIDERS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setAcceptedSportsCards((cur) =>
                                cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])}
                              className={[
                                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                acceptedSportsCards.includes(c)
                                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              {SPORTS_CARD_LABELS[c]}
                            </button>
                          ))}
                        </div>
                        {acceptedSportsCards.includes('inne') && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={sportsCardOtherName}
                              onChange={(e) => setSportsCardOtherName(e.target.value)}
                              placeholder="Jaka karta? np. OK System"
                              maxLength={40}
                              className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Organizer participates */}
              <div className="py-2 border-b border-slate-100">
                <div className="flex items-center justify-between">
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
                {organizerParticipates && GK_SPORTS.includes(sport) && goalkeepersEnabled && (
                  <div className="mt-2 flex gap-2">
                    {([['field', 'Zawodnik z pola'], ['gk', '🧤 Bramkarz']] as const).map(([role, label]) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setOrganizerRole(role)}
                        className={[
                          'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                          organizerRole === role
                            ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

            </>
          )}

          {/* Sticky action bar — replaces the old two-line, per-step button
              pairs. "Wróć" (left) never validates; "Dalej"/"Opublikuj" (right,
              flex-1) run the same attemptGoToStep validation as clicking a
              step number. */}
          <div
            className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-slate-200 bg-canvas px-4 pt-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] dark:border-slate-700"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0"
                  onClick={() => attemptGoToStep(step - 1)}
                >
                  ← Wróć
                </Button>
              )}
              {step < 3 ? (
                <Button type="button" size="lg" className="flex-1" onClick={() => attemptGoToStep(step + 1)}>
                  Dalej →
                </Button>
              ) : (
                <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
                  Opublikuj mecz →
                </Button>
              )}
            </div>
          </div>

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
