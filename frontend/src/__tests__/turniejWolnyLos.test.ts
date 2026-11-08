import { describe, expect, it } from 'vitest';
import { czyWolnyLos } from '@/lib/turniejWynik';
import { zbudujDrabinke } from '@/lib/turniejFormat';

// Wolny los nie jest rozegranym meczem (migracja 171, turniej pokazowy
// w Luboniu 2026-11-08). Definicja ma być ta sama co `czy_wolny_los()` w bazie,
// a generator ma produkować mecze, które ją spełniają: inaczej panel znów
// policzy wolny los jako rozegrany i zablokuje „Wygeneruj od nowa".
describe('czyWolnyLos', () => {
  const baza = { druzynaAId: 'a', druzynaBId: undefined, zrodloAMeczId: undefined, zrodloBMeczId: undefined };

  it('walkower z jedną drużyną i bez źródeł to wolny los', () => {
    expect(czyWolnyLos({ ...baza, status: 'walkower' })).toBe(true);
    expect(czyWolnyLos({ ...baza, druzynaAId: undefined, druzynaBId: 'b', status: 'walkower' })).toBe(true);
  });

  it('prawdziwy walkower z dwiema drużynami nie jest wolnym losem', () => {
    expect(czyWolnyLos({ ...baza, druzynaBId: 'b', status: 'walkower' })).toBe(false);
  });

  it('walkower w meczu, którego druga strona czeka na zwycięzcę, nie jest wolnym losem', () => {
    expect(czyWolnyLos({ ...baza, zrodloBMeczId: 'm1', status: 'walkower' })).toBe(false);
  });

  it('mecz zaplanowany albo zakończony nie jest wolnym losem', () => {
    expect(czyWolnyLos({ ...baza, status: 'zaplanowany' })).toBe(false);
    expect(czyWolnyLos({ ...baza, status: 'zakonczony' })).toBe(false);
  });

  it('generator: 14 drużyn daje dokładnie 2 wolne losy, a wszystkie inne mecze nimi nie są', () => {
    const druzyny = Array.from({ length: 14 }, (_, i) => `d${i + 1}`);
    let n = 0;
    const mecze = zbudujDrabinke(druzyny, { startNumer: 1, noweId: () => `m${++n}` });
    const walkowery = mecze.filter((m) => m.status === 'walkower');
    expect(walkowery).toHaveLength(2);
    expect(walkowery.every((m) => czyWolnyLos({ ...m, status: 'walkower' }))).toBe(true);
    expect(mecze.filter((m) => czyWolnyLos({ ...m, status: m.status ?? 'zaplanowany' }))).toHaveLength(2);
  });
});
