import { describe, it, expect, vi, beforeEach } from 'vitest';

// Atrapa oddaje wynik per TABELA, bo `nieprzeczytaneWMeczach()` odpytuje trzy:
// `event_participants` i `events` (przez `getMyActiveEventIds`), potem `events`
// po nadchodzące i `event_comments` po wiadomości.
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

import { nieprzeczytaneWMeczach } from '@/lib/comments';

const WCZORAJ = '2020-01-01';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
  window.localStorage.clear();
  // Gram w dwóch meczach; który z nich jest nadchodzący, decyduje `tables.events`.
  tables.event_participants = {
    data: [
      { event_id: 'e-stary', rsvp: 'yes', pending_approval: false },
      { event_id: 'e-nowy', rsvp: 'yes', pending_approval: false },
    ],
    error: null,
  };
});

describe('nieprzeczytaneWMeczach', () => {
  it('nie liczy rozmów z meczów, które już się odbyły', async () => {
    // Baza zwraca TYLKO nadchodzące (filtr `gte('event_date', dzis)`), więc
    // atrapa oddaje sam mecz przyszły. Nieprzeczytana wiadomość wisi w starym.
    tables.events = { data: [{ id: 'e-nowy', title: 'Czwartek', event_date: '2999-01-01' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e-stary', user_id: 'ktos', created_at: '2026-01-01T10:00:00Z' }],
      error: null,
    };

    // To jest ten błąd: rozmowa z rozegranego meczu zapalała wskaźnik na stałe,
    // bo „Moje" pokazuje wyłącznie nadchodzące — nie było jak jej otworzyć,
    // a więc i odznaczyć.
    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 0, tytul: null });
  });

  it('liczy nieprzeczytaną z nadchodzącego meczu i podaje jego tytuł', async () => {
    tables.events = { data: [{ id: 'e-nowy', title: 'Czwartek', event_date: '2999-01-01' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e-nowy', user_id: 'ktos', created_at: '2026-01-01T10:00:00Z' }],
      error: null,
    };

    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 1, tytul: 'Czwartek' });
  });

  it('gaśnie po wejściu w rozmowę', async () => {
    tables.events = { data: [{ id: 'e-nowy', title: 'Czwartek', event_date: '2999-01-01' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e-nowy', user_id: 'ktos', created_at: '2026-01-01T10:00:00Z' }],
      error: null,
    };
    window.localStorage.setItem('bojo:rozmowa-widziano:e-nowy', '2026-06-01T10:00:00Z');

    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 0, tytul: null });
  });

  it('własna wiadomość nie zapala wskaźnika', async () => {
    tables.events = { data: [{ id: 'e-nowy', title: 'Czwartek', event_date: '2999-01-01' }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e-nowy', user_id: 'ja', created_at: '2026-01-01T10:00:00Z' }],
      error: null,
    };

    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 0, tytul: null });
  });

  it('bez żadnego meczu nie pyta o wiadomości', async () => {
    tables.event_participants = { data: [], error: null };
    tables.events = { data: [], error: null };

    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 0, tytul: null });
    expect(fromMock).not.toHaveBeenCalledWith('event_comments');
  });

  it('data w przeszłości w atrapie nie zmienia wyniku — filtruje baza, nie kod', async () => {
    // Test-strażnik: gdyby ktoś kiedyś przeniósł filtr daty do kodu, ta asercja
    // ma się wywalić i wymusić decyzję, gdzie ten filtr ma mieszkać.
    tables.events = { data: [{ id: 'e-nowy', title: 'Stary', event_date: WCZORAJ }], error: null };
    tables.event_comments = {
      data: [{ event_id: 'e-nowy', user_id: 'ktos', created_at: '2026-01-01T10:00:00Z' }],
      error: null,
    };

    expect(await nieprzeczytaneWMeczach('ja')).toEqual({ ile: 1, tytul: 'Stary' });
  });
});
