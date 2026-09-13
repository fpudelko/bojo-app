import { describe, it, expect } from 'vitest';
import {
  STATUS_TURNIEJU, STATUS_DRUZYNY, FORMAT_LABEL, FORMAT_OPIS, FAZA_LABEL,
  opisFormatu, odmienDruzyny, odmienZawodnikow,
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
    const fazy: MeczFaza[] = ['grupa', 'liga', '1/16', '1/8', 'cwierc', 'polfinal', 'o_3_miejsce', 'final'];
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
