import { describe, it, expect, vi, beforeEach } from 'vitest';

// Osobny plik zamiast dopisania do `events.test.ts`: tamtejszy mock nie zna
// `in`/`neq`/`gte` ani zapytania liczącego (`head: true`), a rozszerzanie go
// zmieniłoby zachowanie kilkudziesięciu istniejących testów.
const { tables, fromMock, ostatnieSelect } = vi.hoisted(() => {
  const tables: Record<string, { data?: unknown; count?: number; error: unknown }> = {};
  const ostatnieSelect: { args: unknown[] } = { args: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chains: Record<string, any> = {};
  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};
    ['insert', 'update', 'delete', 'eq', 'neq', 'gte', 'in', 'is', 'order', 'limit'].forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.select = vi.fn((...args: unknown[]) => {
      if (table === 'events' && args.length > 1) ostatnieSelect.args = args;
      return chain;
    });
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: [], count: 0, error: null });
    chains[table] = chain;
    return chain;
  }
  const fromMock = vi.fn((table: string) => chainFor(table));
  return { tables, fromMock, ostatnieSelect };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock, rpc: vi.fn() } }));

import { policzNadchodzaceMoje } from '@/lib/events';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
  ostatnieSelect.args = [];
});

describe('policzNadchodzaceMoje', () => {
  it('zwraca liczbę meczów i pyta bazę wyłącznie o licznik', async () => {
    tables.event_participants = {
      data: [
        { event_id: 'e1', rsvp: 'yes', pending_approval: false },
        { event_id: 'e2', rsvp: 'yes', pending_approval: false },
      ],
      error: null,
    };
    tables.events = { count: 2, error: null };

    expect(await policzNadchodzaceMoje('u1')).toBe(2);
    // `head: true` — plakietka potrzebuje liczby, nie wierszy, a to zapytanie
    // leci przy każdej zmianie trasy.
    expect(ostatnieSelect.args[1]).toEqual({ count: 'exact', head: true });
  });

  it('bez żadnego meczu nie pyta bazy o drugie zapytanie', async () => {
    tables.event_participants = { data: [], error: null };
    tables.events = { data: [], count: 0, error: null };

    expect(await policzNadchodzaceMoje('u1')).toBe(0);
    expect(ostatnieSelect.args).toEqual([]);
  });

  it('mecz czekający na akceptację nie liczy się jako mój', async () => {
    tables.event_participants = {
      data: [{ event_id: 'e1', rsvp: 'yes', pending_approval: true }],
      error: null,
    };
    tables.events = { data: [], count: 0, error: null };

    expect(await policzNadchodzaceMoje('u1')).toBe(0);
    expect(ostatnieSelect.args).toEqual([]);
  });
});
