import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { harmonogramMeczu, PRZYPOMNIENIA_UTC, type PozycjaHarmonogramu } from '@/lib/harmonogramMeczu';
import type { EventItem, EventParticipant } from '@/types';

// Test anty-rozjazdowy (patrz nagłówek harmonogramMeczu.ts): jeśli ktoś kiedyś
// przesunie godzinę zadania `bojo-przypomnienia` w SQL bez zmiany
// `PRZYPOMNIENIA_UTC`, ten test ma to złapać, zanim złapie to organizator
// czytający kartę, która kłamie o zegarze. Wzorzec: `typyPowiadomien.test.ts`.
const KATALOG_MIGRACJI = path.join(process.cwd(), '..', 'supabase', 'migrations');

function plikiMigracjiPosortowane(): string[] {
  return readdirSync(KATALOG_MIGRACJI)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

describe('PRZYPOMNIENIA_UTC — lustro cron.schedule w migracjach', () => {
  it('ostatnia definicja zadania bojo-przypomnienia zgadza się z PRZYPOMNIENIA_UTC', () => {
    const WZORZEC = /cron\.schedule\(\s*'bojo-przypomnienia'\s*,\s*'(\d+)\s+(\d+)\s+\*\s+\*\s+\*'/;
    let ostatnie: { minuta: number; godzina: number } | null = null;
    for (const plik of plikiMigracjiPosortowane()) {
      const tresc = readFileSync(path.join(KATALOG_MIGRACJI, plik), 'utf8');
      const dopasowanie = tresc.match(WZORZEC);
      if (dopasowanie) ostatnie = { minuta: Number(dopasowanie[1]), godzina: Number(dopasowanie[2]) };
    }
    expect(ostatnie).not.toBeNull();
    expect(ostatnie).toEqual({ minuta: PRZYPOMNIENIA_UTC.minuta, godzina: PRZYPOMNIENIA_UTC.godzina });
  });

  it('ostatnia definicja wyslij_przypomnienia() liczy jutro/wczoraj tak, jak zakłada harmonogramMeczu', () => {
    let ostatniaTresc: string | null = null;
    for (const plik of plikiMigracjiPosortowane()) {
      const tresc = readFileSync(path.join(KATALOG_MIGRACJI, plik), 'utf8');
      if (/CREATE OR REPLACE FUNCTION wyslij_przypomnienia\(\)/.test(tresc)) ostatniaTresc = tresc;
    }
    expect(ostatniaTresc).not.toBeNull();
    // Blok A/B: przypomnienie dzień PRZED meczem.
    expect(ostatniaTresc).toMatch(/event_date\s*=\s*v_dzis\s*\+\s*1/);
    // Blok C: „po meczu" dzień PO meczu.
    expect(ostatniaTresc).toMatch(/event_date\s*=\s*v_dzis\s*-\s*1/);
  });
});

const BAZOWY: Pick<EventItem, 'date' | 'costGrosze' | 'trackResults' | 'reserveEnabled' | 'reserveClaimMinutes' | 'status'> = {
  date: '2026-09-25',
  costGrosze: 0,
  trackResults: false,
  reserveEnabled: false,
  reserveClaimMinutes: 60,
  status: 'active',
};

function gosc(overrides: Partial<EventParticipant> = {}): Pick<EventParticipant, 'isGuest' | 'userId' | 'maGuestEmail' | 'isReserve' | 'pendingApproval' | 'rsvp'> {
  return {
    isGuest: true,
    userId: undefined,
    maGuestEmail: false,
    isReserve: false,
    pendingApproval: false,
    rsvp: 'yes',
    ...overrides,
  };
}

const chwilaUTC = (rok: number, mies: number, dzien: number, godz: number, min = 0) =>
  new Date(Date.UTC(rok, mies - 1, dzien, godz, min));

function znajdz(pozycje: PozycjaHarmonogramu[], klucz: PozycjaHarmonogramu['klucz']) {
  return pozycje.find((p) => p.klucz === klucz);
}

describe('harmonogramMeczu', () => {
  it('mecz za 3 dni: przypomnienie zaplanowane na 16:00 UTC dzień wcześniej', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, date: '2026-09-25' }, [], chwilaUTC(2026, 9, 20, 10),
    );
    const p = znajdz(pozycje, 'przypomnienie');
    expect(p).toMatchObject({ klucz: 'przypomnienie' });
    if (p?.klucz === 'przypomnienie') {
      expect(p.kiedy.toISOString()).toBe('2026-09-24T16:00:00.000Z');
    }
  });

  it('mecz jutro, sprawdzane PO 16:00 UTC: za późno na automatyczne przypomnienie', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, date: '2026-09-25' }, [], chwilaUTC(2026, 9, 24, 17),
    );
    expect(znajdz(pozycje, 'przypomnienie_za_pozno')).toBeDefined();
    expect(znajdz(pozycje, 'przypomnienie')).toBeUndefined();
  });

  it('mecz jutro, sprawdzane PRZED 16:00 UTC: przypomnienie jeszcze zaplanowane', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, date: '2026-09-25' }, [], chwilaUTC(2026, 9, 24, 10),
    );
    expect(znajdz(pozycje, 'przypomnienie')).toBeDefined();
    expect(znajdz(pozycje, 'przypomnienie_za_pozno')).toBeUndefined();
  });

  it('mecz dziś: zawsze za późno na automatyczne przypomnienie', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, date: '2026-09-25' }, [], chwilaUTC(2026, 9, 25, 8),
    );
    expect(znajdz(pozycje, 'przypomnienie_za_pozno')).toBeDefined();
  });

  it('darmowy mecz bez wyniku: brak pozycji „po meczu"', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, costGrosze: 0, trackResults: false }, [], chwilaUTC(2026, 9, 20, 10),
    );
    expect(znajdz(pozycje, 'po_meczu')).toBeUndefined();
  });

  it('płatny mecz: pozycja „po meczu" zaplanowana dzień PO meczu', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, date: '2026-09-25', costGrosze: 2000 }, [], chwilaUTC(2026, 9, 20, 10),
    );
    const p = znajdz(pozycje, 'po_meczu');
    expect(p).toMatchObject({ klucz: 'po_meczu' });
    if (p?.klucz === 'po_meczu') {
      expect(p.kiedy.toISOString()).toBe('2026-09-26T16:00:00.000Z');
    }
  });

  it('mecz ze śledzonym wynikiem (darmowy): pozycja „po meczu" mimo braku kosztu', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, costGrosze: 0, trackResults: true }, [], chwilaUTC(2026, 9, 20, 10),
    );
    expect(znajdz(pozycje, 'po_meczu')).toBeDefined();
  });

  it('rezerwa wyłączona: brak pozycji „rezerwa"', () => {
    const pozycje = harmonogramMeczu({ ...BAZOWY, reserveEnabled: false }, [], chwilaUTC(2026, 9, 20, 10));
    expect(znajdz(pozycje, 'rezerwa')).toBeUndefined();
  });

  it('rezerwa włączona: pozycja niesie liczbę minut z ustawień meczu', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, reserveEnabled: true, reserveClaimMinutes: 180 }, [], chwilaUTC(2026, 9, 20, 10),
    );
    expect(znajdz(pozycje, 'rezerwa')).toMatchObject({ klucz: 'rezerwa', minuty: 180 });
  });

  it('dwóch gości bez adresu e-mail: „bez_wiadomosci" niesie ile: 2', () => {
    const sklad = [
      gosc({ maGuestEmail: false }),
      gosc({ maGuestEmail: false }),
      gosc({ maGuestEmail: true }),       // ma e-mail — pominięty
      gosc({ userId: 'u1', isGuest: false }), // konto — pominięty
    ];
    const pozycje = harmonogramMeczu(BAZOWY, sklad, chwilaUTC(2026, 9, 20, 10));
    expect(znajdz(pozycje, 'bez_wiadomosci')).toMatchObject({ klucz: 'bez_wiadomosci', ile: 2 });
  });

  it('nikt bez wiadomości: pozycja nie występuje wcale', () => {
    const sklad = [gosc({ maGuestEmail: true })];
    const pozycje = harmonogramMeczu(BAZOWY, sklad, chwilaUTC(2026, 9, 20, 10));
    expect(znajdz(pozycje, 'bez_wiadomosci')).toBeUndefined();
  });

  it('mecz odwołany: pusta lista, niezależnie od reszty ustawień', () => {
    const pozycje = harmonogramMeczu(
      { ...BAZOWY, status: 'cancelled', reserveEnabled: true, costGrosze: 2000 },
      [gosc({ maGuestEmail: false })],
      chwilaUTC(2026, 9, 20, 10),
    );
    expect(pozycje).toEqual([]);
  });

  it('zimą przypomnienie o 16:00 UTC to 17:00 czasu polskiego (bez DST)', () => {
    const pozycje = harmonogramMeczu({ ...BAZOWY, date: '2027-01-15' }, [], chwilaUTC(2027, 1, 10, 10));
    const p = znajdz(pozycje, 'przypomnienie');
    if (p?.klucz === 'przypomnienie') {
      const godzinaLokalna = new Intl.DateTimeFormat('pl-PL', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Warsaw',
      }).format(p.kiedy);
      expect(godzinaLokalna).toBe('17:00');
    } else {
      throw new Error('brak pozycji przypomnienie');
    }
  });
});
