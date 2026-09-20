import { describe, it, expect } from 'vitest';
import { uprawnieniaTurnieju, przyjmujeZgloszenia, domyslnaZakladka } from '@/lib/turnieje';

describe('uprawnieniaTurnieju', () => {
  const turniej = { organizatorId: 'org-1' };

  it('organizator ma komplet uprawnień, choćby nie miał wiersza w turniej_osoby', () => {
    const u = uprawnieniaTurnieju(turniej, null, 'org-1');
    expect(u).toEqual({
      jestOrganizatorem: true, mozeEdytowac: true, mozeProwadzic: true, mozeZarzadzacDruzynami: true,
    });
  });

  it('obcy bez wiersza w turniej_osoby nie ma żadnego uprawnienia', () => {
    const u = uprawnieniaTurnieju(turniej, null, 'obcy-1');
    expect(u).toEqual({
      jestOrganizatorem: false, mozeEdytowac: false, mozeProwadzic: false, mozeZarzadzacDruzynami: false,
    });
  });

  it('niezalogowany (userId undefined) nie ma żadnego uprawnienia', () => {
    const u = uprawnieniaTurnieju(turniej, null, undefined);
    expect(u.jestOrganizatorem).toBe(false);
    expect(u.mozeEdytowac).toBe(false);
  });

  it('mozeEdytowac implikuje pozostałe dwa, nawet gdy w bazie stoją na false', () => {
    const osoba = { userId: 'u1', mozeEdytowac: true, mozeProwadzic: false, mozeZarzadzacDruzynami: false };
    const u = uprawnieniaTurnieju(turniej, osoba, 'u1');
    expect(u).toEqual({
      jestOrganizatorem: false, mozeEdytowac: true, mozeProwadzic: true, mozeZarzadzacDruzynami: true,
    });
  });

  it('prowadzący z samym moze_prowadzic nie dostaje pozostałych uprawnień', () => {
    const osoba = { userId: 'u1', mozeEdytowac: false, mozeProwadzic: true, mozeZarzadzacDruzynami: false };
    const u = uprawnieniaTurnieju(turniej, osoba, 'u1');
    expect(u).toEqual({
      jestOrganizatorem: false, mozeEdytowac: false, mozeProwadzic: true, mozeZarzadzacDruzynami: false,
    });
  });

  it('wiersz cudzej osoby (inny user_id) nie liczy się mimo obecności w tabeli', () => {
    const osoba = { userId: 'kolegs', mozeEdytowac: true, mozeProwadzic: true, mozeZarzadzacDruzynami: true };
    const u = uprawnieniaTurnieju(turniej, osoba, 'obcy');
    expect(u.mozeEdytowac).toBe(false);
  });
});

describe('przyjmujeZgloszenia', () => {
  it('true przy statusie zapisy i wolnych miejscach', () => {
    expect(przyjmujeZgloszenia({ status: 'zapisy', maxDruzyn: 8 }, 5)).toBe(true);
  });

  it('false przy komplecie drużyn, mimo statusu zapisy', () => {
    expect(przyjmujeZgloszenia({ status: 'zapisy', maxDruzyn: 8 }, 8)).toBe(false);
  });

  it('false, gdy status inny niż zapisy', () => {
    (['szkic', 'zamkniete_zapisy', 'trwa', 'zakonczony', 'odwolany'] as const).forEach((status) => {
      expect(przyjmujeZgloszenia({ status, maxDruzyn: 8 }, 2)).toBe(false);
    });
  });
});

describe('domyslnaZakladka', () => {
  const puste = { maMecze: false, maTabele: false };
  const pelne = { maMecze: true, maTabele: true };

  it('zapisy prowadzą na Info — tam człowiek z ulicy dowie się, co to za turniej', () => {
    expect(domyslnaZakladka('szkic', puste)).toBe('info');
    expect(domyslnaZakladka('zapisy', puste)).toBe('info');
    // Regresja S-11: strona twardo otwierała „Mecze", więc link udostępniony
    // w okresie zapisów lądował na „Terminarz jeszcze nie jest gotowy".
    expect(domyslnaZakladka('zapisy', pelne)).not.toBe('mecze');
  });

  it('po zamknięciu zapisów i w trakcie prowadzą na Mecze — gdy jest co pokazać', () => {
    expect(domyslnaZakladka('zamkniete_zapisy', pelne)).toBe('mecze');
    expect(domyslnaZakladka('trwa', pelne)).toBe('mecze');
  });

  it('bez terminarza żaden stan nie otwiera pustej zakładki Mecze', () => {
    expect(domyslnaZakladka('zamkniete_zapisy', puste)).toBe('druzyny');
    expect(domyslnaZakladka('trwa', puste)).toBe('druzyny');
  });

  it('zakończony prowadzi na Tabelę, a bez tabeli na Mecze', () => {
    expect(domyslnaZakladka('zakonczony', pelne)).toBe('tabela');
    expect(domyslnaZakladka('zakonczony', puste)).toBe('mecze');
  });

  it('odwołany prowadzi na Info — tam stoi powód i kontakt do organizatora', () => {
    expect(domyslnaZakladka('odwolany', pelne)).toBe('info');
  });
});

describe('przyjmujeZgloszenia — termin graniczny', () => {
  const baza = { status: 'zapisy', maxDruzyn: 8 } as const;

  it('zamyka zapisy po terminie, choć miejsca zostały', () => {
    expect(przyjmujeZgloszenia(
      { ...baza, zapisyDo: '2026-10-12T23:59:00Z' }, 3, new Date('2026-10-13T08:00:00Z'),
    )).toBe(false);
  });

  it('przed terminem przyjmuje', () => {
    expect(przyjmujeZgloszenia(
      { ...baza, zapisyDo: '2026-10-12T23:59:00Z' }, 3, new Date('2026-10-10T08:00:00Z'),
    )).toBe(true);
  });

  it('bez terminu zachowuje się jak dotąd', () => {
    expect(przyjmujeZgloszenia({ ...baza, zapisyDo: undefined }, 3, new Date('2030-01-01'))).toBe(true);
  });
});
