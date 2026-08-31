import { describe, it, expect } from 'vitest';
import { nazwaZAdresu, eventLocation } from '@/lib/utils';

describe('nazwaZAdresu', () => {
  // Nominatim porządkuje `display_name` od najbardziej szczegółowego — dla
  // pinezki wskazanej ręcznie na mapie pierwszy segment bywa numerem domu,
  // nie nazwą miejsca. Zgłoszone wprost: mecz miał „GDZIE: 19C".
  it('pomija numer domu i bierze ulicę', () => {
    expect(nazwaZAdresu('19C, Stanisława Zwierzchowskiego, Żegrze, Poznań, wielkopolskie, Polska'))
      .toBe('Stanisława Zwierzchowskiego');
  });

  it('pomija numer domu bez litery', () => {
    expect(nazwaZAdresu('7, Kwiatowa, Poznań')).toBe('Kwiatowa');
  });

  it('zostawia pierwszy segment, gdy nie jest samym numerem', () => {
    expect(nazwaZAdresu('Orlik Rataje, os. Piastowskie, Poznań')).toBe('Orlik Rataje');
  });

  it('pusty i brakujący adres nie wywraca funkcji', () => {
    expect(nazwaZAdresu('')).toBe('');
    expect(nazwaZAdresu(null)).toBe('');
    expect(nazwaZAdresu(undefined)).toBe('');
  });

  it('gdy WSZYSTKIE segmenty są numerami, zostaje pierwszy z nich', () => {
    // Skrajny przypadek — nie ma czego innego pokazać. Kod pocztowy
    // („61-001") NIE jest bare-number w tym sensie — ma myślnik, więc go nie
    // pomijamy; to celowo, bo to jedyny przypadek, w którym drugi segment
    // niesie realną informację (kod, nie sam numer domu).
    expect(nazwaZAdresu('19C, 42')).toBe('19C');
  });
});

describe('eventLocation', () => {
  // Adres z importu OSM/Nominatim zwykle zaczyna się od tej samej nazwy, którą
  // `primary` już pokazuje pogrubioną — bez ucięcia tego prefiksu `secondary`
  // powtarzał nazwę obiektu raz jeszcze. Zgłoszone wprost: „nazwa obiektu bez
  // sensu powtórzona, niech szarym już jej nie będzie; tylko adres".
  it('ucina z adresu powtórzoną nazwę obiektu', () => {
    const wynik = eventLocation({
      fieldName: 'Park Nad Wartą',
      fieldAddress: 'Park Nad Wartą, Rataje, Poznań, województwo wielkopolskie, Polska',
    });
    expect(wynik.primary).toBe('Park Nad Wartą');
    expect(wynik.secondary).toBe('Rataje, Poznań, województwo wielkopolskie, Polska');
  });

  it('zostawia adres bez zmian, gdy nie zaczyna się od nazwy', () => {
    const wynik = eventLocation({
      fieldName: 'Orlik Rataje',
      fieldAddress: 'os. Piastowskie, Poznań',
    });
    expect(wynik.primary).toBe('Orlik Rataje');
    expect(wynik.secondary).toBe('os. Piastowskie, Poznań');
  });

  it('nie pokazuje drugiej linii, gdy adres to dokładnie ta sama nazwa', () => {
    const wynik = eventLocation({ fieldName: 'Park Nad Wartą', fieldAddress: 'Park Nad Wartą' });
    expect(wynik.secondary).toBeNull();
  });

  it('porównanie ignoruje wielkość liter', () => {
    const wynik = eventLocation({
      fieldName: 'Park nad Wartą',
      fieldAddress: 'PARK NAD WARTĄ, Rataje, Poznań',
    });
    expect(wynik.secondary).toBe('Rataje, Poznań');
  });
});
