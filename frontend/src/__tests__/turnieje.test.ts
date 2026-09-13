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
  it('mapuje każdy stan na właściwą zakładkę', () => {
    expect(domyslnaZakladka('szkic')).toBe('info');
    expect(domyslnaZakladka('zapisy')).toBe('info');
    expect(domyslnaZakladka('zamkniete_zapisy')).toBe('druzyny');
    expect(domyslnaZakladka('trwa')).toBe('terminarz');
    expect(domyslnaZakladka('zakonczony')).toBe('tabela');
    expect(domyslnaZakladka('odwolany')).toBe('tabela');
  });
});
