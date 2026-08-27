import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wzorem licznikMoich.test.ts — chain generyczny, `.then()` oddaje ustawioną
// odpowiedź niezależnie od filtrów. Wystarcza tu: `miastaPowyzejProguDlaSportu`
// woła `fields` raz na sport, więc test ustawia jedną odpowiedź i sprawdza
// logikę grupowania/progu, nie samo zapytanie do bazy.
const { tables, fromMock } = vi.hoisted(() => {
  const tables: Record<string, { data?: unknown; count?: number; error: unknown }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chains: Record<string, any> = {};
  function chainFor(table: string) {
    if (chains[table]) return chains[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};
    ['eq', 'neq', 'contains', 'in', 'order', 'range'].forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.select = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: [], count: 0, error: null });
    chains[table] = chain;
    return chain;
  }
  const fromMock = vi.fn((table: string) => chainFor(table));
  return { tables, fromMock };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));

import {
  znajdzMiastoPrioryteotowe,
  liczObiektowWMiescie,
  miastaPowyzejProguDlaSportu,
  paryHubowMiastSportu,
  PROG_OBIEKTOW_HUB_MIASTA,
} from '@/lib/hubMiasta';

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(tables).forEach((k) => delete tables[k]);
});

describe('PROG_OBIEKTOW_HUB_MIASTA', () => {
  it('próg to 3 — decyzja właściciela 2026-08-25, nie 4c', () => {
    expect(PROG_OBIEKTOW_HUB_MIASTA).toBe(3);
  });
});

describe('znajdzMiastoPrioryteotowe', () => {
  it('znajduje nazwę po slugu, z odmianą i diakrytykami', () => {
    tables.miasta_priorytetowe = { data: [{ nazwa: 'Warszawa' }, { nazwa: 'Bielsko-Biała' }], error: null };
    return expect(znajdzMiastoPrioryteotowe('bielsko-biala')).resolves.toBe('Bielsko-Biała');
  });

  it('zwraca null dla miasta spoza listy priorytetowej', async () => {
    tables.miasta_priorytetowe = { data: [{ nazwa: 'Warszawa' }], error: null };
    expect(await znajdzMiastoPrioryteotowe('wroclaw')).toBeNull();
  });
});

describe('liczObiektowWMiescie', () => {
  it('liczy zapytaniem count:exact, head:true — nie pobiera wierszy', async () => {
    tables.fields = { count: 7, error: null };
    expect(await liczObiektowWMiescie('piłka nożna', 'Poznań')).toBe(7);
  });

  it('brak wyniku liczy jako zero', async () => {
    tables.fields = { count: undefined, error: null };
    expect(await liczObiektowWMiescie('piłka nożna', 'Poznań')).toBe(0);
  });
});

describe('miastaPowyzejProguDlaSportu', () => {
  it('zwraca tylko miasta z co najmniej trzema obiektami, posortowane', async () => {
    tables.miasta_priorytetowe = {
      data: [{ nazwa: 'Warszawa' }, { nazwa: 'Poznań' }, { nazwa: 'Kraków' }],
      error: null,
    };
    tables.fields = {
      data: [
        { city: 'Warszawa' }, { city: 'Warszawa' }, { city: 'Warszawa' },
        { city: 'Poznań' }, { city: 'Poznań' }, // dwa — poniżej progu
        { city: 'Kraków' }, { city: 'Kraków' }, { city: 'Kraków' }, { city: 'Kraków' },
      ],
      error: null,
    };

    const wynik = await miastaPowyzejProguDlaSportu('piłka nożna');
    expect(wynik.map((m) => m.nazwa)).toEqual(['Kraków', 'Warszawa']);
    expect(wynik.find((m) => m.nazwa === 'Kraków')?.slug).toBe('krakow');
  });

  it('brak miast priorytetowych nie odpytuje fields', async () => {
    tables.miasta_priorytetowe = { data: [], error: null };
    expect(await miastaPowyzejProguDlaSportu('piłka nożna')).toEqual([]);
  });
});

describe('paryHubowMiastSportu', () => {
  it('łączy wyniki ze wszystkich sportów w KATALOG_SPORT_MAP', async () => {
    tables.miasta_priorytetowe = { data: [{ nazwa: 'Poznań' }], error: null };
    tables.fields = {
      data: [{ city: 'Poznań' }, { city: 'Poznań' }, { city: 'Poznań' }],
      error: null,
    };

    const pary = await paryHubowMiastSportu();
    // Ten sam mock odpowiada identycznie na każde zapytanie o `fields`
    // (niezależnie od sportu), więc para (sport, "poznan") wychodzi dla
    // każdego z siedmiu sportów z KATALOG_SPORT_MAP.
    expect(pary.length).toBe(7);
    expect(pary.every((p) => p.miastoSlug === 'poznan')).toBe(true);
    expect(new Set(pary.map((p) => p.sportSlug)).size).toBe(7);
  });
});
