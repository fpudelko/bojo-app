import { describe, it, expect } from 'vitest';
import { podiumTurnieju, tekstPodium, medal } from '@/lib/turniejPodium';
import type { TurniejMecz, WierszTabeli } from '@/types';

const mecz = (n: Partial<TurniejMecz>): TurniejMecz => ({
  id: 'm', turniejId: 't1', numer: 1, faza: 'grupa', status: 'zakonczony',
  wynikA: 0, wynikB: 0, wynikRecznie: false, createdAt: '', ...n,
} as TurniejMecz);

const wiersz = (druzynaId: string, nazwa: string, punkty: number): WierszTabeli => ({
  druzynaId, nazwa, mecze: 3, wygrane: 1, remisy: 0, przegrane: 2,
  bramkiZdobyte: 3, bramkiStracone: 3, roznica: 0, punkty, rozstrzygnietyRecznie: false,
});

const nazwy = new Map([['d1', 'Dziki'], ['d2', 'Orły'], ['d3', 'Wilki'], ['d4', 'Sokoły']]);

describe('podiumTurnieju — faza pucharowa', () => {
  it('finał daje pierwsze i drugie miejsce', () => {
    const p = podiumTurnieju([
      mecz({ id: 'f', faza: 'final', druzynaAId: 'd1', druzynaBId: 'd2', zwyciezcaId: 'd1' }),
    ], nazwy);
    expect(p).toEqual([
      { miejsce: 1, druzynaId: 'd1', nazwa: 'Dziki' },
      { miejsce: 2, druzynaId: 'd2', nazwa: 'Orły' },
    ]);
  });

  it('mecz o 3. miejsce domyka podium', () => {
    const p = podiumTurnieju([
      mecz({ id: 'f', faza: 'final', druzynaAId: 'd1', druzynaBId: 'd2', zwyciezcaId: 'd1' }),
      mecz({ id: 't', faza: 'o_3_miejsce', druzynaAId: 'd3', druzynaBId: 'd4', zwyciezcaId: 'd3' }),
    ], nazwy);
    expect(p).toHaveLength(3);
    expect(p[2]).toEqual({ miejsce: 3, druzynaId: 'd3', nazwa: 'Wilki' });
  });

  it('bez meczu o 3. miejsce NIE wymyśla trzeciego — dwaj półfinaliści są równi', () => {
    const p = podiumTurnieju([
      mecz({ id: 'p1', faza: 'polfinal', druzynaAId: 'd1', druzynaBId: 'd3', zwyciezcaId: 'd1' }),
      mecz({ id: 'p2', faza: 'polfinal', druzynaAId: 'd2', druzynaBId: 'd4', zwyciezcaId: 'd2' }),
      mecz({ id: 'f', faza: 'final', druzynaAId: 'd1', druzynaBId: 'd2', zwyciezcaId: 'd1' }),
    ], nazwy);
    expect(p).toHaveLength(2);
  });

  it('nierozegrany finał nie daje podium', () => {
    const p = podiumTurnieju([
      mecz({ id: 'f', faza: 'final', status: 'zaplanowany', druzynaAId: 'd1', druzynaBId: 'd2' }),
    ], nazwy);
    expect(p).toEqual([]);
  });

  it('finał wygrany walkowerem liczy się tak samo', () => {
    const p = podiumTurnieju([
      mecz({ id: 'f', faza: 'final', status: 'walkower', druzynaAId: 'd1', druzynaBId: 'd2', zwyciezcaId: 'd2' }),
    ], nazwy);
    expect(p[0]).toEqual({ miejsce: 1, druzynaId: 'd2', nazwa: 'Orły' });
    expect(p[1].druzynaId).toBe('d1');
  });
});

describe('podiumTurnieju — liga', () => {
  const tabela = [wiersz('d2', 'Orły', 9), wiersz('d1', 'Dziki', 6), wiersz('d3', 'Wilki', 3), wiersz('d4', 'Sokoły', 0)];

  it('bierze trzy pierwsze miejsca tabeli', () => {
    const p = podiumTurnieju([], nazwy, tabela);
    expect(p.map((m) => m.nazwa)).toEqual(['Orły', 'Dziki', 'Wilki']);
  });

  it('DRABINKA BIJE TABELĘ — mistrz bywa drugi w swojej grupie', () => {
    const p = podiumTurnieju([
      mecz({ id: 'f', faza: 'final', druzynaAId: 'd1', druzynaBId: 'd2', zwyciezcaId: 'd1' }),
    ], nazwy, tabela);
    expect(p[0].nazwa).toBe('Dziki');
  });

  it('dwie drużyny to podium dwuosobowe, nie błąd', () => {
    const p = podiumTurnieju([], nazwy, tabela.slice(0, 2));
    expect(p).toHaveLength(2);
  });

  it('pusty turniej nie ma podium', () => {
    expect(podiumTurnieju([], nazwy, [])).toEqual([]);
    expect(podiumTurnieju([], nazwy)).toEqual([]);
  });
});

describe('tekstPodium', () => {
  const podium = [
    { miejsce: 1 as const, druzynaId: 'd1', nazwa: 'Dziki' },
    { miejsce: 2 as const, druzynaId: 'd2', nazwa: 'Orły' },
  ];

  it('niesie medale, nazwy i link', () => {
    const tekst = tekstPodium('Puchar Dzielnicy', podium, 'https://bojo.pl/turnieje/1');
    expect(tekst).toContain('🥇 Dziki');
    expect(tekst).toContain('🥈 Orły');
    expect(tekst).toContain('https://bojo.pl/turnieje/1');
  });

  it('dokłada króla strzelców, gdy ktoś strzelił', () => {
    const tekst = tekstPodium('Puchar', podium, 'link', { imie: 'Marek Nowak', gole: 7 });
    expect(tekst).toContain('Marek Nowak (7)');
  });

  it('nie chwali się królem strzelców przy zerze goli', () => {
    const tekst = tekstPodium('Puchar', podium, 'link', { imie: 'Nikt', gole: 0 });
    expect(tekst).not.toContain('Król strzelców');
  });

  it('medal zna trzy miejsca', () => {
    expect([medal(1), medal(2), medal(3)]).toEqual(['🥇', '🥈', '🥉']);
  });
});
