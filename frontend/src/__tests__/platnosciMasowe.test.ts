import { describe, it, expect, vi, beforeEach } from 'vitest';

// Atrapa nagrywa każde wywołanie .update(...).in(...) — grupowanie po kwocie
// w `ustawPlatnoscWszystkim` ma dać osobny UPDATE na każdą różną wartość.
const { wywolania, from } = vi.hoisted(() => {
  const wywolania: { zmiany: Record<string, unknown>; ids: string[] }[] = [];
  const from = vi.fn(() => ({
    update: (zmiany: Record<string, unknown>) => ({
      in: (_kolumna: string, ids: string[]) => {
        wywolania.push({ zmiany, ids });
        return { select: () => Promise.resolve({ data: ids.map((id) => ({ id })), error: null }) };
      },
    }),
  }));
  return { wywolania, from };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

import { ustawPlatnoscWszystkim } from '@/lib/eventFeatures';

beforeEach(() => { wywolania.length = 0; from.mockClear(); });

describe('ustawPlatnoscWszystkim', () => {
  it('pusta lista — nie odpytuje bazy', async () => {
    await ustawPlatnoscWszystkim([], true);
    expect(from).not.toHaveBeenCalled();
  });

  it('jedna wspólna kwota — jeden UPDATE ze wszystkimi id', async () => {
    await ustawPlatnoscWszystkim(
      [{ id: 'p1', kwotaGrosze: 2000 }, { id: 'p2', kwotaGrosze: 2000 }],
      true,
    );
    expect(wywolania).toHaveLength(1);
    expect(wywolania[0].zmiany).toEqual({ has_paid: true, paid_amount: 2000 });
    expect(wywolania[0].ids.sort()).toEqual(['p1', 'p2']);
  });

  it('dwie różne kwoty (zniżka z karty sportowej) — dwa UPDATE-y', async () => {
    await ustawPlatnoscWszystkim(
      [
        { id: 'p1', kwotaGrosze: 2000 },
        { id: 'p2', kwotaGrosze: 1500 },
        { id: 'p3', kwotaGrosze: 2000 },
      ],
      true,
    );
    expect(wywolania).toHaveLength(2);
    const pelna = wywolania.find((w) => w.zmiany.paid_amount === 2000)!;
    const zeZnizka = wywolania.find((w) => w.zmiany.paid_amount === 1500)!;
    expect(pelna.ids.sort()).toEqual(['p1', 'p3']);
    expect(zeZnizka.ids).toEqual(['p2']);
  });

  it('cofanie — jeden UPDATE z has_paid:false i paid_amount:0, niezależnie od kwot', async () => {
    await ustawPlatnoscWszystkim(
      [{ id: 'p1', kwotaGrosze: 2000 }, { id: 'p2', kwotaGrosze: 1500 }],
      false,
    );
    expect(wywolania).toHaveLength(1);
    expect(wywolania[0].zmiany).toEqual({ has_paid: false, paid_amount: 0 });
    expect(wywolania[0].ids.sort()).toEqual(['p1', 'p2']);
  });

  it('rzuca, gdy baza zwróci mniej wierszy niż podano id (cicha porażka RLS)', async () => {
    from.mockImplementationOnce(() => ({
      update: () => ({
        in: (_kolumna: string, ids: string[]) => ({
          select: () => Promise.resolve({ data: ids.slice(0, ids.length - 1).map((id) => ({ id })), error: null }),
        }),
      }),
    }));
    await expect(ustawPlatnoscWszystkim([{ id: 'p1', kwotaGrosze: 2000 }, { id: 'p2', kwotaGrosze: 2000 }], true))
      .rejects.toThrow(/zmieniła 1 z 2 wierszy/);
  });
});
