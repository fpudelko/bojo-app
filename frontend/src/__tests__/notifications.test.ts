import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppNotification } from '@/types';
import { otwarteSprawy, toNotif, WYMAGA_AKCJI } from '@/lib/notifications';

// Zapytania w `otwarteSprawy` różnią się TABELĄ tylko pozornie — obie idą do
// `event_participants`. Rozróżniamy je po tym, czy w łańcuchu pada `.eq
// ('pending_approval', true)` (prośby) czy `.not('claim_offered_at', …)`
// (oferta miejsca z rezerwy), i oddajemy przygotowaną odpowiedź.
const { wynikProsb, wynikOfert, from } = vi.hoisted(() => {
  const wynikProsb = { data: [] as any[], error: null as any };
  const wynikOfert = { data: [] as any[], error: null as any };

  function nowyLancuch() {
    const stan = { prosby: false, oferty: false };
    const lancuch: any = {
      select: () => lancuch,
      eq: (kolumna: string) => { if (kolumna === 'pending_approval') stan.prosby = true; return lancuch; },
      not: () => { stan.oferty = true; return lancuch; },
      // `.in()` domyka zapytanie — to na nim await zwraca wynik.
      in: () => Promise.resolve(stan.prosby ? wynikProsb : stan.oferty ? wynikOfert : { data: [], error: null }),
    };
    return lancuch;
  }

  return { wynikProsb, wynikOfert, from: vi.fn(() => nowyLancuch()) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from } }));

function powiadomienie(over: Partial<AppNotification> & { id: string; type: string }): AppNotification {
  return {
    userId: 'u1',
    title: 'tytuł',
    createdAt: '2026-08-10T08:00:00Z',
    ...over,
  } as AppNotification;
}

beforeEach(() => {
  wynikProsb.data = []; wynikProsb.error = null;
  wynikOfert.data = []; wynikOfert.error = null;
  from.mockClear();
});

describe('otwarteSprawy', () => {
  it('nie odpytuje bazy, gdy nie ma powiadomień wymagających działania', async () => {
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'nowy_mecz_w_grupie', eventId: 'e1' }),
    ]);
    expect(wynik).toEqual(new Set());
    expect(from).not.toHaveBeenCalled();
  });

  it('zostawia otwartą prośbę, gdy mecz nadal ma wpis do rozpatrzenia', async () => {
    wynikProsb.data = [{ event_id: 'e1' }];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'prosba_o_dolaczenie', eventId: 'e1' }),
    ]);
    expect(wynik?.has('n1')).toBe(true);
  });

  it('zamyka prośbę rozpatrzoną — mecz nie ma już nic w pending', async () => {
    wynikProsb.data = [];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'prosba_o_dolaczenie', eventId: 'e1' }),
    ]);
    expect(wynik?.has('n1')).toBe(false);
  });

  it('rozdziela mecze: jedna prośba otwarta, druga załatwiona', async () => {
    wynikProsb.data = [{ event_id: 'e2' }];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'prosba_o_dolaczenie', eventId: 'e1' }),
      powiadomienie({ id: 'n2', type: 'prosba_o_dolaczenie', eventId: 'e2' }),
    ]);
    expect(wynik?.has('n1')).toBe(false);
    expect(wynik?.has('n2')).toBe(true);
  });

  it('oferta miejsca z rezerwy liczy się jako otwarta, dopóki jest aktywna', async () => {
    wynikOfert.data = [{ event_id: 'e9' }];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'reserve_claim_offered', eventId: 'e9' }),
    ]);
    expect(wynik?.has('n1')).toBe(true);
  });

  // Błąd zapytania NIE może wyglądać jak „wszystko załatwione" — wywołujący
  // ma wtedy zostawić dotychczasowy wygląd, a nie wygasić czekającą prośbę.
  it('zwraca null, gdy zapytanie padło', async () => {
    wynikProsb.error = { message: 'boom' };
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'prosba_o_dolaczenie', eventId: 'e1' }),
    ]);
    expect(wynik).toBeNull();
  });

  it('pomija powiadomienia bez meczu', async () => {
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'prosba_o_dolaczenie' }),
    ]);
    expect(wynik).toEqual(new Set());
    expect(from).not.toHaveBeenCalled();
  });
});

// 093: powiadomienia grupowe (ogłoszenie na tablicy, nowy mecz w grupie) niosą
// `group_id` — bez mapowania w `toNotif` dzwonek renderowałby martwy wiersz.
describe('toNotif', () => {
  it('maps group_id to groupId', () => {
    const n = toNotif({
      id: 'n1', user_id: 'u1', type: 'ogloszenie_w_grupie', title: 't',
      group_id: 'g1', created_at: '2026-08-10T08:00:00Z',
    });
    expect(n.groupId).toBe('g1');
  });

  it('leaves groupId undefined when the row has none', () => {
    const n = toNotif({
      id: 'n1', user_id: 'u1', type: 'nowy_mecz_w_grupie', title: 't',
      created_at: '2026-08-10T08:00:00Z',
    });
    expect(n.groupId).toBeUndefined();
  });
});

// Dzwonek dziś niesie prawie wyłącznie rzeczy WYMAGAJĄCE DZIAŁANIA — ogłoszenie
// na tablicy grupy to informacja, nie zadanie, więc nie ma tam czego rozpatrywać.
describe('WYMAGA_AKCJI', () => {
  it('does not include ogloszenie_w_grupie', () => {
    expect(WYMAGA_AKCJI.has('ogloszenie_w_grupie')).toBe(false);
  });
});
