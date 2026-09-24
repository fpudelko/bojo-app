import { describe, it, expect } from 'vitest';
import { isUpcoming, isEventJoinable, timeUntil, matchWhenLabel, minutesUntilStart, dzienTygodniaWBierniku, krotkiTermin, dzisLokalnie, jutroLokalnie } from '@/lib/eventDates';
import type { EventItem } from '@/types';

function fakeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'e1',
    organizerId: 'u1',
    organizerName: 'Jan',
    sport: 'piłka nożna',
    fieldName: 'Orlik',
    date: '2026-01-01',
    time: '18:00',
    maxPlayers: 10,
    visibility: 'public',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'active',
    requireSmsConfirmation: false,
    trackAttendance: false,
    teamMode: 'brak',
    trackPayments: false,
    showPaymentStatus: false,
    trackResults: false,
    ...overrides,
  } as EventItem;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(n: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d;
}

describe('isUpcoming', () => {
  it('dzisiejsza data jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(0)) }))).toBe(true);
  });
  it('data w przyszłości jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(5)) }))).toBe(true);
  });
  it('data w przeszłości nie jest nadchodząca', () => {
    expect(isUpcoming(fakeEvent({ date: ymd(addDays(-1)) }))).toBe(false);
  });
});

describe('isEventJoinable', () => {
  it('mecz po godzinie startu nie jest już do dołączenia', () => {
    expect(isEventJoinable(fakeEvent({ date: ymd(addDays(-1)), time: '18:00' }))).toBe(false);
  });
  it('mecz w przyszłości jest do dołączenia', () => {
    expect(isEventJoinable(fakeEvent({ date: ymd(addDays(3)), time: '18:00' }))).toBe(true);
  });
});

describe('timeUntil', () => {
  it('zwraca null, gdy mecz jest dalej niż 24h', () => {
    expect(timeUntil(ymd(addDays(3)), '18:00')).toBeNull();
  });
  it('zwraca null bez godziny', () => {
    expect(timeUntil(ymd(addDays(0)))).toBeNull();
  });
});

describe('minutesUntilStart', () => {
  it('positive minutes for a future match', () => {
    const inTwoHours = new Date(Date.now() + 2 * 3600_000);
    const minutes = minutesUntilStart(ymd(inTwoHours), `${String(inTwoHours.getHours()).padStart(2, '0')}:${String(inTwoHours.getMinutes()).padStart(2, '0')}`);
    expect(minutes).toBeGreaterThan(110);
    expect(minutes).toBeLessThanOrEqual(120);
  });

  it('negative minutes once the match has started', () => {
    expect(minutesUntilStart(ymd(addDays(-1)), '18:00')).toBeLessThan(0);
  });

  it('returns null on malformed input instead of throwing', () => {
    expect(minutesUntilStart('', '')).toBeNull();
  });
});

describe('matchWhenLabel', () => {
  it('dziś', () => {
    expect(matchWhenLabel(ymd(addDays(0)), '18:00')).toBe('dziś · 18:00');
  });
  it('jutro', () => {
    expect(matchWhenLabel(ymd(addDays(1)), '18:00')).toBe('jutro · 18:00');
  });
  it('w ciągu tygodnia pokazuje dzień tygodnia', () => {
    const label = matchWhenLabel(ymd(addDays(3)), '18:00');
    expect(label).toMatch(/^w [a-ząćęłńóśźż]+ · 18:00$/);
  });
  it('dalej niż tydzień pokazuje datę', () => {
    const label = matchWhenLabel(ymd(addDays(30)), '18:00');
    expect(label).toMatch(/^\d{1,2} [a-ząćęłńóśźż]+ · 18:00$/);
  });
});

describe('dzienTygodniaWBierniku', () => {
  // Zgłoszone wprost z sesji QA: „w niedziela" zamiast „w niedzielę" —
  // `format(date, 'EEEE')` zwraca mianownik, trzy dni tygodnia różnią się
  // w bierniku (pozostałe cztery mają tę samą formę w obu przypadkach).
  it('odmienia niedzielę, środę i sobotę przez biernik', () => {
    expect(dzienTygodniaWBierniku(new Date(2026, 8, 6))).toBe('niedzielę');  // 2026-09-06
    expect(dzienTygodniaWBierniku(new Date(2026, 8, 9))).toBe('środę');      // 2026-09-09
    expect(dzienTygodniaWBierniku(new Date(2026, 8, 12))).toBe('sobotę');    // 2026-09-12
  });

  it('zostawia bez zmian dni, gdzie mianownik = biernik', () => {
    expect(dzienTygodniaWBierniku(new Date(2026, 8, 7))).toBe('poniedziałek');
    expect(dzienTygodniaWBierniku(new Date(2026, 8, 10))).toBe('czwartek');
  });
});

describe('krotkiTermin', () => {
  it('dziś — sama godzina, bez daty', () => {
    // 23:59 DZIŚ, nie „teraz + 2 h": po 22:00 tamto przeskakiwało na jutro
    // i test padał co wieczór (CI chodzi w UTC, więc o tej porze też).
    const dzisWieczorem = new Date();
    dzisWieczorem.setHours(23, 59, 0, 0);
    expect(krotkiTermin(dzisWieczorem)).toBe('do 23:59');
  });

  it('jutro — słowo „jutra", nie odmieniona nazwa dnia', () => {
    const jutroTaSamaGodzina = new Date();
    jutroTaSamaGodzina.setDate(jutroTaSamaGodzina.getDate() + 1);
    expect(krotkiTermin(jutroTaSamaGodzina)).toMatch(/^do jutra, \d{2}:\d{2}$/);
  });

  it('pojutrze', () => {
    const pojutrze = new Date();
    pojutrze.setDate(pojutrze.getDate() + 2);
    expect(krotkiTermin(pojutrze)).toMatch(/^do pojutrza, \d{2}:\d{2}$/);
  });

  it('dalej niż pojutrze — data dzień.miesiąc, nie nazwa dnia tygodnia', () => {
    const zaTydzien = new Date();
    zaTydzien.setDate(zaTydzien.getDate() + 7);
    expect(krotkiTermin(zaTydzien)).toMatch(/^do \d{1,2}\.\d{2}, \d{2}:\d{2}$/);
  });

  it('termin, który już minął', () => {
    expect(krotkiTermin(new Date(Date.now() - 60_000))).toBe('czas minął');
  });
});

// F-8 (docs/faza1-organizator-plan.md): `toISOString().slice(0, 10)` liczy
// w UTC, więc między północą a 1–2 w nocy czasu polskiego cofa się o dzień.
describe('dzisLokalnie / jutroLokalnie', () => {
  it('formatuje datę lokalną jako YYYY-MM-DD, dopełnioną zerami', () => {
    expect(dzisLokalnie(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('00:30 czasu lokalnego to wciąż DZISIEJSZA data, nie wczorajsza', () => {
    // Bez `dzisLokalnie()` (przez `toISOString()`) ta godzina cofnęłaby się
    // do poprzedniego dnia w każdej strefie na wschód od UTC.
    expect(dzisLokalnie(new Date(2026, 8, 25, 0, 30))).toBe('2026-09-25');
  });

  it('23:30 czasu lokalnego to wciąż DZIŚ, nie jutro', () => {
    expect(dzisLokalnie(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
  });

  it('jutroLokalnie to dzisLokalnie + jeden dzień', () => {
    expect(jutroLokalnie(new Date(2026, 8, 25, 12, 0))).toBe('2026-09-26');
  });

  it('jutroLokalnie przechodzi poprawnie przez koniec miesiąca', () => {
    expect(jutroLokalnie(new Date(2026, 8, 30, 12, 0))).toBe('2026-10-01');
  });

  it('jutroLokalnie przechodzi poprawnie przez koniec roku', () => {
    expect(jutroLokalnie(new Date(2026, 11, 31, 12, 0))).toBe('2027-01-01');
  });

  it('00:30 lokalnie: jutroLokalnie liczy od dzisiejszej daty, nie wczorajszej', () => {
    expect(jutroLokalnie(new Date(2026, 8, 25, 0, 30))).toBe('2026-09-26');
  });
});
