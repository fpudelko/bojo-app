import { describe, it, expect } from 'vitest';
import { eventUrl, eventShareText, type DaneDoUdostepnienia } from '@/lib/eventShare';

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
