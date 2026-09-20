import { describe, it, expect } from 'vitest';
import { szacunekZParametrow, zdanieOCzasie } from '@/lib/turniejKreator';

// Wyliczenie czasu w kreatorze odpala PRAWDZIWE generatory na atrapach drużyn,
// więc te testy pilnują nie tylko wzoru, ale i tego, że kreator mówi to samo,
// co pokaże później terminarz.

const baza = {
  liczbaAren: 2,
  czasMeczuMin: 10,
  przerwaMin: 5,
  dataStartu: '2026-10-18',
  godzinaStartu: '10:00',
};

describe('szacunekZParametrow — liczba meczów zgadza się z formatem', () => {
  it('liga: każdy z każdym', () => {
    // 6 drużyn → 6·5/2 = 15 meczów.
    expect(szacunekZParametrow({ ...baza, format: 'liga', liczbaDruzyn: 6 }).liczbaMeczow).toBe(15);
  });

  it('puchar: n-1 meczów przy potędze dwójki', () => {
    expect(szacunekZParametrow({ ...baza, format: 'puchar', liczbaDruzyn: 8 }).liczbaMeczow).toBe(7);
  });

  it('puchar z meczem o 3. miejsce ma jeden mecz więcej', () => {
    const bez = szacunekZParametrow({ ...baza, format: 'puchar', liczbaDruzyn: 8 });
    const z = szacunekZParametrow({ ...baza, format: 'puchar', liczbaDruzyn: 8, meczO3Miejsce: true });
    expect(z.liczbaMeczow).toBe(bez.liczbaMeczow + 1);
  });

  it('grupy → puchar: faza grupowa plus drabinka awansujących', () => {
    // 8 drużyn → 2 grupy po 4 (po 6 meczów = 12) + drabinka 4 drużyn (3 mecze).
    expect(szacunekZParametrow({ ...baza, format: 'grupy_puchar', liczbaDruzyn: 8 }).liczbaMeczow).toBe(15);
  });

  it('więcej awansujących = większa drabinka', () => {
    const dwa = szacunekZParametrow({ ...baza, format: 'grupy_puchar', liczbaDruzyn: 8, awansujeZGrupy: 2 });
    const jeden = szacunekZParametrow({ ...baza, format: 'grupy_puchar', liczbaDruzyn: 8, awansujeZGrupy: 1 });
    expect(dwa.liczbaMeczow).toBeGreaterThan(jeden.liczbaMeczow);
  });

  it('poniżej dwóch drużyn nie ma czego liczyć', () => {
    expect(szacunekZParametrow({ ...baza, format: 'liga', liczbaDruzyn: 1 }).liczbaMeczow).toBe(0);
    expect(szacunekZParametrow({ ...baza, format: 'liga', liczbaDruzyn: 0 }).liczbaMeczow).toBe(0);
  });
});

describe('szacunekZParametrow — czas i godzina końca', () => {
  it('więcej boisk skraca turniej', () => {
    const jedno = szacunekZParametrow({ ...baza, liczbaAren: 1, format: 'liga', liczbaDruzyn: 6 });
    const dwa = szacunekZParametrow({ ...baza, liczbaAren: 2, format: 'liga', liczbaDruzyn: 6 });
    expect(dwa.czasCalkowityMin).toBeLessThan(jedno.czasCalkowityMin);
  });

  it('podaje godzinę ostatniego gwizdka', () => {
    const s = szacunekZParametrow({ ...baza, format: 'grupy_puchar', liczbaDruzyn: 8 });
    expect(s.koniecGodzina).toMatch(/^\d{2}:\d{2}$/);
    expect(s.poZmroku).toBe(false);
  });

  it('bez daty startu nie zmyśla godziny', () => {
    const s = szacunekZParametrow({
      format: 'liga', liczbaDruzyn: 6, liczbaAren: 2, czasMeczuMin: 10, przerwaMin: 5,
    });
    expect(s.koniecGodzina).toBeUndefined();
    expect(s.czasCalkowityMin).toBeGreaterThan(0);
  });

  it('turniej nie mieszczący się w dobie melduje to zamiast podawać godzinę', () => {
    const s = szacunekZParametrow({
      ...baza, format: 'liga', liczbaDruzyn: 24, liczbaAren: 1, czasMeczuMin: 90, przerwaMin: 30,
    });
    expect(s.poZmroku).toBe(true);
    expect(s.koniecGodzina).toBeUndefined();
  });
});

describe('zdanieOCzasie', () => {
  it('mówi liczbą meczów, czasem i godziną', () => {
    const s = szacunekZParametrow({ ...baza, format: 'grupy_puchar', liczbaDruzyn: 8 });
    const zdanie = zdanieOCzasie(s);
    expect(zdanie).toContain('15 meczów');
    expect(zdanie).toContain('ostatni gwizdek');
  });

  it('bez drużyn prosi o drużyny, nie pokazuje zera', () => {
    const s = szacunekZParametrow({ ...baza, format: 'liga', liczbaDruzyn: 1 });
    expect(zdanieOCzasie(s)).toContain('dwie drużyny');
  });

  it('turniej ponad dobę mówi wprost, że się nie zmieści', () => {
    const s = szacunekZParametrow({
      ...baza, format: 'liga', liczbaDruzyn: 24, liczbaAren: 1, czasMeczuMin: 90, przerwaMin: 30,
    });
    expect(zdanieOCzasie(s)).toContain('nie zmieści się w jednym dniu');
  });

  it('odmienia „mecz" przez liczbę', () => {
    expect(zdanieOCzasie(szacunekZParametrow({ ...baza, format: 'puchar', liczbaDruzyn: 2 }))).toContain('1 mecz ');
    expect(zdanieOCzasie(szacunekZParametrow({ ...baza, format: 'puchar', liczbaDruzyn: 4 }))).toContain('3 mecze');
  });
});
