import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppNotification } from '@/types';
import { otwarteSprawy, toNotif, WYMAGA_AKCJI, celPowiadomienia } from '@/lib/notifications';

// Zapytania w `otwarteSprawy` różnią się TABELĄ tylko pozornie — trzy z nich
// idą do `event_participants`. Rozróżniamy je po tym, czy w łańcuchu pada
// `.eq('pending_approval', true)` (prośby) czy `.not('claim_offered_at', …)`
// (oferta miejsca z rezerwy) — gdy żadne z nich, to zapytanie o mój udział
// (097). Czwarte zapytanie idzie do `event_declines` — tu rozróżnia sama
// nazwa tabeli, przekazana do `from()`.
const { wynikProsb, wynikOfert, wynikUdzial, wynikOdmowy, from } = vi.hoisted(() => {
  const wynikProsb = { data: [] as any[], error: null as any };
  const wynikOfert = { data: [] as any[], error: null as any };
  const wynikUdzial = { data: [] as any[], error: null as any };
  const wynikOdmowy = { data: [] as any[], error: null as any };

  function nowyLancuch(table: string) {
    const stan = { prosby: false, oferty: false };
    const lancuch: any = {
      select: () => lancuch,
      eq: (kolumna: string) => { if (kolumna === 'pending_approval') stan.prosby = true; return lancuch; },
      not: () => { stan.oferty = true; return lancuch; },
      // `.in()` domyka zapytanie — to na nim await zwraca wynik.
      in: () => Promise.resolve(
        table === 'event_declines' ? wynikOdmowy
          : stan.prosby ? wynikProsb
          : stan.oferty ? wynikOfert
          : wynikUdzial,
      ),
    };
    return lancuch;
  }

  return { wynikProsb, wynikOfert, wynikUdzial, wynikOdmowy, from: vi.fn((table: string) => nowyLancuch(table)) };
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
  wynikUdzial.data = []; wynikUdzial.error = null;
  wynikOdmowy.data = []; wynikOdmowy.error = null;
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

  // 097: "pytanie_o_udzial" jest otwarte, dopóki NIE odpowiedziałem — ani nie
  // dołączyłem, ani nie odmówiłem wprost.
  describe('pytanie_o_udzial (097)', () => {
    it('zostaje otwarte, gdy nie ma ani wpisu w składzie, ani odmowy', async () => {
      const wynik = await otwarteSprawy('u1', [
        powiadomienie({ id: 'n1', type: 'pytanie_o_udzial', eventId: 'e1' }),
      ]);
      expect(wynik?.has('n1')).toBe(true);
    });

    it('zamyka się, gdy dołączyłem do meczu', async () => {
      wynikUdzial.data = [{ event_id: 'e1' }];
      const wynik = await otwarteSprawy('u1', [
        powiadomienie({ id: 'n1', type: 'pytanie_o_udzial', eventId: 'e1' }),
      ]);
      expect(wynik?.has('n1')).toBe(false);
    });

    // Kluczowy przypadek: "nie gram" to ODPOWIEDŹ, nie cisza — musi zamykać
    // sprawę dokładnie tak samo jak dołączenie.
    it('zamyka się, gdy jawnie odmówiłem — odmowa to odpowiedź, nie cisza', async () => {
      wynikOdmowy.data = [{ event_id: 'e1' }];
      const wynik = await otwarteSprawy('u1', [
        powiadomienie({ id: 'n1', type: 'pytanie_o_udzial', eventId: 'e1' }),
      ]);
      expect(wynik?.has('n1')).toBe(false);
    });

    it('zwraca null, gdy zapytanie o odmowy padło', async () => {
      wynikOdmowy.error = { message: 'boom' };
      const wynik = await otwarteSprawy('u1', [
        powiadomienie({ id: 'n1', type: 'pytanie_o_udzial', eventId: 'e1' }),
      ]);
      expect(wynik).toBeNull();
    });
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

  it('includes pytanie_o_udzial (097) — to jest prośba o decyzję, nie informacja', () => {
    expect(WYMAGA_AKCJI.has('pytanie_o_udzial')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Zaproszenie na mecz jest pytaniem o udział, nie ogłoszeniem
// ---------------------------------------------------------------------------
describe('zaproszenie_na_mecz', () => {
  it('wymaga działania — inaczej wisiało w panelu jako zwykła informacja', () => {
    expect(WYMAGA_AKCJI.has('zaproszenie_na_mecz')).toBe(true);
  });

  it('zostaje otwarte, dopóki nie ma ani zapisu, ani odmowy', async () => {
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'zaproszenie_na_mecz', eventId: 'e1' }),
    ]);
    expect(wynik?.has('n1')).toBe(true);
  });

  it('zamyka się po zapisaniu na mecz', async () => {
    wynikUdzial.data = [{ event_id: 'e1' }];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'zaproszenie_na_mecz', eventId: 'e1' }),
    ]);
    expect(wynik?.has('n1')).toBe(false);
  });

  it('zamyka się TAK SAMO po odmowie — „nie gram" to odpowiedź, nie cisza', async () => {
    wynikOdmowy.data = [{ event_id: 'e1' }];
    const wynik = await otwarteSprawy('u1', [
      powiadomienie({ id: 'n1', type: 'zaproszenie_na_mecz', eventId: 'e1' }),
    ]);
    expect(wynik?.has('n1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// celPowiadomienia (119) — wiadomość ma prowadzić WPROST na zakładkę
// „Rozmowa"/„Tablica", nie na domyślną zakładkę meczu/grupy. Ta sama reguła
// (typ → tab) jest zduplikowana po stronie Deno w send-push/index.ts, bo
// dwa różne runtime'y nie mogą dzielić importu — stąd te testy pilnują
// WYŁĄCZNIE strony klienta.
// ---------------------------------------------------------------------------
describe('celPowiadomienia', () => {
  it('wiadomość w meczu prowadzi na zakładkę rozmowy, nie na skład', () => {
    expect(celPowiadomienia(powiadomienie({ id: 'n1', type: 'wiadomosc_w_meczu', eventId: 'e1' })))
      .toBe('/wydarzenia/e1?tab=rozmowa');
  });

  it('wiadomość w grupie prowadzi na zakładkę tablicy, nie na listę meczów', () => {
    expect(celPowiadomienia(powiadomienie({ id: 'n1', type: 'wiadomosc_w_grupie', groupId: 'g1' })))
      .toBe('/grupy/g1?tab=tablica');
  });

  it('ogłoszenie w grupie prowadzi na tę samą zakładkę tablicy', () => {
    expect(celPowiadomienia(powiadomienie({ id: 'n1', type: 'ogloszenie_w_grupie', groupId: 'g1' })))
      .toBe('/grupy/g1?tab=tablica');
  });

  it('inne typy z event_id idą na domyślną stronę meczu, bez zakładki', () => {
    expect(celPowiadomienia(powiadomienie({ id: 'n1', type: 'nowy_mecz_w_grupie', eventId: 'e1' })))
      .toBe('/wydarzenia/e1');
  });

  it('niepotwierdzony wpis gościa prowadzi do przejęcia, nie na stronę meczu', () => {
    expect(celPowiadomienia(powiadomienie({
      id: 'n1', type: 'niepotwierdzony_wpis_goscia', eventId: 'e1', claimToken: 'tok',
    }))).toBe('/gracz/przejmij/tok');
  });

  it('typ bez event_id/group_id i bez wpisu w mapie tras nie prowadzi nigdzie', () => {
    expect(celPowiadomienia(powiadomienie({ id: 'n1', type: 'cos_nieznanego' }))).toBeNull();
  });
});
