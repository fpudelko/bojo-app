import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — jeden chainable "builder" na tabelę, wielokrotnego użytku
// w obrębie jednego testu (np. `getGroupMembers` odpytuje trzy tabele po
// kolei). Każda metoda łańcucha zwraca ten sam obiekt, a `.then` na końcu
// oddaje skonfigurowaną odpowiedź dla danej tabeli — ten sam wzorzec co
// `__tests__/events.test.ts`, rozszerzony o wieloosobowe tabele.
// ---------------------------------------------------------------------------
const { tables, chainFor, fromMock, rpcMock } = vi.hoisted(() => {
  const tables: Record<string, { data: unknown; error: unknown }> = {};
  const chains: Record<string, any> = {};

  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    const methods = [
      'select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte',
      'order', 'in', 'is', 'limit',
    ];
    const chain: any = {};
    methods.forEach((m) => { chain[m] = vi.fn(() => chain); });
    chain.maybeSingle = vi.fn(() => Promise.resolve(tables[table] ?? { data: null, error: null }));
    chain.single = vi.fn(() => Promise.resolve(tables[table] ?? { data: null, error: null }));
    // Await bezpośrednio na łańcuchu (bez .maybeSingle()/.single()) — np. `.select().in(...)`.
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: null, error: null });
    chains[table] = chain;
    return chain;
  }

  const fromMock = vi.fn((table: string) => chainFor(table));
  const rpcMock = vi.fn();

  return { tables, chainFor, fromMock, rpcMock };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock, auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

import {
  joinGroupByCode, addMemberToGroup, regenerateJoinCode, setMemberPermissions, getGroupMembers,
  uprawnieniaCzlonka, czyWspolorganizator, getMyGroupsZTerminem,
} from '@/lib/groups';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
  rpcMock.mockReset();
});

// ---------------------------------------------------------------------------
// joinGroupByCode
// ---------------------------------------------------------------------------
describe('joinGroupByCode', () => {
  it('uppercases and trims the code before calling the RPC', async () => {
    rpcMock.mockResolvedValue({ data: 'group-1', error: null });
    await joinGroupByCode(' abc123 ');
    expect(rpcMock).toHaveBeenCalledWith('dolacz_do_grupy_kodem', { p_code: 'ABC123', p_od: null });
  });

  it('forwards the inviter id when given', async () => {
    rpcMock.mockResolvedValue({ data: 'group-1', error: null });
    await joinGroupByCode('ABC123', 'inviter-uuid');
    expect(rpcMock).toHaveBeenCalledWith('dolacz_do_grupy_kodem', { p_code: 'ABC123', p_od: 'inviter-uuid' });
  });

  it('propagates the RPC error message verbatim, so the toast can show it', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Nie ma grupy o tym kodzie' } });
    await expect(joinGroupByCode('ZZZZZZ')).rejects.toThrow('Nie ma grupy o tym kodzie');
  });

  it('returns the group id from the RPC result', async () => {
    rpcMock.mockResolvedValue({ data: 'group-42', error: null });
    const id = await joinGroupByCode('ABC123');
    expect(id).toBe('group-42');
  });
});

// ---------------------------------------------------------------------------
// addMemberToGroup — musi iść przez RPC, nigdy przez surowy INSERT (migracja
// `094` zdjęła politykę INSERT na group_members).
// ---------------------------------------------------------------------------
describe('addMemberToGroup', () => {
  it('calls the RPC and never touches group_members with a raw insert', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await addMemberToGroup('group-1', 'user-1');
    expect(rpcMock).toHaveBeenCalledWith('dodaj_czlonka_do_grupy', { p_group_id: 'group-1', p_user_id: 'user-1' });
    const groupMembersChain = chainFor('group_members');
    expect(groupMembersChain.insert).not.toHaveBeenCalled();
  });

  it('throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Nie masz uprawnień' } });
    await expect(addMemberToGroup('group-1', 'user-1')).rejects.toThrow('Nie masz uprawnień');
  });
});

// ---------------------------------------------------------------------------
// regenerateJoinCode
// ---------------------------------------------------------------------------
describe('regenerateJoinCode', () => {
  it('returns the new code from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: 'NEWCODE', error: null });
    const code = await regenerateJoinCode('group-1');
    expect(code).toBe('NEWCODE');
    expect(rpcMock).toHaveBeenCalledWith('odswiez_kod_grupy', { p_group_id: 'group-1' });
  });
});

// ---------------------------------------------------------------------------
// setMemberPermissions — musi iść przez zaktualizujJedenWiersz, więc
// zero-zmienionych-wierszy jest wyjątkiem, nie cichym sukcesem.
// ---------------------------------------------------------------------------
describe('setMemberPermissions', () => {
  it('resolves when the update touches the row', async () => {
    const chain = chainFor('group_members');
    chain.select.mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'member-row-1' }], error: null }));
    await expect(setMemberPermissions('member-row-1', {
      canManageMembers: true, canCreateEvents: true, canModerateWall: false, canInvite: true,
    })).resolves.toBeUndefined();
  });

  it('throws when RLS silently updated zero rows', async () => {
    const chain = chainFor('group_members');
    chain.select.mockImplementationOnce(() => Promise.resolve({ data: [], error: null }));
    await expect(setMemberPermissions('member-row-1', {
      canManageMembers: true, canCreateEvents: false, canModerateWall: false, canInvite: false,
    })).rejects.toThrow(/Nie udało się zmienić uprawnień/);
  });
});

// ---------------------------------------------------------------------------
// uprawnieniaCzlonka — czysta funkcja, lustro triggera ustaw_role_czlonka
// z bazy (migracje `092`, `096`).
// ---------------------------------------------------------------------------
describe('uprawnieniaCzlonka', () => {
  it('gives the founder every right, even when every column in the row is false', () => {
    const p = uprawnieniaCzlonka(
      { createdBy: 'founder-1' },
      { userId: 'founder-1', canManageMembers: false, canCreateEvents: false, canModerateWall: false, canInvite: false },
    );
    expect(p).toEqual({ isFounder: true, canManageMembers: true, canCreateEvents: true, canModerateWall: true, canInvite: true });
  });

  it('reads canInvite from the row for a non-founder member', () => {
    const p = uprawnieniaCzlonka(
      { createdBy: 'founder-1' },
      { userId: 'member-1', canManageMembers: false, canCreateEvents: true, canModerateWall: false, canInvite: true },
    );
    expect(p.isFounder).toBe(false);
    expect(p.canInvite).toBe(true);
  });

  it('does not promote anyone when the group has no founder (creator account deleted)', () => {
    const p = uprawnieniaCzlonka(
      { createdBy: undefined },
      { userId: 'member-1', canManageMembers: true, canCreateEvents: true, canModerateWall: true, canInvite: true },
    );
    expect(p.isFounder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getGroupMembers — kolejność źródła nazwy: profiles.display_name PRZED
// nazwą z ostatniego udziału w meczu, fallback 'Gracz'.
// ---------------------------------------------------------------------------
describe('getGroupMembers', () => {
  it('maps the new permission columns and invited_by', async () => {
    tables.group_members = {
      data: [{
        id: 'm1', group_id: 'g1', user_id: 'u1', role: 'admin', joined_at: '2026-01-01',
        can_manage_members: true, can_create_events: true, can_moderate_wall: false, can_invite: true, invited_by: 'u9',
      }],
      error: null,
    };
    tables.profiles = { data: [{ id: 'u1', avatar_url: null, display_name: 'Jan Kowalski' }], error: null };
    tables.event_participants = { data: [], error: null };

    const [m] = await getGroupMembers('g1');
    expect(m.canManageMembers).toBe(true);
    expect(m.canCreateEvents).toBe(true);
    expect(m.canModerateWall).toBe(false);
    expect(m.canInvite).toBe(true);
    expect(m.invitedBy).toBe('u9');
    expect(m.name).toBe('Jan Kowalski');
  });

  it('falls back to the latest participation name when profiles.display_name is empty', async () => {
    tables.group_members = {
      data: [{
        id: 'm1', group_id: 'g1', user_id: 'u1', role: 'member', joined_at: '2026-01-01',
        can_manage_members: false, can_create_events: true, can_moderate_wall: false, can_invite: false, invited_by: null,
      }],
      error: null,
    };
    tables.profiles = { data: [{ id: 'u1', avatar_url: null, display_name: null }], error: null };
    tables.event_participants = { data: [{ user_id: 'u1', name: 'Kuba z meczu', created_at: '2026-01-01' }], error: null };

    const [m] = await getGroupMembers('g1');
    expect(m.name).toBe('Kuba z meczu');
  });

  it('falls back to "Gracz" when there is neither a profile name nor a participation', async () => {
    tables.group_members = {
      data: [{
        id: 'm1', group_id: 'g1', user_id: 'u1', role: 'member', joined_at: '2026-01-01',
        can_manage_members: false, can_create_events: true, can_moderate_wall: false, can_invite: false, invited_by: null,
      }],
      error: null,
    };
    tables.profiles = { data: [{ id: 'u1', avatar_url: null, display_name: null }], error: null };
    tables.event_participants = { data: [], error: null };

    const [m] = await getGroupMembers('g1');
    expect(m.name).toBe('Gracz');
  });
});

// ---------------------------------------------------------------------------
// getMyGroupsZTerminem — grupa z najbliższym terminem ma iść pierwsza,
// grupy bez terminu lądują na końcu w niezmienionej kolejności.
// ---------------------------------------------------------------------------
describe('getMyGroupsZTerminem', () => {
  it('sorts groups with an upcoming match ahead of ones without, nearest date first', async () => {
    tables.group_members = { data: [{ group_id: 'g-far' }, { group_id: 'g-none' }, { group_id: 'g-near' }], error: null };
    tables.groups = {
      data: [
        { id: 'g-far', name: 'Daleki termin', created_at: '2026-01-01' },
        { id: 'g-none', name: 'Bez terminu', created_at: '2026-02-01' },
        { id: 'g-near', name: 'Bliski termin', created_at: '2026-03-01' },
      ],
      error: null,
    };
    tables.events = {
      data: [
        { id: 'e-near', group_id: 'g-near', event_date: '2026-08-16', event_time: '19:00:00', status: 'confirmed' },
        { id: 'e-far', group_id: 'g-far', event_date: '2026-09-01', event_time: '19:00:00', status: 'confirmed' },
      ],
      error: null,
    };

    const groups = await getMyGroupsZTerminem('user-1');
    expect(groups.map((g) => g.id)).toEqual(['g-near', 'g-far', 'g-none']);
  });
});

// ---------------------------------------------------------------------------
// czyWspolorganizator — odznaka ma odpowiadać roli 'admin' z triggera (092)
// ---------------------------------------------------------------------------
describe('czyWspolorganizator', () => {
  it('nie uznaje za współorganizatora kogoś z samymi domyślnymi prawami członka', () => {
    // can_create_events i can_invite mają w bazie DEFAULT true — tak wygląda
    // KAŻDY dopisany członek. Wcześniej dostawał przez to odznakę.
    expect(czyWspolorganizator({ canManageMembers: false, canModerateWall: false })).toBe(false);
  });

  it('uznaje zarządzanie składem', () => {
    expect(czyWspolorganizator({ canManageMembers: true, canModerateWall: false })).toBe(true);
  });

  it('uznaje moderowanie tablicy', () => {
    expect(czyWspolorganizator({ canManageMembers: false, canModerateWall: true })).toBe(true);
  });
});
