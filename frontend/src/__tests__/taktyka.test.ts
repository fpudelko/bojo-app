import { describe, it, expect } from 'vitest';
import {
  domyslneUstawienie, opisTaktyki, pozycjeZeSchematu, ustawieniaDlaSkladu,
  USTAWIENIA_PILKA,
} from '@/lib/taktyka';

describe('pozycjeZeSchematu', () => {
  it('daje tylu graczy, ile mówi schemat', () => {
    expect(pozycjeZeSchematu('1-4-4-2')).toHaveLength(11);
    expect(pozycjeZeSchematu('1-2-2')).toHaveLength(5);
    expect(pozycjeZeSchematu('1-4-2-3-1')).toHaveLength(11);
  });

  it('bramkarz stoi najniżej, napastnik najwyżej', () => {
    const p = pozycjeZeSchematu('1-4-4-2');
    expect(p[0].rola).toBe('BR');
    expect(p[0].y).toBeLessThan(p[p.length - 1].y);
    expect(p[p.length - 1].rola).toBe('NA');
  });

  it('pojedynczy gracz w linii staje na środku', () => {
    const p = pozycjeZeSchematu('1-2-1');
    expect(p[0].x).toBe(50);                       // bramkarz
    expect(p[p.length - 1].x).toBe(50);            // samotny napastnik
  });

  it('linia rozkłada się symetrycznie i nie dotyka krawędzi', () => {
    const czworka = pozycjeZeSchematu('1-4-4-2').filter((p) => p.rola === 'OB');
    expect(czworka.map((p) => p.x)).toEqual([12, 37, 63, 88]);
    // Margines po bokach istnieje po to, żeby nazwisko skrajnego gracza
    // mieściło się na boisku.
    expect(Math.min(...czworka.map((p) => p.x))).toBeGreaterThan(0);
    expect(Math.max(...czworka.map((p) => p.x))).toBeLessThan(100);
  });

  it('numery slotów są kolejne — na nich opiera się przypisanie graczy', () => {
    expect(pozycjeZeSchematu('1-3-2').map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ostatnia linia to zawsze atak, także przy pięciu liniach', () => {
    const p = pozycjeZeSchematu('1-4-2-3-1');
    expect(p[p.length - 1].rola).toBe('NA');
    // Środkowe linie to pomoc — bez tego 1-4-2-3-1 opisywałoby napastnika
    // jako pomocnika.
    expect(p.filter((x) => x.rola === 'PM')).toHaveLength(5);
  });

  it('śmieciowe wejście nie wywraca widoku', () => {
    expect(pozycjeZeSchematu('')).toEqual([]);
    expect(pozycjeZeSchematu('abc')).toEqual([]);
  });
});

describe('ustawieniaDlaSkladu', () => {
  it('proponuje ustawienia na dokładnie tylu graczy i o jednego więcej', () => {
    // O jednego więcej, bo w amatorskim meczu ktoś zawsze się spóźnia,
    // a ustawienie na siedmiu przy sześciu obecnych jest użyteczniejsze
    // niż pusta lista.
    const u = ustawieniaDlaSkladu('pilka-nozna', 5);
    expect(u.every((x) => x.ilu === 5 || x.ilu === 6)).toBe(true);
    expect(u.some((x) => x.schemat === '1-2-2')).toBe(true);
  });

  it('nigdy nie zwraca pustej listy — nawet przy absurdalnym składzie', () => {
    expect(ustawieniaDlaSkladu('pilka-nozna', 1).length).toBeGreaterThan(0);
    expect(ustawieniaDlaSkladu('pilka-nozna', 30).length).toBeGreaterThan(0);
  });

  it('siatkówka i koszykówka mają własne zestawy', () => {
    expect(ustawieniaDlaSkladu('siatkowka', 6)[0].schemat).toBe('3-3');
    expect(ustawieniaDlaSkladu('koszykowka', 5).some((u) => u.schemat === '2-3')).toBe(true);
  });
});

describe('domyslneUstawienie', () => {
  it('daje schemat, który da się od razu narysować', () => {
    const schemat = domyslneUstawienie('pilka-nozna', 7);
    expect(pozycjeZeSchematu(schemat).length).toBeGreaterThan(0);
  });
});

describe('katalog ustawień', () => {
  it('liczba graczy zgadza się z sumą linii w każdym schemacie', () => {
    // Test-strażnik: literówka w schemacie (np. '1-4-4-3' opisane jako 11)
    // rozjechałaby dobór ustawień do składu, a na boisku pojawiłaby się
    // pozycja, na której nikt nie stanie.
    for (const u of USTAWIENIA_PILKA) {
      const suma = u.schemat.split('-').reduce((a, b) => a + Number(b), 0);
      expect(suma, u.schemat).toBe(u.ilu);
    }
  });

  it('schematy się nie powtarzają', () => {
    const schematy = USTAWIENIA_PILKA.map((u) => u.schemat);
    expect(new Set(schematy).size).toBe(schematy.length);
  });
});

describe('opisTaktyki', () => {
  it('składa wybrane decyzje w jedno zdanie', () => {
    expect(opisTaktyki({ krycie: 'strefa', pressing: 'wysoki' })).toBe('Strefa · Od razu');
  });

  it('brak decyzji to pusty tekst, nie „undefined"', () => {
    expect(opisTaktyki({})).toBe('');
    expect(opisTaktyki(null)).toBe('');
  });
});
