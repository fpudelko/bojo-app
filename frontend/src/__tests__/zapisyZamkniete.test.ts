import { describe, it, expect, vi, beforeEach } from 'vitest';

// Zamykanie zapisów (migracja `141`) — strona TypeScriptowa.
//
// CZEGO TU NIE MA I GDZIE TO JEST: prawdziwa granica siedzi w bazie,
// w `dolacz_do_meczu()` i `dolacz_do_meczu_jako_goscie()`. Sprawdza ją
// `supabase/test/zapisy-zamkniete.sql` — na prawdziwym Postgresie, z asercjami
// puszczonymi też przy ZDJĘTYM strażniku, żeby wiedzieć, że nie są puste.
// Vitest nie ma bazy i nie ma jak tamtego dotknąć.
//
// Tutaj pilnujemy dwóch rzeczy, których tamten plik nie widzi, a które psują
// się po cichu:
//
//  1. MAPOWANIA KOLUMNY. `toEvent()` przepisuje wiersz bazy na `EventItem`.
//     Literówka w nazwie kolumny nie jest błędem ani w TypeScripcie (wiersz
//     jest `any`), ani w bazie — objawia się jako przełącznik, który po
//     odświeżeniu strony wraca do „otwarte".
//  2. CISZY PRZY ZAPISIE. Niepasująca polityka RLS aktualizuje 0 wierszy
//     i zwraca SUKCES (patrz AGENTS.md). Bez `zaktualizujJedenWiersz()`
//     organizator klika „Zamknij zapisy", dostaje zieloną chmurkę i nic się
//     nie dzieje.

const { mockUpdate, mockEq, mockSelect } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ update: mockUpdate })),
    rpc: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

import { supabase } from '@/lib/supabase';
import { toEvent, setZapisyZamkniete } from '@/lib/events';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ select: mockSelect });
  mockSelect.mockResolvedValue({ data: [{ id: 'ev-1' }], error: null });
});

describe('toEvent — kolumna zapisy_zamkniete', () => {
  const wiersz = {
    id: 'ev-1', organizer_id: 'org-1', sport: 'piłka nożna',
    field_name: 'Orlik', event_date: '2099-07-01', event_time: '18:00',
    max_players: 14, visibility: 'public', created_at: '2099-01-01T00:00:00Z',
  };

  it('czyta zamknięte zapisy z wiersza', () => {
    expect(toEvent({ ...wiersz, zapisy_zamkniete: true }).zapisyZamkniete).toBe(true);
  });

  it('mecz sprzed migracji 141 ma zapisy OTWARTE', () => {
    // Kolumna doszła w `141`. Gdyby brak wartości czytał się jako „zamknięte",
    // migracja zamknęłaby zapisy na wszystkich istniejących meczach naraz.
    expect(toEvent(wiersz).zapisyZamkniete).toBe(false);
    expect(toEvent({ ...wiersz, zapisy_zamkniete: null }).zapisyZamkniete).toBe(false);
  });

  it('zamknięte zapisy NIE robią z meczu odwołanego', () => {
    // Dwa stany rozłączne — gdyby kiedyś ktoś związał je ze sobą w mapowaniu,
    // skład dostałby „mecz odwołany" (migracje `139`, `140`).
    expect(toEvent({ ...wiersz, zapisy_zamkniete: true }).status).toBe('active');
  });
});

describe('setZapisyZamkniete', () => {
  it('zamyka zapisy, ustawiając TĘ kolumnę i nie dotykając statusu', async () => {
    await setZapisyZamkniete('ev-1', true);
    expect(supabase.from).toHaveBeenCalledWith('events');
    expect(mockUpdate).toHaveBeenCalledWith({ zapisy_zamkniete: true });
    // Asercja negatywna jest tu sednem: `status` to odwołanie meczu.
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('otwiera zapisy z powrotem', async () => {
    await setZapisyZamkniete('ev-1', false);
    expect(mockUpdate).toHaveBeenCalledWith({ zapisy_zamkniete: false });
  });

  it('zero zmienionych wierszy to BŁĄD, nie sukces', async () => {
    // Ten przypadek nie jest teoretyczny: dokładnie tak wygląda nietrafiona
    // polityka RLS. Bez wyjątku organizator widzi potwierdzenie zamknięcia
    // zapisów, na które nikt nowy i tak wejdzie.
    mockSelect.mockResolvedValue({ data: [], error: null });
    await expect(setZapisyZamkniete('ev-1', true)).rejects.toThrow(/nie zmieniła żadnego wiersza/);
  });

  it('błąd bazy leci dalej, nie jest połykany', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(setZapisyZamkniete('ev-1', true)).rejects.toThrow(/permission denied/);
  });
});
