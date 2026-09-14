import { describe, it, expect } from 'vitest';
import { zbudujIcs, nazwaPliku, type MeczDoKalendarza } from '@/lib/kalendarz';

const TERAZ = new Date('2026-01-05T12:00:00Z');

const MECZ: MeczDoKalendarza = {
  id: 'abc-123',
  tytul: 'Piłka nożna 7v7',
  data: '2026-01-07',
  godzina: '18:00',
  godzinaKonca: '19:30',
  miejsce: 'Ośrodek Przywodny Rataje',
  opis: 'Poziom rekreacyjny',
  url: 'https://bojo.pl/wydarzenia/abc-123',
};

/** Rozwija zawinięcia RFC 5545 (CRLF + spacja), żeby asercje mogły patrzeć
 *  na logiczne linie, a nie na to, gdzie akurat wypadł limit 75 oktetów. */
function linie(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n');
}

describe('zbudujIcs — szkielet pliku', () => {
  it('składa poprawną kopertę VCALENDAR z jednym VEVENT', () => {
    const l = linie(zbudujIcs(MECZ, TERAZ));
    expect(l[0]).toBe('BEGIN:VCALENDAR');
    expect(l[l.length - 1]).toBe('END:VCALENDAR');
    expect(l.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(l.filter((x) => x === 'END:VEVENT')).toHaveLength(1);
  });

  it('używa CRLF, nie samego \\n — na tym część klientów odmawia wczytania', () => {
    const ics = zbudujIcs(MECZ, TERAZ);
    expect(ics).toContain('\r\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('dokłada definicję strefy, więc TZID nie wisi bez pokrycia', () => {
    const l = linie(zbudujIcs(MECZ, TERAZ));
    expect(l).toContain('BEGIN:VTIMEZONE');
    expect(l).toContain('TZID:Europe/Warsaw');
    expect(l).toContain('END:VTIMEZONE');
  });
});

describe('zbudujIcs — termin', () => {
  it('zapisuje czas ścienny ze strefą, bez przeliczania na UTC', () => {
    const l = linie(zbudujIcs(MECZ, TERAZ));
    expect(l).toContain('DTSTART;TZID=Europe/Warsaw:20260107T180000');
    expect(l).toContain('DTEND;TZID=Europe/Warsaw:20260107T193000');
  });

  it('mecz bez godziny końca dostaje domyślne 90 minut', () => {
    const l = linie(zbudujIcs({ ...MECZ, godzinaKonca: null }, TERAZ));
    expect(l).toContain('DTEND;TZID=Europe/Warsaw:20260107T193000');
  });

  it('mecz przez północ kończy się NASTĘPNEGO dnia', () => {
    const l = linie(zbudujIcs({ ...MECZ, godzina: '23:00', godzinaKonca: null }, TERAZ));
    expect(l).toContain('DTSTART;TZID=Europe/Warsaw:20260107T230000');
    expect(l).toContain('DTEND;TZID=Europe/Warsaw:20260108T003000');
  });

  it('godzina z sekundami z bazy („18:00:00") nie psuje stempla', () => {
    const l = linie(zbudujIcs({ ...MECZ, godzinaKonca: '19:30:00' }, TERAZ));
    expect(l).toContain('DTEND;TZID=Europe/Warsaw:20260107T193000');
  });
});

describe('zbudujIcs — UID', () => {
  it('bierze się z id meczu, więc ponowne pobranie AKTUALIZUJE wpis', () => {
    const a = linie(zbudujIcs(MECZ, TERAZ)).find((x) => x.startsWith('UID:'));
    const b = linie(zbudujIcs({ ...MECZ, godzina: '20:00' }, TERAZ)).find((x) => x.startsWith('UID:'));
    expect(a).toBe('UID:bojo-abc-123@bojo.pl');
    // Ta sama wartość mimo innej godziny — inaczej kalendarz pokazałby dwa
    // mecze i żadnej wskazówki, który jest prawdziwy.
    expect(b).toBe(a);
  });
});

describe('zbudujIcs — escapowanie tekstu (RFC 5545 §3.3.11)', () => {
  it('ucieka przecinek w adresie — bez tego wartość dzieli się na dwie', () => {
    const l = linie(zbudujIcs({ ...MECZ, miejsce: 'Rataje, ul. Piastowska 3' }, TERAZ));
    expect(l).toContain('LOCATION:Rataje\\, ul. Piastowska 3');
  });

  it('ucieka średnik, ukośnik i złamanie linii w opisie', () => {
    const ics = zbudujIcs({ ...MECZ, opis: 'a;b\\c\nd' }, TERAZ);
    const opis = linie(ics).find((x) => x.startsWith('DESCRIPTION:'))!;
    expect(opis).toContain('a\\;b\\\\c\\nd');
  });

  it('nie podwaja ukośników wstawionych przez własne escapowanie', () => {
    const ics = zbudujIcs({ ...MECZ, tytul: 'Mecz, wieczorny' }, TERAZ);
    expect(linie(ics)).toContain('SUMMARY:Mecz\\, wieczorny');
  });

  it('adres strony meczu jedzie w opisie, nie tylko w polu URL', () => {
    const opis = linie(zbudujIcs(MECZ, TERAZ)).find((x) => x.startsWith('DESCRIPTION:'))!;
    expect(opis).toContain('https://bojo.pl/wydarzenia/abc-123');
  });

  it('mecz bez opisu ma w DESCRIPTION sam adres, bez pustych linii na przedzie', () => {
    const opis = linie(zbudujIcs({ ...MECZ, opis: null }, TERAZ)).find((x) => x.startsWith('DESCRIPTION:'))!;
    expect(opis).toBe('DESCRIPTION:https://bojo.pl/wydarzenia/abc-123');
  });
});

describe('zbudujIcs — zawijanie linii (RFC 5545 §3.1)', () => {
  const DLUGI = 'Ośrodek Przywodny Rataje — boisko piłkarskie pełnowymiarowe ze sztuczną nawierzchnią';

  it('żadna fizyczna linia nie przekracza 75 oktetów', () => {
    const ics = zbudujIcs({ ...MECZ, tytul: DLUGI, miejsce: DLUGI, opis: DLUGI }, TERAZ);
    const enc = new TextEncoder();
    for (const l of ics.split('\r\n')) {
      expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    }
  });

  it('po rozwinięciu zawinięć treść jest dokładnie ta sama', () => {
    const ics = zbudujIcs({ ...MECZ, miejsce: DLUGI }, TERAZ);
    expect(linie(ics)).toContain(`LOCATION:${DLUGI}`);
  });

  it('nie tnie znaku wielobajtowego w połowie', () => {
    // Sto „ż" to 200 bajtów — zawijanie trafi w środek pola wielokrotnie.
    const ics = zbudujIcs({ ...MECZ, tytul: 'ż'.repeat(100) }, TERAZ);
    expect(ics).not.toContain('�');
    expect(linie(ics)).toContain(`SUMMARY:${'ż'.repeat(100)}`);
  });
});

describe('nazwaPliku', () => {
  it('sprowadza polskie znaki do ASCII', () => {
    expect(nazwaPliku('Piłka nożna 7v7')).toBe('pilka-nozna-7v7.ics');
  });

  it('nie zostawia znaków, które psują nazwy plików', () => {
    expect(nazwaPliku('Mecz: 18:00 / orlik?')).toBe('mecz-18-00-orlik.ics');
  });

  it('pusty tytuł ma sensowną nazwę zamiast samego rozszerzenia', () => {
    expect(nazwaPliku('???')).toBe('mecz.ics');
  });
});
