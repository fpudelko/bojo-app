import { describe, expect, it } from 'vitest';
import { miejscaWTabeli, maRemisWTabeli, zastosujKolejnoscReczna } from '@/lib/turniejTabela';
import { podiumTurnieju, tekstPodium } from '@/lib/turniejPodium';
import type { WierszTabeli } from '@/types';

const w = (druzynaId: string, punkty: number, zd = 1, st = 1, reczny = false): WierszTabeli => ({
  druzynaId, nazwa: druzynaId, mecze: 2, wygrane: 1, remisy: 0, przegrane: 1,
  bramkiZdobyte: zd, bramkiStracone: st, roznica: zd - st, punkty, rozstrzygnietyRecznie: reczny,
});

// Grupa finałowa w Luboniu (2026-11-21): trzy drużyny, 3 pkt, 1:1 każda.
const lubon = [w('AFC Poznań', 3), w('Natanael i Przyjaciele', 3), w('Niedźwiedzie FC', 3)];

describe('remis w tabeli', () => {
  it('identyczny bilans = to samo miejsce', () => {
    expect(miejscaWTabeli(lubon)).toEqual([1, 1, 1]);
    expect(maRemisWTabeli(lubon)).toBe(true);
    expect(miejscaWTabeli([w('A', 6), w('B', 3), w('C', 3), w('D', 0)])).toEqual([1, 2, 2, 4]);
  });

  it('podium z remisu: wszyscy ex aequo, nikt nie dostaje srebra alfabetem', () => {
    const p = podiumTurnieju([], new Map(), lubon);
    expect(p.map((m) => [m.miejsce, m.exAequo])).toEqual([[1, true], [1, true], [1, true]]);
    expect(tekstPodium('Gramy dla Marysi', p, 'https://bojo.pl/x')).toContain('🥇 AFC Poznań (ex aequo)');
  });

  it('kolejność organizatora rozstrzyga remis', () => {
    const t = zastosujKolejnoscReczna(lubon, ['Niedźwiedzie FC', 'AFC Poznań', 'Natanael i Przyjaciele']);
    expect(t.map((x) => x.druzynaId)).toEqual(['Niedźwiedzie FC', 'AFC Poznań', 'Natanael i Przyjaciele']);
    expect(miejscaWTabeli(t)).toEqual([1, 2, 3]);
    const p = podiumTurnieju([], new Map(), t);
    expect(p.map((m) => [m.nazwa, m.miejsce, m.exAequo])).toEqual([
      ['Niedźwiedzie FC', 1, false], ['AFC Poznań', 2, false], ['Natanael i Przyjaciele', 3, false],
    ]);
  });

  it('kolejność częściowa: wybrani na górze, reszta liczona za nimi', () => {
    const t = zastosujKolejnoscReczna([w('A', 6), w('B', 3), w('C', 3)], ['C']);
    expect(t.map((x) => x.druzynaId)).toEqual(['C', 'A', 'B']);
  });
});
