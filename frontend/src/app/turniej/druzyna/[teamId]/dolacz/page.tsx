'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, MapPin, CalendarDays, ChevronRight, Star, Loader2, UserPlus, ShieldCheck, Crown,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import { useAuth, displayName } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { getTeam, joinTeam } from '@/lib/tournaments';
import { ALL_POSITIONS, POSITION_LABELS, POSITION_TONE, formatDays } from '@/lib/tournamentLabels';
import type { TournamentTeam, PlayerPosition } from '@/types';

export default function JoinTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [team, setTeam] = useState<TournamentTeam | null>(null);
  const [ready, setReady] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);

  const [position, setPosition] = useState<PlayerPosition>('uniwersalny');
  const [shirtNumber, setShirtNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTeam(teamId)
      .then((tm) => {
        setTeam(tm);
        if (tm && user) {
          setIsCaptain(tm.captainId === user.id);
          const already = (tm.members ?? []).some((m) => m.userId === user.id);
          setAlreadyMember(already);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [teamId, user]);

  async function join() {
    if (!user || !team) return;
    setSaving(true);
    try {
      await joinTeam(teamId, user.id, displayName(user), position, shirtNumber ? parseInt(shirtNumber, 10) : undefined);
      toast('Dołączyłeś do drużyny! 🎉', 'success');
      router.push(`/turniej/druzyna/${teamId}`);
    } catch (e: any) {
      toast(e?.message ?? 'Nie udało się dołączyć.', 'error');
      setSaving(false);
    }
  }

  if (loading || !ready) {
    return <div className="min-h-screen"><Header />
      <div className="flex items-center justify-center py-32 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
    </div>;
  }

  if (!team) {
    return <div className="min-h-screen bg-canvas"><Header />
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-slate-500">Nie znaleziono drużyny.</p>
        <Link href="/turniej" className="mt-4 inline-block text-primary-700">← Turniej</Link>
      </div>
    </div>;
  }

  const currentCount = team.members?.length ?? 0;
  const maxSquad = 12;

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-lg px-4 py-10">

        {/* Team card */}
        <div className="overflow-hidden rounded-3xl bg-primary-700 text-white shadow-card">
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-2xl font-extrabold">
              {team.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold">{team.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-white/75">
                {team.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{team.district}</span>}
                <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" />{team.captainName}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
                <CalendarDays className="h-3.5 w-3.5" /> {formatDays(team.availabilityDays)}
              </p>
            </div>
          </div>
          <div className="bg-black/10 px-6 py-2 text-sm text-white/80">
            <Users className="mr-1.5 inline h-4 w-4" />
            {currentCount} zawodników · {Math.max(0, maxSquad - currentCount)} wolnych miejsc
          </div>
        </div>

        {/* States */}
        {isCaptain && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary-700" />
            <p className="mt-2 font-semibold text-ink">Jesteś kapitanem tej drużyny</p>
            <Link href={`/turniej/druzyna/${teamId}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
              Zarządzaj drużyną <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {alreadyMember && !isCaptain && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card">
            <Star className="mx-auto h-8 w-8 fill-accent-500 text-accent-500" />
            <p className="mt-2 font-semibold text-ink">Jesteś już w tej drużynie!</p>
            <Link href={`/turniej/druzyna/${teamId}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
              Zobacz drużynę <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!isCaptain && !alreadyMember && !user && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-ink">Dołącz do drużyny</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Potrzebujesz konta BOJO — rejestracja zajmuje 30 sekund i otwiera dostęp do
              całej platformy: znajdowanie gier, rezerwacje boisk i więcej.
            </p>
            <div className="mt-5 space-y-2">
              <Link
                href={`/logowanie?next=/turniej/druzyna/${teamId}/dolacz`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 py-3 font-semibold text-white hover:bg-primary-800"
              >
                <UserPlus className="h-5 w-5" /> Zarejestruj się i dołącz
              </Link>
              <p className="text-center text-xs text-slate-400">Masz już konto? Ten sam link zaloguje Cię i doda do drużyny.</p>
            </div>
          </div>
        )}

        {!isCaptain && !alreadyMember && user && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-ink">Dołącz jako {displayName(user)}</h2>
            <p className="mt-1 text-sm text-slate-500">Wybierz pozycję — kapitan może ją później zmienić.</p>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-ink">Pozycja</p>
              <div className="flex flex-wrap gap-2">
                {ALL_POSITIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPosition(p)}
                    className={clsx(
                      'rounded-full px-3.5 py-2 text-sm font-semibold transition-all',
                      position === p
                        ? POSITION_TONE[p] + ' ring-2 ring-offset-1 ring-current/30'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                    )}
                  >
                    {POSITION_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-ink">
                Numer na koszulce <span className="font-normal text-slate-400">(opcjonalnie)</span>
              </label>
              <input
                value={shirtNumber}
                onChange={(e) => {
                  const n = e.target.value.replace(/\D/, '');
                  if (!n || (parseInt(n, 10) >= 1 && parseInt(n, 10) <= 99)) setShirtNumber(n);
                }}
                placeholder="np. 9"
                inputMode="numeric"
                maxLength={2}
                className="mt-1.5 w-24 rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-bold outline-none focus:border-primary-500"
              />
            </div>

            <button
              type="button"
              onClick={join}
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-base font-bold text-primary-950 hover:bg-accent-400 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              Dołącz do drużyny {team.name}
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Turniej organizowany przez BOJO · Tylko sport zespołowy · Poznań
        </p>
      </div>
    </div>
  );
}
