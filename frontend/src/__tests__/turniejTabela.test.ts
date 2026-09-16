import { describe, expect, it } from 'vitest';
import { obliczTabele, posortujTabele, opisAwansu } from '@/lib/turniejTabela';
import type { TurniejMecz } from '@/types';

const OPCJE = { punktyZaWygrana: 3, punktyZaRemis: 1 };

function mecz(dane: Partial<TurniejMecz>): Pick<TurniejMecz, 'status' | 'druzynaAId' | 'druzynaBId' | 'wynikA' | 'wynikB' | 'zwyciezcaId'> {
  return { status: 'zakonczony', druzynaAId: 'a', druzynaBId: 'b', wynikA: 0, wynikB: 0, zwyciezcaId: undefined, ...dane };
}

const DRUZYNY = [
  { id: 'a', nazwa: 'Alfa' },
  { id: 'b', nazwa: 'Beta' },
  { id: 'c', nazwa: 'Gamma' },
];

describe('obliczTabele', () => {
  it('zwraca zerowy wiersz dla drużyny bez rozegranych meczów', () => {
    const tabela = obliczTabele([], DRUZYNY, OPCJE);
    expect(tabela).toHaveLength(3);
    expect(tabela.every((w) => w.mecze === 0 && w.punkty === 0)).toBe(true);
  });

  it('liczy zwycięstwo: 3 punkty zwycięzcy, 0 przegranemu', () => {
    const tabela = obliczTabele(
      [mecz({ druzynaAId: 'a', druzynaBId: 'b', wynikA: 2, wynikB: 1, zwyciezcaId: 'a' })],
      DRUZYNY, OPCJE,
    );
    const a = tabela.find((w) => w.druzynaId === 'a')!;
    const b = tabela.find((w) => w.druzynaId === 'b')!;
    expect(a).toMatchObject({ mecze: 1, wygrane: 1, remisy: 0, przegrane: 0, bramkiZdobyte: 2, bramkiStracone: 1, roznica: 1, punkty: 3 });
    expect(b).toMatchObject({ mecze: 1, wygrane: 0, remisy: 0, przegrane: 1, bramkiZdobyte: 1, bramkiStracone: 2, roznica: -1, punkty: 0 });
  });

  it('remis (zwyciezcaId brak) daje po 1 punkcie obu stronom', () => {
    const tabela = obliczTabele(
      [mecz({ druzynaAId: 'a', druzynaBId: 'b', wynikA: 1, wynikB: 1, zwyciezcaId: undefined })],
      DRUZYNY, OPCJE,
    );
    const a = tabela.find((w) => w.druzynaId === 'a')!;
    const b = tabela.find((w) => w.druzynaId === 'b')!;
    expect(a.remisy).toBe(1);
    expect(a.punkty).toBe(1);
    expect(b.remisy).toBe(1);
    expect(b.punkty).toBe(1);
  });

  it('walkower liczy się jak normalne zwycięstwo (0:0, ale jest zwycięzca)', () => {
    const tabela = obliczTabele(
      [mecz({ status: 'walkower', druzynaAId: 'a', druzynaBId: 'b', wynikA: 0, wynikB: 0, zwyciezcaId: 'a' })],
      DRUZYNY, OPCJE,
    );
    expect(tabela.find((w) => w.druzynaId === 'a')).toMatchObject({ wygrane: 1, punkty: 3 });
    expect(tabela.find((w) => w.druzynaId === 'b')).toMatchObject({ przegrane: 1, punkty: 0 });
  });

  it('pomija mecze nierozegrane (zaplanowany/trwa/odwolany)', () => {
    const tabela = obliczTabele(
      [
        mecz({ status: 'zaplanowany', druzynaAId: 'a', druzynaBId: 'b', wynikA: 5, wynikB: 0 }),
        mecz({ status: 'trwa', druzynaAId: 'a', druzynaBId: 'c', wynikA: 5, wynikB: 0 }),
        mecz({ status: 'odwolany', druzynaAId: 'b', druzynaBId: 'c', wynikA: 5, wynikB: 0 }),
      ],
      DRUZYNY, OPCJE,
    );
    expect(tabela.every((w) => w.mecze === 0)).toBe(true);
  });

  it('pomija mecz z nieznaną drużyną (TBD w drabince) bez rzucania błędu', () => {
    const tabela = obliczTabele(
      [mecz({ druzynaAId: 'a', druzynaBId: undefined, wynikA: 0, wynikB: 0, zwyciezcaId: undefined })],
      DRUZYNY, OPCJE,
    );
    expect(tabela.find((w) => w.druzynaId === 'a')!.mecze).toBe(0);
  });

  it('sumuje wiele meczów tej samej drużyny poprawnie', () => {
    const tabela = obliczTabele(
      [
        mecz({ druzynaAId: 'a', druzynaBId: 'b', wynikA: 2, wynikB: 0, zwyciezcaId: 'a' }),
        mecz({ druzynaAId: 'c', druzynaBId: 'a', wynikA: 1, wynikB: 1, zwyciezcaId: undefined }),
      ],
      DRUZYNY, OPCJE,
    );
    const a = tabela.find((w) => w.druzynaId === 'a')!;
    expect(a).toMatchObject({ mecze: 2, wygrane: 1, remisy: 1, przegrane: 0, bramkiZdobyte: 3, bramkiStracone: 1, roznica: 2, punkty: 4 });
  });
});

describe('posortujTabele', () => {
  it('sortuje po punktach malejąco', () => {
    const wiersze = obliczTabele(
      [
        mecz({ druzynaAId: 'a', druzynaBId: 'b', wynikA: 1, wynikB: 0, zwyciezcaId: 'a' }),
        mecz({ druzynaAId: 'c', druzynaBId: 'b', wynikA: 0, wynikB: 0, zwyciezcaId: undefined }),
      ],
      DRUZYNY, OPCJE,
    );
    // a: 3 pkt. b i c remisują po 1 pkt, ale c ma lepszy bilans bramek (0 vs -1 dla b).
    const posortowane = posortujTabele(wiersze);
    expect(posortowane.map((w) => w.druzynaId)).toEqual(['a', 'c', 'b']);
  });

  it('przy równych punktach rozstrzyga różnica bramek', () => {
    const wiersze = [
      { druzynaId: 'x', nazwa: 'X', mecze: 1, wygrane: 1, remisy: 0, przegrane: 0, bramkiZdobyte: 5, bramkiStracone: 1, roznica: 4, punkty: 3, rozstrzygnietyRecznie: false },
      { druzynaId: 'y', nazwa: 'Y', mecze: 1, wygrane: 1, remisy: 0, przegrane: 0, bramkiZdobyte: 2, bramkiStracone: 0, roznica: 2, punkty: 3, rozstrzygnietyRecznie: false },
    ];
    expect(posortujTabele(wiersze).map((w) => w.druzynaId)).toEqual(['x', 'y']);
  });

  it('pozycja ręczna wygrywa z kryteriami liczonymi', () => {
    const wiersze = obliczTabele(
      [mecz({ druzynaAId: 'a', druzynaBId: 'b', wynikA: 5, wynikB: 0, zwyciezcaId: 'a' })],
      DRUZYNY, OPCJE,
    );
    // 'a' wygrywa liczeniem, ale organizator ręcznie stawia 'c' na pierwszym miejscu
    const posortowane = posortujTabele(wiersze, new Map([['c', 1]]));
    expect(posortowane[0].druzynaId).toBe('c');
    expect(posortowane[0].rozstrzygnietyRecznie).toBe(true);
    expect(posortowane.slice(1).map((w) => w.druzynaId)).toEqual(['a', 'b']);
  });

  it('bez żadnej pozycji ręcznej rozstrzygnietyRecznie jest zawsze false', () => {
    const wiersze = obliczTabele([], DRUZYNY, OPCJE);
    expect(posortujTabele(wiersze).every((w) => !w.rozstrzygnietyRecznie)).toBe(true);
  });
});

describe('opisAwansu', () => {
  it('jeden podpis dla całego turnieju, z odmianą liczebnika', () => {
    expect(opisAwansu([4, 4], 2)).toBe('Pierwsze 2 miejsca w grupie awansują do fazy pucharowej');
    expect(opisAwansu([4, 4], 1)).toBe('Pierwsze miejsce w grupie awansuje do fazy pucharowej');
    expect(opisAwansu([8], 5)).toBe('Pierwsze 5 miejsc w grupie awansuje do fazy pucharowej');
  });

  it('bez grup nie ma podpisu — liga to jedna tabela, nie ma dokąd awansować', () => {
    expect(opisAwansu([], 2)).toBeNull();
  });

  it('gdy nikt nie odpada, podpis nic nie wnosi', () => {
    // Trzy drużyny w grupie, awansują trzy — podświetlenie objęłoby całą tabelę.
    expect(opisAwansu([3, 3], 3)).toBeNull();
    expect(opisAwansu([2], 4)).toBeNull();
  });

  it('wystarczy JEDNA grupa, z której ktoś odpada', () => {
    // Grupy bywają nierówne (7 drużyn to 4 + 3). Z czwórki ktoś odpada,
    // więc reguła awansu jest realna i podpis ma się pokazać.
    expect(opisAwansu([4, 3], 3)).toBe('Pierwsze 3 miejsca w grupie awansują do fazy pucharowej');
  });
});
