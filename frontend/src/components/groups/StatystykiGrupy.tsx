'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getGroupStats, getGroupLeaderboard, pokazacKolumneWygranych } from '@/lib/groupStats';
import type { GroupStats, GroupLeaderboardEntry } from '@/types';

// `min-h` + `flex … justify-center`: „nadchodzące" jest dłuższe niż sąsiednie
// etykiety i na wąskim telefonie łamie się do dwóch linii, podczas gdy „gole"
// czy „rozegrane" mieszczą się w jednej — bez wspólnej minimalnej wysokości
// i wyśrodkowania siatka rozjeżdżała się (ten jeden kafelek wyższy, treść
// reszty przyklejona do góry zamiast wyśrodkowana).
function Kafelek({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[4rem] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="font-display text-xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export default function StatystykiGrupy({ groupId }: { groupId: string }) {
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [ranking, setRanking] = useState<GroupLeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGroupStats(groupId), getGroupLeaderboard(groupId)])
      .then(([s, r]) => { setStats(s); setRanking(r); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Błąd'))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return <div className="flex justify-center py-10 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (error || !stats) {
    return <p className="py-10 text-center text-sm text-red-600">{error ?? 'Nie udało się wczytać statystyk'}</p>;
  }

  const wiersze = ranking ?? [];
  const pokazWygrane = pokazacKolumneWygranych(wiersze);
  const maDane = stats.matchesPlayed > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">
        <Kafelek label="rozegrane" value={stats.matchesPlayed} />
        <Kafelek label="nadchodzące" value={stats.matchesUpcoming} />
        <Kafelek label="gole" value={stats.goalsTotal} />
        <Kafelek label="grało nas" value={stats.distinctPlayers} />
      </div>

      {!maDane ? (
        <div className="py-8 text-center">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Jeszcze nie ma z czego liczyć</p>
          <p className="mt-1 text-sm text-slate-400">
            Statystyki robią się z wpisanych wyników. Po meczu wpisz wynik i gole — reszta policzy się sama.
          </p>
        </div>
      ) : wiersze.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-700">
                <th className="px-3 py-2 font-medium">Gracz</th>
                <th className="px-3 py-2 text-right font-medium">Mecze</th>
                <th className="px-3 py-2 text-right font-medium">Niezawodność</th>
                <th className="px-3 py-2 text-right font-medium">Gole</th>
                {pokazWygrane && <th className="px-3 py-2 text-right font-medium">Wygrane</th>}
              </tr>
            </thead>
            <tbody>
              {wiersze.map((w) => (
                <tr key={w.userId} className="border-b border-slate-50 last:border-0 dark:border-slate-700">
                  <td className="px-3 py-2 text-ink">{w.name}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{w.matchesPlayed}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{w.niezawodnoscPct}%</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{w.goals}</td>
                  {pokazWygrane && (
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                      {w.matchesWithTeams > 0 ? w.wins : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
