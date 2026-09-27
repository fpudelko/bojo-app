import { describe, it, expect, vi, beforeEach } from 'vitest';

// Liczenie zajętych miejsc w składzie (Y-1, migration 127).
//
// CZEGO TU NIE MA I GDZIE TO JEST: zapytania na prawdziwym Postgresie
// leżą w `supabase/test/policzZajeteMiejsca.sql`. Vitest testuje
// TypeScript/RLS/schema osobno.
//
// Tutaj pilnujemy trzech rzeczy, których tamten plik nie widzi:
//
//  1. KOLUMNY, NIE GWIAZDKA. `select('*')` zwraca permission denied od
//     migracji 127 (kolumny event_participants są zamknięte dla anon).
//     Funkcja musi wybrać jawne kolumny.
//  2. FILTROWANIE PO RSVP. Liczenie pominęło obserwujących (rsvp='maybe').
//     Test pilnuje, żeby nie wróciło.
//  3. CZYSTOŚĆ FUNKCJI. `liczZajeteMiejsca()` to czysta funkcja bez importów —
//     można ją testować ze zmyślonym wierszami bazy.

const { mockSelect, mockEq, mockData } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockData: null as any,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: mockSelect })),
    rpc: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

import { supabase } from '@/lib/supabase';
import { policzZajeteMiejsca } from '@/app/wydarzenia/[id]/eventMeta';
import { liczZajeteMiejsca } from '@/lib/zajeteMiejsca';

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: mockData, error: null });
});

describe('liczZajeteMiejsca — czysta funkcja', () => {
  it('liczy uczestników: bez rezerwowych, bez czekających, bez obserwujących', () => {
    const wiersze = [
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },       // ✓ liczy
      { is_reserve: false, pending_approval: false, rsvp: 'maybe' },     // ✗ obserwuje
      { is_reserve: true, pending_approval: false, rsvp: 'yes' },        // ✗ rezerwa
      { is_reserve: false, pending_approval: true, rsvp: 'yes' },        // ✗ czeka
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },       // ✓ liczy
    ];
    expect(liczZajeteMiejsca(wiersze)).toBe(2);
  });

  it('obsługuje puste i nullowe wartości', () => {
    const wiersze = [
      { is_reserve: null, pending_approval: null, rsvp: null },
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },
    ];
    expect(liczZajeteMiejsca(wiersze)).toBe(1);
  });

  it('zwraca 0 na pusty array', () => {
    expect(liczZajeteMiejsca([])).toBe(0);
  });

  it('zwraca 0 na null/undefined', () => {
    expect(liczZajeteMiejsca(null)).toBe(0);
    expect(liczZajeteMiejsca(undefined)).toBe(0);
  });
});

describe('policzZajeteMiejsca — zapytanie na event_participants', () => {
  it('używa jawnych kolumn, nie select("*")', async () => {
    mockData = [
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },
      { is_reserve: false, pending_approval: false, rsvp: 'maybe' },
    ];
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: mockData, error: null });

    await policzZajeteMiejsca('ev-123');

    expect(mockSelect).toHaveBeenCalledWith('is_reserve, pending_approval, rsvp');
    expect(mockSelect).not.toHaveBeenCalledWith('*');
  });

  it('filtruje event_id i zwraca liczbę obserwaną przez liczZajeteMiejsca', async () => {
    mockData = [
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },
      { is_reserve: false, pending_approval: false, rsvp: 'yes' },
      { is_reserve: false, pending_approval: false, rsvp: 'maybe' },
    ];
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: mockData, error: null });

    const result = await policzZajeteMiejsca('ev-123');

    expect(mockEq).toHaveBeenCalledWith('event_id', 'ev-123');
    expect(result).toBe(2);
  });

  it('zwraca undefined na błąd zapytania', async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: null, error: new Error('permission denied') });

    const result = await policzZajeteMiejsca('ev-123');

    expect(result).toBeUndefined();
  });

  it('nie filtruje pending_approval ani is_reserve w zapytaniu (wszystkie wiersze)', async () => {
    mockData = [];
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: mockData, error: null });

    await policzZajeteMiejsca('ev-123');

    const calls = mockSelect.mock.calls[0][0];
    expect(calls).toContain('is_reserve');
    expect(calls).toContain('pending_approval');
    expect(calls).toContain('rsvp');
    // Filtrowanie odbywa się w czystej funkcji, nie w zapytaniu
    expect(mockEq.mock.calls.length).toBe(1); // tylko event_id
  });
});
