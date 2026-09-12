import { describe, it, expect } from 'vitest';
import { eventUrl, eventShareText, type DaneDoUdostepnienia, tekstOdwolania, tekstPrzywrocenia } from '@/lib/eventShare';

const bazowy: DaneDoUdostepnienia = {
  sport: 'piłka nożna',
  title: undefined,
  maxPlayers: 14,
  date: '2026-08-12',      // środa
  time: '18:00:00',
  endTime: '19:30:00',
  costGrosze: 2000,
  fieldName: 'Orlik Sołacz',
  fieldAddress: 'ul. Niestachowska 8',
};

describe('eventUrl', () => {
  it('buduje adres kanoniczny, nie krótki /d/', () => {
    expect(eventUrl('abc-123', 'https://bojo.pl')).toBe('https://bojo.pl/wydarzenia/abc-123');
  });

  it('nie dubluje ukośnika, gdy origin się nim kończy', () => {
    expect(eventUrl('abc', 'https://bojo.pl/')).toBe('https://bojo.pl/wydarzenia/abc');
  });

  it('nigdy nie wskazuje na /d/ — ten adres jest poza indeksowaniem, więc leci bez podglądu', () => {
    expect(eventUrl('abc', 'https://bojo.pl')).not.toContain('/d/');
  });
});

describe('eventShareText', () => {
  it('składa cztery linie', () => {
    expect(eventShareText(bazowy).split('\n')).toHaveLength(4);
  });

  it('pierwsza linia to emoji sportu i domyślny tytuł', () => {
    expect(eventShareText(bazowy).split('\n')[0]).toBe('⚽ Piłka nożna 7v7');
  });

  it('używa własnego tytułu, gdy organizator go podał', () => {
    const t = eventShareText({ ...bazowy, title: 'Środowa gierka' });
    expect(t.split('\n')[0]).toBe('⚽ Środowa gierka');
  });

  it('druga linia to dzień, data i zakres godzin bez sekund', () => {
    expect(eventShareText(bazowy).split('\n')[1]).toBe('środa, 12 sierpnia · 18:00–19:30');
  });

  it('bez godziny końca pokazuje samą godzinę startu', () => {
    const t = eventShareText({ ...bazowy, endTime: undefined });
    expect(t.split('\n')[1]).toBe('środa, 12 sierpnia · 18:00');
  });

  it('trzecia linia to miejsce z adresem', () => {
    expect(eventShareText(bazowy).split('\n')[2]).toBe('Orlik Sołacz, ul. Niestachowska 8');
  });

  it('miejsce spoza katalogu bierze nazwę własną i adres własny', () => {
    const t = eventShareText({
      ...bazowy,
      fieldName: undefined,
      fieldAddress: undefined,
      customLocationName: 'Plaża Rusałka',
      customAddress: 'ul. Nad Jeziorem 1',
    });
    expect(t.split('\n')[2]).toBe('Plaża Rusałka, ul. Nad Jeziorem 1');
  });

  it('nie dubluje miejsca, gdy nazwa i adres są tym samym', () => {
    const t = eventShareText({ ...bazowy, fieldName: 'ul. Niestachowska 8' });
    expect(t.split('\n')[2]).toBe('ul. Niestachowska 8');
  });

  it('czwarta linia to liczba miejsc i cena od osoby', () => {
    expect(eventShareText(bazowy).split('\n')[3]).toBe('14 miejsc · 20,00 zł od osoby');
  });

  it('mecz darmowy mówi to wprost', () => {
    const t = eventShareText({ ...bazowy, costGrosze: 0 });
    expect(t.split('\n')[3]).toBe('14 miejsc · za darmo');
  });

  it('odmienia „miejsca" poprawnie także w przedziale 12–14', () => {
    // Reguła `n < 5` dawała tu „miejsca" — a 14 to domyślny skład piłkarski.
    expect(eventShareText({ ...bazowy, maxPlayers: 14 })).toContain('14 miejsc ');
    expect(eventShareText({ ...bazowy, maxPlayers: 4 })).toContain('4 miejsca ');
    expect(eventShareText({ ...bazowy, maxPlayers: 22 })).toContain('22 miejsca ');
  });

  it('nie zawiera adresu meczu — link idzie osobno, żeby działał podgląd', () => {
    expect(eventShareText(bazowy)).not.toContain('http');
  });

  it('nie wywraca się na niepoprawnej dacie', () => {
    const t = eventShareText({ ...bazowy, date: 'bez-sensu' });
    expect(t.split('\n')[1]).toContain('bez-sensu');
  });
});

// ---------------------------------------------------------------------------
// eventShareText ze `stan` — audyt 2026-09-12, ustalenie S-5.
//
// PO CO. Wiadomość na czat mówiła zawsze „14 miejsc", niezależnie od tego,
// czy meczowi brakuje dwóch osób, czy dopiero powstał — a „ile brakuje" jest
// dokładnie tym, po co organizator wkleja link na grupę. Argument „bez
// zakładania konta" (wyzwanie 1-2 ze strategii) nie padał wcale, choć da się
// go złożyć uczciwie zawsze tam, gdzie pasek dolny na stronie meczu i tak
// pokazuje „Dołącz bez konta".
// ---------------------------------------------------------------------------
describe('eventShareText — z podanym stanem zapisów (S-5)', () => {
  it('bez `stan` zachowuje się DOKŁADNIE jak dotąd — bezpiecznik wsteczny', () => {
    expect(eventShareText(bazowy)).toBe(eventShareText(bazowy, undefined));
    expect(eventShareText(bazowy).split('\n')[3]).toBe('14 miejsc · 20,00 zł od osoby');
    expect(eventShareText(bazowy).split('\n')).toHaveLength(4);
  });

  it('wolne miejsca: mówi ile zostało i dokłada zdanie o zapisie bez konta', () => {
    const t = eventShareText(bazowy, { wolneMiejsca: 2, reserveEnabled: true, zapisyZamkniete: false });
    const linie = t.split('\n');
    expect(linie[3]).toBe('Zostały 2 miejsca · 20,00 zł od osoby');
    expect(linie[4]).toBe('Zapisujesz się bez zakładania konta.');
  });

  it('komplet z włączoną rezerwą: „wejdź na rezerwę" i nadal bez konta', () => {
    const t = eventShareText(bazowy, { wolneMiejsca: 0, reserveEnabled: true, zapisyZamkniete: false });
    const linie = t.split('\n');
    expect(linie[3]).toBe('Komplet — wejdź na rezerwę · 20,00 zł od osoby');
    expect(linie[4]).toBe('Zapisujesz się bez zakładania konta.');
  });

  it('komplet z wyłączoną rezerwą: samo „Komplet", BEZ obietnicy zapisu bez konta', () => {
    const t = eventShareText(bazowy, { wolneMiejsca: 0, reserveEnabled: false, zapisyZamkniete: false });
    const linie = t.split('\n');
    expect(linie[3]).toBe('Komplet · 20,00 zł od osoby');
    expect(linie).toHaveLength(4);
  });

  it('zapisy zamknięte wygrywają nad kompletem/wolnymi miejscami i nie obiecują zapisu bez konta', () => {
    const t = eventShareText(bazowy, { wolneMiejsca: 5, reserveEnabled: true, zapisyZamkniete: true });
    const linie = t.split('\n');
    expect(linie[3]).toBe('Zapisy zamknięte · 20,00 zł od osoby');
    expect(linie).toHaveLength(4);
  });

  it('odmienia liczbę wolnych miejsc (1 / 2-4 / 5+)', () => {
    expect(eventShareText(bazowy, { wolneMiejsca: 1, reserveEnabled: true, zapisyZamkniete: false }))
      .toContain('Zostało 1 miejsce ·');
    expect(eventShareText(bazowy, { wolneMiejsca: 3, reserveEnabled: true, zapisyZamkniete: false }))
      .toContain('Zostały 3 miejsca ·');
    expect(eventShareText(bazowy, { wolneMiejsca: 8, reserveEnabled: true, zapisyZamkniete: false }))
      .toContain('Zostało 8 miejsc ·');
  });
});

// ---------------------------------------------------------------------------
// tekstOdwolania — wiadomość na czat, gdy mecz się nie odbędzie.
//
// PO CO ISTNIEJE: `cancelEvent()` powiadamia uczestników Z KONTEM (migracja
// `070` plus push), ale wyzwalacz ma warunek `user_id IS NOT NULL`, więc gość
// bez konta nie dostaje NICZEGO. Dla niego czat organizatora jest jedynym
// kanałem — i to jest ta wiadomość.
// ---------------------------------------------------------------------------
describe('tekstOdwolania', () => {
  it('pierwsza linia mówi wprost, że mecz jest odwołany', () => {
    expect(tekstOdwolania(bazowy).split('\n')[0]).toBe('❌ Odwołane: Piłka nożna 7v7');
  });

  it('niesie datę, godzinę i miejsce — bez nich wiadomość nie mówi, KTÓRY mecz', () => {
    const linie = tekstOdwolania({ ...bazowy, fieldName: 'Orlik Sołacz', fieldAddress: 'ul. Niestachowska 8' }).split('\n');
    expect(linie[1]).toContain('18:00');
    expect(linie[1]).toContain('sierpnia');
    expect(linie[2]).toBe('Orlik Sołacz, ul. Niestachowska 8');
  });

  it('kończy się jednoznacznym zdaniem, nie samym nagłówkiem', () => {
    expect(tekstOdwolania(bazowy).split('\n')[3]).toBe('Mecz się nie odbędzie.');
  });

  it('używa własnego tytułu meczu, gdy organizator go nadał', () => {
    expect(tekstOdwolania({ ...bazowy, title: 'Środowa gierka' })).toContain('Odwołane: Środowa gierka');
  });

  // Ta sama zasada co w `eventShareText`: zła data nie może wywrócić okna
  // odwołania, bo organizator zostaje wtedy bez możliwości powiadomienia ekipy.
  it('nie wywraca się na niepoprawnej dacie', () => {
    expect(() => tekstOdwolania({ ...bazowy, date: 'bez-sensu' })).not.toThrow();
  });

  // Notatka organizatora (migracja 142) — ten sam tekst, który trafia do
  // dzwonka/push/maila, ma iść też na czat, jeśli organizator wybrał drugą
  // drogę „Odwołaj i wyślij wiadomość".
  it('dokłada notatkę organizatora na końcu, gdy jest podana', () => {
    const linie = tekstOdwolania(bazowy, 'Boisko zalane, szukamy zastępczego terminu.').split('\n');
    expect(linie).toHaveLength(5);
    expect(linie[3]).toBe('Mecz się nie odbędzie.');
    expect(linie[4]).toBe('Boisko zalane, szukamy zastępczego terminu.');
  });

  it('bez notatki wiadomość zostaje w czterech liniach', () => {
    expect(tekstOdwolania(bazowy, undefined).split('\n')).toHaveLength(4);
    expect(tekstOdwolania(bazowy, '   ').split('\n')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// tekstPrzywrocenia — druga połowa `tekstOdwolania`.
//
// PO CO ISTNIEJE: migracja `139` powiadamia o cofnięciu odwołania te osoby,
// które dostały wcześniej `mecz_odwolany` — ale gość bez konta i BEZ adresu
// nie ma jak się o tym dowiedzieć. Ten sam powód, dla którego istnieje
// `tekstOdwolania`, tylko z odwrotnym znakiem.
// ---------------------------------------------------------------------------
describe('tekstPrzywrocenia', () => {
  it('pierwsza linia mówi wprost, że mecz wraca', () => {
    expect(tekstPrzywrocenia(bazowy).split('\n')[0]).toBe('✅ Wraca: Piłka nożna 7v7');
  });

  it('niesie termin z godzinami — bez niego nie ma po co wracać do kalendarza', () => {
    expect(tekstPrzywrocenia(bazowy).split('\n')[1]).toBe('środa, 12 sierpnia · 18:00–19:30');
  });

  it('niesie miejsce z adresem', () => {
    expect(tekstPrzywrocenia(bazowy).split('\n')[2]).toBe('Orlik Sołacz, ul. Niestachowska 8');
  });

  it('kończy się zdaniem, które rozstrzyga', () => {
    expect(tekstPrzywrocenia(bazowy).split('\n')[3]).toBe('Mecz jednak się odbędzie.');
  });

  it('ma ten sam kształt co zaproszenie i odwołanie — cztery linie', () => {
    expect(tekstPrzywrocenia(bazowy).split('\n')).toHaveLength(4);
    expect(tekstOdwolania(bazowy).split('\n')).toHaveLength(4);
  });
});
