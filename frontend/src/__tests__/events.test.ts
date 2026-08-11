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

import { createEvent, joinEvent, removeParticipant, getMyParticipationMap, wolneMiejscaWgRol
} from '@/lib/events';

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
    //   events            → .select().eq().single() → { max_players: 10, max_goalkeepers, goalkeepers_enabled }
    //   event_participants (confirmedCounts) → .select().eq().eq().eq() → participant rows
    //   event_participants (.insert)
    let queryCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          ...mockChain,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { max_players: 10, max_goalkeepers: 2, goalkeepers_enabled: false },
                error: null,
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      // event_participants: confirmedCounts() chains .select('is_goalkeeper, claim_offered_at, rsvp').eq().eq().eq()
      // Returns mock participant rows (5 non-reserve confirmed participants, no held offers).
      const thirdEq = vi.fn().mockResolvedValue({
        data: [
          { is_goalkeeper: false, claim_offered_at: null, rsvp: 'yes' },
          { is_goalkeeper: false, claim_offered_at: null, rsvp: 'yes' },
          { is_goalkeeper: false, claim_offered_at: null, rsvp: 'yes' },
          { is_goalkeeper: false, claim_offered_at: null, rsvp: 'yes' },
          { is_goalkeeper: false, claim_offered_at: null, rsvp: 'yes' },
        ],
        error: null,
      });
      const secondEq = vi.fn().mockReturnValue({ eq: thirdEq });
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      return {
        ...mockChain,
        select: vi.fn().mockReturnValue({ eq: firstEq }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    // `joinEvent` oddaje dziś, GDZIE wylądował zapis — strona meczu potrzebuje
    // tego, żeby nie mówić „Dołączyłeś do meczu!" komuś, kto trafił na rezerwę.
    await expect(joinEvent('event-1', 'user-1', 'Test User'))
      .resolves.toEqual({ isReserve: false, pending: false });
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

// ---------------------------------------------------------------------------
// getMyParticipationMap — 'invited' status derived from event_player_invites
// ---------------------------------------------------------------------------
describe('getMyParticipationMap', () => {
  it('derives status "invited" for an open invite with no participant row yet', async () => {
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'event_participants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      // event_player_invites → .select().eq().is()
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [{ event_id: 'e-invited' }], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const map = await getMyParticipationMap('user-1');
    expect(map['e-invited']).toBe('invited');
  });

  it('an existing participant row wins over an open invite for the same event', async () => {
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'event_participants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ event_id: 'e1', rsvp: null, is_reserve: false, pending_approval: false }],
              error: null,
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [{ event_id: 'e1' }], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const map = await getMyParticipationMap('user-1');
    // Already answered (playing) — the invite is stale context, not the relation.
    expect(map['e1']).toBe('playing');
  });

  it('no invites and no participant rows produces an empty map', async () => {
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'event_participants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    const map = await getMyParticipationMap('user-1');
    expect(map).toEqual({});
  });
});

describe('wolneMiejscaWgRol', () => {
  const skladPolowy = (pole: number, bramkarze: number) => [
    ...Array.from({ length: pole }, () => ({ isGoalkeeper: false })),
    ...Array.from({ length: bramkarze }, () => ({ isGoalkeeper: true })),
  ];

  it('bez rozróżniania ról oddaje jedną pulę', () => {
    const w = wolneMiejscaWgRol(skladPolowy(3, 0), { maxPlayers: 14, goalkeepersEnabled: false });
    expect(w).toEqual({ pole: 11, bramkarze: 0, razem: 11, rozdzielone: false });
  });

  // Sedno zgłoszenia: „zostały 2 wolne miejsca" przy komplecie w polu znaczyło
  // w rzeczywistości „2 miejsca dla bramkarzy", a zawodnik z pola i tak lądował
  // na rezerwie — dowiadując się o tym dopiero po zapisaniu się.
  it('rozdziela pulę: komplet w polu przy wolnych miejscach dla bramkarzy', () => {
    const w = wolneMiejscaWgRol(skladPolowy(12, 0), {
      maxPlayers: 14, maxGoalkeepers: 2, goalkeepersEnabled: true,
    });
    expect(w.pole).toBe(0);
    expect(w.bramkarze).toBe(2);
    expect(w.razem).toBe(2);
    expect(w.rozdzielone).toBe(true);
  });

  it('liczy obie role osobno', () => {
    const w = wolneMiejscaWgRol(skladPolowy(10, 1), {
      maxPlayers: 14, maxGoalkeepers: 2, goalkeepersEnabled: true,
    });
    expect(w.pole).toBe(2);
    expect(w.bramkarze).toBe(1);
  });

  it('nie schodzi poniżej zera przy nadkomplecie', () => {
    const w = wolneMiejscaWgRol(skladPolowy(0, 3), {
      maxPlayers: 14, maxGoalkeepers: 2, goalkeepersEnabled: true,
    });
    expect(w.bramkarze).toBe(0);
  });

  it('pusty skład oddaje pełne limity', () => {
    const w = wolneMiejscaWgRol([], { maxPlayers: 14, maxGoalkeepers: 2, goalkeepersEnabled: true });
    expect(w.pole).toBe(12);
    expect(w.bramkarze).toBe(2);
  });
});

// Tryb wspólnej puli (migracja `077`). Sedno zgłoszenia: przy 14 miejscach
// i 2 bramkarzach trzynasty zawodnik z pola lądował na rezerwie, choć dwa
// miejsca stały puste i nikt ich nie zajmował.
describe('wolneMiejscaWgRol — tryb wspólnej puli', () => {
  const sklad = (pole: number, bramkarze: number) => [
    ...Array.from({ length: pole }, () => ({ isGoalkeeper: false })),
    ...Array.from({ length: bramkarze }, () => ({ isGoalkeeper: true })),
  ];
  const wspolna = {
    maxPlayers: 14, maxGoalkeepers: 2,
    goalkeepersEnabled: true, goalkeeperSlotsReserved: false,
  };
  const zarezerwowane = { ...wspolna, goalkeeperSlotsReserved: true };

  it('dwunastu w polu: rezerwacja blokuje, wspólna pula nie', () => {
    expect(wolneMiejscaWgRol(sklad(12, 0), zarezerwowane).pole).toBe(0);
    expect(wolneMiejscaWgRol(sklad(12, 0), wspolna).pole).toBe(2);
  });

  it('wspólna pula nie udaje, że pule są osobne', () => {
    expect(wolneMiejscaWgRol(sklad(5, 0), wspolna).rozdzielone).toBe(false);
  });

  it('sufit bramkarzy obowiązuje mimo wolnych miejsc', () => {
    const w = wolneMiejscaWgRol(sklad(5, 2), wspolna);
    expect(w.razem).toBe(7);
    expect(w.pole).toBe(7);
    expect(w.bramkarze).toBe(0);
  });

  it('wolne miejsca dla bramkarzy nie przekraczają tego, co zostało w ogóle', () => {
    // Jedno wolne miejsce w sumie, sufit bramkarzy pozwoliłby na dwa.
    const w = wolneMiejscaWgRol(sklad(13, 0), wspolna);
    expect(w.razem).toBe(1);
    expect(w.bramkarze).toBe(1);
  });
});
