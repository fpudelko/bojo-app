'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lock, Globe, ArrowLeft, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import TimeSelect from '@/components/ui/TimeSelect';
import VenuePicker from '@/components/map/VenuePicker';
import RemindersSection from '@/components/events/RemindersSection';
import { SHOW_SMS_FEATURES } from '@/lib/features';
import { useAuth } from '@/lib/auth';
import { useAdmin } from '@/lib/admin';
import { getEvent, updateEvent } from '@/lib/events';
import { getField } from '@/lib/api';
import { surfaceLabel, venueThumbnail } from '@/lib/labels';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SPORTS_CARD_PROVIDERS, SPORTS_CARD_LABELS } from '@/lib/payments';
import type { Field, Visibility, TeamMode, PaymentMethod, SportsCardProvider } from '@/types';

// Sports where a goalkeeper / field-player distinction makes sense.
const GK_SPORTS = ['piłka nożna', 'futsal'];

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
import Link from 'next/link';

import { FOCUS_SPORTS, sportLabel } from '@/lib/sports';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useAdmin();

  const [pageLoading, setPageLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const [sport, setSport] = useState('piłka nożna');
  const [field, setField] = useState<Field | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [goalkeepersEnabled, setGoalkeepersEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [requireApproval, setRequireApproval] = useState(false);
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
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethod[]>([]);
  const [blikPhone, setBlikPhone] = useState('');
  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(false);
  const [cardDiscountPln, setCardDiscountPln] = useState('');
  const [acceptedSportsCards, setAcceptedSportsCards] = useState<SportsCardProvider[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotAllowed(true); setPageLoading(false); return; }

    getEvent(id)
      .then(async ({ event: ev }) => {
        if (ev.organizerId !== user.id && !isAdmin) { setNotAllowed(true); return; }

        setSport(ev.sport);
        setDate(ev.date);
        setTime(ev.time?.slice(0, 5) ?? '18:00');
        setEndTime(ev.endTime?.slice(0, 5) ?? '');
        setMaxPlayers(ev.maxPlayers);
        setGoalkeepersEnabled(ev.goalkeepersEnabled ?? false);
        setTitle(ev.title ?? '');
        setDescription(ev.description ?? '');
        setVisibility(ev.visibility);
        setRequireApproval(ev.requireApproval);
        setRequireSmsConfirmation(ev.requireSmsConfirmation);
        setTrackAttendance(ev.trackAttendance);
        setTeamMode(ev.teamMode);
        setTrackPayments(ev.trackPayments);
        setShowPaymentStatus(ev.showPaymentStatus);
        setTrackResults(ev.trackResults);
        setConfirmationDeadlineH(ev.confirmationDeadlineH);
        if (ev.costGrosze > 0) setCostPln(String(ev.costGrosze / 100));
        setAcceptedPaymentMethods(ev.acceptedPaymentMethods ?? []);
        setBlikPhone(ev.blikPhone ?? '');
        setAcceptedSportsCards(ev.acceptedSportsCards ?? []);
        setCardDiscountEnabled((ev.acceptedSportsCards ?? []).length > 0);
        if (ev.sportsCardDiscountGrosze != null) setCardDiscountPln(String(ev.sportsCardDiscountGrosze / 100));
        if (ev.requireSmsConfirmation || ev.trackAttendance || ev.teamMode !== 'brak' || ev.trackPayments || ev.trackResults) {
          setAdvOpen(true);
        }

        if (ev.fieldId) {
          try {
            const f = await getField(ev.fieldId);
            setField(f);
          } catch {
            // Field may have been removed; reconstruct minimal object for display
            setField({
              id: ev.fieldId,
              name: ev.fieldName,
              sport: [ev.sport],
              address: ev.fieldName,
              lat: ev.lat ?? 0,
              lng: ev.lng ?? 0,
              available: true,
              surface: '',
              isIndoor: false,
              isBookable: false,
              bookingType: 'none' as const,
              bookingEnabled: false,
              mapVisibility: 'organizer_only',
            });
          }
        }
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setPageLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field) { setError('Wybierz boisko na mapie.'); return; }
    if (!date) { setError('Podaj datę.'); return; }
    if (endTime && endTime <= time) {
      setError('Godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    const hasCost = parseFloat(costPln || '0') > 0;

    setSubmitting(true);
    setError(null);
    try {
      await updateEvent(id, {
        sport,
        fieldId: field.id,
        fieldName: field.name,
        lat: field.lat,
        lng: field.lng,
        title: title || undefined,
        description: description || undefined,
        date,
        time,
        endTime: endTime || undefined,
        maxPlayers,
        maxGoalkeepers: 2,
        goalkeepersEnabled: GK_SPORTS.includes(sport) ? goalkeepersEnabled : false,
        visibility,
        requireApproval,
        requireSmsConfirmation,
        trackAttendance,
        teamMode,
        trackPayments,
        showPaymentStatus: trackPayments ? showPaymentStatus : false,
        trackResults,
        confirmationDeadlineH,
        costGrosze: Math.round(parseFloat(costPln || '0') * 100),
        acceptedPaymentMethods: hasCost ? acceptedPaymentMethods : [],
        blikPhone: hasCost && acceptedPaymentMethods.includes('blik') ? blikPhone : undefined,
        acceptedSportsCards: hasCost && cardDiscountEnabled ? acceptedSportsCards : [],
        sportsCardDiscountGrosze: hasCost && cardDiscountEnabled && cardDiscountPln
          ? Math.round(parseFloat(cardDiscountPln) * 100)
          : null,
      });
      router.push(`/wydarzenia/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';

  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 text-center text-slate-500">
          <div>
            <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">Brak dostępu</p>
            <p className="text-sm mt-1">Tylko organizator może edytować wydarzenie.</p>
            <Link href={`/wydarzenia/${id}`} className="text-primary-600 text-sm underline mt-4 inline-block">
              Wróć do wydarzenia
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/wydarzenia/${id}`} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Edytuj wydarzenie</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sport</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
              {(FOCUS_SPORTS.includes(sport as typeof FOCUS_SPORTS[number])
                ? FOCUS_SPORTS
                : [sport, ...FOCUS_SPORTS]
              ).map((s) => <option key={s} value={s}>{sportLabel(s)}</option>)}
            </select>
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Boisko {field && <span className="text-primary-600">— {field.name}</span>}
            </label>
            <p className="text-xs text-slate-500 mb-2">Kliknij pinezkę na mapie, aby zmienić boisko.</p>
            <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
              <VenuePicker selectedId={field?.id} onSelect={setField} />
            </div>
            {field && (
              <div className="mt-2 flex gap-3 items-center bg-slate-50 rounded-lg p-2">
                {venueThumbnail(field.lat, field.lng, 160, 100) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venueThumbnail(field.lat, field.lng, 160, 100)!}
                    alt={field.name}
                    className="w-20 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{field.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {field.address}
                  </p>
                  {field.surface && (
                    <p className="text-xs text-slate-400">{surfaceLabel(field.surface)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date / start time / end time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rozpoczęcie</label>
              <TimeSelect value={time} onChange={setTime} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Zakończenie <span className="text-slate-400 font-normal">(opcjonalnie)</span>
              </label>
              <TimeSelect value={endTime} allowEmpty onChange={setEndTime} />
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Liczba miejsc: <span className="text-primary-600 font-semibold">{maxPlayers}</span>
            </label>
            <input
              type="range" min={2} max={30} value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Goalkeeper distinction — sports with a goalkeeper only */}
          {GK_SPORTS.includes(sport) && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="pr-3">
                <p className="text-sm font-medium text-slate-900">Rozróżniaj bramkarzy</p>
                <p className="text-xs text-slate-500">Gracze wybierają bramkarz / zawodnik z pola. Max 2 bramkarzy — kolejni na rezerwę.</p>
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

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Widoczność</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button" onClick={() => setVisibility('private')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'private' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Prywatne</span>
                  <span className="block text-xs text-slate-500">Tylko przez link</span>
                </span>
              </button>
              <button
                type="button" onClick={() => setVisibility('public')}
                className={[
                  'flex items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                  visibility === 'public' ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
                ].join(' ')}
              >
                <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Publiczne</span>
                  <span className="block text-xs text-slate-500">Widoczne dla wszystkich</span>
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

          {/* Advanced settings accordion */}
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
                {SHOW_SMS_FEATURES && (
                <ToggleRow label="Potwierdzenie SMS" desc="Zaproszeni gracze potwierdzają przez SMS" checked={requireSmsConfirmation} onChange={setRequireSmsConfirmation} />
                )}
                {SHOW_SMS_FEATURES && requireSmsConfirmation && (
                  <div className="py-3">
                    <label className="block text-xs text-slate-600 mb-1">Termin potwierdzenia (h przed meczem)</label>
                    <input type="number" min={1} max={168} value={confirmationDeadlineH}
                      onChange={(e) => setConfirmationDeadlineH(Number(e.target.value))}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                )}
                <ToggleRow label="Śledzenie obecności" desc="Śledź kto przyszedł, a kto nie" checked={trackAttendance} onChange={setTrackAttendance} />
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Tryb drużyn</p>
                    <p className="text-xs text-slate-500 mt-0.5">Jak są tworzone składy</p>
                  </div>
                  <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as TeamMode)}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
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
                      <label className="block text-xs text-slate-600 mb-1">Koszt uczestnictwa (PLN)</label>
                      <input type="number" min={0} step={0.5} value={costPln}
                        onChange={(e) => setCostPln(e.target.value)}
                        placeholder="0.00"
                        className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>

                    {parseFloat(costPln || '0') > 0 && (
                      <div className="space-y-4 rounded-xl border border-slate-200 p-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">
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
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Numer telefonu do BLIKA
                            </label>
                            <input
                              type="tel"
                              value={blikPhone}
                              onChange={(e) => setBlikPhone(e.target.value)}
                              placeholder="np. 600 123 456"
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                              <label className="block text-xs font-medium text-slate-600 mb-1">
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
                                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <p className="mt-1 text-xs text-slate-500">
                                Zostaw puste, jeśli zniżka zależy od dnia, limitu wejść itp. — gracze zobaczą,
                                że karta daje zniżkę, i dopytają Cię o szczegóły.
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-2">
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
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

          <div className="flex gap-3">
            <Link href={`/wydarzenia/${id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full" size="lg">Anuluj</Button>
            </Link>
            <Button type="submit" size="lg" isLoading={submitting} className="flex-1">
              Zapisz zmiany
            </Button>
          </div>
        </form>

        {/* Reminders — standalone section, saves independently from the main form */}
        {SHOW_SMS_FEATURES && <RemindersSection eventId={id} />}
      </main>
    </div>
  );
}
