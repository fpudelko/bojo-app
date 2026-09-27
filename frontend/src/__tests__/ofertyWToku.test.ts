import { describe, it, expect } from 'vitest';
import { ofertyWToku, wolneMiejscaWgRol } from '@/lib/events';
import type { EventParticipant } from '@/types';

// X-4: rezerwowy z aktywną ofertą trzyma miejsce, choć formalnie jest jeszcze
// na rezerwie. Licznik „Zostało N wolnych miejsc" i okno zapisu mają liczyć
// z tym samym zbiorem, co baza (`sync_reserve_claim()`) — inaczej obiecują
// miejsce, które w rzeczywistości czeka na konkretną osobę.

function wpis(nadpisz: Partial<EventParticipant> & { id: string }): EventParticipant {
  return {
    eventId: 'e1',
    userId: `u-${nadpisz.id}`,
    name: nadpisz.id,
    isGuest: false,
    hasPaid: false,
    isReserve: true,
    createdAt: '2026-09-01T10:00:00Z',
    zapisanoAt: '2026-09-01T10:00:00Z',
    paidAmount: 0,
    isCaptain: false,
    isGoalkeeper: false,
    pendingApproval: false,
    rsvp: 'yes',
    claimPassed: false,
    ...nadpisz,
  } as EventParticipant;
}

const TERAZ = new Date('2026-09-27T18:00:00Z').getTime();
const REZERWE_MINUTY = 180; // 3 godziny

describe('ofertyWToku', () => {
  it('bez oferty nikogo nie wybiera', () => {
    const rezerwa = [wpis({ id: 'a' }), wpis({ id: 'b' })];
    expect(ofertyWToku(rezerwa, REZERWE_MINUTY, TERAZ)).toEqual([]);
  });

  it('oferta w toku (termin jeszcze nie minął)', () => {
    const aktywna = wpis({
      id: 'a',
      claimOfferedAt: new Date(TERAZ - 60 * 60_000).toISOString(), // godzinę temu
    });
    expect(ofertyWToku([aktywna], REZERWE_MINUTY, TERAZ)).toEqual([aktywna]);
  });

  it('oferta WYGASŁA (termin minął) nie liczy się jako w toku', () => {
    const wygasla = wpis({
      id: 'a',
      claimOfferedAt: new Date(TERAZ - 4 * 60 * 60_000).toISOString(), // 4 h temu
    });
    expect(ofertyWToku([wygasla], REZERWE_MINUTY, TERAZ)).toEqual([]);
  });

  it('oferta ODPUSZCZONA (claimPassed) nie liczy się, nawet z aktywnym terminem', () => {
    const odpuszczona = wpis({
      id: 'a',
      claimOfferedAt: new Date(TERAZ - 60 * 60_000).toISOString(),
      claimPassed: true,
    });
    expect(ofertyWToku([odpuszczona], REZERWE_MINUTY, TERAZ)).toEqual([]);
  });

  it('miesza aktywne, wygasłe i odpuszczone — wybiera tylko aktywną', () => {
    const aktywna = wpis({ id: 'a', claimOfferedAt: new Date(TERAZ - 30 * 60_000).toISOString() });
    const wygasla = wpis({ id: 'b', claimOfferedAt: new Date(TERAZ - 4 * 60 * 60_000).toISOString() });
    const odpuszczona = wpis({
      id: 'c', claimOfferedAt: new Date(TERAZ - 30 * 60_000).toISOString(), claimPassed: true,
    });
    const bezOferty = wpis({ id: 'd' });
    expect(ofertyWToku([aktywna, wygasla, odpuszczona, bezOferty], REZERWE_MINUTY, TERAZ))
      .toEqual([aktywna]);
  });
});

// Sedno X-4: licznik oparty na `regulars` samych liczył miejsce trzymane dla
// oferty jako wolne — po dołączeniu `ofertyWToku()` do składu przed
// `wolneMiejscaWgRol()` znika.
describe('wolneMiejscaWgRol z ofertami w toku (X-4)', () => {
  it('3 w składzie + 1 oferta w toku = zero wolnych na 4 miejsca (nie 1)', () => {
    const regulars = [{ isGoalkeeper: false }, { isGoalkeeper: false }, { isGoalkeeper: false }];
    const oferta = wpis({ id: 'a', claimOfferedAt: new Date(TERAZ - 60 * 60_000).toISOString() });
    const wolneBezOferty = wolneMiejscaWgRol(regulars, { maxPlayers: 4 });
    expect(wolneBezOferty.razem).toBe(1); // to jest dokładnie kłamstwo z X-4

    const wolneZOfertaBezPominiecia = wolneMiejscaWgRol(
      [...regulars, ...ofertyWToku([oferta], REZERWE_MINUTY, TERAZ)],
      { maxPlayers: 4 },
    );
    expect(wolneZOfertaBezPominiecia.razem).toBe(0);
  });

  it('oferta wygasła nie zabiera miejsca z licznika', () => {
    const regulars = [{ isGoalkeeper: false }, { isGoalkeeper: false }, { isGoalkeeper: false }];
    const wygasla = wpis({ id: 'a', claimOfferedAt: new Date(TERAZ - 4 * 60 * 60_000).toISOString() });
    const wolne = wolneMiejscaWgRol(
      [...regulars, ...ofertyWToku([wygasla], REZERWE_MINUTY, TERAZ)],
      { maxPlayers: 4 },
    );
    expect(wolne.razem).toBe(1);
  });
});
