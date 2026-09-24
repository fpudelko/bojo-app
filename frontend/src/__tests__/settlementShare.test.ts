import { describe, it, expect } from 'vitest';
import { tekstRozliczenia, type DaneDoRozliczenia } from '@/lib/settlementShare';
import type { EventParticipant } from '@/types';

const bazowy: DaneDoRozliczenia = {
  sport: 'piłka nożna',
  title: undefined,
  maxPlayers: 14,
  date: '2026-08-12', // środa
  costGrosze: 2000,
  sportsCardDiscountGrosze: null,
};

const ORGANIZER = 'organizer-id';

function gracz(overrides: Partial<EventParticipant>): EventParticipant {
  return {
    id: overrides.id ?? 'p1',
    eventId: 'e1',
    name: overrides.name ?? 'Gracz',
    isGuest: false,
    hasPaid: false,
    isReserve: false,
    createdAt: '2026-08-01T00:00:00Z',
    paidAmount: 0,
    isCaptain: false,
    isGoalkeeper: false,
    pendingApproval: false,
    rsvp: 'yes',
    claimPassed: false,
    hasSportsCard: false,
    ...overrides,
  };
}

describe('tekstRozliczenia', () => {
  it('mówi "Wszyscy oddali", gdy nikt nie zalega', () => {
    const sklad = [gracz({ id: 'a', name: 'Marek', hasPaid: true })];
    expect(tekstRozliczenia(bazowy, sklad, ORGANIZER)).toContain('Wszyscy oddali');
  });

  it('wymienia zaległych z kwotą i poprawną odmianą liczebnika', () => {
    const sklad = [
      gracz({ id: 'a', name: 'Marek', hasPaid: false }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: false }),
      gracz({ id: 'c', name: 'Piotrek', hasPaid: true }),
    ];
    const tekst = tekstRozliczenia(bazowy, sklad, ORGANIZER);
    expect(tekst).toContain('Zaległości (2 osoby):');
    expect(tekst).toContain('Marek: 20,00 zł');
    expect(tekst).toContain('Kuba: 20,00 zł');
    expect(tekst).not.toContain('Piotrek:');
  });

  it('pokazuje "dogadajmy kwotę" zamiast liczby przy nieustalonej zniżce kartowej', () => {
    const sklad = [gracz({ id: 'a', name: 'Marek', hasSportsCard: true, hasPaid: false })];
    const tekst = tekstRozliczenia({ ...bazowy, sportsCardDiscountGrosze: null }, sklad, ORGANIZER);
    expect(tekst).toContain('dogadajmy kwotę');
  });

  it('dopisuje numer BLIK tylko, gdy BLIK jest wśród akceptowanych metod', () => {
    const sklad = [gracz({ id: 'a', name: 'Marek', hasPaid: false })];
    const zBlikiem = tekstRozliczenia(
      { ...bazowy, blikPhone: '501 234 567', acceptedPaymentMethods: ['blik'] },
      sklad,
      ORGANIZER,
    );
    expect(zBlikiem).toContain('BLIK: 501 234 567');

    const bezBlika = tekstRozliczenia(
      { ...bazowy, blikPhone: '501 234 567', acceptedPaymentMethods: ['gotowka'] },
      sklad,
      ORGANIZER,
    );
    expect(bezBlika).not.toContain('BLIK:');
  });

  it('dopisuje adnotację "(nie przyszedł/-a)" przy zalegającym oznaczonym jako nieobecny', () => {
    const sklad = [
      gracz({ id: 'a', name: 'Marek', hasPaid: false }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: false }),
    ];
    const tekst = tekstRozliczenia(bazowy, sklad, ORGANIZER, new Set(['a']));
    expect(tekst).toContain('Marek: 20,00 zł (nie przyszedł/-a)');
    expect(tekst).toContain('Kuba: 20,00 zł');
    expect(tekst).not.toContain('Kuba: 20,00 zł (nie przyszedł/-a)');
  });

  it('liczy zebrane i oczekiwane po uwzględnieniu zniżki kartowej', () => {
    const sklad = [
      gracz({ id: 'a', name: 'Marek', hasPaid: true, hasSportsCard: true }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: false }),
    ];
    const tekst = tekstRozliczenia({ ...bazowy, sportsCardDiscountGrosze: 500 }, sklad, ORGANIZER);
    // Marek płaci 15 zł (zniżka), Kuba 20 zł — zebrane 15,00 z 35,00.
    expect(tekst).toContain('zebrane 15,00 zł z 35,00 zł');
  });

  it('nigdy nie wypisuje organizatora w "Zaległościach", nawet nieopłaconego (F-1)', () => {
    const sklad = [
      gracz({ id: 'org', name: 'Franek', userId: ORGANIZER, hasPaid: false }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: false }),
    ];
    const tekst = tekstRozliczenia(bazowy, sklad, ORGANIZER);
    expect(tekst).not.toContain('Franek');
    expect(tekst).toContain('Zaległości (1 osoba):');
    expect(tekst).toContain('Kuba: 20,00 zł');
  });

  it('mówi "Wszyscy oddali" mimo nieopłaconego organizatora, gdy reszta oddała', () => {
    const sklad = [
      gracz({ id: 'org', name: 'Franek', userId: ORGANIZER, hasPaid: false }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: true }),
    ];
    const tekst = tekstRozliczenia(bazowy, sklad, ORGANIZER);
    expect(tekst).toContain('Wszyscy oddali');
  });

  it('nie liczy organizatora do "zebrane / z"', () => {
    const sklad = [
      gracz({ id: 'org', name: 'Franek', userId: ORGANIZER, hasPaid: true }),
      gracz({ id: 'b', name: 'Kuba', hasPaid: true }),
    ];
    // Organizator opłacony też nie liczy się do sumy — inaczej "zebrane" mówi
    // 40,00 zł, mimo że tylko Kuba realnie oddał pieniądze organizatorowi.
    const tekst = tekstRozliczenia(bazowy, sklad, ORGANIZER);
    expect(tekst).toContain('zebrane 20,00 zł z 20,00 zł');
  });
});
