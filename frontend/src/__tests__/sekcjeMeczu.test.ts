import { describe, it, expect } from 'vitest';
import { sekcjeRozwiniete, godzinDoMeczu, type StanMeczu } from '@/lib/sekcjeMeczu';

const spokojny: StanMeczu = {
  godzinDoMeczu: 72, poMeczu: false, odwolany: false,
  zarzadza: false, prosbyDoDecyzji: 0,
  druzynyOpublikowane: false, propozycjeSkladu: 0,
  platny: false, zalegam: false, ktosNieOddal: false,
  wynikBrakuje: true,
};

describe('które sekcje są rozwinięte na wejściu', () => {
  it('mecz za tydzień, nic do zrobienia — wszystko zwinięte', () => {
    expect(sekcjeRozwiniete(spokojny).size).toBe(0);
  });

  it('opublikowane składy rozwijają Drużyny KAŻDEMU', () => {
    // Sedno poprzedniej wady: zakładka „Taktyka" pokazywała się dopiero komuś,
    // kto MA już drużynę — więc gracz, który nie wiedział, w której jest,
    // nie miał jak sprawdzić.
    expect(sekcjeRozwiniete({ ...spokojny, druzynyOpublikowane: true }).has('druzyny')).toBe(true);
  });

  it('propozycja składu od gracza rozwija Drużyny ORGANIZATOROWI', () => {
    const s = { ...spokojny, zarzadza: true, propozycjeSkladu: 1 };
    expect(sekcjeRozwiniete(s).has('druzyny')).toBe(true);
    // …i tylko jemu: gracz nie ma tu nic do zdecydowania.
    expect(sekcjeRozwiniete({ ...s, zarzadza: false }).has('druzyny')).toBe(false);
  });

  it('dobę przed meczem bez składów organizator dostaje Drużyny', () => {
    expect(sekcjeRozwiniete({ ...spokojny, zarzadza: true, godzinDoMeczu: 12 }).has('druzyny')).toBe(true);
    expect(sekcjeRozwiniete({ ...spokojny, zarzadza: true, godzinDoMeczu: 48 }).has('druzyny')).toBe(false);
  });

  it('Kasa rozwija się TYLKO temu, kto zalega — nie każdemu na płatnym meczu', () => {
    const platny = { ...spokojny, platny: true, godzinDoMeczu: 5 };
    expect(sekcjeRozwiniete(platny).has('kasa')).toBe(false);
    expect(sekcjeRozwiniete({ ...platny, zalegam: true }).has('kasa')).toBe(true);
  });

  it('po meczu organizator dostaje Wynik i Kasę, gdy ktoś nie oddał', () => {
    const po = {
      ...spokojny, zarzadza: true, poMeczu: true, godzinDoMeczu: -3,
      platny: true, ktosNieOddal: true, wynikBrakuje: true,
    };
    const otwarte = sekcjeRozwiniete(po);
    expect(otwarte.has('wynik')).toBe(true);
    expect(otwarte.has('kasa')).toBe(true);
  });

  it('wpisany wynik nie rozwija już niczego', () => {
    const po = { ...spokojny, zarzadza: true, poMeczu: true, godzinDoMeczu: -3, wynikBrakuje: false };
    expect(sekcjeRozwiniete(po).has('wynik')).toBe(false);
  });

  it('Ustawienia nie rozwijają się NIGDY', () => {
    // To nie jest decyzja, która na Ciebie czeka — to szuflada.
    const wszystko: StanMeczu = {
      ...spokojny, zarzadza: true, poMeczu: true, godzinDoMeczu: -1,
      druzynyOpublikowane: true, propozycjeSkladu: 3,
      platny: true, zalegam: true, ktosNieOddal: true,
    };
    expect(sekcjeRozwiniete(wszystko).has('ustawienia')).toBe(false);
  });

  it('odwołany mecz nie rozwija niczego — nie ma decyzji do podjęcia', () => {
    const odwolany: StanMeczu = {
      ...spokojny, odwolany: true, zarzadza: true, poMeczu: true,
      druzynyOpublikowane: true, platny: true, zalegam: true, ktosNieOddal: true,
    };
    expect(sekcjeRozwiniete(odwolany).size).toBe(0);
  });
});

describe('godzinDoMeczu', () => {
  const teraz = new Date(2026, 7, 22, 12, 0).getTime();

  it('liczy godziny do rozpoczęcia', () => {
    expect(godzinDoMeczu('2026-08-22', '18:00', teraz)).toBeCloseTo(6, 5);
  });

  it('mecz, który był, ma wartość ujemną', () => {
    expect(godzinDoMeczu('2026-08-22', '09:00', teraz)).toBeCloseTo(-3, 5);
  });

  it('zepsuta data nie wywraca strony, tylko zachowuje się jak odległy mecz', () => {
    expect(godzinDoMeczu('', null, teraz)).toBe(Number.POSITIVE_INFINITY);
  });
});
