// Faza po grupach (migracja 175): grupa finałowa i drabinka z miejsc w grupach.
// Wzór: turniej „Gramy dla Marysi" (Luboń, 28.11.2026) — trzy grupy po pięć
// drużyn, zwycięzcy grup grają każdy z każdym w grupie finałowej F.
import { describe, expect, it } from 'vitest';
import {
  drabinkaZGrup, grupaFinalowaZGrup, meczeKazdyZKazdym, nazwaMiejscaWGrupie,
} from '@/lib/turniejFormat';
import { porownajTermin, przerwaPrzedMeczem } from '@/lib/turniejEtykiety';

const licznik = () => { let n = 0; return () => `m${++n}`; };
const GRUPY = [{ id: 'gA', nazwa: 'A' }, { id: 'gB', nazwa: 'B' }, { id: 'gC', nazwa: 'C' }];

describe('grupaFinalowaZGrup', () => {
  it('Luboń: 3 grupy po 5 + finałowa z trzech zwycięzców = 33 mecze', () => {
    const noweId = licznik();
    let numer = 1;
    const grupowe = GRUPY.flatMap((g) => {
      const druzyny = [1, 2, 3, 4, 5].map((i) => `${g.id}-d${i}`);
      const czesc = meczeKazdyZKazdym(druzyny, { startNumer: numer, grupaId: g.id, noweId });
      numer += czesc.length;
      return czesc;
    });
    expect(grupowe).toHaveLength(30);
    const finalowe = grupaFinalowaZGrup(GRUPY, 'gF', {
      startNumer: numer, startKolejka: 6, awansuje: 1, noweId,
    });
    expect(finalowe).toHaveLength(3);
    expect(grupowe.length + finalowe.length).toBe(33);
    for (const m of finalowe) {
      expect(m.grupaId).toBe('gF');
      expect(m.faza).toBe('grupa');
      expect(m.druzynaAId).toBeUndefined();
      expect(m.druzynaBId).toBeUndefined();
      expect(m.zrodloAMiejsce).toBe(1);
      expect(m.zrodloBMiejsce).toBe(1);
      expect(m.kolejka).toBeGreaterThanOrEqual(6);
    }
    // Każda para zwycięzców gra dokładnie raz.
    const pary = finalowe.map((m) => [m.zrodloAGrupaId, m.zrodloBGrupaId].sort().join('-')).sort();
    expect(pary).toEqual(['gA-gB', 'gA-gC', 'gB-gC']);
    expect(finalowe.map((m) => m.numer)).toEqual([31, 32, 33]);
  });
});

describe('drabinkaZGrup', () => {
  it('2 grupy × 2: półfinały na krzyż, bez rewanżu z grupy', () => {
    const mecze = drabinkaZGrup(GRUPY.slice(0, 2), {
      startNumer: 13, startKolejka: 4, awansuje: 2, noweId: licznik(),
    });
    expect(mecze).toHaveLength(3);
    const polfinaly = mecze.filter((m) => m.faza === 'polfinal');
    expect(polfinaly).toHaveLength(2);
    for (const m of polfinaly) {
      expect(m.zrodloAGrupaId).not.toBe(m.zrodloBGrupaId);
      expect(m.zrodloAMiejsce! + m.zrodloBMiejsce!).toBe(3);
      expect(m.kolejka).toBe(4);
    }
    const final = mecze.find((m) => m.faza === 'final')!;
    expect(final.zrodloAMeczId).toBe(polfinaly[0].id);
    expect(final.kolejka).toBe(5);
    expect(mecze.map((m) => m.numer)).toEqual([13, 14, 15]);
  });

  it('3 grupy × 2: wolne losy nie są meczami, miejsce z grupy wchodzi wprost do półfinału', () => {
    const mecze = drabinkaZGrup(GRUPY, { startNumer: 1, startKolejka: 1, awansuje: 2, noweId: licznik() });
    // 6 drużyn w drabince na 8: dwa ćwierćfinały do rozegrania, dwa wolne losy.
    expect(mecze.filter((m) => m.faza === 'cwierc')).toHaveLength(2);
    expect(mecze.some((m) => m.status === 'walkower')).toBe(false);
    const polfinaly = mecze.filter((m) => m.faza === 'polfinal');
    const zGrupyWprost = polfinaly.flatMap((m) => [m.zrodloAGrupaId, m.zrodloBGrupaId]).filter(Boolean);
    expect(zGrupyWprost).toHaveLength(2);
    // Żaden ćwierćfinał nie jest rewanżem z grupy.
    for (const m of mecze.filter((x) => x.faza === 'cwierc')) {
      expect(m.zrodloAGrupaId).not.toBe(m.zrodloBGrupaId);
    }
    // Nigdzie nie zostało odwołanie do usuniętego wolnego losu.
    const ids = new Set(mecze.map((m) => m.id));
    for (const m of mecze) {
      if (m.zrodloAMeczId) expect(ids.has(m.zrodloAMeczId)).toBe(true);
      if (m.zrodloBMeczId) expect(ids.has(m.zrodloBMeczId)).toBe(true);
      expect(m.druzynaAId).toBeUndefined();
      expect(m.druzynaBId).toBeUndefined();
    }
    expect(mecze.map((m) => m.numer)).toEqual(mecze.map((_, i) => i + 1));
  });
});

describe('nazwaMiejscaWGrupie', () => {
  it('pierwsze miejsce to zwycięzca, dalsze z numerem', () => {
    expect(nazwaMiejscaWGrupie('A', 1)).toBe('Zwycięzca A');
    expect(nazwaMiejscaWGrupie('B', 2)).toBe('2. miejsce B');
  });
});

describe('kolejność i przerwy w ręcznym harmonogramie', () => {
  // 12:26 → mecz do 12:38, przerwa (konkurs), następny o 13:00.
  const m = (numer: number, godzina?: string) => ({
    numer,
    zaplanowanyAt: godzina ? new Date(`2026-11-28T${godzina}:00+01:00`).toISOString() : undefined,
  });

  it('sortuje po godzinie, numer rozstrzyga remis, bez godziny na końcu', () => {
    const lista = [m(24, '14:10'), m(25), m(23, '13:56'), m(22, '13:56')].sort(porownajTermin);
    expect(lista.map((x) => x.numer)).toEqual([22, 23, 24, 25]);
  });

  it('pokazuje przerwę tylko przy wyraźnie dłuższym odstępie', () => {
    const opcje = { czasMeczuMin: 12, przerwaMin: 2 };
    expect(przerwaPrzedMeczem(m(1, '12:12'), m(2, '12:26'), opcje)).toBeNull();
    expect(przerwaPrzedMeczem(m(2, '12:26'), m(3, '13:00'), opcje)).toEqual({ od: '12:38', do: '13:00' });
    expect(przerwaPrzedMeczem(undefined, m(1, '08:30'), opcje)).toBeNull();
  });
});
