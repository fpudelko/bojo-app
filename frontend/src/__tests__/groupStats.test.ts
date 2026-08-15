import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tables, fromMock, rpcMock } = vi.hoisted(() => {
  const tables: Record<string, { data: unknown; error: unknown }> = {};
  const chains: Record<string, any> = {};
  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    const chain: any = {};
    ['select', 'in'].forEach((m) => { chain[m] = vi.fn(() => chain); });
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: null, error: null });
    chains[table] = chain;
    return chain;
  }
  const fromMock = vi.fn((table: string) => chainFor(table));
  const rpcMock = vi.fn();
  return { tables, fromMock, rpcMock };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }));

import { getGroupStats, getGroupLeaderboard, niezawodnoscPct, pokazacKolumneWygranych } from '@/lib/groupStats';
import type { GroupLeaderboardEntry } from '@/types';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
  rpcMock.mockReset();
});

describe('getGroupStats', () => {
  it('unwraps the single-row table-function result', async () => {
    rpcMock.mockResolvedValue({
      data: [{ matches_played: 12, matches_upcoming: 2, goals_total: 34, members_count: 9, distinct_players: 15 }],
      error: null,
    });
    const stats = await getGroupStats('g1');
    expect(stats).toEqual({
      matchesPlayed: 12, matchesUpcoming: 2, goalsTotal: 34, membersCount: 9, distinctPlayers: 15,
    });
  });

  it('defaults every field to 0 when the RPC returns nothing', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const stats = await getGroupStats('g1');
    expect(stats).toEqual({
      matchesPlayed: 0, matchesUpcoming: 0, goalsTotal: 0, membersCount: 0, distinctPlayers: 0,
    });
  });

  it('throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getGroupStats('g1')).rejects.toThrow('boom');
  });
});

describe('getGroupLeaderboard', () => {
  it('joins profile names by user_id, falling back to Gracz', async () => {
    rpcMock.mockResolvedValue({
      data: [{ user_id: 'u1', matches_played: 5, goals: 3, wins: 1, matches_with_teams: 2, no_shows: 0, niezawodnosc_pct: 100 }],
      error: null,
    });
    tables.profiles = { data: [{ id: 'u1', display_name: null, avatar_url: null }], error: null };

    const [row] = await getGroupLeaderboard('g1');
    expect(row.name).toBe('Gracz');
    expect(row.goals).toBe(3);
  });

  it('propagates the members-only exception instead of returning an empty list', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Statystyki grupy widzą wyłącznie jej członkowie' } });
    await expect(getGroupLeaderboard('g1')).rejects.toThrow(/wyłącznie jej członkowie/);
  });

  it('returns an empty array without querying profiles when there are no rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const rows = await getGroupLeaderboard('g1');
    expect(rows).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('niezawodnoscPct', () => {
  it('returns 100 for zero matches, not NaN', () => {
    expect(niezawodnoscPct(0, 0)).toBe(100);
  });

  it('computes the percentage of matches played without a no-show', () => {
    expect(niezawodnoscPct(10, 1)).toBe(90);
  });
});

describe('pokazacKolumneWygranych', () => {
  const wpis = (matchesWithTeams: number): GroupLeaderboardEntry => ({
    userId: 'u1', name: 'Jan', matchesPlayed: 5, goals: 1, wins: 0,
    matchesWithTeams, noShows: 0, niezawodnoscPct: 100,
  });

  it('hides the column when nobody ever played a match with teams', () => {
    expect(pokazacKolumneWygranych([wpis(0), wpis(0)])).toBe(false);
  });

  it('shows the column when at least one row has matchesWithTeams > 0', () => {
    expect(pokazacKolumneWygranych([wpis(0), wpis(3)])).toBe(true);
  });
});
