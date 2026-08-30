import { describe, it, expect } from 'vitest';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { zWielkiejLitery, linkDojazdu } from '@/lib/utils';

describe('zWielkiejLitery', () => {
  // Zgłoszone wprost z sesji QA: „Niedz. 30 Sie". Tailwindowe `capitalize` to
  // `text-transform: capitalize` — wielka litera KAŻDEGO słowa, a polska data
  // ma mieć wielką tylko pierwszą.
  it('podnosi wyłącznie pierwszą literę, reszty nie tyka', () => {
    expect(zWielkiejLitery('niedz. 30 sie')).toBe('Niedz. 30 sie');
    expect(zWielkiejLitery('niedziela, 30 sierpnia')).toBe('Niedziela, 30 sierpnia');
  });

  it('nie psuje tekstu, który już ma wielką literę', () => {
    expect(zWielkiejLitery('Poniedziałek, 1 września')).toBe('Poniedziałek, 1 września');
  });

  it('pusty tekst przechodzi bez zmian', () => {
    expect(zWielkiejLitery('')).toBe('');
  });

  // Realne formaty użyte w kodzie — gdyby ktoś podmienił wzorzec `format()`,
  // ten test pokazuje, co dostanie użytkownik.
  it('daje poprawną polską datę dla obu wzorców z aplikacji', () => {
    const niedziela = parseISO('2026-08-30');
    expect(zWielkiejLitery(format(niedziela, 'EEE d MMM', { locale: pl })))
      .toBe('Niedz. 30 sie');
    expect(zWielkiejLitery(format(niedziela, 'EEEE, d MMMM', { locale: pl })))
      .toBe('Niedziela, 30 sierpnia');
  });
});

describe('linkDojazdu', () => {
  it('współrzędne mają pierwszeństwo przed adresem', () => {
    expect(linkDojazdu({ lat: 52.4, lng: 16.9, adres: 'ul. Kwiatowa 3' }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=52.4,16.9');
  });

  it('bez współrzędnych idzie po adresie', () => {
    expect(linkDojazdu({ lat: null, lng: null, adres: 'Stanisława Zwierzchowskiego, Poznań' }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=Stanis%C5%82awa%20Zwierzchowskiego%2C%20Pozna%C5%84');
  });

  it('bez jednego i drugiego nie ma linku — nie link donikąd', () => {
    expect(linkDojazdu({})).toBeNull();
    expect(linkDojazdu({ lat: null, lng: null, adres: '   ' })).toBeNull();
  });

  // `lat: 0` jest poprawną współrzędną — sprawdzamy `!= null`, nie prawdziwość.
  it('zero jako współrzędna nie wypada na fallback', () => {
    expect(linkDojazdu({ lat: 0, lng: 0, adres: 'gdziekolwiek' }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=0,0');
  });
});
