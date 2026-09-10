import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Każdy selektor użyty w `mask:` Playwrighta musi istnieć w kodzie aplikacji.
//
// SKĄD TEN PLIK. Playwright NIE zgłasza błędu, gdy maska nie trafia w żaden
// element — po prostu maluje zero pikseli i zrzut wychodzi taki, jakby maski
// nie było wcale. Maska jest więc obietnicą, którą da się złożyć i nigdy nie
// dotrzymać, a komentarz obok niej brzmi tak samo w obu przypadkach.
//
// To nie jest hipoteza. `wizualne.spec.ts` maskował `[data-zrzut-maskuj]`
// („liczniki z katalogu boisk rosną z każdym importem") od dnia, w którym ten
// przemiał po trasach powstał — a atrybutu NIGDY nie było w `src`. Przez cały
// ten czas licznik katalogu jechał na wzorzec bez osłony, a plik wyglądał na
// zabezpieczony.
//
// Ten test czyta scenariusze, wyciąga z nich selektory atrybutowe podane
// w `mask:` i sprawdza, że każdy występuje w `frontend/src`. Zastępuje
// pilnowanie pojedynczych atrybutów z nazwy: nowa maska jest objęta ochroną
// od razu, bez dopisywania tu czegokolwiek.

const KATALOG = process.cwd();
const KATALOG_E2E = path.join(KATALOG, 'e2e');
const KATALOG_SRC = path.join(KATALOG, 'src');

/** Wszystkie pliki `*.spec.ts` scenariuszy. */
function plikiScenariuszy(): string[] {
  return readdirSync(KATALOG_E2E)
    .filter((n) => n.endsWith('.spec.ts'))
    .map((n) => path.join(KATALOG_E2E, n));
}

/** Cały kod aplikacji jako jeden łańcuch — szukamy w nim samych atrybutów. */
function zrodlaAplikacji(): string {
  const kawalki: string[] = [];
  const obejdz = (katalog: string) => {
    for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
      const sciezka = path.join(katalog, wpis.name);
      if (wpis.isDirectory()) {
        if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
        obejdz(sciezka);
        continue;
      }
      if (/\.(tsx?|jsx?)$/.test(wpis.name)) kawalki.push(readFileSync(sciezka, 'utf8'));
    }
  };
  obejdz(KATALOG_SRC);
  return kawalki.join('\n');
}

/**
 * Selektory atrybutowe z `mask: [...]` — tylko `data-*`, bo tylko takie
 * dopisujemy do JSX wyłącznie na potrzeby zrzutów. Selektory klasowe
 * (`.leaflet-tile-pane`) pochodzą z bibliotek i nie ma ich czego szukać w `src`.
 */
function maskowaneAtrybuty(kod: string): string[] {
  const znalezione = new Set<string>();
  // `mask:` bierze tablicę, która może stać w jednej linii albo w kilku.
  const bloki = kod.match(/mask:\s*\[[^\]]*\]/g) ?? [];
  for (const blok of bloki) {
    for (const trafienie of blok.match(/\[data-[a-z0-9-]+\]/g) ?? []) {
      znalezione.add(trafienie.slice(1, -1));
    }
  }
  return Array.from(znalezione);
}

describe('maski zrzutów', () => {
  const src = zrodlaAplikacji();
  const pliki = plikiScenariuszy();

  it('scenariusze w ogóle się znajdują — inaczej ten test przechodzi na pusto', () => {
    expect(pliki.length).toBeGreaterThan(0);
  });

  for (const plik of pliki) {
    const nazwa = path.basename(plik);
    const atrybuty = maskowaneAtrybuty(readFileSync(plik, 'utf8'));
    if (atrybuty.length === 0) continue;

    it(`${nazwa}: każdy maskowany atrybut istnieje w kodzie aplikacji`, () => {
      for (const atrybut of atrybuty) {
        expect(
          src.includes(atrybut),
          `\`${nazwa}\` maskuje [${atrybut}], ale tego atrybutu nie ma w frontend/src — ` +
            'maska maluje zero pikseli i niczego nie zasłania.',
        ).toBe(true);
      }
    });
  }

  it('pilnuje obu masek, które dziś istnieją', () => {
    // Asercja na samą LISTĘ, nie na jej zawartość: gdyby ktoś usunął maskę
    // razem z atrybutem, pętla wyżej przeszłaby na pusto i nikt by nie
    // zauważył, że ochrona zniknęła.
    const wszystkie = new Set(pliki.flatMap((p) => maskowaneAtrybuty(readFileSync(p, 'utf8'))));
    expect(Array.from(wszystkie).sort()).toEqual(['data-pole-daty', 'data-zrzut-maskuj']);
  });
});
