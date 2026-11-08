import { describe, it, expect } from 'vitest';
import {
  pulpitPrzedTurniejem, postepTurnieju, meczeDoWpisania, mozeRozpoczacTurniej,
} from '@/lib/turniejPulpit';
import type { TurniejMecz } from '@/types';

// Pulpit organizatora liczy stan dnia turnieju — jedynego stanu w tym module,
// którego nie da się obejrzeć bez czekania na sobotę. Dlatego „teraz" jest
// argumentem, a nie `new Date()` w środku.

const druzyna = (status: string, oplacone = false) =>
  ({ status, wpisoweOplaconeAt: oplacone ? '2026-10-01T10:00:00Z' : undefined }) as never;

const mecz = (n: Partial<TurniejMecz> = {}): TurniejMecz => ({
  id: `m${n.numer ?? 1}`, turniejId: 't1', numer: n.numer ?? 1, faza: 'grupa',
  status: 'zaplanowany', wynikA: 0, wynikB: 0, wynikRecznie: false,
  druzynaAId: 'dA', druzynaBId: 'dB',
  createdAt: '2026-10-01T08:00:00Z', ...n,
} as TurniejMecz);

describe('pulpitPrzedTurniejem', () => {
  const turniej = { maxDruzyn: 8, wpisoweGrosze: 10000 };

  it('liczy WYŁĄCZNIE przyjęte, a czekające pokazuje osobnym wierszem', () => {
    // Reguła jest wspólna z kafelkiem listy i ze stroną turnieju
    // (`liczDruzynyWTurnieju`), i od 2026-09-22 znaczy: przyjęte.
    //
    // Wcześniej liczyły się także czekające, żeby pulpit i kafelek nie
    // pokazywały dwóch różnych liczb. Spójność została, ale ceną było
    // kłamstwo w drugą stronę: „3 z 8" nie odróżniało turnieju prawie
    // pełnego od takiego, w którym przyjęte są dwie drużyny, a reszta
    // czeka na decyzję. Czekające mają własny wiersz, więc pulpit nic
    // nie traci — decyzja właściciela po audycie UX.
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta'), druzyna('przyjeta'), druzyna('zgloszona'), druzyna('odrzucona')],
      [],
      false,
    );
    expect(p.find((x) => x.klucz === 'druzyny')?.tekst).toBe('2 z 8 drużyn');
    expect(p.find((x) => x.klucz === 'zgloszenia')?.tekst).toBe('1 zgłoszenie czeka na decyzję');
  });

  it('wycofana i odrzucona zwalniają miejsce', () => {
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta'), druzyna('odrzucona'), druzyna('wycofana')],
      [],
      false,
    );
    expect(p.find((x) => x.klucz === 'druzyny')?.tekst).toBe('1 z 8 drużyn');
  });

  it('czekające zgłoszenia pokazują się osobno — to decyzja do podjęcia', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('zgloszona'), druzyna('zgloszona')], [], false);
    const poz = p.find((x) => x.klucz === 'zgloszenia');
    // Polski ma TRZY formy, a liczebnik odmienia też czasownik obok.
    // Uproszczenie do „1 zgłoszenie / N zgłoszeń" dawało „2 zgłoszeń czeka",
    // czyli błąd widoczny w panelu przy każdej drugiej drużynie (audyt 5).
    expect(poz?.tekst).toBe('2 zgłoszenia czekają na decyzję');
    expect(poz?.stan).toBe('uwaga');
  });

  it('nie wymyśla pozycji o zgłoszeniach, gdy żadne nie czeka', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('przyjeta')], [], false);
    expect(p.find((x) => x.klucz === 'zgloszenia')).toBeUndefined();
  });

  it('brak terminarza to stan „brak", nie ostrzeżenie', () => {
    expect(pulpitPrzedTurniejem(turniej, [], [], false).find((x) => x.klucz === 'terminarz')?.stan).toBe('brak');
    expect(pulpitPrzedTurniejem(turniej, [], [mecz()], false).find((x) => x.klucz === 'terminarz')?.stan).toBe('gotowe');
  });

  it('wpisowe i BLIK pokazują się TYLKO przy płatnym turnieju', () => {
    const darmowy = pulpitPrzedTurniejem({ maxDruzyn: 8, wpisoweGrosze: 0 }, [druzyna('przyjeta')], [], false);
    expect(darmowy.find((x) => x.klucz === 'wpisowe')).toBeUndefined();
    expect(darmowy.find((x) => x.klucz === 'blik')).toBeUndefined();
  });

  it('wpisowe liczy się względem PRZYJĘTYCH drużyn', () => {
    const p = pulpitPrzedTurniejem(
      turniej,
      [druzyna('przyjeta', true), druzyna('przyjeta'), druzyna('zgloszona', true)],
      [],
      true,
    );
    expect(p.find((x) => x.klucz === 'wpisowe')?.tekst).toBe('1 z 2 opłaciło wpisowe');
    expect(p.find((x) => x.klucz === 'wpisowe')?.stan).toBe('uwaga');
  });

  it('brak numeru BLIK mówi, co z tego wynika dla kapitanów', () => {
    const p = pulpitPrzedTurniejem(turniej, [druzyna('przyjeta')], [], false);
    expect(p.find((x) => x.klucz === 'blik')?.stan).toBe('brak');
    expect(p.find((x) => x.klucz === 'blik')?.tekst).toContain('kapitanowie');
  });
});

describe('postepTurnieju', () => {
  it('liczy wynik i walkower jako rozegrane, odwołanych nie liczy wcale', () => {
    const mecze = [
      mecz({ numer: 1, status: 'zakonczony' }),
      mecz({ numer: 2, status: 'walkower' }),
      mecz({ numer: 3, status: 'trwa' }),
      mecz({ numer: 4, status: 'zaplanowany' }),
      mecz({ numer: 5, status: 'odwolany' }),
    ];
    expect(postepTurnieju(mecze)).toEqual({ rozegrane: 2, wszystkie: 4 });
  });
});

describe('meczeDoWpisania', () => {
  it('najpierw mecze w toku, potem po numerze, bez meczów czekających na drużynę', () => {
    const mecze = [
      mecz({ numer: 3, status: 'zaplanowany' }),
      mecz({ numer: 1, status: 'zakonczony' }),
      mecz({ numer: 4, status: 'trwa' }),
      mecz({ numer: 2, status: 'zaplanowany' }),
      mecz({ numer: 5, status: 'zaplanowany', druzynaBId: undefined }),
    ];
    expect(meczeDoWpisania(mecze).map((m) => m.numer)).toEqual([4, 2, 3]);
  });

  it('godzina w terminarzu nie zmienia kolejności', () => {
    const mecze = [
      mecz({ numer: 2, status: 'zaplanowany', zaplanowanyAt: '2026-10-18T09:00:00Z' }),
      mecz({ numer: 1, status: 'zaplanowany', zaplanowanyAt: '2026-10-18T15:00:00Z' }),
    ];
    expect(meczeDoWpisania(mecze).map((m) => m.numer)).toEqual([1, 2]);
  });
});

describe('mozeRozpoczacTurniej', () => {
  it('wymaga terminarza', () => {
    expect(mozeRozpoczacTurniej({ status: 'zamkniete_zapisy' }, [])).toBe(false);
    expect(mozeRozpoczacTurniej({ status: 'zamkniete_zapisy' }, [{}])).toBe(true);
    expect(mozeRozpoczacTurniej({ status: 'zapisy' }, [{}])).toBe(true);
  });

  it('nie proponuje startu turnieju, który trwa, skończył się albo jest szkicem', () => {
    for (const status of ['szkic', 'trwa', 'zakonczony', 'odwolany'] as const) {
      expect(mozeRozpoczacTurniej({ status }, [{}])).toBe(false);
    }
  });
});
