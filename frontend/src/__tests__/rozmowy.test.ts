import { describe, it, expect } from 'vitest';
import { polaczRozmowy, policzNieprzeczytane, najswiezszaNieprzeczytana } from '@/lib/rozmowy';
import type { RozmowaNaLiscie } from '@/lib/comments';

function r(id: string, najnowsza: string, ile = 0, tytul = id): RozmowaNaLiscie {
  return { id, tytul, ile, najnowsza, ostatnia: 'cześć', autor: 'Marek', moja: false };
}

describe('polaczRozmowy', () => {
  it('układa wszystkie trzy rodzaje od najnowszej', () => {
    const wynik = polaczRozmowy(
      [r('m1', '2026-08-20T10:00:00Z')],
      [r('g1', '2026-08-22T10:00:00Z')],
      [r('d1', '2026-08-21T10:00:00Z')],
    );
    expect(wynik.map((w) => w.id)).toEqual(['g1', 'd1', 'm1']);
  });

  // TO JEST SEDNO ZMIANY. Mecz prowadził wcześniej na
  // `/wydarzenia/[id]?tab=rozmowa`, a ekipa na `/grupy/[id]?tab=tablica` —
  // czyli dotknięcie rozmowy wyrzucało z komunikatora na stronę meczu albo
  // ekipy, z paskiem zakładek i zarządzaniem, a „wstecz" wracało stamtąd na
  // `/grupy` zamiast do listy rozmów. Wszystkie trzy zostają pod `/rozmowy`.
  it('wszystkie adresy zostają w komunikatorze', () => {
    const wynik = polaczRozmowy([r('m1', '2026-08-20T10:00:00Z')], [r('g1', '2026-08-19T10:00:00Z')], [r('d1', '2026-08-18T10:00:00Z')]);
    const href = Object.fromEntries(wynik.map((w) => [w.typ, w.href]));
    expect(href.mecz).toBe('/rozmowy/mecz/m1');
    expect(href.grupa).toBe('/rozmowy/grupa/g1');
    expect(href.dm).toBe('/rozmowy/d1');
    expect(wynik.every((w) => w.href.startsWith('/rozmowy/'))).toBe(true);
  });

  it('rozmowy prywatne są opcjonalne', () => {
    expect(polaczRozmowy([], [])).toEqual([]);
  });
});

describe('policzNieprzeczytane', () => {
  // Liczy WIADOMOŚCI, nie rozmowy. Plakietka w nawigacji pokazywała wcześniej
  // liczbę MECZÓW z nieprzeczytanymi (`nieprzeczytaneWMeczach`), a nagłówek
  // ekranu rozmów sumę wiadomości — dwie różne liczby dla tej samej rzeczy.
  it('sumuje wiadomości, nie rozmowy', () => {
    const wpisy = polaczRozmowy(
      [r('m1', '2026-08-20T10:00:00Z', 3)],
      [r('g1', '2026-08-19T10:00:00Z', 2)],
      [r('d1', '2026-08-18T10:00:00Z', 1)],
    );
    expect(policzNieprzeczytane(wpisy)).toBe(6);
  });

  // Rozmowy prywatne nie były wcześniej sprawdzane W OGÓLE — wskaźnik nie
  // zapalał się od DM-a, choć DM jest jedyną wiadomością skierowaną wprost
  // do jednej osoby.
  it('liczy też rozmowy prywatne', () => {
    const wpisy = polaczRozmowy([], [], [r('d1', '2026-08-18T10:00:00Z', 4)]);
    expect(policzNieprzeczytane(wpisy)).toBe(4);
  });

  it('bez nieprzeczytanych daje zero', () => {
    expect(policzNieprzeczytane(polaczRozmowy([r('m1', '2026-08-20T10:00:00Z')], []))).toBe(0);
  });
});

describe('najswiezszaNieprzeczytana', () => {
  it('bierze najświeższą danego rodzaju, pomijając przeczytane', () => {
    const wpisy = polaczRozmowy(
      [r('m1', '2026-08-22T10:00:00Z', 0, 'Stary mecz'), r('m2', '2026-08-21T10:00:00Z', 2, 'Środowa gierka')],
      [r('g1', '2026-08-23T10:00:00Z', 1, 'Ekipa z Rataj')],
    );
    expect(najswiezszaNieprzeczytana(wpisy, 'mecz')?.tytul).toBe('Środowa gierka');
    expect(najswiezszaNieprzeczytana(wpisy, 'grupa')?.tytul).toBe('Ekipa z Rataj');
  });

  it('oddaje null, gdy nic nieprzeczytanego tego rodzaju nie ma', () => {
    const wpisy = polaczRozmowy([r('m1', '2026-08-22T10:00:00Z', 1)], []);
    expect(najswiezszaNieprzeczytana(wpisy, 'grupa')).toBeNull();
  });
});
