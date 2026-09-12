import { describe, it, expect } from 'vitest';
import {
  policzZmiany, czyPowiadamia, komuDojdzie, konsekwencjeZapisu, konsekwencjeOdwolania,
  type DaneDoPorownania,
} from '@/lib/zmianyMeczu';
import type { EventParticipant } from '@/types';

const bazowy: DaneDoPorownania = {
  date: '2026-08-12',          // środa
  time: '18:00',
  miejsceNazwa: 'Orlik Sołacz',
  fieldId: 'field-1',
  costGrosze: 2000,
  maxPlayers: 14,
  visibility: 'public',
  requireApproval: false,
  reserveEnabled: true,
  goalkeepersEnabled: false,
  title: '',
  description: '',
  acceptedPaymentMethods: ['gotowka'],
  acceptedSportsCards: [],
};

function uczestnik(p: Partial<EventParticipant>): EventParticipant {
  return {
    id: 'p', eventId: 'e', name: 'X', isGuest: false, hasPaid: false,
    isReserve: false, createdAt: '', paidAmount: 0, isCaptain: false,
    isGoalkeeper: false, pendingApproval: false, rsvp: 'yes', claimPassed: false,
    hasSportsCard: false,
    ...p,
  };
}

describe('policzZmiany', () => {
  it('brak zmian to pusta lista — bez tego pusty zapis szedł do bazy', () => {
    expect(policzZmiany(bazowy, { ...bazowy })).toEqual([]);
  });

  it('zmiana daty opisuje termin pełnym dniem tygodnia, nie samą datą', () => {
    const z = policzZmiany(bazowy, { ...bazowy, date: '2026-08-13' });
    expect(z).toHaveLength(1);
    expect(z[0].klucz).toBe('termin');
    expect(z[0].przed).toBe('środa, 12 sierpnia, 18:00');
    expect(z[0].po).toBe('czwartek, 13 sierpnia, 18:00');
  });

  it('zmiana samej godziny też jest zmianą terminu', () => {
    const z = policzZmiany(bazowy, { ...bazowy, time: '20:30' });
    expect(z.map((x) => x.klucz)).toEqual(['termin']);
  });

  it('sekundy w godzinie nie robią z niczego zmiany', () => {
    // Baza zwraca `18:00:00`, formularz trzyma `18:00` — bez ucięcia sekund
    // KAŻDY zapis wyglądałby na zmianę terminu i wysyłał powiadomienie.
    expect(policzZmiany({ ...bazowy, time: '18:00:00' }, bazowy)).toEqual([]);
  });

  it('to samo boisko o innym id liczy się jako zmiana miejsca', () => {
    // Dwa różne orliki potrafią nazywać się tak samo.
    const z = policzZmiany(bazowy, { ...bazowy, fieldId: 'field-2' });
    expect(z.map((x) => x.klucz)).toEqual(['miejsce']);
  });

  it('koszt opisuje kwotę od osoby, a zero nazywa po imieniu', () => {
    const z = policzZmiany(bazowy, { ...bazowy, costGrosze: 0 });
    expect(z[0].przed).toBe('20.00 zł od osoby');
    expect(z[0].po).toBe('za darmo');
  });

  it('kolejność jest od najważniejszego dla uczestnika', () => {
    const z = policzZmiany(bazowy, {
      ...bazowy, title: 'Czwartkowa', costGrosze: 3000, date: '2026-08-13',
    });
    expect(z.map((x) => x.klucz)).toEqual(['termin', 'koszt', 'tytul']);
  });

  it('sama kolejność metod płatności nie jest zmianą', () => {
    const a: DaneDoPorownania = { ...bazowy, acceptedPaymentMethods: ['gotowka', 'blik'] };
    const b: DaneDoPorownania = { ...bazowy, acceptedPaymentMethods: ['blik', 'gotowka'] };
    expect(policzZmiany(a, b)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TO JEST NAJWAŻNIEJSZY TEST W TYM PLIKU.
//
// Flaga `powiadamia` jest LUSTREM wyzwalaczy bazy: `065` reaguje na datę
// i godzinę, `114` na miejsce i koszt, nic innego nie wysyła nic. Jeśli kiedyś
// dojdzie trzeci wyzwalacz, ten test padnie — i o to chodzi. Okno mówiące
// „12 osób dostanie powiadomienie" tam, gdzie nikt go nie dostaje, jest gorsze
// niż brak okna: raz nauczony organizator przestaje pisać na czacie.
// ---------------------------------------------------------------------------
describe('powiadamia — zbiór kluczy zgodny z wyzwalaczami 065 i 114', () => {
  const wszystkieZmiany = policzZmiany(bazowy, {
    date: '2030-01-01',
    time: '21:00',
    miejsceNazwa: 'Inne boisko',
    fieldId: undefined,
    costGrosze: 5000,
    maxPlayers: 10,
    visibility: 'private',
    requireApproval: true,
    reserveEnabled: false,
    goalkeepersEnabled: true,
    title: 'Nowy tytuł',
    description: 'Nowy opis',
    acceptedPaymentMethods: ['blik'],
    acceptedSportsCards: ['multisport'],
  });

  it('powiadamiają dokładnie: termin, miejsce, koszt', () => {
    expect(wszystkieZmiany.filter((z) => z.powiadamia).map((z) => z.klucz))
      .toEqual(['termin', 'miejsce', 'koszt']);
  });

  it('reszta pól jest cicha', () => {
    expect(wszystkieZmiany.filter((z) => !z.powiadamia).map((z) => z.klucz))
      .toEqual(['miejsca', 'widocznosc', 'akceptacja', 'rezerwa', 'bramkarze', 'tytul', 'opis', 'platnosci']);
  });

  it('czyPowiadamia jest fałszem, gdy zmienia się sam tytuł', () => {
    expect(czyPowiadamia(policzZmiany(bazowy, { ...bazowy, title: 'Inny' }))).toBe(false);
  });
});

describe('komuDojdzie', () => {
  it('dzieli skład na trzy kanały i pomija organizatora', () => {
    const komu = komuDojdzie([
      uczestnik({ userId: 'org' }),
      uczestnik({ userId: 'u1' }),
      uczestnik({ userId: 'u2' }),
      uczestnik({ isGuest: true, maGuestEmail: true }),
      uczestnik({ isGuest: true, maGuestEmail: false }),
      uczestnik({ isGuest: true }),
    ], 'org');

    expect(komu).toEqual({ zKontem: 2, gosciezAdresem: 1, gosciebezAdresu: 2 });
  });

  it('liczy też rezerwowych — zmiana terminu unieważnia ich plany tak samo', () => {
    const komu = komuDojdzie([
      uczestnik({ userId: 'u1', isReserve: true }),
      uczestnik({ userId: 'u2', rsvp: 'maybe' }),
    ], 'org');
    expect(komu.zKontem).toBe(2);
  });
});

describe('konsekwencjeZapisu', () => {
  const komu = { zKontem: 9, gosciezAdresem: 3, gosciebezAdresu: 1 };

  it('przy zmianie powiadamiającej mówi o wszystkich trzech kanałach', () => {
    const zdania = konsekwencjeZapisu(policzZmiany(bazowy, { ...bazowy, date: '2026-08-13' }), komu);
    expect(zdania[0]).toContain('9 osób z kontem');
    expect(zdania[1]).toContain('3 gości');
    expect(zdania[2]).toContain('nie podała adresu');
  });

  it('przy zmianie cichej mówi WPROST, że nikt się nie dowie', () => {
    const zdania = konsekwencjeZapisu(policzZmiany(bazowy, { ...bazowy, title: 'Inny' }), komu);
    expect(zdania[0]).toContain('nie wysyłają nikomu powiadomienia');
  });

  it('ostrzega, gdy nowy limit jest niższy niż obsadzony skład', () => {
    const zdania = konsekwencjeZapisu([], komu, { zapisanych: 12, miejsc: 10 });
    expect(zdania.at(-1)).toContain('Nikt nie zostanie usunięty');
    expect(zdania.at(-1)).toContain('2 osoby będą nad limitem');
  });

  it('nie ostrzega, gdy limit nadal mieści skład', () => {
    expect(konsekwencjeZapisu([], komu, { zapisanych: 8, miejsc: 10 })).toEqual([]);
  });

  it('mecz bez nikogo z kontem nie obiecuje powiadomień', () => {
    const zdania = konsekwencjeZapisu(
      policzZmiany(bazowy, { ...bazowy, date: '2026-08-13' }),
      { zKontem: 0, gosciezAdresem: 0, gosciebezAdresu: 2 },
    );
    expect(zdania[0]).toContain('Nikt w składzie nie ma konta');
  });
});

// Regresja `S-4` (audyt 2026-09-12): okno odwołania liczyło odbiorców po
// swojemu (`[...regulars, ...reserves]`, pomijając obserwujących i czekających
// na akceptację) i mówiło „jeśli podała adres" zamiast dokładnej odpowiedzi
// z `ma_guest_email`. `konsekwencjeOdwolania()` to ten sam podział na kanały
// co `konsekwencjeZapisu()`, zawsze powiadamiający — odwołanie nie ma stanu
// „cisza".
describe('konsekwencjeOdwolania', () => {
  it('mówi o trzech kanałach naraz, gdy są odbiorcy w każdym', () => {
    const zdania = konsekwencjeOdwolania({ zKontem: 8, gosciezAdresem: 2, gosciebezAdresu: 1 });
    expect(zdania[0]).toContain('8 osób z kontem');
    expect(zdania[0]).toContain('powiadomienie w Bojo');
    expect(zdania[1]).toContain('2 gości');
    expect(zdania[1]).toContain('e-mail');
    expect(zdania[2]).toContain('1 osoba');
    expect(zdania[2]).toContain('nie podała adresu');
  });

  it('mecz bez nikogo z kontem nie obiecuje powiadomienia w Bojo', () => {
    const zdania = konsekwencjeOdwolania({ zKontem: 0, gosciezAdresem: 1, gosciebezAdresu: 0 });
    expect(zdania[0]).toContain('Nikt w składzie nie ma konta');
  });

  it('sami z kontem — bez zdań o gościach', () => {
    const zdania = konsekwencjeOdwolania({ zKontem: 5, gosciezAdresem: 0, gosciebezAdresu: 0 });
    expect(zdania).toHaveLength(1);
  });

  // Obserwujący i czekający na akceptację WCHODZĄ do `zKontem` — to
  // `komuDojdzie()` decyduje, kto się liczy (patrz jego własne testy wyżej),
  // ta funkcja tylko tłumaczy podział na zdania. Sprawdzone przez
  // `komuDojdzie()` bezpośrednio: obserwujący i pending_approval liczą się
  // do `zKontem`, dopóki mają `userId`.
  it('liczba z kontem pochodzi wprost z komuDojdzie (obserwujący i czekający wliczeni)', () => {
    const komu = komuDojdzie([
      uczestnik({ userId: 'gracz' }),
      uczestnik({ userId: 'obserwator', rsvp: 'maybe' }),
      uczestnik({ userId: 'oczekujacy', pendingApproval: true }),
    ], 'org');
    const zdania = konsekwencjeOdwolania(komu);
    expect(zdania[0]).toContain('3 osoby z kontem');
  });
});
