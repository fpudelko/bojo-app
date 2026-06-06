'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, ChevronLeft, Users, ListOrdered, GitBranch, Loader2, Goal,
} from 'lucide-react';
import { clsx } from 'clsx';
import Header from '@/components/layout/Header';
import {
  getActiveTournament, getTeams, getGroups, getStandings, getMatches,
} from '@/lib/tournaments';
import { STAGE_LABELS } from '@/lib/tournamentLabels';
import type {
  Tournament, TournamentTeam, TournamentGroup, TournamentStanding,
  TournamentMatch, MatchStage,
} from '@/types';

type Tab = 'grupy' | 'drabinka' | 'wyniki';

const KNOCKOUT_ORDER: MatchStage[] = [
  'round_of_32', 'round_of_16', 'quarter', 'semi', 'final',
];

export default function BracketPage() {
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [standings, setStandings] = useState<TournamentStanding[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('grupy');

  useEffect(() => {
    getActiveTournament().then(async (tour) => {
      setT(tour);
      if (tour) {
        const [tm, gr, st, ma] = await Promise.all([
          getTeams(tour.id), getGroups(tour.id), getStandings(tour.id), getMatches(tour.id),
        ]);
        setTeams(tm); setGroups(gr); setStandings(st); setMatches(ma);
      }
      setReady(true);
    });
  }, []);

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((tm) => m.set(tm.id, tm.name));
    return m;
  }, [teams]);

  const advance = t?.advancePerGroup ?? 2;
  const knockoutMatches = matches.filter((m) => m.stage !== 'group');
  const playedMatches = matches
    .filter((m) => m.status === 'played' || m.status === 'walkover')
    .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''));

  if (!ready) {
    return (
      <div className="min-h-screen"><Header />
        <div className="flex items-center justify-center py-32 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/turniej" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Wróć do turnieju
        </Link>
        <h1 className="font-display text-3xl font-extrabold text-ink">Drabinka i tabele</h1>
        <p className="mt-1 text-slate-500">{t?.name ?? 'BOJO Community Cup'}</p>

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-2xl bg-slate-100 p-1">
          {([
            { id: 'grupy', label: 'Grupy', Icon: ListOrdered },
            { id: 'drabinka', label: 'Drabinka', Icon: GitBranch },
            { id: 'wyniki', label: 'Wyniki', Icon: Goal },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                tab === id ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'grupy' && (
            <GroupsTab groups={groups} standings={standings} advance={advance} />
          )}
          {tab === 'drabinka' && (
            <BracketTab matches={knockoutMatches} teamName={teamName} />
          )}
          {tab === 'wyniki' && (
            <ResultsTab matches={playedMatches} teamName={teamName} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Groups ──────────────────────────────────────────────────────────────────

function GroupsTab({
  groups, standings, advance,
}: { groups: TournamentGroup[]; standings: TournamentStanding[]; advance: number }) {
  if (groups.length === 0) {
    return <Empty icon={Users} text="Grupy pojawią się po losowaniu. Zgłoszone drużyny widać na stronie turnieju." />;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const rows = standings
          .filter((s) => s.groupId === g.id)
          .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
        return (
          <div key={g.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="bg-primary-700 px-4 py-2.5 font-display font-bold text-white">Grupa {g.name}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="py-2 pl-3 text-left font-medium">#</th>
                  <th className="py-2 text-left font-medium">Drużyna</th>
                  <th className="px-1.5 py-2 text-center font-medium" title="Mecze">M</th>
                  <th className="px-1.5 py-2 text-center font-medium" title="Bilans bramek">+/−</th>
                  <th className="py-2 pr-3 text-center font-medium" title="Punkty">Pkt</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-400">Brak rozegranych meczów</td></tr>
                ) : rows.map((s, i) => (
                  <tr key={s.teamId} className={clsx('border-b border-slate-50 last:border-0', i < advance && 'bg-primary-50/40')}>
                    <td className="py-2.5 pl-3">
                      <span className={clsx(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                        i < advance ? 'bg-primary-700 text-white' : 'text-slate-400',
                      )}>{i + 1}</span>
                    </td>
                    <td className="py-2.5 font-medium text-ink">{s.teamName}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-slate-500">{s.played}</td>
                    <td className="px-1.5 py-2.5 text-center tabular-nums text-slate-500">
                      {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                    </td>
                    <td className="py-2.5 pr-3 text-center font-bold tabular-nums text-ink">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-400">
              Awansuje {advance} najlepsze
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Bracket ─────────────────────────────────────────────────────────────────

function BracketTab({
  matches, teamName,
}: { matches: TournamentMatch[]; teamName: Map<string, string> }) {
  if (matches.length === 0) {
    return <Empty icon={GitBranch} text="Drabinka pucharowa pojawi się po zakończeniu fazy grupowej." />;
  }
  const stages = KNOCKOUT_ORDER.filter((st) => matches.some((m) => m.stage === st));
  // add third place at the end if present
  const hasThird = matches.some((m) => m.stage === 'third_place');

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-5">
        {stages.map((st) => {
          const col = matches
            .filter((m) => m.stage === st)
            .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
          return (
            <div key={st} className="flex w-64 flex-col justify-around gap-4">
              <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-400">{STAGE_LABELS[st]}</p>
              {col.map((m) => <BracketMatch key={m.id} m={m} teamName={teamName} />)}
            </div>
          );
        })}
        {hasThird && (
          <div className="flex w-64 flex-col justify-around gap-4">
            <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-400">{STAGE_LABELS.third_place}</p>
            {matches.filter((m) => m.stage === 'third_place').map((m) => (
              <BracketMatch key={m.id} m={m} teamName={teamName} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatch({ m, teamName }: { m: TournamentMatch; teamName: Map<string, string> }) {
  const a = m.teamAId ? teamName.get(m.teamAId) : undefined;
  const b = m.teamBId ? teamName.get(m.teamBId) : undefined;
  const decided = m.status === 'played' || m.status === 'walkover';
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <Side name={a} score={m.scoreA} win={decided && m.winnerTeamId === m.teamAId} />
      <div className="h-px bg-slate-100" />
      <Side name={b} score={m.scoreB} win={decided && m.winnerTeamId === m.teamBId} />
    </div>
  );
}

function Side({ name, score, win }: { name?: string; score?: number; win?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between px-3 py-2.5 text-sm', win && 'bg-primary-50')}>
      <span className={clsx('truncate', name ? (win ? 'font-bold text-primary-800' : 'text-ink') : 'italic text-slate-400')}>
        {name ?? 'do ustalenia'}
      </span>
      <span className={clsx('ml-2 tabular-nums', win ? 'font-bold text-primary-800' : 'text-slate-500')}>
        {score ?? '–'}
      </span>
    </div>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

function ResultsTab({
  matches, teamName,
}: { matches: TournamentMatch[]; teamName: Map<string, string> }) {
  if (matches.length === 0) {
    return <Empty icon={Goal} text="Tu pojawią się wyniki rozegranych meczów." />;
  }
  return (
    <div className="space-y-2">
      {matches.map((m) => {
        const a = m.teamAId ? teamName.get(m.teamAId) : '—';
        const b = m.teamBId ? teamName.get(m.teamBId) : '—';
        const aWin = m.winnerTeamId === m.teamAId;
        const bWin = m.winnerTeamId === m.teamBId;
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <span className="hidden w-28 shrink-0 text-xs text-slate-400 sm:block">{STAGE_LABELS[m.stage]}</span>
            <span className={clsx('flex-1 text-right text-sm', aWin ? 'font-bold text-ink' : 'text-slate-600')}>{a}</span>
            <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold tabular-nums text-ink">
              {m.scoreA ?? 0}:{m.scoreB ?? 0}
            </span>
            <span className={clsx('flex-1 text-sm', bWin ? 'font-bold text-ink' : 'text-slate-600')}>{b}</span>
            {m.status === 'walkover' && <span className="shrink-0 text-[10px] font-semibold uppercase text-amber-500">walkower</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">{text}</p>
    </div>
  );
}
