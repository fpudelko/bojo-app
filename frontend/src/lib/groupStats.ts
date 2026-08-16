// Statystyki grupy (migracja `095`) — nagłówek publiczny + tabela graczy
// wyłącznie dla członków. Obie RPC-e są uczciwe co do tego, czego NIE da się
// policzyć — patrz komentarz w migracji i `pokazacKolumneWygranych()` niżej.
import { supabase } from './supabase';
import type { GroupStats, GroupLeaderboardEntry } from '@/types';

const PUSTE_STATYSTYKI: GroupStats = {
  matchesPlayed: 0, matchesUpcoming: 0, goalsTotal: 0, membersCount: 0, distinctPlayers: 0,
};

/** Pięć liczb do nagłówka grupy. `get_group_stats` jest funkcją tabelaryczną
 *  (jeden wiersz) — supabase-js oddaje ją jako tablicę, tak samo jak
 *  `getPlayerStats()` w `lib/players.ts`. */
export async function getGroupStats(groupId: string): Promise<GroupStats> {
  const { data, error } = await supabase.rpc('get_group_stats', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return PUSTE_STATYSTYKI;
  return {
    matchesPlayed: row.matches_played ?? 0,
    matchesUpcoming: row.matches_upcoming ?? 0,
    goalsTotal: row.goals_total ?? 0,
    membersCount: row.members_count ?? 0,
    distinctPlayers: row.distinct_players ?? 0,
  };
}

/** Tabela graczy — wyłącznie dla członków; RPC sama odmawia nie-członkowi
 *  wyjątkiem („Statystyki grupy widzą wyłącznie jej członkowie"), więc błąd
 *  propaguje się do wywołującego zamiast cichej pustej listy. */
export async function getGroupLeaderboard(groupId: string): Promise<GroupLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_group_leaderboard', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    user_id: string; matches_played: number; goals: number; wins: number;
    matches_with_teams: number; no_shows: number; niezawodnosc_pct: number;
  }>;
  if (rows.length === 0) return [];

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', rows.map((r) => r.user_id));
  if (profileError) throw new Error(profileError.message);
  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    userId: r.user_id,
    name: profiles.get(r.user_id)?.display_name ?? 'Gracz',
    avatarUrl: profiles.get(r.user_id)?.avatar_url ?? undefined,
    matchesPlayed: r.matches_played,
    goals: r.goals,
    wins: r.wins,
    matchesWithTeams: r.matches_with_teams,
    noShows: r.no_shows,
    niezawodnoscPct: r.niezawodnosc_pct,
  }));
}

/** Czysta funkcja — pilnuje reguły z `docs/domena.md`: „0 zwycięstw" bez
 *  mianownika myli się z „nigdy nie dzieliliśmy drużyn". Test w
 *  `groupStats.test.ts` przypina próg `0`. */
export function niezawodnoscPct(mecze: number, nieobecnosci: number): number {
  if (mecze === 0) return 100;
  return Math.round(((mecze - nieobecnosci) / mecze) * 100);
}

/** Kolumnę „wygrane" pokazujemy tylko, gdy ktokolwiek w grupie zagrał choć
 *  jeden mecz z podziałem na drużyny — inaczej cała kolumna to same zera
 *  udające dane. */
export function pokazacKolumneWygranych(wiersze: GroupLeaderboardEntry[]): boolean {
  return wiersze.some((w) => w.matchesWithTeams > 0);
}
