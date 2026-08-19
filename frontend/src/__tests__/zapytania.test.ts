import { describe, it, expect, vi, beforeEach } from 'vitest';

const { stanUpdate, from } = vi.hoisted(() => {
  const stanUpdate = { data: [] as unknown[], error: null as { message: string } | null };
  const from = vi.fn(() => ({
    update: () => ({
      eq: () => ({
        select: () => Promise.resolve(stanUpdate),
      }),
      in: () => ({
        select: () => Promise.resolve(stanUpdate),
      }),
    }),
  }));
  return { stanUpdate, from };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

import { zaktualizujJedenWiersz, zaktualizujWiersze, pobierzWszystkie } from '@/lib/zapytania';

beforeEach(() => { stanUpdate.data = []; stanUpdate.error = null; from.mockClear(); });

describe('zaktualizujJedenWiersz', () => {
  it('przechodzi, gdy baza zmieniła wiersz', async () => {
    stanUpdate.data = [{ id: 'p1' }];
    await expect(zaktualizujJedenWiersz('event_participants', 'p1', { is_reserve: false }))
      .resolves.toBeUndefined();
  });

  // Sedno: RLS nie rzuca błędem, tylko aktualizuje 0 wierszy i zwraca sukces.
  // Bez tego sprawdzenia użytkownik widzi „przycisk nic nie robi".
  it('rzuca, gdy nie zmieniono żadnego wiersza (cicha porażka RLS)', async () => {
    stanUpdate.data = [];
    await expect(zaktualizujJedenWiersz('event_participants', 'p1', { is_reserve: false }))
      .rejects.toThrow(/nie zmieniła żadnego wiersza/);
  });

  it('w komunikacie podpowiada RLS jako najczęstszą przyczynę', async () => {
    stanUpdate.data = [];
    await expect(zaktualizujJedenWiersz('t', 'x', {}, 'Nie udało się awansować gracza'))
      .rejects.toThrow(/RLS/);
  });

  it('przepuszcza prawdziwy błąd bazy bez podmiany treści', async () => {
    stanUpdate.error = { message: 'connection reset' };
    await expect(zaktualizujJedenWiersz('t', 'x', {})).rejects.toThrow('connection reset');
  });
});

describe('zaktualizujWiersze', () => {
  it('pusta lista id — nie odpytuje bazy', async () => {
    await zaktualizujWiersze('event_participants', [], { has_paid: true });
    expect(from).not.toHaveBeenCalled();
  });

  it('przechodzi, gdy baza zmieniła dokładnie tyle wierszy, ile podano', async () => {
    stanUpdate.data = [{ id: 'p1' }, { id: 'p2' }];
    await expect(zaktualizujWiersze('event_participants', ['p1', 'p2'], { has_paid: true }))
      .resolves.toBeUndefined();
  });

  // Cicha porażka RLS na skalę: część wierszy się zmieniła, część nie —
  // i to musi rzucić błędem, nie przejść po cichu jako częściowy sukces.
  it('rzuca, gdy baza zmieniła mniej wierszy niż podano id', async () => {
    stanUpdate.data = [{ id: 'p1' }];
    await expect(zaktualizujWiersze('event_participants', ['p1', 'p2'], { has_paid: true }))
      .rejects.toThrow(/zmieniła 1 z 2 wierszy/);
  });

  it('przepuszcza prawdziwy błąd bazy bez podmiany treści', async () => {
    stanUpdate.error = { message: 'connection reset' };
    await expect(zaktualizujWiersze('t', ['x'], {})).rejects.toThrow('connection reset');
  });
});

describe('pobierzWszystkie', () => {
  /** Udaje tabelę o zadanej liczbie wierszy, stronicowaną jak PostgREST. */
  const tabela = (ile: number, strona = 1000) => (od: number) =>
    Promise.resolve({
      data: Array.from({ length: Math.max(0, Math.min(strona, ile - od)) }, (_, i) => ({ id: od + i })),
      error: null,
    });

  it('zbiera wszystkie strony, nie tylko pierwszą', async () => {
    const wynik = await pobierzWszystkie<{ id: number }>(tabela(2500));
    expect(wynik).toHaveLength(2500);
    expect(wynik[2499].id).toBe(2499);
  });

  it('kończy na niepełnej stronie', async () => {
    const budowniczy = vi.fn(tabela(150));
    await pobierzWszystkie<{ id: number }>(budowniczy);
    expect(budowniczy).toHaveBeenCalledTimes(1);
  });

  // Dokładna wielokrotność rozmiaru strony to przypadek, w którym naiwna pętla
  // albo się urywa, albo kręci w kółko.
  it('radzi sobie z liczbą wierszy równą wielokrotności strony', async () => {
    const wynik = await pobierzWszystkie<{ id: number }>(tabela(2000));
    expect(wynik).toHaveLength(2000);
  });

  it('pusta tabela to pusta lista, nie błąd', async () => {
    expect(await pobierzWszystkie<{ id: number }>(tabela(0))).toEqual([]);
  });

  it('przerywa bezpiecznikiem, gdy strony nigdy się nie kończą', async () => {
    const bezKonca = () => Promise.resolve({
      data: Array.from({ length: 10 }, (_, i) => ({ id: i })), error: null,
    });
    await expect(pobierzWszystkie(bezKonca, { strona: 10, maksWierszy: 100 }))
      .rejects.toThrow(/bezpiecznik/);
  });

  it('przepuszcza błąd zapytania', async () => {
    const padajace = () => Promise.resolve({ data: null, error: { message: 'timeout' } });
    await expect(pobierzWszystkie(padajace)).rejects.toThrow('timeout');
  });
});
