import { describe, it, expect } from 'vitest';
import {
  powtarzalnoscOrganizatora, konwersjaGoscia, type ZdarzenieDoAktywacji,
} from '@/lib/analytics';

// Dwie liczby, których panel nie liczył do 2026-09-21, a od których zależy
// kolejność wszystkiego innego (docs/analiza-gtm-2026-09.md, POZIOM 2).
//
// Test pilnuje przede wszystkim rozróżnienia, dla którego te funkcje powstały:
// licznik wolumenu („mecze utworzone / 7 dni") pokazuje tę samą wartość dla
// dziesięciu organizatorów po jednym meczu i dla jednego z dziesięcioma, a to
// są przeciwstawne stany biznesu.

const DOBA = 24 * 60 * 60 * 1000;
const BAZA = Date.parse('2026-09-01T12:00:00Z');

/** Skrót do budowania wiersza: dzień liczony od 2026-09-01. */
function zd(user_id: string | null, event_type: string, dzien = 0): ZdarzenieDoAktywacji {
  return { user_id, event_type, created_at: new Date(BAZA + dzien * DOBA).toISOString() };
}

describe('powtarzalnoscOrganizatora', () => {
  it('odróżnia dziesięciu organizatorów po jednym meczu od jednego z dziesięcioma', () => {
    const rozproszone = Array.from({ length: 10 }, (_, i) => zd(`u${i}`, 'event_created', i));
    const skupione = Array.from({ length: 10 }, (_, i) => zd('u0', 'event_created', i));

    // Ten sam wolumen (10 meczów) i przeciwny wynik — to jest cały powód
    // istnienia tej funkcji.
    expect(rozproszone).toHaveLength(skupione.length);
    expect(powtarzalnoscOrganizatora(rozproszone).procent).toBe(0);
    expect(powtarzalnoscOrganizatora(skupione).procent).toBe(100);
  });

  it('liczy organizatorów, nie mecze', () => {
    const w = powtarzalnoscOrganizatora([
      zd('a', 'event_created', 0), zd('a', 'event_created', 3), zd('a', 'event_created', 9),
      zd('b', 'event_created', 1),
    ]);
    expect(w.organizatorzy).toBe(2);
    expect(w.zDrugimMeczem).toBe(1);
    expect(w.procent).toBe(50);
  });

  it('pomija zdarzenia innego typu i wiersze bez użytkownika', () => {
    const w = powtarzalnoscOrganizatora([
      zd('a', 'event_created', 0), zd('a', 'event_joined', 1), zd('a', 'login', 2),
      // Gość nie jest zalogowany, więc `user_id` bywa pusty — taki wiersz nie
      // może zrobić z nikogo organizatora.
      zd(null, 'event_created', 3),
    ]);
    expect(w.organizatorzy).toBe(1);
    expect(w.zDrugimMeczem).toBe(0);
  });

  it('mediana mierzy odstęp PIERWSZY → DRUGI, niezależnie od kolejności wejścia', () => {
    // Panel oddaje wiersze malejąco po dacie, więc kolejność wejścia jest tu
    // odwrotna do chronologicznej — wynik nie może od niej zależeć.
    const w = powtarzalnoscOrganizatora([
      zd('a', 'event_created', 20), zd('a', 'event_created', 4), zd('a', 'event_created', 0),
      zd('b', 'event_created', 6), zd('b', 'event_created', 0),
    ]);
    // a: 0→4 (4 dni), b: 0→6 (6 dni). Mediana z [4, 6] = 5.
    expect(w.medianaDniDoDrugiego).toBe(5);
  });

  it('null zamiast zera przy pustym mianowniku', () => {
    // „0%" czytałoby się jak zmierzona porażka tam, gdzie nie ma czego mierzyć.
    const w = powtarzalnoscOrganizatora([]);
    expect(w.procent).toBeNull();
    expect(w.medianaDniDoDrugiego).toBeNull();
  });

  it('niesparsowalna data nie przecieka jako NaN do mediany', () => {
    const w = powtarzalnoscOrganizatora([
      { user_id: 'a', event_type: 'event_created', created_at: 'nie-data' },
      zd('a', 'event_created', 0), zd('a', 'event_created', 2),
    ]);
    expect(w.medianaDniDoDrugiego).toBe(2);
  });
});

describe('konwersjaGoscia', () => {
  it('liczy oba zdarzenia i ich proporcję', () => {
    const k = konwersjaGoscia([
      ...Array.from({ length: 8 }, () => zd(null, 'guest_joined')),
      zd('a', 'guest_claimed'), zd('b', 'guest_claimed'),
    ]);
    expect(k.zapisyGosci).toBe(8);
    expect(k.przejecia).toBe(2);
    expect(k.procent).toBe(25);
  });

  it('null przy zerze zapisów', () => {
    expect(konwersjaGoscia([zd('a', 'login')]).procent).toBeNull();
  });
});
