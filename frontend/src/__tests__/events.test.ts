import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock factory can reference them
// ---------------------------------------------------------------------------
const { mockSingle, mockDelete, mockUpdate, mockRpc, mockChain } = vi.hoisted(() => {
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

  return { mockSingle, mockDelete, mockUpdate, mockRpc, mockChain };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockChain),
    rpc: mockRpc,
    // `auth` w atrapie, bo `removeParticipant()` pyta o sesję, żeby odróżnić
    // „wypisał się sam" od „usunął go organizator" (dziennik meczu).
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

import { supabase } from '@/lib/supabase';
import {
  createEvent, joinEvent, joinEventAsGuest, removeParticipant, getMyParticipationMap,
  wolneMiejscaWgRol, addGuest, repeatEvent, werdyktGry, czasRezerwyTekst,
} from '@/lib/events';
import type { EventItem } from '@/types';

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
// repeatEvent
// ---------------------------------------------------------------------------
describe('repeatEvent', () => {
  const source: EventItem = {
    id: 'src-event', organizerId: 'organizer-uid', organizerName: 'Jan Kowalski',
    sport: 'piłka nożna', fieldName: 'Orlik Rataje', date: '2099-07-01', time: '18:00',
    endTime: '19:30', maxPlayers: 10, visibility: 'private', createdAt: '2099-01-01T00:00:00Z',
    status: 'active', requireSmsConfirmation: false, teamMode: 'brak', trackPayments: false,
    showPaymentStatus: false, trackResults: false, confirmationDeadlineH: 24, costGrosze: 0,
    teamsPublished: false, allowGuestAdds: false, joinCode: 'ABCDEF', requireApproval: false,
    maxGoalkeepers: 2, goalkeeperSlotsReserved: false, goalkeepersEnabled: false,
    reserveClaimMinutes: 120, acceptedPaymentMethods: [], acceptedSportsCards: [],
    sportsCardDiscountGrosze: null,
  };

  it('passes an explicit newEndTime through to createEvent instead of copying source.endTime', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-event' }, error: null });

    await repeatEvent(source, '2099-07-08', '10:00', 'organizer-uid', 'Jan Kowalski', true, false, '11:30');

    const insertedRows = mockChain.insert.mock.calls.map(([row]) => row);
    const eventRow = insertedRows.find((row) => 'end_time' in row);
    expect(eventRow.end_time).toBe('11:30');
  });

  it('falls back to source.endTime when newEndTime is not given (previous behaviour)', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-event' }, error: null });

    await repeatEvent(source, '2099-07-08', '10:00', 'organizer-uid', 'Jan Kowalski');

    const insertedRows = mockChain.insert.mock.calls.map(([row]) => row);
    const eventRow = insertedRows.find((row) => 'end_time' in row);
    expect(eventRow.end_time).toBe('19:30');
  });

  // Regresja: `repeatEvent` gubiło `groupId` — powtórka meczu ekipy wypinała
  // termin z grupy, i cotygodniowa gierka rozjeżdżała się z listą meczów grupy
  // po pierwszej powtórce.
  it('carries source.groupId through to the repeated event', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-event' }, error: null });

    await repeatEvent(
      { ...source, groupId: 'group-uuid-1' },
      '2099-07-08', '10:00', 'organizer-uid', 'Jan Kowalski',
    );

    const insertedRows = mockChain.insert.mock.calls.map(([row]) => row);
    const eventRow = insertedRows.find((row) => 'group_id' in row);
    expect(eventRow.group_id).toBe('group-uuid-1');
  });

  it('keeps group_id null when the source event has none', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-event' }, error: null });

    await repeatEvent(source, '2099-07-08', '10:00', 'organizer-uid', 'Jan Kowalski');

    const insertedRows = mockChain.insert.mock.calls.map(([row]) => row);
    const eventRow = insertedRows.find((row) => 'group_id' in row);
    expect(eventRow.group_id).toBeNull();
  });

  it('carries source.minPlayers through to the repeated event', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-event' }, error: null });

    await repeatEvent(
      { ...source, minPlayers: 8 },
      '2099-07-08', '10:00', 'organizer-uid', 'Jan Kowalski',
    );

    const insertedRows = mockChain.insert.mock.calls.map(([row]) => row);
    const eventRow = insertedRows.find((row) => 'min_players' in row);
    expect(eventRow.min_players).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// addGuest — zwraca id i claim_token, żeby wywołujący mógł od razu zaproponować
// wysłanie zaproszenia (GuestInviteNudge.tsx) bez dodatkowego zapytania.
// ---------------------------------------------------------------------------
describe('addGuest', () => {
  it('zwraca id i claimToken nowego wiersza, obok isReserve', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'participant-uuid-1', claim_token: 'token-abc' },
      error: null,
    });

    const wynik = await addGuest('event-1', 'Marek Nowak', true);

    expect(wynik).toEqual({ id: 'participant-uuid-1', claimToken: 'token-abc', isReserve: true });
    const { supabase } = await import('@/lib/supabase');
    expect(supabase.from).toHaveBeenCalledWith('event_participants');
  });

  it('throws when Supabase returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    await expect(addGuest('event-1', 'Marek Nowak', true)).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// joinEvent
// ---------------------------------------------------------------------------
describe('joinEvent — kontrakt z bazą', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  /** `check_rate_limit` przepuszcza, `dolacz_do_meczu` oddaje podany wynik. */
  function bazaOddaje(wynik: { is_reserve: boolean; pending: boolean }) {
    mockRpc.mockImplementation((nazwa: string) => {
      if (nazwa === 'check_rate_limit') return Promise.resolve({ data: true, error: null });
      if (nazwa === 'dolacz_do_meczu') return Promise.resolve({ data: [wynik], error: null });
      return Promise.resolve({ data: null, error: null });
    });
  }

  // Sedno etapu 3: decyzja „skład czy rezerwa" NIE jest już liczona
  // w przeglądarce. Gdyby ktoś ją tu przywrócił, ten test nadal by przechodził
  // — ale kolejny (poniżej) już nie.
  it('oddaje to, co zdecydowała baza — skład', async () => {
    bazaOddaje({ is_reserve: false, pending: false });
    await expect(joinEvent('event-1', 'user-1', 'Test User'))
      .resolves.toEqual({ isReserve: false, pending: false });
  });

  it('oddaje to, co zdecydowała baza — rezerwa', async () => {
    bazaOddaje({ is_reserve: true, pending: false });
    await expect(joinEvent('event-1', 'user-1', 'Test User'))
      .resolves.toEqual({ isReserve: true, pending: false });
  });

  it('oddaje to, co zdecydowała baza — prośba do akceptacji', async () => {
    bazaOddaje({ is_reserve: false, pending: true });
    await expect(joinEvent('event-1', 'user-1', 'Test User'))
      .resolves.toEqual({ isReserve: false, pending: true });
  });

  // Ten test jest właściwym strażnikiem: zapis to JEDNO wywołanie funkcji
  // bazodanowej, a nie sekwencja „wczytaj ustawienia → policz → wstaw".
  // Tamta sekwencja pozwalała dwóm graczom dostać to samo ostatnie miejsce.
  it('nie czyta ustawień meczu ani nie liczy pojemności w przeglądarce', async () => {
    bazaOddaje({ is_reserve: false, pending: false });
    await joinEvent('event-1', 'user-1', 'Test User');

    // `from` bywa wołane przez dziennik aktywności — chodzi o to, żeby NIE
    // czytało ustawień meczu ani wpisów uczestników, bo to znaczyłoby, że
    // pojemność znów liczy się w przeglądarce.
    expect(supabase.from).not.toHaveBeenCalledWith('events');
    expect(supabase.from).not.toHaveBeenCalledWith('event_participants');
    expect(mockRpc).toHaveBeenCalledWith('dolacz_do_meczu', expect.objectContaining({
      p_event_id: 'event-1',
      p_nazwa: 'Test User',
      p_bramkarz: false,
    }));
  });

  it('przekazuje rolę i deklarację płatności', async () => {
    bazaOddaje({ is_reserve: false, pending: false });
    await joinEvent('event-1', 'user-1', 'Test User', true, {
      method: 'blik', hasSportsCard: true, sportsCardProvider: 'multisport',
    });
    expect(mockRpc).toHaveBeenCalledWith('dolacz_do_meczu', expect.objectContaining({
      p_bramkarz: true,
      p_metoda_platnosci: 'blik',
      p_karta_sportowa: true,
      p_dostawca_karty: 'multisport',
    }));
  });

  // Bez karty sportowej dostawca nie ma prawa jechać do bazy — inaczej wpis
  // deklarowałby zniżkę, której nikt nie zgłosił.
  it('nie wysyła dostawcy karty, gdy karty nie ma', async () => {
    bazaOddaje({ is_reserve: false, pending: false });
    await joinEvent('event-1', 'user-1', 'Test User', false, {
      method: 'gotowka', hasSportsCard: false, sportsCardProvider: 'multisport',
    });
    expect(mockRpc).toHaveBeenCalledWith('dolacz_do_meczu', expect.objectContaining({
      p_dostawca_karty: null,
    }));
  });

  it('przenosi błąd z bazy bez podmiany treści', async () => {
    mockRpc.mockImplementation((nazwa: string) => {
      if (nazwa === 'check_rate_limit') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: { message: 'Jesteś już zapisany na ten mecz' } });
    });
    await expect(joinEvent('event-1', 'user-1', 'Test User'))
      .rejects.toThrow('Jesteś już zapisany na ten mecz');
  });

  it('zatrzymuje się na limicie prób, zanim ruszy bazę', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(joinEvent('event-1', 'user-1', 'Test User')).rejects.toThrow(/Zbyt wiele/);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// joinEventAsGuest — zapis bez logowania. Kształt wyniku decyduje o tym, KTÓRY
// ekran zobaczy gość (zachęta do konta / „wcześniej dołączyłeś" / logowanie),
// więc mapowanie kolumn RPC jest tu kontraktem, nie szczegółem.
// ---------------------------------------------------------------------------
describe('joinEventAsGuest — kontrakt z bazą', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.from).mockReturnValue(mockChain as never);
    mockSingle.mockResolvedValue({ data: { is_reserve: false }, error: null });
  });

  function bazaOddaje(wiersz: Record<string, unknown>) {
    mockRpc.mockImplementation((nazwa: string) => {
      if (nazwa === 'dolacz_do_meczu_jako_goscie') {
        return Promise.resolve({ data: [wiersz], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  }

  it('świeży zapis bez konta — token, brak powtórki, brak konta', async () => {
    bazaOddaje({ claim_token: 'tok-1', event_id: 'e1', already_joined: false, has_account: false });

    await expect(joinEventAsGuest('e1', 'Jan Kowalski', 'jan@example.com'))
      .resolves.toEqual({ claimToken: 'tok-1', isReserve: false, alreadyJoined: false, hasAccount: false, pendingApproval: false });
    expect(mockRpc).toHaveBeenCalledWith('dolacz_do_meczu_jako_goscie', expect.objectContaining({
      p_event_id: 'e1',
      p_imie: 'Jan Kowalski',
      p_email: 'jan@example.com',
      p_bramkarz: false,
    }));
  });

  // Sedno migracji 088: e-mail z kontem dostaje ekran namawiający na LOGOWANIE,
  // a nie na zakładanie drugiego konta. Bez tej flagi frontend nie ma tej wiedzy.
  it('świeży zapis e-mailem, który ma już konto — hasAccount true', async () => {
    bazaOddaje({ claim_token: 'tok-2', event_id: 'e1', already_joined: false, has_account: true });
    mockSingle.mockResolvedValue({ data: { is_reserve: true }, error: null });

    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .resolves.toEqual({ claimToken: 'tok-2', isReserve: true, alreadyJoined: false, hasAccount: true, pendingApproval: false });
  });

  it('powtórka tym samym mailem bez konta — ten sam token, alreadyJoined', async () => {
    bazaOddaje({ claim_token: 'tok-1', event_id: 'e1', already_joined: true, has_account: false });

    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .resolves.toEqual({ claimToken: 'tok-1', isReserve: false, alreadyJoined: true, hasAccount: false, pendingApproval: false });
  });

  // Wpis ma już właściciela: pusty token to sygnał „nie ma czego przejmować,
  // pokaż ekran logowania". Wcześniej baza rzucała w tym miejscu wyjątkiem,
  // a frontend rozpoznawał go po treści komunikatu.
  it('wpis z właścicielem — pusty token zamiast wyjątku, bez dopytywania o rezerwę', async () => {
    bazaOddaje({ claim_token: null, event_id: 'e1', already_joined: true, has_account: true });

    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .resolves.toEqual({ claimToken: null, isReserve: false, alreadyJoined: true, hasAccount: true, pendingApproval: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // Migracje odpalane są ręcznie, więc między mergem a wklejeniem 088 w Supabase
  // RPC zwraca stary, trzykolumnowy kształt. Musi działać, nie wywracać się.
  it('stary kształt sprzed 088 (bez has_account) — hasAccount false, bez wyjątku', async () => {
    bazaOddaje({ claim_token: 'tok-1', event_id: 'e1', already_joined: false });

    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .resolves.toEqual({ claimToken: 'tok-1', isReserve: false, alreadyJoined: false, hasAccount: false, pendingApproval: false });
  });

  // 111: mecz z akceptacją zapisów — gość dostaje pending_approval=true i nie
  // zajmuje miejsca (dokładnie ta sama para pól co isReserve, drugim zapytaniem).
  it('mecz z akceptacją zapisów — pendingApproval true', async () => {
    bazaOddaje({ claim_token: 'tok-3', event_id: 'e1', already_joined: false, has_account: false });
    mockSingle.mockResolvedValue({ data: { is_reserve: false, pending_approval: true }, error: null });

    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .resolves.toEqual({ claimToken: 'tok-3', isReserve: false, alreadyJoined: false, hasAccount: false, pendingApproval: true });
  });

  it('przenosi błąd z bazy bez podmiany treści', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Mecz został odwołany' } });
    await expect(joinEventAsGuest('e1', 'Jan', 'jan@example.com'))
      .rejects.toThrow('Mecz został odwołany');
  });
});

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

// ---------------------------------------------------------------------------
// werdyktGry (097) — próg minimum graczy, żeby organizator nie liczył
// "brakuje nam 1go? dobrze liczę?" w głowie.
// ---------------------------------------------------------------------------
describe('werdyktGry', () => {
  it('brak progu daje "brak-progu", nie udaje werdyktu', () => {
    expect(werdyktGry({ minPlayers: undefined }, 5)).toEqual({ stan: 'brak-progu', brakuje: 0 });
  });

  it('próg 0 też liczy się jako brak progu', () => {
    expect(werdyktGry({ minPlayers: 0 }, 5)).toEqual({ stan: 'brak-progu', brakuje: 0 });
  });

  it('równo minimum: gramy, brakuje 0', () => {
    expect(werdyktGry({ minPlayers: 10 }, 10)).toEqual({ stan: 'gramy', brakuje: 0 });
  });

  it('powyżej minimum: gramy', () => {
    expect(werdyktGry({ minPlayers: 10 }, 12)).toEqual({ stan: 'gramy', brakuje: 0 });
  });

  it('jeden poniżej minimum: zagrożona, brakuje 1', () => {
    expect(werdyktGry({ minPlayers: 10 }, 9)).toEqual({ stan: 'zagrozona', brakuje: 1 });
  });

  it('pusty skład: zagrożona, brakuje całego progu', () => {
    expect(werdyktGry({ minPlayers: 10 }, 0)).toEqual({ stan: 'zagrozona', brakuje: 10 });
  });

  it('błędna konfiguracja (min > max, tu tylko sam próg) nie wywraca funkcji', () => {
    expect(() => werdyktGry({ minPlayers: 99 }, 3)).not.toThrow();
    expect(werdyktGry({ minPlayers: 99 }, 3).brakuje).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// czasRezerwyTekst (118) — ta sama reguła formatu co sync_reserve_claim()
// w SQL, więc treść push i tekst na stronie meczu nigdy się nie rozjadą.
// ---------------------------------------------------------------------------
describe('czasRezerwyTekst', () => {
  it('poniżej godziny pokazuje same minuty', () => {
    expect(czasRezerwyTekst(30)).toBe('30 min.');
  });

  it('pełna godzina bez zbędnych "0 min."', () => {
    expect(czasRezerwyTekst(60)).toBe('1 godz.');
    expect(czasRezerwyTekst(180)).toBe('3 godz.');
  });

  it('niepełna godzina łączy oba człony', () => {
    expect(czasRezerwyTekst(90)).toBe('1 godz. 30 min.');
    expect(czasRezerwyTekst(150)).toBe('2 godz. 30 min.');
  });
});
