import { describe, it, expect } from 'vitest';
import {
  STATUS_TURNIEJU, STATUS_DRUZYNY, FORMAT_LABEL, FORMAT_OPIS, FAZA_LABEL,
  opisFormatu, odmienDruzyny, odmienZawodnikow, stanZapisowTurnieju,
} from '@/lib/turniejEtykiety';
import type { DruzynaStatus, MeczFaza, TurniejFormat, TurniejStatus } from '@/types';

// Sanity: mapy etykiet mają wpis dla KAŻDEJ wartości typu — literówka w kluczu
// (np. `zamnkiete_zapisy`) dałaby `undefined` w UI zamiast błędu kompilacji,
// bo `Record<T, X>` sprawdza tylko, że nie ma BRAKUJĄCYCH kluczy w drugą stronę
// TypeScript i tak by to złapał, ale test dokumentuje intencję i łapie rozjazd,
// gdyby ktoś kiedyś osłabił typ do `Partial<Record<...>>`.
describe('kompletność map etykiet', () => {
  it('STATUS_TURNIEJU pokrywa wszystkie stany', () => {
    const stany: TurniejStatus[] = ['szkic', 'zapisy', 'zamkniete_zapisy', 'trwa', 'zakonczony', 'odwolany'];
    stany.forEach((s) => expect(STATUS_TURNIEJU[s]).toBeDefined());
  });

  it('STATUS_DRUZYNY pokrywa wszystkie stany', () => {
    const stany: DruzynaStatus[] = ['zgloszona', 'przyjeta', 'rezerwa', 'odrzucona', 'wycofana'];
    stany.forEach((s) => expect(STATUS_DRUZYNY[s]).toBeDefined());
  });

  it('FORMAT_LABEL i FORMAT_OPIS pokrywają wszystkie formaty', () => {
    const formaty: TurniejFormat[] = ['grupy_puchar', 'puchar', 'liga'];
    formaty.forEach((f) => {
      expect(FORMAT_LABEL[f]).toBeTruthy();
      expect(FORMAT_OPIS[f]).toBeTruthy();
    });
  });

  it('FAZA_LABEL pokrywa wszystkie fazy meczu', () => {
    const fazy: MeczFaza[] = ['grupa', 'liga', '1/32', '1/16', '1/8', 'cwierc', 'polfinal', 'o_3_miejsce', 'final'];
    fazy.forEach((f) => expect(FAZA_LABEL[f]).toBeTruthy());
  });
});

describe('kolory statusów — zgodność z konwencją AGENTS.md', () => {
  it('„Czeka na przyjęcie" jest niebieskie (wymaga akceptacji uczestnictwa)', () => {
    expect(STATUS_DRUZYNY.zgloszona.ton).toContain('blue');
  });

  it('„Zapisy zamknięte" jest szare, tak jak przy meczu (lib/stanZapisow.ts)', () => {
    expect(STATUS_TURNIEJU.zamkniete_zapisy.ton).toContain('slate');
  });

  it('odwołanie jest czerwone', () => {
    expect(STATUS_TURNIEJU.odwolany.ton).toContain('red');
  });
});

describe('opisFormatu', () => {
  it('liga dokłada liczbę drużyn do opisu', () => {
    const opis = opisFormatu({ format: 'liga' }, 6);
    expect(opis).toContain('6 drużyn');
  });

  it('grupy_puchar i puchar nie wspominają liczby drużyn (opis stały)', () => {
    expect(opisFormatu({ format: 'grupy_puchar' }, 8)).toBe(FORMAT_OPIS.grupy_puchar);
    expect(opisFormatu({ format: 'puchar' }, 8)).toBe(FORMAT_OPIS.puchar);
  });
});

describe('odmiana — rzeczowniki męskoosobowe liczą się jak "gracz", nie jak n<5', () => {
  it('odmienDruzyny: 1/2-4/5+ i pułapka 12-14', () => {
    expect(odmienDruzyny(1)).toBe('1 drużyna');
    expect(odmienDruzyny(3)).toBe('3 drużyny');
    expect(odmienDruzyny(5)).toBe('5 drużyn');
    expect(odmienDruzyny(13)).toBe('13 drużyn'); // n<5 dałoby błędnie "drużyny"
  });

  it('odmienZawodnikow: 1/2-4/5+ i pułapka 12-14 — ta sama reguła co "gracz"/"członek" w reszcie repo', () => {
    expect(odmienZawodnikow(1)).toBe('1 zawodnik');
    expect(odmienZawodnikow(3)).toBe('3 zawodnicy');
    expect(odmienZawodnikow(5)).toBe('5 zawodników');
    expect(odmienZawodnikow(13)).toBe('13 zawodników'); // n<5 dałoby błędnie "zawodnicy"
  });
});

describe('stanZapisowTurnieju — plakat zapisów', () => {
  const teraz = new Date('2026-10-10T12:00:00Z');

  it('liczy wolne miejsca i zapełnienie', () => {
    const s = stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 6, teraz);
    expect(s.wolne).toBe(2);
    expect(s.procent).toBe(75);
    expect(s.miejscaLabel).toBe('Zostały 2 miejsca');
  });

  it('odmienia czasownik razem z rzeczownikiem', () => {
    expect(stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 7, teraz).miejscaLabel)
      .toBe('Zostało 1 miejsce');
    expect(stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 3, teraz).miejscaLabel)
      .toBe('Zostało 5 miejsc');
    // Pułapka 12-14: reguła `n < 5` dałaby tu błędnie „Zostały 13 miejsca".
    expect(stanZapisowTurnieju({ maxDruzyn: 16, zapisyDo: undefined }, 3, teraz).miejscaLabel)
      .toBe('Zostało 13 miejsc');
  });

  it('komplet mówi „komplet", nie „Zostało 0 miejsc"', () => {
    const s = stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 8, teraz);
    expect(s.wolne).toBe(0);
    expect(s.procent).toBe(100);
    expect(s.miejscaLabel).toBe('Komplet drużyn');
  });

  it('nie przekracza 100% przy nadkomplecie (drużyny dodane ręcznie ponad limit)', () => {
    expect(stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 10, teraz).procent).toBe(100);
    expect(stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 10, teraz).wolne).toBe(0);
  });

  it('pokazuje termin graniczny, a po nim mówi wprost, że zapisy są zamknięte', () => {
    const przed = stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: '2026-10-12T23:59:59' }, 3, teraz);
    expect(przed.poTerminie).toBe(false);
    expect(przed.terminLabel).toContain('Zapisy do');

    const po = stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: '2026-10-09T23:59:59' }, 3, teraz);
    expect(po.poTerminie).toBe(true);
    expect(po.terminLabel).toBe('Zapisy zamknięte');
  });

  it('bez terminu nie wymyśla etykiety', () => {
    expect(stanZapisowTurnieju({ maxDruzyn: 8, zapisyDo: undefined }, 3, teraz).terminLabel).toBeUndefined();
  });
});
