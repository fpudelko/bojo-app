import { describe, it, expect } from 'vitest';
import { centrumTurnieju } from '@/lib/turniejPulpit';
import { tabeleTurnieju } from '@/lib/turniejTabela';
import type { TurniejGrupa, TurniejMecz } from '@/types';

// Centrum dowodzenia panelu na komputerze (2026-11-21). „Teraz” jest
// argumentem, bo dzień turnieju to jedyny stan, którego nie da się obejrzeć
// bez czekania na sobotę.

const mecz = (n: Partial<TurniejMecz> & { numer: number }): TurniejMecz => ({
  id: `m${n.numer}`, turniejId: 't1', faza: 'grupa',
  status: 'zaplanowany', wynikA: 0, wynikB: 0, wynikRecznie: false,
  druzynaAId: 'dA', druzynaBId: 'dB',
  zaplanowanyAt: `2026-11-21T${String(8 + n.numer).padStart(2, '0')}:00:00Z`,
  createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z', ...n,
} as TurniejMecz);

describe('centrumTurnieju', () => {
  const teraz = new Date('2026-11-21T12:30:00Z');

  it('dzieli mecze na trwające, najbliższe (po terminie) i ostatnie (od najświeższego)', () => {
    const c = centrumTurnieju([
      mecz({ numer: 6 }),
      mecz({ numer: 5 }),
      mecz({ numer: 4, status: 'trwa' }),
      mecz({ numer: 1, status: 'zakonczony', zakonczonyAt: '2026-11-21T09:20:00Z' }),
      // Rozegrany poza kolejnością: zakończony PÓŹNIEJ niż M3, więc wyżej.
      mecz({ numer: 2, status: 'zakonczony', zakonczonyAt: '2026-11-21T11:30:00Z' }),
      mecz({ numer: 3, status: 'walkower', zakonczonyAt: '2026-11-21T11:00:00Z' }),
    ], teraz);
    expect(c.naZywo.map((m) => m.numer)).toEqual([4]);
    expect(c.najblizsze.map((m) => m.numer)).toEqual([5, 6]);
    expect(c.ostatnie.map((m) => m.numer)).toEqual([2, 3, 1]);
    expect(c.liczbaRozegranych).toBe(3);
    expect(c.liczbaDoRozegrania).toBe(2);
  });

  it('pomija wolny los: nikt w nim nie gra', () => {
    const c = centrumTurnieju([
      mecz({ numer: 1, status: 'walkower', druzynaBId: undefined }),
      mecz({ numer: 2 }),
    ], teraz);
    expect(c.ostatnie).toEqual([]);
    expect(c.liczbaRozegranych).toBe(0);
  });

  it('przycina listy do limitów', () => {
    const lista = Array.from({ length: 10 }, (_, i) => mecz({ numer: i + 1 }));
    const c = centrumTurnieju(lista, teraz, { najblizsze: 4 });
    expect(c.najblizsze).toHaveLength(4);
    expect(c.liczbaDoRozegrania).toBe(10);
  });

  it('wskazuje mecz, który wg planu już powinien grać, tylko gdy nic nie trwa', () => {
    // M4 o 12:00, teraz 12:30, nic nie trwa: pytanie „rozpocząć?”.
    const bezMeczu = centrumTurnieju([mecz({ numer: 4 }), mecz({ numer: 5 })], teraz);
    expect(bezMeczu.zaleglyStart?.numer).toBe(4);
    // Coś trwa: to nie jest decyzja do podjęcia, tylko normalny dzień.
    const zMeczem = centrumTurnieju([mecz({ numer: 3, status: 'trwa' }), mecz({ numer: 4 })], teraz);
    expect(zMeczem.zaleglyStart).toBeNull();
    // Następny dopiero o 13:00: nic nie czeka.
    expect(centrumTurnieju([mecz({ numer: 5 })], teraz).zaleglyStart).toBeNull();
  });

  it('nie proponuje startu meczu, w którym nie znamy jeszcze drużyn', () => {
    const c = centrumTurnieju([mecz({ numer: 4, druzynaAId: undefined }), mecz({ numer: 5 })], new Date('2026-11-21T14:00:00Z'));
    expect(c.zaleglyStart?.numer).toBe(5);
  });
});

describe('tabeleTurnieju', () => {
  const turniej = { format: 'grupy_finalowa' as const, punktyZaWygrana: 3, punktyZaRemis: 1 };
  const grupy: TurniejGrupa[] = [
    { id: 'gA', turniejId: 't1', nazwa: 'A' } as TurniejGrupa,
    { id: 'gF', turniejId: 't1', nazwa: 'F', finalowa: true } as TurniejGrupa,
  ];
  const druzyny = [
    { id: 'd1', nazwa: 'Jedynka', grupaId: 'gA' },
    { id: 'd2', nazwa: 'Dwójka', grupaId: 'gA' },
    { id: 'd3', nazwa: 'Trójka', grupaId: 'gB' },
  ];

  it('liczy tabelę grupy z jej drużyn, a finałowej z drużyn wpisanych do jej meczów', () => {
    const tabele = tabeleTurnieju(turniej, grupy, [
      mecz({ numer: 1, grupaId: 'gA', druzynaAId: 'd1', druzynaBId: 'd2', status: 'zakonczony', wynikA: 0, wynikB: 2, zwyciezcaId: 'd2' }),
      mecz({ numer: 2, grupaId: 'gF', druzynaAId: 'd2', druzynaBId: 'd3' }),
    ], druzyny);
    expect(tabele.map((t) => t.grupa?.id)).toEqual(['gA', 'gF']);
    expect(tabele[0].wiersze.map((w) => w.nazwa)).toEqual(['Dwójka', 'Jedynka']);
    expect(tabele[1].wiersze.map((w) => w.druzynaId).sort()).toEqual(['d2', 'd3']);
  });

  it('bez grup i meczów turnieju pucharowego nie ma tabel', () => {
    expect(tabeleTurnieju({ ...turniej, format: 'puchar' }, [], [], druzyny)).toEqual([]);
  });
});

describe('centrumTurnieju: wolna arena i przeciągnięte mecze', () => {
  const teraz = new Date('2026-11-21T12:30:00Z');

  it('przy jednej hali i meczu w toku nie proponuje rozpoczęcia kolejnego', () => {
    const c = centrumTurnieju([mecz({ numer: 3, status: 'trwa' }), mecz({ numer: 4 })], teraz, { liczbaAren: 1 });
    expect(c.doRozpoczecia).toBeNull();
  });

  it('przy dwóch arenach proponuje pierwszy mecz na WOLNEJ arenie', () => {
    const c = centrumTurnieju([
      mecz({ numer: 3, status: 'trwa', arenaId: 'a1' }),
      mecz({ numer: 4, arenaId: 'a1' }),
      mecz({ numer: 5, arenaId: 'a2' }),
    ], teraz, { liczbaAren: 2 });
    expect(c.doRozpoczecia?.numer).toBe(5);
  });

  it('bez meczu w toku proponuje pierwszy gotowy', () => {
    const c = centrumTurnieju([mecz({ numer: 4, druzynaBId: undefined }), mecz({ numer: 5 })], teraz);
    expect(c.doRozpoczecia?.numer).toBe(5);
  });

  it('zgłasza mecz w toku dłużej niż dwa razy czas gry', () => {
    const c = centrumTurnieju([
      mecz({ numer: 3, status: 'trwa', rozpoczetyAt: '2026-11-21T12:00:00Z' }), // 30 min
      mecz({ numer: 4, status: 'trwa', rozpoczetyAt: '2026-11-21T12:10:00Z' }), // 20 min
    ], teraz, { czasMeczuMin: 12 });
    expect(c.przeciagniete.map((m) => m.numer)).toEqual([3]);
  });
});
