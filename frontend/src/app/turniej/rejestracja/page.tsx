'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Plus, Trash2, Check, ChevronLeft, ChevronRight, Shield,
  CalendarDays, Trophy, Star, AlertCircle, Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getActiveTournament, getMyTeam, registerTeam,
  type SquadMemberInput,
} from '@/lib/tournaments';
import {
  ALL_POSITIONS, POSITION_LABELS, POSITION_TONE,
  DAY_NAMES_FULL, DAY_NAMES,
} from '@/lib/tournamentLabels';
import type { Tournament, PlayerPosition } from '@/types';

interface DraftMember extends SquadMemberInput {
  key: string;
}

function newMember(isCaptain = false): DraftMember {
  return {
    key: Math.random().toString(36).slice(2),
    name: '',
    position: isCaptain ? 'pomocnik' : 'uniwersalny',
    shirtNumber: undefined,
    isCaptain,
    isReserve: false,
  };
}

const STEPS = ['Drużyna', 'Skład', 'Dostępność'] as const;

export default function TeamRegistrationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [t, setT] = useState<Tournament | null>(null);
  const [alreadyTeam, setAlreadyTeam] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // form state
  const [teamName, setTeamName] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [fromTime, setFromTime] = useState('18:00');
  const [toTime, setToTime] = useState('21:00');
  const [finalsConfirmed, setFinalsConfirmed] = useState(false);

  useEffect(() => {
    if (loading) return;
    getActiveTournament().then(async (tour) => {
      setT(tour);
      if (tour && user) {
        const mine = await getMyTeam(tour.id, user.id);
        if (mine) setAlreadyTeam(mine.id);
      }
      setReady(true);
    });
  }, [loading, user]);

  // seed the squad with the captain as first row once we know the user
  useEffect(() => {
    if (user && members.length === 0) {
      const captain = newMember(true);
      captain.name = displayName(user);
      const min = t?.minSquad ?? 5;
      const rest = Array.from({ length: Math.max(0, min - 1) }, () => newMember());
      setMembers([captain, ...rest]);
    }
  }, [user, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const minSquad = t?.minSquad ?? 5;
  const maxSquad = t?.maxSquad ?? 10;
  const filledMembers = useMemo(() => members.filter((m) => m.name.trim()), [members]);

  function updateMember(key: string, patch: Partial<DraftMember>) {
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }
  function removeMember(key: string) {
    setMembers((prev) => prev.filter((m) => m.key !== key));
  }
  function addMember() {
    if (members.length >= maxSquad) return;
    setMembers((prev) => [...prev, newMember()]);
  }
  function setCaptain(key: string) {
    setMembers((prev) => prev.map((m) => ({ ...m, isCaptain: m.key === key })));
  }
  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  // ── validation per step ───────────────────────────────────────────────
  const step0Ok = teamName.trim().length >= 2;
  const step1Ok = filledMembers.length >= minSquad && members.some((m) => m.isCaptain && m.name.trim());
  const step2Ok = days.length > 0;

  async function submit() {
    if (!user || !t) return;
    setSaving(true);
    try {
      const teamId = await registerTeam(t.id, user.id, {
        name: teamName,
        district: district || undefined,
        captainName: displayName(user),
        captainPhone: phone || undefined,
        captainEmail: user.email ?? undefined,
        availabilityDays: days,
        availabilityFrom: fromTime || undefined,
        availabilityTo: toTime || undefined,
        finalsConfirmed,
        squad: filledMembers.map(({ key, ...m }) => m),
      });
      toast('Drużyna zgłoszona! Do zobaczenia na boisku 🏆', 'success');
      router.push(`/turniej/druzyna/${teamId}`);
    } catch (e: any) {
      toast(e?.message ?? 'Nie udało się zgłosić drużyny.', 'error');
      setSaving(false);
    }
  }

  // ── guards ────────────────────────────────────────────────────────────
  if (loading || !ready) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center py-32 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Guard
        title="Zaloguj się, aby zgłosić drużynę"
        body="Rejestracja drużyny wymaga konta — zajmuje to chwilę."
        cta="Zaloguj się"
        href="/logowanie?next=/turniej/rejestracja"
      />
    );
  }

  if (alreadyTeam) {
    return (
      <Guard
        title="Masz już zgłoszoną drużynę"
        body="W tej edycji możesz prowadzić jedną drużynę."
        cta="Przejdź do drużyny"
        href={`/turniej/druzyna/${alreadyTeam}`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/turniej" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Wróć do turnieju
        </Link>

        <h1 className="font-display text-3xl font-extrabold text-ink">Zgłoś drużynę</h1>
        <p className="mt-1 text-slate-500">{t?.name ?? 'BOJO Community Cup'}</p>

        {/* Stepper */}
        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                i < step ? 'bg-primary-700 text-white'
                  : i === step ? 'bg-primary-700 text-white ring-4 ring-primary-100'
                  : 'bg-slate-200 text-slate-500',
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={clsx('hidden text-sm font-medium sm:block', i === step ? 'text-ink' : 'text-slate-400')}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          {/* ── STEP 0: Team ──────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <Field label="Nazwa drużyny" hint="2–40 znaków, widoczna publicznie">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.slice(0, 40))}
                  placeholder="np. Orły Winogrady"
                  className="input"
                  autoFocus
                />
              </Field>
              <Field label="Dzielnica / rejon" hint="Skąd jesteście? (opcjonalnie)">
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="np. Jeżyce, Grunwald, Nowe Miasto…"
                  className="input"
                />
              </Field>
              <Field label="Telefon kapitana" hint="Do kontaktu w sprawach meczów (opcjonalnie)">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="600 700 800"
                  inputMode="tel"
                  className="input"
                />
              </Field>
              <div className="rounded-xl bg-primary-50 p-3.5 text-sm text-primary-800">
                <Shield className="mr-1.5 inline h-4 w-4" />
                Jesteś kapitanem tej drużyny ({displayName(user)}). Tylko Ty zarządzasz składem
                i umawiasz mecze.
              </div>
            </div>
          )}

          {/* ── STEP 1: Squad ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-ink">Skład</h2>
                  <p className="text-sm text-slate-500">
                    {filledMembers.length}/{maxSquad} · minimum {minSquad}
                  </p>
                </div>
                <button
                  onClick={addMember}
                  disabled={members.length >= maxSquad}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" /> Zawodnik
                </button>
              </div>

              <div className="space-y-2.5">
                {members.map((m, idx) => (
                  <div key={m.key} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={m.shirtNumber ?? ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          updateMember(m.key, { shirtNumber: isNaN(n) ? undefined : Math.min(99, Math.max(1, n)) });
                        }}
                        placeholder="#"
                        inputMode="numeric"
                        className="w-12 shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm font-bold tabular-nums focus:border-primary-500 focus:outline-none"
                      />
                      <input
                        value={m.name}
                        onChange={(e) => updateMember(m.key, { name: e.target.value })}
                        placeholder={idx === 0 ? 'Kapitan — imię i nazwisko' : 'Imię i nazwisko'}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                      <button
                        onClick={() => removeMember(m.key)}
                        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Usuń zawodnika"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* position picker */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {ALL_POSITIONS.map((p) => (
                        <button
                          key={p}
                          onClick={() => updateMember(m.key, { position: p })}
                          className={clsx(
                            'rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
                            m.position === p
                              ? POSITION_TONE[p] + ' ring-2 ring-offset-1 ring-current/30'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                          )}
                        >
                          {POSITION_LABELS[p]}
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={m.isReserve}
                            onChange={(e) => updateMember(m.key, { isReserve: e.target.checked })}
                            className="accent-primary-700"
                          />
                          Rezerwa
                        </label>
                        <button
                          onClick={() => setCaptain(m.key)}
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                            m.isCaptain ? 'bg-accent-100 text-accent-700' : 'text-slate-400 hover:text-slate-600',
                          )}
                          title="Ustaw jako kapitana"
                        >
                          <Star className={clsx('h-3.5 w-3.5', m.isCaptain && 'fill-accent-500 text-accent-500')} />
                          {m.isCaptain ? 'Kapitan' : ''}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!step1Ok && (
                <p className="flex items-center gap-1.5 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  Uzupełnij co najmniej {minSquad} zawodników i wskaż kapitana.
                </p>
              )}
            </div>
          )}

          {/* ── STEP 2: Availability ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-semibold text-ink">W jakie dni gracie?</h2>
                <p className="text-sm text-slate-500">
                  Dobierzemy rywali tak, by mieli ten sam dzień co wy — łatwiej umówić mecz.
                </p>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {DAY_NAMES.map((label, i) => {
                    const d = i + 1;
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={clsx(
                          'rounded-xl py-2.5 text-sm font-semibold transition-colors',
                          on ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                        title={DAY_NAMES_FULL[i]}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gracie od">
                  <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="input" />
                </Field>
                <Field label="Gracie do">
                  <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="input" />
                </Field>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={finalsConfirmed}
                  onChange={(e) => setFinalsConfirmed(e.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-primary-700"
                />
                <span className="text-sm text-slate-700">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Trophy className="h-4 w-4 text-accent-600" /> Potwierdzamy obecność na Finals Day
                  </span>
                  Jeśli awansujemy, pojawimy się na wielkim finale.
                </span>
              </label>

              {/* Summary */}
              <div className="rounded-2xl bg-primary-50 p-4 text-sm">
                <p className="font-semibold text-primary-800">Podsumowanie</p>
                <ul className="mt-2 space-y-1 text-primary-700/90">
                  <li className="flex items-center gap-2"><Users className="h-4 w-4" /> {teamName || 'Twoja drużyna'} · {filledMembers.length} zawodników</li>
                  <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {days.length ? days.sort((a, b) => a - b).map((d) => DAY_NAMES[d - 1]).join(', ') : 'wybierz dni'} · {fromTime}–{toTime}</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── nav ───────────────────────────────────────────────────── */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" /> Wstecz
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 0 && !step0Ok) || (step === 1 && !step1Ok)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40"
              >
                Dalej <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!step2Ok || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-bold text-primary-950 hover:bg-accent-400 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Zgłoś drużynę
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          padding: 0.625rem 0.875rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.input:focus) {
          border-color: #15663e;
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function Guard({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <Trophy className="h-7 w-7 text-primary-700" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-slate-500">{body}</p>
        <Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-6 py-3 font-semibold text-white hover:bg-primary-800">
          {cta} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
