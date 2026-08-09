import { describe, it, expect } from 'vitest';
import {
  terminyWZakresie,
  patchDlaPozostalych,
  POLA_POZA_ZAKRESEM,
  ETYKIETY_ZAKRESU,
  type ZakresEdycji,
} from '@/lib/series';
import { dayOfWeekFromDate, dayOfWeekLabelFromDate } from '@/lib/recurring';
import type { EventCreate } from '@/types';

const DZIS = '2026-08-09';

// Seria cotygodniowa: dwa terminy rozegrane, jeden dzisiaj, dwa przyszłe.
const SERIA = [
  { id: 'a', date: '2026-07-26' },
  { id: 'b', date: '2026-08-02' },
  { id: 'c', date: '2026-08-09' }, // dzisiaj
  { id: 'd', date: '2026-08-16' },
  { id: 'e', date: '2026-08-23' },
];

const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe('terminyWZakresie', () => {
  it('„ten" zwraca wyłącznie edytowany termin', () => {
    expect(ids(terminyWZakresie(SERIA, 'd', 'ten', DZIS))).toEqual(['d']);
  });

  it('„cała seria" zwraca wszystkie terminy, także rozegrane', () => {
    expect(ids(terminyWZakresie(SERIA, 'd', 'cala-seria', DZIS)))
      .toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('„ten i przyszłe" pomija rozegrane', () => {
    expect(ids(terminyWZakresie(SERIA, 'c', 'ten-i-przyszle', DZIS)))
      .toEqual(['c', 'd', 'e']);
  });

  it('„ten i przyszłe" traktuje dzisiejszy termin jako przyszły', () => {
    // Mecz jest dzisiaj wieczorem — zmiana ceny musi go objąć, inaczej
    // organizator poprawia cenę „od teraz" i akurat ten mecz jej nie dostaje.
    expect(ids(terminyWZakresie(SERIA, 'a', 'ten-i-przyszle', DZIS))).toContain('c');
  });

  it('edytowany termin zostaje w zakresie, nawet gdy już się odbył', () => {
    // Organizator poprawia właśnie ten rozegrany termin — wypadnięcie go
    // z własnej edycji byłoby zaskoczeniem.
    const wynik = ids(terminyWZakresie(SERIA, 'b', 'ten-i-przyszle', DZIS));
    expect(wynik).toContain('b');
    expect(wynik).not.toContain('a'); // wcześniejszy rozegrany już nie
    expect(wynik).toEqual(['b', 'c', 'd', 'e']);
  });

  it('kolejność wstawiania nie ma znaczenia — liczy się data', () => {
    // Terminy bywają dopisywane ręcznie poza kolejnością (`/cykliczne/[id]`
    // pozwala wybrać dowolną datę), więc zakres nie może iść po pozycji w tablicy.
    const przetasowana = [SERIA[3], SERIA[0], SERIA[4], SERIA[2], SERIA[1]];
    expect(ids(terminyWZakresie(przetasowana, 'c', 'ten-i-przyszle', DZIS)).sort())
      .toEqual(['c', 'd', 'e']);
  });

  it('nieznane id daje pustą listę zamiast rzucać', () => {
    expect(terminyWZakresie(SERIA, 'nie-ma', 'cala-seria', DZIS)).toEqual([]);
  });

  it('każdy zakres ma etykietę do pokazania w modalu', () => {
    const zakresy: ZakresEdycji[] = ['ten', 'ten-i-przyszle', 'cala-seria'];
    for (const z of zakresy) {
      expect(ETYKIETY_ZAKRESU[z].tytul.length).toBeGreaterThan(0);
      expect(ETYKIETY_ZAKRESU[z].opis.length).toBeGreaterThan(0);
    }
  });
});

describe('patchDlaPozostalych — data nigdy nie idzie zbiorczo', () => {
  const patch = {
    sport: 'pilka-nozna',
    fieldName: 'Boisko A',
    date: '2026-09-01',
    time: '20:00',
    maxPlayers: 12,
    visibility: 'public',
    costGrosze: 2500,
  } as EventCreate;

  it('usuwa `date`', () => {
    expect('date' in patchDlaPozostalych(patch)).toBe(false);
  });

  it('zostawia resztę ustawień nietkniętą', () => {
    const wynik = patchDlaPozostalych(patch);
    expect(wynik).toMatchObject({
      sport: 'pilka-nozna', time: '20:00', maxPlayers: 12, costGrosze: 2500,
    });
  });

  it('nie mutuje wejścia', () => {
    patchDlaPozostalych(patch);
    expect(patch.date).toBe('2026-09-01');
  });

  it('lista pól poza zakresem zawiera `date`', () => {
    expect(POLA_POZA_ZAKRESEM).toContain('date');
  });
});

// Reguła powtarzania — ta sama arytmetyka, którą po stronie bazy robi
// `utworz_nalezne_terminy_serii()` (migracja 073). Trzymamy ją pod testem,
// bo pomyłka o jeden dzień jest tu niewidoczna gołym okiem.
describe('dzień tygodnia z daty (ISO: 1=Pon…7=Niedz)', () => {
  it('poniedziałek to 1, niedziela to 7', () => {
    expect(dayOfWeekFromDate('2026-08-10')).toBe(1); // pon
    expect(dayOfWeekFromDate('2026-08-16')).toBe(7); // niedz
  });

  it('nie zjeżdża o dzień przez strefę czasową', () => {
    // `new Date('2026-08-10')` parsuje jako UTC i w strefach ujemnych cofa się
    // o dobę. Dlatego `dayOfWeekFromDate` dokleja 'T00:00:00'.
    expect(dayOfWeekFromDate('2026-08-10')).toBe(1);
    expect(dayOfWeekFromDate('2026-01-01')).toBe(4); // czwartek
  });

  it('etykieta jest po polsku i z małej litery', () => {
    expect(dayOfWeekLabelFromDate('2026-08-10')).toBe('poniedziałek');
  });
});
