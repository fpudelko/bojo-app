'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, ChevronLeft, ChevronRight, Shield, CalendarDays,
  Check, AlertCircle, Loader2, Copy, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getActiveTournament, getMyTeam, registerTeam } from '@/lib/tournaments';
import { DAY_NAMES, DAY_NAMES_FULL } from '@/lib/tournamentLabels';
import type { Tournament } from '@/types';

const STEPS = ['Drużyna', 'Dostępność'] as const;

export default function TeamRegistrationPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [t, setT] = useState<Tournament | null>(null);
  const [alreadyTeamId, setAlreadyTeamId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // success state
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // form
  const [teamName, setTeamName] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [fromTime, setFromTime] = useState('18:00');
  const [toTime, setToTime] = useState('21:00');
  const [finalsConfirmed, setFinalsConfirmed] = useState(false);

  useEffect(() => {
    if (loading) return;
    getActiveTournament()
      .then(async (tour) => {
        setT(tour);
        if (tour && user) {
          const mine = await getMyTeam(tour.id, user.id);
          if (mine) setAlreadyTeamId(mine.id);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [loading, user]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function submit() {
    if (!user || !t) {
      toast('Turniej niedostępny — odśwież stronę i spróbuj ponownie.', 'error');
      return;
    }
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
        squad: [], // players join themselves via invite link
      });
      setCreatedTeamId(teamId);
    } catch (e: any) {
      toast(e?.message ?? 'Nie udało się zgłosić drużyny.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const step0Ok = teamName.trim().length >= 2;
  const step1Ok = days.length > 0;

  const inviteUrl = createdTeamId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/turniej/druzyna/${createdTeamId}/dolacz`
    : '';

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── guards ──────────────────────────────────────────────────────────────

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
    return <Guard
      title="Zaloguj się, aby zgłosić drużynę"
      body="Kapitan musi mieć konto BOJO — zajmuje to 30 sekund."
      cta="Zaloguj się"
      href="/logowanie?next=/turniej/rejestracja"
    />;
  }

  if (alreadyTeamId) {
    return <Guard
      title="Masz już zgłoszoną drużynę"
      body="W tej edycji możesz prowadzić jedną drużynę jako kapitan."
      cta="Przejdź do drużyny"
      href={`/turniej/druzyna/${alreadyTeamId}`}
    />;
  }

  if (!t) {
    return <Guard
      title="Zapisy są chwilowo niedostępne"
      body="Turniej jest w przygotowaniu lub zapisy zostały zamknięte. Sprawdź stronę turnieju."
      cta="Wróć do turnieju"
      href="/turniej"
    />;
  }

  // ── success screen ───────────────────────────────────────────────────────

  if (createdTeamId) {
    return (
      <div className="min-h-screen bg-canvas">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-700">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">
            Drużyna {teamName} zgłoszona!
          </h1>
          <p className="mt-2 text-slate-500">
            Teraz zaproś graczy. Każdy kliknie link i dołączy do drużyny przez swoje konto BOJO
            — to ich punkt wejścia do aplikacji.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card text-left">
            <p className="text-sm font-semibold text-ink">Link dla zawodników</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Wrzuć do grupki na WhatsApp/Messenger — każdy musi się zarejestrować w BOJO, żeby dołączyć.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl bg-slate-100 px-3 py-2.5 text-xs text-slate-700">
                {inviteUrl}
              </code>
              <button
                onClick={copyLink}
                className={clsx(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  copied
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-primary-700 text-white hover:bg-primary-800',
                )}
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/turniej/druzyna/${createdTeamId}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3 font-semibold text-white hover:bg-primary-800"
            >
              Przejdź do drużyny <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/turniej"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 font-semibold text-slate-600 hover:bg-slate-50"
            >
              Wróć na stronę turnieju
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── form ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-xl px-4 py-8">
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

          {/* ── Step 0: team basics ───────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <FieldRow label="Nazwa drużyny" hint="2–40 znaków, widoczna publicznie">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.slice(0, 40))}
                  placeholder="np. Orły Winogrady"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
                />
              </FieldRow>
              <FieldRow label="Dzielnica / rejon" hint="Opcjonalnie — pomaga dobrać rywali z okolicy">
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="np. Jeżyce, Grunwald, Wilda…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
                />
              </FieldRow>
              <FieldRow label="Telefon kapitana" hint="Do kontaktu w sprawach meczów (opcjonalnie)">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="600 700 800"
                  inputMode="tel"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
                />
              </FieldRow>

              <div className="rounded-xl bg-primary-50 p-3.5 text-sm text-primary-800">
                <Shield className="mr-1.5 inline h-4 w-4" />
                Kapitan: <strong>{displayName(user)}</strong> — po rejestracji dostaniesz link,
                który wrzucasz ekipie. Każdy dołącza przez swoje konto BOJO.
              </div>
            </div>
          )}

          {/* ── Step 1: availability ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-ink">W jakie dni gracie?</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Dobierzemy grupę tak, by rywale mieli ten sam dzień — łatwiej umówić mecze.
                </p>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {DAY_NAMES.map((label, i) => {
                    const d = i + 1;
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        title={DAY_NAMES_FULL[i]}
                        className={clsx(
                          'rounded-xl py-2.5 text-sm font-semibold transition-colors',
                          on ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!step1Ok && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" /> Zaznacz co najmniej jeden dzień.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Od">
                  <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
                </FieldRow>
                <FieldRow label="Do">
                  <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500" />
                </FieldRow>
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

              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-ink">Podsumowanie</p>
                <ul className="mt-2 space-y-1 text-slate-600">
                  <li>🏟 <strong>{teamName}</strong>{district ? ` · ${district}` : ''}</li>
                  <li><CalendarDays className="mr-1 inline h-4 w-4" />
                    {days.sort((a, b) => a - b).map((d) => DAY_NAMES[d - 1]).join(', ')} · {fromTime}–{toTime}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* nav */}
          <div className="mt-7 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:invisible"
            >
              <ChevronLeft className="h-4 w-4" /> Wstecz
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!step0Ok}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40"
              >
                Dalej <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!step1Ok || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-bold text-primary-950 hover:bg-accent-400 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Zgłoś drużynę
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
