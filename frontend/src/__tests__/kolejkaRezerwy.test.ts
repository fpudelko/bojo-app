import { describe, it, expect } from 'vitest';
import {
  kolejkaRezerwy, pozycjaWKolejce, pozycjaPoZapisie, czekaNaOferte, pominietyWKolejce,
} from '@/lib/kolejkaRezerwy';
import type { EventParticipant } from '@/types';

// Kolejka rezerwowa liczona w przeglądarce musi dawać TĘ SAMĄ odpowiedź co
// `sync_reserve_claim()` (migracja `135`). Liczba „N. w kolejce" pokazana
// graczowi jest obietnicą — jeśli baza rozdaje miejsca inną regułą, to nie jest
// oszacowanie, tylko nieprawda podana jako fakt.

// `id` przychodzi ZAWSZE ze spreadu — wymusza to sygnatura, więc podawanie go
// też w literale nad spreadem byłoby martwym zapisem (TS2783).
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

describe('kolejkaRezerwy — kolejność zapisu', () => {
  it('ustawia wg momentu zapisu, nie wg kolejności w tablicy', () => {
    const rezerwy = [
      wpis({ id: 'c', zapisanoAt: '2026-09-01T12:00:00Z' }),
      wpis({ id: 'a', zapisanoAt: '2026-09-01T10:00:00Z' }),
      wpis({ id: 'b', zapisanoAt: '2026-09-01T11:00:00Z' }),
    ];
    expect(kolejkaRezerwy(rezerwy, false, false).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('pomija tego, kto ODPUŚCIŁ — świadoma odmowa wypada z kolejki', () => {
    const rezerwy = [
      wpis({ id: 'a', claimPassed: true }),
      wpis({ id: 'b', zapisanoAt: '2026-09-01T11:00:00Z' }),
    ];
    expect(kolejkaRezerwy(rezerwy, false, false).map((p) => p.id)).toEqual(['b']);
  });

  it('pomija obserwujących i czekających na akceptację', () => {
    const rezerwy = [
      wpis({ id: 'obserwuje', rsvp: 'maybe' }),
      wpis({ id: 'czeka', pendingApproval: true }),
      wpis({ id: 'realny', zapisanoAt: '2026-09-01T11:00:00Z' }),
    ];
    expect(kolejkaRezerwy(rezerwy, false, false).map((p) => p.id)).toEqual(['realny']);
  });
});

describe('kolejkaRezerwy — wygasła oferta ląduje na końcu, ale zostaje', () => {
  // To jest sedno migracji `135`. Wcześniej wygaśnięcie ustawiało `claim_passed`,
  // czyli to samo co świadome „Odpuszczam" — kto nie odebrał powiadomienia
  // w oknie 3 h, wypadał z kolejki na zawsze i nie dowiadywał się o tym.
  it('kto nie zdążył, stoi ZA tymi, którym oferty nie składano', () => {
    const rezerwy = [
      wpis({ id: 'spozniony', zapisanoAt: '2026-09-01T09:00:00Z', ofertaWygaslaAt: '2026-09-02T09:00:00Z' }),
      wpis({ id: 'nowy', zapisanoAt: '2026-09-01T12:00:00Z' }),
    ];
    // „spozniony" zapisał się WCZEŚNIEJ, a mimo to jest drugi.
    expect(kolejkaRezerwy(rezerwy, false, false).map((p) => p.id)).toEqual(['nowy', 'spozniony']);
  });

  it('nie wypada z kolejki — dostanie kolejną ofertę', () => {
    const spozniony = wpis({ id: 'spozniony', ofertaWygaslaAt: '2026-09-02T09:00:00Z' });
    expect(kolejkaRezerwy([spozniony], false, false)).toHaveLength(1);
    expect(pozycjaWKolejce(spozniony, [spozniony], false)).toBe(1);
  });

  it('wśród pominiętych pierwszy jest ten, którego ominięto NAJDAWNIEJ', () => {
    const rezerwy = [
      wpis({ id: 'swiezo', ofertaWygaslaAt: '2026-09-05T09:00:00Z' }),
      wpis({ id: 'dawno', ofertaWygaslaAt: '2026-09-02T09:00:00Z' }),
    ];
    expect(kolejkaRezerwy(rezerwy, false, false).map((p) => p.id)).toEqual(['dawno', 'swiezo']);
  });
});

describe('kolejkaRezerwy — dwie osobne kolejki przy bramkarzach', () => {
  const rezerwy = [
    wpis({ id: 'pole1', zapisanoAt: '2026-09-01T10:00:00Z' }),
    wpis({ id: 'pole2', zapisanoAt: '2026-09-01T11:00:00Z' }),
    wpis({ id: 'pole3', zapisanoAt: '2026-09-01T12:00:00Z' }),
    wpis({ id: 'bramkarz', zapisanoAt: '2026-09-01T13:00:00Z', isGoalkeeper: true }),
  ];

  it('bramkarz jedyny w swojej kolejce jest PIERWSZY, nie czwarty', () => {
    // Ten dokładnie błąd pokazywał baner rezerwowego: filtrował tylko
    // `claimPassed`, więc bramkarz czytał „Rezerwa · 4." i „przed Tobą 3 osoby",
    // choć wchodził następny. Baza liczy inaczej — `czy_na_rezerwe()` prowadzi
    // osobne pule.
    const bramkarz = rezerwy[3];
    expect(pozycjaWKolejce(bramkarz, rezerwy, true)).toBe(1);
  });

  it('bez rozróżniania ról kolejka jest jedna — bramkarz jest czwarty', () => {
    expect(pozycjaWKolejce(rezerwy[3], rezerwy, false)).toBe(4);
  });

  it('kolejka pola nie zawiera bramkarza', () => {
    expect(kolejkaRezerwy(rezerwy, true, false).map((p) => p.id)).toEqual(['pole1', 'pole2', 'pole3']);
  });
});

describe('pozycjaWKolejce — null znaczy „nie ma Cię w kolejce"', () => {
  it('zwraca null dla kogoś, kto odpuścił', () => {
    const odpuscil = wpis({ id: 'x', claimPassed: true });
    expect(pozycjaWKolejce(odpuscil, [odpuscil], false)).toBeNull();
  });

  it('nigdy nie zwraca 0 — stara wersja gasiła liczbę przez `-1 + 1 || null`', () => {
    const odpuscil = wpis({ id: 'x', claimPassed: true });
    expect(pozycjaWKolejce(odpuscil, [odpuscil], false)).not.toBe(0);
  });
});

describe('pozycjaPoZapisie — co zobaczy ktoś, kto zapisze się teraz', () => {
  it('ląduje za tymi, którzy czekają, ale PRZED pominiętymi', () => {
    const rezerwy = [
      wpis({ id: 'czeka', zapisanoAt: '2026-09-01T10:00:00Z' }),
      wpis({ id: 'pominiety', ofertaWygaslaAt: '2026-09-02T09:00:00Z' }),
    ];
    // Nowy wpis ma najświeższe `zapisano_at`, więc w grupie „nigdy nieominięci"
    // jest ostatni — czyli drugi w całej kolejce, przed „pominiety".
    expect(pozycjaPoZapisie(rezerwy, false, false)).toBe(2);
  });

  it('liczy osobno dla roli bramkarza', () => {
    const rezerwy = [
      wpis({ id: 'pole1' }),
      wpis({ id: 'pole2', zapisanoAt: '2026-09-01T11:00:00Z' }),
    ];
    expect(pozycjaPoZapisie(rezerwy, true, true)).toBe(1);
    expect(pozycjaPoZapisie(rezerwy, true, false)).toBe(3);
  });

  it('pusta kolejka daje pierwsze miejsce', () => {
    expect(pozycjaPoZapisie([], false, false)).toBe(1);
  });
});

describe('czekaNaOferte — kto realnie dostanie ofertę', () => {
  it('rezerwowy z kontem ofertę dostanie', () => {
    expect(czekaNaOferte(wpis({ id: 'a' }))).toBe(true);
  });

  it('gość Z ADRESEM też — od migracji 137 oferta idzie mailem', () => {
    // Wcześniej `sync_reserve_claim()` filtrowało `user_id IS NOT NULL`, więc
    // gość był w kolejce POMIJANY po cichu — a mail „jesteś na rezerwie"
    // obiecywał mu wprost „damy znać, gdy zwolni się miejsce".
    const gosc = wpis({ id: 'g', isGuest: true, userId: undefined, maGuestEmail: true });
    expect(czekaNaOferte(gosc)).toBe(true);
    expect(pominietyWKolejce(gosc)).toBe(false);
  });

  it('gość BEZ adresu stoi w kolejce, ale zaproszony nie będzie', () => {
    // Nie ma jak go zawiadomić — i to musi zobaczyć ORGANIZATOR, bo inaczej
    // patrzy na listę rezerwową, której część jest martwa.
    const gosc = wpis({ id: 'g', isGuest: true, userId: undefined, maGuestEmail: false });
    expect(kolejkaRezerwy([gosc], false, false)).toHaveLength(1);
    expect(czekaNaOferte(gosc)).toBe(false);
    expect(pominietyWKolejce(gosc)).toBe(true);
  });

  it('kto odpuścił, oferty nie dostanie mimo konta', () => {
    expect(czekaNaOferte(wpis({ id: 'a', claimPassed: true }))).toBe(false);
  });

  it('ostrzeżenie NIE dotyczy kogoś, kto w kolejce nie stoi', () => {
    // Odpuścił albo czeka na akceptację — organizator nie ma tu nic do zrobienia.
    expect(pominietyWKolejce(wpis({ id: 'g', isGuest: true, userId: undefined, claimPassed: true }))).toBe(false);
    expect(pominietyWKolejce(wpis({ id: 'g', isGuest: true, userId: undefined, pendingApproval: true }))).toBe(false);
  });
});
