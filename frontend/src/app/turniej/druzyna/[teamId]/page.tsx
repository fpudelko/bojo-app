'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy, ChevronLeft, MapPin, Phone, Star, Shield, CalendarDays,
  Loader2, Clock, Check, X, Send, Goal, AlertCircle, Crown,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  getActiveTournament, getTeam, getTeams, getMatches, getSharedDays,
  proposeMatchSlot, acceptMatchSlot, reportResult, confirmResult,
} from '@/lib/tournaments';
import {
  POSITION_LABELS, POSITION_TONE, POSITION_SHORT, TEAM_STATUS_LABELS,
  STAGE_LABELS, DAY_NAMES, formatDays,
} from '@/lib/tournamentLabels';
import type {
  Tournament, TournamentTeam, TournamentMatch, PlayerPosition,
} from '@/types';

const POSITION_ORDER: PlayerPosition[] = ['bramkarz', 'obrońca', 'pomocnik', 'napastnik', 'uniwersalny'];

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [t, setT] = useState<Tournament | null>(null);
  const [team, setTeam] = useState<TournamentTeam | null>(null);
  const [allTeams, setAllTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [ready, setReady] = useState(false);

  async function reload(tour: Tournament) {
    const [tm, teamsAll, ma] = await Promise.all([
      getTeam(teamId), getTeams(tour.id), getMatches(tour.id),
    ]);
    setTeam(tm); setAllTeams(teamsAll); setMatches(ma);
  }

  useEffect(() => {
    getActiveTournament().then(async (tour) => {
      setT(tour);
      if (tour) await reload(tour);
      setReady(true);
    });
  }, [teamId]);

  const isCaptain = !!user && !!team && team.captainId === user.id;
  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    allTeams.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [allTeams]);

  const myMatches = useMemo(
    () => matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId),
    [matches, teamId],
  );

  if (!ready) {
    return <div className="min-h-screen"><Header />
      <div className="flex items-center justify-center py-32 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
    </div>;
  }
  if (!team) {
    return <div className="min-h-screen bg-canvas"><Header />
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-slate-500">Nie znaleziono drużyny.</p>
        <Link href="/turniej" className="mt-4 inline-block text-primary-700">← Wróć do turnieju</Link>
      </div>
    </div>;
  }

  const squadByPos = POSITION_ORDER
    .map((p) => ({ pos: p, players: (team.members ?? []).filter((m) => m.position === p) }))
    .filter((g) => g.players.length > 0);

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/turniej" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Turniej
        </Link>

        {/* Team header */}
        <div className="overflow-hidden rounded-3xl bg-primary-700 text-white shadow-card">
          <div className="flex items-center gap-4 p-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-2xl font-extrabold">
              {team.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold">{team.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                {team.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{team.district}</span>}
                <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" />{team.captainName}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDays(team.availabilityDays)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-black/10 px-6 py-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-accent-400" /> {TEAM_STATUS_LABELS[team.status]}
            </span>
            {team.finalsConfirmed && (
              <span className="inline-flex items-center gap-1.5 text-accent-400">
                <Trophy className="h-4 w-4" /> Potwierdzona obecność na finale
              </span>
            )}
          </div>
        </div>

        {isCaptain && (
          <div className="mt-3 rounded-xl bg-accent-50 px-4 py-2.5 text-sm text-accent-800">
            <Star className="mr-1.5 inline h-4 w-4 fill-accent-500 text-accent-500" />
            Jesteś kapitanem — umawiasz mecze i zgłaszasz wyniki.
          </div>
        )}

        {/* Squad */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">Skład <span className="text-slate-400">({team.members?.length ?? 0})</span></h2>
          <div className="mt-3 space-y-4">
            {squadByPos.map(({ pos, players }) => (
              <div key={pos}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{POSITION_LABELS[pos]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                      <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', POSITION_TONE[m.position])}>
                        {m.shirtNumber ?? POSITION_SHORT[m.position]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{m.name}</span>
                      {m.isCaptain && <Star className="h-4 w-4 shrink-0 fill-accent-500 text-accent-500" />}
                      {m.isReserve && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">REZ</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Matches */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">Mecze</h2>
          {myMatches.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Terminarz pojawi się po losowaniu grup.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {myMatches.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  teamId={teamId}
                  teamName={teamName}
                  isCaptain={isCaptain}
                  onChange={() => t && reload(t)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Match row with scheduling + result actions ──────────────────────────────

function MatchRow({
  match, teamId, teamName, isCaptain, onChange,
}: {
  match: TournamentMatch;
  teamId: string;
  teamName: Map<string, string>;
  isCaptain: boolean;
  onChange: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [sharedDays, setSharedDays] = useState<number[]>([]);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [openResult, setOpenResult] = useState(false);
  const [slot, setSlot] = useState('');
  const [venue, setVenue] = useState('');
  const [sa, setSa] = useState('');
  const [sb, setSb] = useState('');

  const oppId = match.teamAId === teamId ? match.teamBId : match.teamAId;
  const opp = oppId ? teamName.get(oppId) : undefined;
  const decided = match.status === 'played' || match.status === 'walkover';
  const iProposed = match.proposedByTeamId === teamId;

  useEffect(() => {
    if (openSchedule && oppId) getSharedDays(teamId, oppId).then(setSharedDays);
  }, [openSchedule, oppId, teamId]);

  async function wrap(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok, 'success'); onChange(); }
    catch (e: any) { toast(e?.message ?? 'Błąd', 'error'); }
    finally { setBusy(false); setOpenSchedule(false); setOpenResult(false); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{STAGE_LABELS[match.stage]}</span>
        <StatusPill status={match.status} />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="font-semibold text-ink">vs {opp ?? 'do ustalenia'}</span>
        {decided && (
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold tabular-nums">
            {match.scoreA ?? 0}:{match.scoreB ?? 0}
          </span>
        )}
      </div>

      {match.scheduledAt && !decided && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary-700">
          <CalendarDays className="h-4 w-4" />
          {new Date(match.scheduledAt).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {match.venueText && <span className="text-slate-500">· {match.venueText}</span>}
        </p>
      )}

      {match.status === 'proposed' && match.proposedSlot && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-amber-600">
          <Clock className="h-4 w-4" />
          Propozycja: {new Date(match.proposedSlot).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {match.venueText && <span className="text-slate-500">· {match.venueText}</span>}
        </p>
      )}

      {/* Captain actions */}
      {isCaptain && oppId && !decided && (
        <div className="mt-3 flex flex-wrap gap-2">
          {/* propose / re-propose */}
          {(match.status === 'pending' || (match.status === 'proposed' && iProposed)) && (
            <button onClick={() => setOpenSchedule((o) => !o)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> {match.status === 'pending' ? 'Zaproponuj termin' : 'Zmień propozycję'}
            </button>
          )}
          {/* accept opponent's proposal */}
          {match.status === 'proposed' && !iProposed && match.proposedSlot && (
            <>
              <button onClick={() => wrap(() => acceptMatchSlot(match.id, match.proposedSlot!), 'Termin potwierdzony')} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">
                <Check className="h-3.5 w-3.5" /> Akceptuj termin
              </button>
              <button onClick={() => setOpenSchedule((o) => !o)} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <X className="h-3.5 w-3.5" /> Zaproponuj inny
              </button>
            </>
          )}
          {/* report result once scheduled */}
          {match.status === 'scheduled' && (
            <button onClick={() => setOpenResult((o) => !o)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-accent-400 disabled:opacity-40">
              <Goal className="h-3.5 w-3.5" /> Zgłoś wynik
            </button>
          )}
        </div>
      )}

      {/* opponent confirms reported result */}
      {isCaptain && match.reportedByTeamId && match.reportedByTeamId !== teamId && !decided && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-amber-800">
            <AlertCircle className="h-4 w-4" /> Rywal zgłosił wynik {match.scoreA}:{match.scoreB}
          </p>
          <button
            onClick={() => wrap(
              () => confirmResult(match.id, teamId, match.scoreA ?? 0, match.scoreB ?? 0, match.teamAId, match.teamBId),
              'Wynik potwierdzony',
            )}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-800">
            <Check className="h-3.5 w-3.5" /> Potwierdź wynik
          </button>
        </div>
      )}

      {/* schedule form */}
      {openSchedule && (
        <div className="mt-3 space-y-2.5 rounded-xl bg-slate-50 p-3">
          {sharedDays.length > 0 && (
            <p className="text-xs text-primary-700">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              Wspólne dni dostępności: <strong>{sharedDays.map((d) => DAY_NAMES[d - 1]).join(', ')}</strong>
            </p>
          )}
          <input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Orlik / boisko (opcjonalnie)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
          <button
            onClick={() => slot && wrap(
              () => proposeMatchSlot(match.id, teamId, new Date(slot).toISOString(), venue || undefined),
              'Propozycja wysłana',
            )}
            disabled={busy || !slot}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">
            <Send className="h-3.5 w-3.5" /> Wyślij propozycję
          </button>
        </div>
      )}

      {/* result form */}
      {openResult && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
          <input value={sa} onChange={(e) => setSa(e.target.value)} placeholder="0" inputMode="numeric"
            className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-bold focus:border-primary-500 focus:outline-none" />
          <span className="font-bold text-slate-400">:</span>
          <input value={sb} onChange={(e) => setSb(e.target.value)} placeholder="0" inputMode="numeric"
            className="w-16 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-bold focus:border-primary-500 focus:outline-none" />
          <button
            onClick={() => wrap(
              () => reportResult(match.id, teamId, parseInt(sa || '0', 10), parseInt(sb || '0', 10)),
              'Wynik zgłoszony — czeka na potwierdzenie rywala',
            )}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-primary-950 hover:bg-accent-400 disabled:opacity-40">
            <Goal className="h-3.5 w-3.5" /> Zapisz
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: TournamentMatch['status'] }) {
  const map: Record<TournamentMatch['status'], { label: string; cls: string }> = {
    pending: { label: 'Do umówienia', cls: 'bg-slate-100 text-slate-500' },
    proposed: { label: 'Propozycja', cls: 'bg-amber-100 text-amber-700' },
    scheduled: { label: 'Umówiony', cls: 'bg-primary-100 text-primary-700' },
    played: { label: 'Rozegrany', cls: 'bg-primary-700 text-white' },
    walkover: { label: 'Walkower', cls: 'bg-amber-500 text-white' },
    disputed: { label: 'Spór', cls: 'bg-rose-100 text-rose-700' },
  };
  const s = map[status];
  return <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', s.cls)}>{s.label}</span>;
}
