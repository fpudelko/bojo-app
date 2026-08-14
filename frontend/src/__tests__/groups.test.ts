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
      canManageMembers: true, canCreateEvents: true, canModerateWall: false,
    })).resolves.toBeUndefined();
  });

  it('throws when RLS silently updated zero rows', async () => {
    const chain = chainFor('group_members');
    chain.select.mockImplementationOnce(() => Promise.resolve({ data: [], error: null }));
    await expect(setMemberPermissions('member-row-1', {
      canManageMembers: true, canCreateEvents: false, canModerateWall: false,
    })).rejects.toThrow(/Nie udało się zmienić uprawnień/);
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
        can_manage_members: true, can_create_events: true, can_moderate_wall: false, invited_by: 'u9',
      }],
      error: null,
    };
    tables.profiles = { data: [{ id: 'u1', avatar_url: null, display_name: 'Jan Kowalski' }], error: null };
    tables.event_participants = { data: [], error: null };

    const [m] = await getGroupMembers('g1');
    expect(m.canManageMembers).toBe(true);
    expect(m.canCreateEvents).toBe(true);
    expect(m.canModerateWall).toBe(false);
    expect(m.invitedBy).toBe('u9');
    expect(m.name).toBe('Jan Kowalski');
  });

  it('falls back to the latest participation name when profiles.display_name is empty', async () => {
    tables.group_members = {
      data: [{
        id: 'm1', group_id: 'g1', user_id: 'u1', role: 'member', joined_at: '2026-01-01',
        can_manage_members: false, can_create_events: true, can_moderate_wall: false, invited_by: null,
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
        can_manage_members: false, can_create_events: true, can_moderate_wall: false, invited_by: null,
      }],
      error: null,
    };
    tables.profiles = { data: [{ id: 'u1', avatar_url: null, display_name: null }], error: null };
    tables.event_participants = { data: [], error: null };

    const [m] = await getGroupMembers('g1');
    expect(m.name).toBe('Gracz');
  });
});
