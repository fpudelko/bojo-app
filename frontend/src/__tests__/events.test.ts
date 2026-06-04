import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock factory can reference them
// ---------------------------------------------------------------------------
const {
  mockInsert, mockSelect, mockSingle, mockDelete, mockUpdate,
  mockEq, mockOrder, mockLimit, mockMaybeSingle, mockRpc, mockChain,
} = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockSelect = vi.fn();
  const mockSingle = vi.fn();
  const mockDelete = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockResolvedValue({ error: null });
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockMaybeSingle = vi.fn();
  // Rate-limit RPC — default to "allowed" so the guarded path runs.
  const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });

  const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
    insert: mockInsert, select: mockSelect, single: mockSingle,
    delete: mockDelete, update: mockUpdate, eq: mockEq,
    order: mockOrder, limit: mockLimit, maybeSingle: mockMaybeSingle,
  };

  // All methods return the chain so they can be chained further
  Object.values(mockChain).forEach((fn) => {
    if (fn !== mockDelete && fn !== mockUpdate) {
      fn.mockReturnValue(mockChain);
    }
  });

  return {
    mockInsert, mockSelect, mockSingle, mockDelete, mockUpdate,
    mockEq, mockOrder, mockLimit, mockMaybeSingle, mockRpc, mockChain,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockChain),
    rpc: mockRpc,
  },
}));

import { createEvent, joinEvent, removeParticipant } from '@/lib/events';

beforeEach(() => {
  vi.clearAllMocks();
  // Restore chain returns — insert chains too (events insert → .select().single())
  Object.values(mockChain).forEach((fn) => {
    if (fn !== mockDelete && fn !== mockUpdate) {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
    }
  });
  mockDelete.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockRpc.mockResolvedValue({ data: true, error: null });
});

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------
describe('createEvent', () => {
  it('inserts event and adds organizer as participant, returns id', async () => {
    const fakeId = 'event-uuid-1234';
    mockSingle.mockResolvedValue({ data: { id: fakeId }, error: null });

    const id = await createEvent(
      {
        sport: 'piłka nożna',
        fieldName: 'Orlik Rataje',
        date: '2026-07-01',
        time: '18:00',
        maxPlayers: 10,
        visibility: 'private',
      },
      'organizer-uid',
      'Jan Kowalski',
    );

    expect(id).toBe(fakeId);
    const { supabase } = await import('@/lib/supabase');
    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(supabase.from).toHaveBeenCalledWith('event_participants');
  });

  it('throws when Supabase returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    await expect(
      createEvent({ sport: 'futsal', fieldName: 'X', date: '2026-01-01', time: '10:00', maxPlayers: 5, visibility: 'private' }, 'u', 'U'),
    ).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// joinEvent
// ---------------------------------------------------------------------------
describe('joinEvent', () => {
  it('adds participant as non-reserve when slots available', async () => {
    const { supabase } = await import('@/lib/supabase');

    // joinEvent calls supabase.from() 3 times:
    //   1. events → .select().eq().single() → { max_players: 10 }
    //   2. event_participants → .select({count}).eq().eq() → { count: 5 }
    //   3. event_participants → .insert() → { error: null }
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          ...mockChain,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { max_players: 10 }, error: null }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      // event_participants: count query + insert
      const finalEq = vi.fn().mockResolvedValue({ count: 5, error: null });
      const firstEq = vi.fn().mockReturnValue({ eq: finalEq });
      return {
        ...mockChain,
        select: vi.fn().mockReturnValue({ eq: firstEq }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(joinEvent('event-1', 'user-1', 'Test User')).resolves.toBeUndefined();
  });

  it('throws when the rate limit is exceeded', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(joinEvent('event-1', 'user-1', 'Test User')).rejects.toThrow(/Zbyt wiele/);
  });
});

// ---------------------------------------------------------------------------
// removeParticipant
// ---------------------------------------------------------------------------
describe('removeParticipant', () => {
  it('deletes the participant row', async () => {
    const { supabase } = await import('@/lib/supabase');

    // removeParticipant calls supabase.from('event_participants') 3 times:
    //   1. .select().eq().single()                           → fetch participant
    //   2. .delete().eq()                                    → delete row
    //   3. .select().eq().eq().order().limit().maybeSingle() → find reserve (null)
    let n = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      n++;
      if (n === 1) return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { event_id: 'ev1', is_reserve: false }, error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
      if (n === 2) return {
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      } as unknown as ReturnType<typeof supabase.from>;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(removeParticipant('participant-1')).resolves.toBeUndefined();
  });

  it('promotes first reserve when a regular spot opens', async () => {
    const { supabase } = await import('@/lib/supabase');

    let deleteWasCalled = false;
    let updateWasCalled = false;
    let n = 0;

    vi.mocked(supabase.from).mockImplementation(() => {
      n++;
      if (n === 1) return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { event_id: 'ev1', is_reserve: false }, error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
      if (n === 2) return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => { deleteWasCalled = true; return Promise.resolve({ error: null }); }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
      if (n === 3) return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'reserve-1' }, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => { updateWasCalled = true; return Promise.resolve({ error: null }); }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    await removeParticipant('participant-1');
    expect(deleteWasCalled).toBe(true);
    expect(updateWasCalled).toBe(true);
  });
});
