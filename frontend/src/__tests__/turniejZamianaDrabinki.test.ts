import { describe, expect, it } from 'vitest';
import { zbudujDrabinke, zamienDruzynyWDrabince } from '@/lib/turniejFormat';

// Ręczna zmiana par w 1. rundzie pucharu (2026-11-08): zamiana tylko między
// zajętymi miejscami, wolny los dostaje nowego zwycięzcę.
const drabinka = (n: number) => {
  let i = 0;
  return zbudujDrabinke(Array.from({ length: n }, (_, k) => `d${k + 1}`), { startNumer: 1, noweId: () => `m${++i}` });
};

describe('zamienDruzynyWDrabince', () => {
  it('zamienia dwie drużyny z różnych meczów', () => {
    const mecze = drabinka(4);
    const [a, b] = mecze;
    const po = zamienDruzynyWDrabince(mecze, { meczId: a.id, strona: 'a' }, { meczId: b.id, strona: 'b' });
    expect(po[0].druzynaAId).toBe(b.druzynaBId);
    expect(po[1].druzynaBId).toBe(a.druzynaAId);
    expect(mecze[0].druzynaAId).toBe(a.druzynaAId); // wejście nietknięte
  });

  it('drużyna wstawiona na wolny los staje się jego zwycięzcą', () => {
    const mecze = drabinka(3);
    const los = mecze.find((m) => m.status === 'walkower')!;
    const zwykly = mecze.find((m) => m.kolejka === 1 && m.status !== 'walkower')!;
    const stronaLosu = los.druzynaAId ? 'a' : 'b';
    const po = zamienDruzynyWDrabince(mecze, { meczId: los.id, strona: stronaLosu }, { meczId: zwykly.id, strona: 'a' });
    const losPo = po.find((m) => m.id === los.id)!;
    expect(losPo.zwyciezcaId).toBe(zwykly.druzynaAId);
    expect(losPo.walkowerDla).toBe(zwykly.druzynaAId);
  });

  it('nie zamienia z pustym miejscem ani w meczach późniejszych rund', () => {
    const mecze = drabinka(3);
    const los = mecze.find((m) => m.status === 'walkower')!;
    const pustaStrona = los.druzynaAId ? 'b' : 'a';
    const zwykly = mecze.find((m) => m.kolejka === 1 && m.status !== 'walkower')!;
    expect(zamienDruzynyWDrabince(mecze, { meczId: los.id, strona: pustaStrona }, { meczId: zwykly.id, strona: 'a' })).toEqual(mecze);
    const final = mecze.find((m) => m.faza === 'final')!;
    expect(zamienDruzynyWDrabince(mecze, { meczId: final.id, strona: 'a' }, { meczId: zwykly.id, strona: 'a' })).toEqual(mecze);
  });
});
