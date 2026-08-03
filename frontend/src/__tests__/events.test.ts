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
        date: '2099-07-01',
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
      createEvent({ sport: 'futsal', fieldName: 'X', date: '2099-01-01', time: '10:00', maxPlayers: 5, visibility: 'private' }, 'u', 'U'),
    ).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// joinEvent
// ---------------------------------------------------------------------------
describe('joinEvent', () => {
  it('adds participant as non-reserve when slots available', async () => {
    const { supabase } = await import('@/lib/supabase');

    // joinEvent queries:
    //   events            → .select().eq().single() → { max_players: 10 }
    //   event_participants → taken count:  .select({count}).eq().eq().eq()
    //   event_participants → held count:   .select({count}).eq().not()
    //   event_participants → .insert()
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
      // The taken-count query chains three .eq() filters (event_id, is_reserve,
      // pending_approval). The held-count query chains .eq() then .not() for
      // spots currently offered to someone on the reserve — none here.
      const thirdEq = vi.fn().mockResolvedValue({ count: 5, error: null });
      const secondEq = vi.fn().mockReturnValue({ eq: thirdEq });
      const firstEq = vi.fn().mockReturnValue({
        eq: secondEq,
        not: vi.fn().mockResolvedValue({ count: 0, error: null }),
      });
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
  // removeParticipant: reads event_id, deletes the row, then nudges the reserve
  // queue so the freed spot gets offered to the next person.
  function mockRemoveChain(onDelete?: () => void, onUpdate?: () => void) {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { event_id: 'event-1' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => { onDelete?.(); return Promise.resolve({ error: null }); }),
      }),
      update: vi.fn().mockImplementation(() => {
        onUpdate?.();
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it('deletes the participant row', async () => {
    const { supabase } = await import('@/lib/supabase');
    let deleteWasCalled = false;
    vi.mocked(supabase.from).mockImplementation(() => mockRemoveChain(() => { deleteWasCalled = true; }));

    await expect(removeParticipant('participant-1')).resolves.toBeUndefined();
    expect(deleteWasCalled).toBe(true);
  });

  it('does NOT promote a reserve directly — it only asks the queue to offer the spot', async () => {
    const { supabase } = await import('@/lib/supabase');
    let updateWasCalled = false;
    vi.mocked(supabase.from).mockImplementation(() => mockRemoveChain(undefined, () => { updateWasCalled = true; }));

    await removeParticipant('participant-1');

    // Nobody is written into the squad here: the spot is merely offered, and
    // the reserve has to accept it themselves.
    expect(updateWasCalled).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('sync_reserve_claim', { p_event_id: 'event-1' });
  });
});
