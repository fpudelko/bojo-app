import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import { ktoMilczy, zapytajMilczacych } from '@/lib/eventResponses';
import type { GroupMember, EventParticipant, EventDecline } from '@/types';

beforeEach(() => {
  vi.clearAllMocks();
});

function czlonek(userId: string, name = userId): GroupMember {
  return {
    id: `m-${userId}`, groupId: 'g-1', userId, role: 'member', joinedAt: '2026-01-01',
    canManageMembers: false, canCreateEvents: true, canModerateWall: false, canInvite: true,
    name, avatarUrl: undefined,
  };
}

function uczestnik(userId: string): EventParticipant {
  return {
    id: `p-${userId}`, eventId: 'e-1', userId, name: userId, isGuest: false, hasPaid: false,
    isReserve: false, createdAt: '2026-01-01', paidAmount: 0, isCaptain: false, isGoalkeeper: false,
    pendingApproval: false, rsvp: 'yes', claimPassed: false, hasSportsCard: false,
  };
}

function odmowa(userId: string): EventDecline {
  return { eventId: 'e-1', userId, createdAt: '2026-01-01' };
}

describe('ktoMilczy', () => {
  it('member with a participant row is not silent', () => {
    const wynik = ktoMilczy([czlonek('u1')], [uczestnik('u1')], []);
    expect(wynik).toEqual([]);
  });

  it('a member who explicitly declined does NOT count as silent — that is the whole point', () => {
    const wynik = ktoMilczy([czlonek('u1')], [], [odmowa('u1')]);
    expect(wynik).toEqual([]);
  });

  it('a member with neither a participant row nor a decline is silent', () => {
    const wynik = ktoMilczy([czlonek('u1'), czlonek('u2')], [uczestnik('u1')], []);
    expect(wynik.map((m) => m.userId)).toEqual(['u2']);
  });

  it('excludes the organizer even when they have not joined their own match', () => {
    const wynik = ktoMilczy([czlonek('organizer'), czlonek('u2')], [], [], 'organizer');
    expect(wynik.map((m) => m.userId)).toEqual(['u2']);
  });

  it('empty group roster gives an empty list, not an error', () => {
    expect(ktoMilczy([], [], [])).toEqual([]);
  });
});

describe('zapytajMilczacych', () => {
  it('calls the RPC with the event id and returns the count', async () => {
    rpcMock.mockResolvedValue({ data: 3, error: null });
    const n = await zapytajMilczacych('event-1');
    expect(rpcMock).toHaveBeenCalledWith('zapytaj_milczacych', { p_event_id: 'event-1' });
    expect(n).toBe(3);
  });

  it('propagates the RPC error message verbatim', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Ta funkcja działa tylko dla meczów przypiętych do ekipy' } });
    await expect(zapytajMilczacych('event-1')).rejects.toThrow('Ta funkcja działa tylko dla meczów przypiętych do ekipy');
  });
});
