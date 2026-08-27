import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Szukanie boisk nie może wymagać polskich ogonków.
 *
 * `ilike '%poznan%'` na `name`/`address` NIE jest zgodne z „Poznań" — Postgres
 * porównuje znak po znaku. Nikt nie pisze ogonków w szukajce na telefonie,
 * więc wpisanie miasta zwracało zero wyników przy 38 tysiącach obiektów
 * w katalogu. Migracja `126` dokłada kolumnę `szukaj_norm`, składaną tak samo
 * jak `foldText()` po tej stronie.
 *
 * Drugi obowiązek tej funkcji: migracje puszcza się w Bojo RĘCZNIE, więc
 * kolumny może jeszcze nie być. Wtedy szukajka ma działać po staremu, a nie
 * wywalić się na czerwono.
 */

const { chain, fromMock } = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  ['select', 'eq', 'overlaps', 'limit', 'ilike', 'or'].forEach((m) => { c[m] = vi.fn(() => c); });
  return { chain: c, fromMock: vi.fn(() => c) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: fromMock } }));

import { searchExplorerFields } from '@/lib/api';

const BOISKO = {
  id: 'f1', name: 'Orlik Poznań', address: 'Poznań, os. Piastowskie',
  lat: 52.4, lng: 16.95, sport: ['piłka nożna'],
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
});

describe('searchExplorerFields', () => {
  it('pyta o kolumnę bez ogonków i sam zdejmuje ogonki z frazy', async () => {
    chain.ilike.mockResolvedValue({ data: [BOISKO], error: null });

    const wynik = await searchExplorerFields('Poznań');

    expect(chain.ilike).toHaveBeenCalledWith('szukaj_norm', '%poznan%');
    expect(wynik).toHaveLength(1);
    expect(wynik[0].name).toBe('Orlik Poznań');
  });

  it('fraza bez ogonków leci do bazy bez zmian — obie strony składają tekst tak samo', async () => {
    chain.ilike.mockResolvedValue({ data: [], error: null });
    await searchExplorerFields('lodz');
    expect(chain.ilike).toHaveBeenCalledWith('szukaj_norm', '%lodz%');

    vi.clearAllMocks();
    Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
    chain.ilike.mockResolvedValue({ data: [], error: null });
    await searchExplorerFields('Łódź');
    // „Łódź" i „lodz" MUSZĄ dać to samo zapytanie — inaczej wynik zależałby od
    // tego, czy ktoś trafił w ogonki.
    expect(chain.ilike).toHaveBeenCalledWith('szukaj_norm', '%lodz%');
  });

  it('bez migracji 126 wraca do starego szukania, zamiast wywalić szukajkę', async () => {
    chain.ilike.mockResolvedValue({ data: null, error: { code: '42703', message: 'column fields.szukaj_norm does not exist' } });
    chain.or.mockResolvedValue({ data: [BOISKO], error: null });

    const wynik = await searchExplorerFields('Poznań');

    expect(chain.or).toHaveBeenCalledWith('name.ilike.%Poznań%,address.ilike.%Poznań%');
    expect(wynik).toHaveLength(1);
  });

  it('błąd, który NIE jest brakiem kolumny, leci dalej — cisza ukryłaby awarię bazy', async () => {
    chain.ilike.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });

    await expect(searchExplorerFields('Poznań')).rejects.toThrow('statement timeout');
    expect(chain.or).not.toHaveBeenCalled();
  });

  it('poniżej dwóch znaków nie pyta bazy w ogóle', async () => {
    expect(await searchExplorerFields('p')).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
