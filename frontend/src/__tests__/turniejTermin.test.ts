import { describe, it, expect } from 'vitest';
import { bezSekund, etykietaTerminu, stanTurnieju } from '@/lib/turniejEtykiety';

// Termin i stan turnieju — dwie rzeczy, które przegląd modułu na żywo złapał
// jako sprzeczne same ze sobą.
//
// SKĄD TEN PLIK. To samo wydarzenie pokazywało się w trzech zapisach naraz:
// „środa, 9 września" na liście, „środa, 16 września · 10:00:00" w turnieju
// (z sekundami, bo `godzina_startu` to kolumna `time`) i „Środa 16.09, 18:00"
// na karcie meczu. Osobno: CZTERY turnieje miały plakietkę „Trwa", w tym jeden
// sprzed tygodnia i jeden, w którym został tylko finał — bo status czytano
// z kolumny, którą organizator przestawia ręcznie.

const DZIS = new Date(2026, 8, 16); // 16 września 2026, środa

describe('bezSekund', () => {
  it('ucina sekundy z kolumny `time`', () => {
    expect(bezSekund('10:00:00')).toBe('10:00');
    expect(bezSekund('18:30')).toBe('18:30');
  });
});

describe('etykietaTerminu', () => {
  it('„Dziś" i „Jutro" zamiast daty dla najbliższych dni', () => {
    expect(etykietaTerminu('2026-09-16', '18:00', DZIS)).toBe('Dziś, 18:00');
    expect(etykietaTerminu('2026-09-17', '10:00:00', DZIS)).toBe('Jutro, 10:00');
    expect(etykietaTerminu('2026-09-15', '10:00', DZIS)).toBe('Wczoraj, 10:00');
  });

  it('dalsze daty: skrót dnia, dzień, miesiąc — jeden zapis w całym module', () => {
    expect(etykietaTerminu('2026-09-20', '10:00:00', DZIS)).toBe('niedz. 20 września, 10:00');
  });

  it('bez godziny zwraca samą datę', () => {
    expect(etykietaTerminu('2026-09-20', undefined, DZIS)).toBe('niedz. 20 września');
  });

  it('nieczytelna data nie wywraca widoku', () => {
    expect(etykietaTerminu('bzdura', '10:00', DZIS)).toBe('bzdura, 10:00');
  });
});

describe('stanTurnieju', () => {
  const mecz = (status: string, zaplanowanyAt?: string, faza: 'grupa' | 'final' = 'grupa') =>
    ({ status, zaplanowanyAt, faza });

  it('decyzja organizatora wygrywa: odwołany i szkic', () => {
    expect(stanTurnieju({ format: 'liga' as const, status: 'odwolany', dataStartu: '2026-09-20' }, [], DZIS).label).toBe('Odwołany');
    expect(stanTurnieju({ format: 'liga' as const, status: 'szkic', dataStartu: '2026-09-20' }, [], DZIS).label).toBe('W przygotowaniu');
  });

  it('mecz w toku bije wszystko inne', () => {
    const stan = stanTurnieju({ format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-16' },
      [mecz('zakonczony'), mecz('trwa'), mecz('zaplanowany')], DZIS);
    expect(stan.label).toBe('Na żywo');
  });

  it('komplet rozegrany to koniec, choćby kolumna mówiła „trwa"', () => {
    // To jest dokładnie ten turniej sprzed tygodnia, który świecił „Trwa".
    const stan = stanTurnieju({ format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-09' },
      [mecz('zakonczony'), mecz('walkower')], DZIS);
    expect(stan.label).toBe('Zakończony');
  });

  it('końcówka turnieju nazywa się inaczej niż jego początek', () => {
    const koncowka = stanTurnieju({ format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-16' },
      [mecz('zakonczony'), mecz('zakonczony'), mecz('zaplanowany', '2026-09-16T19:00:00Z', 'final')], DZIS);
    expect(koncowka.label).toBe('Ostatnie mecze');
    expect(koncowka.szczegol).toBe('Finał dziś, 19:00');

    const poczatek = stanTurnieju({ format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-16' },
      [mecz('zaplanowany', '2026-09-16T10:00:00Z'), mecz('zaplanowany'), mecz('zaplanowany'), mecz('zaplanowany')], DZIS);
    expect(poczatek.label).toBe('Trwa');
  });

  it('zapisy mówią, kiedy start', () => {
    const stan = stanTurnieju({ format: 'liga' as const, status: 'zapisy', dataStartu: '2026-09-17' }, [], DZIS);
    expect(stan.label).toBe('Trwają zapisy');
    expect(stan.szczegol).toBe('Start jutro');
  });

  it('turniej bez terminarza nie udaje zakończonego', () => {
    // Pusty terminarz znaczy „jeszcze nie wygenerowano", a nie „wszystko rozegrane".
    expect(stanTurnieju({ format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-16' }, [], DZIS).label).toBe('Trwa');
  });
});

// Audyt 5 przeszedł pełny łuk turnieju i trafił na moment, w którym publiczna
// strona ogłaszała „Zakończony” tuż po fazie grupowej: wszystkie ISTNIEJĄCE
// mecze były rozegrane, bo drabinka jeszcze nie powstała. Kapitanowie czytali
// koniec turnieju przed ćwierćfinałem.
describe('stanTurnieju — grupy przed drabinką', () => {
  const rozegrany = (faza: 'grupa' | 'final') => ({ status: 'zakonczony', faza });

  it('grupy rozegrane, drabinki brak: to NIE jest koniec', () => {
    const stan = stanTurnieju(
      { format: 'grupy_puchar' as const, status: 'trwa', dataStartu: '2026-09-09' },
      [rozegrany('grupa'), rozegrany('grupa')], DZIS,
    );
    expect(stan.label).toBe('Grupy rozegrane');
    expect(stan.szczegol).toBe('Czeka na drabinkę');
  });

  it('gdy drabinka JUŻ jest i wszystko rozegrane, koniec jest końcem', () => {
    const stan = stanTurnieju(
      { format: 'grupy_puchar' as const, status: 'trwa', dataStartu: '2026-09-09' },
      [rozegrany('grupa'), rozegrany('final')], DZIS,
    );
    expect(stan.label).toBe('Zakończony');
  });

  it('liga nie czeka na żadną drabinkę, więc komplet to koniec', () => {
    const stan = stanTurnieju(
      { format: 'liga' as const, status: 'trwa', dataStartu: '2026-09-09' },
      [rozegrany('grupa')], DZIS,
    );
    expect(stan.label).toBe('Zakończony');
  });
});
