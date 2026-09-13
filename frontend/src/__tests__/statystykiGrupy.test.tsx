import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import StatystykiGrupy from '@/components/groups/StatystykiGrupy';

// Nazwiska graczy w tabeli statystyk mają linkować do profilu — tak samo jak
// gdzie indziej w apce (`/gracz/[id]`). Wiersz zawsze niesie `userId`
// (leaderboard liczy się wyłącznie z kont), więc link renderuje się zawsze.

vi.mock('@/lib/groupStats', () => ({
  getGroupStats: vi.fn(async () => ({
    matchesPlayed: 3,
    matchesUpcoming: 1,
    goalsTotal: 5,
    membersCount: 4,
    distinctPlayers: 4,
  })),
  getGroupLeaderboard: vi.fn(async () => ([
    {
      userId: 'user-1',
      name: 'Jan Kowalski',
      matchesPlayed: 3,
      goals: 2,
      wins: 1,
      matchesWithTeams: 0,
      noShows: 0,
      niezawodnoscPct: 100,
    },
  ])),
  pokazacKolumneWygranych: vi.fn(() => false),
}));

afterEach(cleanup);

describe('StatystykiGrupy', () => {
  it('linkuje nazwisko gracza do jego profilu', async () => {
    render(<StatystykiGrupy groupId="g1" />);
    const link = await waitFor(() => screen.getByRole('link', { name: 'Jan Kowalski' }));
    expect(link).toHaveAttribute('href', '/gracz/user-1');
  });
});
