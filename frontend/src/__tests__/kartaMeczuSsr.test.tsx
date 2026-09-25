import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, cleanup } from '@testing-library/react';
import type { EventItem } from '@/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { EventBrowseCard } from '@/components/EventBrowseCard';

// W-3 (docs/faza1-przejscie-e2e-plan.md). Karta meczu renderuje się także na
// SERWERZE (sekcja „Możesz dołączyć już dziś” na stronie głównej). Serwer
// liczy „teraz” w UTC, gracz w Warszawie — więc „Dzisiaj · 18:00 · za 16 h”
// z serwera i „… za 14 h” z przeglądarki to dwa różne teksty, błąd hydracji
// (#418/#423) i cała strona główna renderowana od nowa.
//
// Niezmiennik: pierwszy render (ten, który idzie w HTML) NIE zależy od „teraz”.
// Etykiety względne dochodzą dopiero po montażu.
//
// Test e2e tego nie złapie: w przemiale bez bazy sekcja jest zawsze pusta,
// bo dane pobiera serwer, a `page.route()` działa tylko w przeglądarce.

const TERAZ = new Date('2026-09-25T14:00:00Z'); // 16:00 w Warszawie

const mecz: EventItem = {
  id: 'm1', organizerId: 'o1', organizerName: 'Marek O.',
  sport: 'piłka nożna', fieldName: 'Orlik Wilda', date: '2026-09-25', time: '18:00',
  endTime: '19:30', maxPlayers: 14, participantsCount: 5, visibility: 'public',
  createdAt: '2026-09-20T00:00:00Z', status: 'active', zapisyZamkniete: false,
  requireSmsConfirmation: false, teamMode: 'brak', trackPayments: false,
  showPaymentStatus: false, trackResults: false, confirmationDeadlineH: 24, costGrosze: 0,
  teamsPublished: false, allowGuestAdds: false, joinCode: 'ABCDEF', requireApproval: false,
  maxGoalkeepers: 2, goalkeeperSlotsReserved: true, goalkeepersEnabled: false,
  reserveClaimMinutes: 60, reserveEnabled: true, acceptedPaymentMethods: [], acceptedSportsCards: [],
  sportsCardDiscountGrosze: null,
};

describe('karta meczu: HTML z serwera nie zależy od „teraz”', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TERAZ);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('render serwerowy: data bezwzględna, bez „Dzisiaj” i bez odliczania', () => {
    const html = renderToString(<EventBrowseCard event={mecz} />);
    expect(html).not.toMatch(/Dzisiaj|Jutro/);
    expect(html).not.toMatch(/za \d+ (h|min)/);
    expect(html).toContain('18:00');
  });

  it('ten sam HTML bez względu na to, która jest godzina', () => {
    const o16 = renderToString(<EventBrowseCard event={mecz} />);
    vi.setSystemTime(new Date('2026-09-25T15:30:00Z'));
    const o1730 = renderToString(<EventBrowseCard event={mecz} />);
    expect(o1730).toBe(o16);
  });

  it('po montażu w przeglądarce etykiety względne wracają', () => {
    render(<EventBrowseCard event={mecz} />);
    expect(screen.getByText(/Dzisiaj/)).toBeTruthy();
    expect(screen.getByText(/za \d+ h/)).toBeTruthy();
  });
});
