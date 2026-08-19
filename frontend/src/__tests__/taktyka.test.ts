import { describe, it, expect } from 'vitest';
import {
  inicjaly, domyslneUstawienie, opisTaktyki, pozycjeZeSchematu, ustawieniaDlaSkladu,
  USTAWIENIA_PILKA, OPCJE_TAKTYKI, WARTOSC_INNE,
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
    expect(p[p.length - 1].rola).toBe('PN');
  });

  it('pozycja niesie STRONĘ boiska, nie samą linię', () => {
    // „OB" przy każdym obrońcy mówiło to samo, co i tak widać po wysokości
    // na boisku. Piłkarz mówi „lewy obrońca", więc tak samo mówi Bojo.
    expect(pozycjeZeSchematu('1-4-4-2').filter((x) => x.rola.endsWith('O')).map((x) => x.rola))
      .toEqual(['LO', 'ŚO', 'ŚO', 'PO']);
  });

  it('samotny napastnik nie ma strony — jest po prostu napastnikiem', () => {
    const p = pozycjeZeSchematu('1-4-2-3-1');
    expect(p[p.length - 1].rola).toBe('N');
    expect(p[p.length - 1].nazwa).toBe('Napastnik');
  });

  it('dwie linie pomocy dostają defensywną i ofensywną, jedna nie', () => {
    // Przy jednej linii pomocy dopisek D/O niczego nie rozróżnia, a wydłuża
    // skrót — więc go nie ma.
    const dwie = pozycjeZeSchematu('1-4-2-3-1').map((x) => x.rola);
    expect(dwie).toContain('LPD');
    expect(dwie).toContain('LPO');
    // Sprawdzamy dokładny zestaw, nie końcówki: „PO" to prawy OBROŃCA,
    // a „PPO" prawy pomocnik ofensywny — dopasowanie po końcówce myliłoby te
    // dwie pozycje.
    const jedna = pozycjeZeSchematu('1-4-4-2').filter((x) => x.nazwa.includes('pomocnik'));
    expect(jedna.map((x) => x.rola)).toEqual(['LP', 'ŚP', 'ŚP', 'PP']);
  });

  it('pojedynczy gracz w linii staje na środku', () => {
    const p = pozycjeZeSchematu('1-2-1');
    expect(p[0].x).toBe(50);                       // bramkarz
    expect(p[p.length - 1].x).toBe(50);            // samotny napastnik
  });

  it('dwóch w linii to lewy i prawy — bez środka', () => {
    expect(pozycjeZeSchematu('1-2-1').filter((x) => x.rola.endsWith('O')).map((x) => x.rola))
      .toEqual(['LO', 'PO']);
  });

  it('linia rozkłada się symetrycznie i nie dotyka krawędzi', () => {
    const czworka = pozycjeZeSchematu('1-4-4-2').filter((p) => p.rola.endsWith('O'));
    expect(czworka.map((p) => p.x)).toEqual([20, 40, 60, 80]);
    // Margines po bokach istnieje po to, żeby kółko i nazwisko skrajnego
    // gracza mieściły się na murawie — przy 12% dotykały linii bocznej.
    expect(Math.min(...czworka.map((p) => p.x))).toBeGreaterThanOrEqual(20);
    expect(Math.max(...czworka.map((p) => p.x))).toBeLessThanOrEqual(80);
  });

  it('numery slotów są kolejne — na nich opiera się przypisanie graczy', () => {
    expect(pozycjeZeSchematu('1-3-2').map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('ostatnia linia to zawsze atak, także przy pięciu liniach', () => {
    const p = pozycjeZeSchematu('1-4-2-3-1');
    expect(p[p.length - 1].nazwa).toBe('Napastnik');
    // Środkowe linie to pomoc — bez tego 1-4-2-3-1 opisywałoby napastnika
    // jako pomocnika.
    expect(p.filter((x) => x.nazwa.includes('pomocnik'))).toHaveLength(5);
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
    expect(opisTaktyki({ krycie: 'strefa', pressing: 'wysoki' })).toBe('Strefa · Pod ich bramką');
  });

  it('brak decyzji to pusty tekst, nie „undefined"', () => {
    expect(opisTaktyki({})).toBe('');
    expect(opisTaktyki(null)).toBe('');
  });

  it('„Inne" pokazuje WPISANY tekst, nie słowo „Inne"', () => {
    // To on jest odpowiedzią — „Inne" nie mówi nikomu nic.
    expect(opisTaktyki({ krycie: 'inne', wlasne: { krycie: 'mieszamy co 10 minut' } }))
      .toBe('mieszamy co 10 minut');
  });

  it('„Inne" bez wpisanego tekstu nie zostawia śmiecia w podsumowaniu', () => {
    expect(opisTaktyki({ krycie: 'inne', wlasne: { krycie: '   ' } })).toBe('');
    expect(opisTaktyki({ krycie: 'inne' })).toBe('');
  });
});

describe('katalog taktyki', () => {
  it('żadne pytanie nie ma dwóch odpowiedzi znaczących to samo', () => {
    // Pierwsza wersja miała „Od połowy" i „Na swojej połowie" — dwa różne
    // sformułowania jednego cofnięcia się. Ten test nie wykryje synonimów sam
    // z siebie, ale pilnuje liczby opcji: przy dwóch odpowiedziach na pytanie
    // trudniej wpisać dwie takie same.
    for (const { klucz, opcje } of OPCJE_TAKTYKI) {
      expect(opcje.length, klucz).toBeLessThanOrEqual(3);
      expect(new Set(opcje.map((o) => o.label)).size, klucz).toBe(opcje.length);
    }
  });

  it('żadna gotowa opcja nie zajmuje wartości zarezerwowanej dla „Inne"', () => {
    for (const { opcje } of OPCJE_TAKTYKI) {
      expect(opcje.some((o) => o.wartosc === WARTOSC_INNE)).toBe(false);
    }
  });
});

describe('inicjaly', () => {
  it('bierze imię i NAZWISKO, nie dwie pierwsze litery imienia', () => {
    // W drużynie z Mateuszem Bazarnikiem i Mateuszem Szubertem dwie pierwsze
    // litery dałyby dwa identyczne kółka — czyli plan gry bez informacji.
    expect(inicjaly('Mateusz Bazarnik')).toBe('MB');
    expect(inicjaly('Mateusz Szubert')).toBe('MS');
  });

  it('bierze OSTATNI człon, gdy nazwisko jest dwuczłonowe', () => {
    expect(inicjaly('Jan Kowalski Nowak')).toBe('JN');
  });

  it('jedno słowo zostaje przy dwóch literach — nie ma z czego wziąć drugiej', () => {
    expect(inicjaly('Franek')).toBe('FR');
  });

  it('nadmiarowe spacje nie psują wyniku', () => {
    expect(inicjaly('  Damian   Sobczyk ')).toBe('DS');
  });

  it('pusta nazwa nie wywraca boiska', () => {
    expect(inicjaly('')).toBe('?');
    expect(inicjaly('   ')).toBe('?');
  });
});
