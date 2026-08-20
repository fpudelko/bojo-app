import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ten sam wzorzec atrapy co `nieprzeczytaneWMeczach.test.ts` — obie funkcje
// dzielą jedną implementację od refaktoru.
const { tables, fromMock } = vi.hoisted(() => {
  const tables: Record<string, { data: unknown; error: unknown }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chains: Record<string, any> = {};
  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};
    ['select', 'eq', 'neq', 'gte', 'in', 'is', 'order', 'limit'].forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: [], error: null });
    chains[table] = chain;
    return chain;
  }
  return { tables, fromMock: vi.fn((table: string) => chainFor(table)) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock, rpc: vi.fn() } }));

import { rozmowyZNieprzeczytanymi } from '@/lib/comments';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
  window.localStorage.clear();
  tables.event_participants = {
    data: [
      { event_id: 'e1', rsvp: 'yes', pending_approval: false },
      { event_id: 'e2', rsvp: 'yes', pending_approval: false },
    ],
    error: null,
  };
});

describe('rozmowyZNieprzeczytanymi', () => {
  it('sortuje malejąco po najświeższej wiadomości', async () => {
    tables.events = {
      data: [
        { id: 'e1', title: 'Środa', event_date: '2999-01-01' },
        { id: 'e2', title: 'Piątek', event_date: '2999-01-02' },
      ],
      error: null,
    };
    tables.event_comments = {
      data: [
        { event_id: 'e1', user_id: 'ktos', created_at: '2026-01-01T08:00:00Z' },
        { event_id: 'e2', user_id: 'ktos', created_at: '2026-01-02T08:00:00Z' },
      ],
      error: null,
    };
    const wynik = await rozmowyZNieprzeczytanymi('ja');
    expect(wynik.map((r) => r.id)).toEqual(['e2', 'e1']);
    expect(wynik[0]).toMatchObject({ id: 'e2', tytul: 'Piątek', ile: 1 });
  });

  it('pomija własne wiadomości', async () => {
    tables.events = { data: [{ id: 'e1', title: 'Środa', event_date: '2999-01-01' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e1', user_id: 'ja', created_at: '2026-01-01T08:00:00Z' }],
      error: null,
    };
    expect(await rozmowyZNieprzeczytanymi('ja')).toEqual([]);
  });

  it('pomija mecze, które już się odbyły — baza zwraca tylko nadchodzące', async () => {
    tables.events = { data: [{ id: 'e2', title: 'Piątek', event_date: '2999-01-02' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e1', user_id: 'ktos', created_at: '2026-01-01T08:00:00Z' }],
      error: null,
    };
    expect(await rozmowyZNieprzeczytanymi('ja')).toEqual([]);
  });

  it('bez żadnego meczu nie pyta o wiadomości', async () => {
    tables.event_participants = { data: [], error: null };
    tables.events = { data: [], error: null };
    expect(await rozmowyZNieprzeczytanymi('ja')).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith('event_comments');
  });
});
