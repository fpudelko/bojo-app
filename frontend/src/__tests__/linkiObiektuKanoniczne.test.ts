import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Link do strony obiektu zawsze adresem KANONICZNYM: `slugBoiska(name, id)`.
//
// SKĄD TEN PLIK. Adres kanoniczny obiektu to nazwa + końcówka identyfikatora.
// Sama nazwa (`slugify(name)`) jest kluczem historycznym: strona obiektu
// przekierowuje z niego na adres kanoniczny, a przy nazwach rodzajowych
// z importu OSM trafia w PRZYPADKOWY obiekt o tej samej nazwie, bo
// „Boisko piłkarskie" jest w katalogu ponad 10 tysięcy razy.
//
// Gdy adres kanoniczny wchodził, poprawiono stronę obiektu i część linków,
// ale sitemapa boisk i trzy huby katalogu (`/boiska/[sport]`,
// `/boiska/[sport]/[miasto]`, `/boiska/woj/[wojewodztwo]`) dalej budowały
// adres z samej nazwy. Skutek wyszedł dopiero przy analizie Search Console
// (2026-09-26): 32 tys. wpisów sitemapy dawało ~10,6 tys. różnych adresów,
// każdy przez przekierowanie, a kliknięcie „Boisko piłkarskie" na liście
// miasta otwierało boisko z innego końca Polski. Żadne inne narzędzie tego
// nie widzi: `tsc` przepuszcza oba zapisy, a zrzuty ekranu nie klikają linków.

const KATALOG_SRC = path.join(process.cwd(), 'src');

/** Pliki aplikacji (bez testów) z treścią, do przeszukania wzorcami. */
function plikiAplikacji(): { sciezka: string; tresc: string }[] {
  const wynik: { sciezka: string; tresc: string }[] = [];
  const obejdz = (katalog: string) => {
    for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
      const sciezka = path.join(katalog, wpis.name);
      if (wpis.isDirectory()) {
        if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
        obejdz(sciezka);
        continue;
      }
      if (/\.(tsx?|jsx?)$/.test(wpis.name)) {
        wynik.push({ sciezka: path.relative(process.cwd(), sciezka), tresc: readFileSync(sciezka, 'utf8') });
      }
    }
  };
  obejdz(KATALOG_SRC);
  return wynik;
}

// Wzorce budowania adresu obiektu z samej nazwy. Świadomie wąskie: `slugify`
// ma też uczciwe zastosowania (miasta, województwa, sporty), więc zakaz
// dotyczy wyłącznie miejsc, w których wynik trafia do adresu `/boisko/…`
// albo do listy obiektów (`slug:` w ItemList hubu).
const ZAKAZANE: { wzorzec: RegExp; opis: string }[] = [
  { wzorzec: /\/boisko\/\$\{slugify\(/, opis: '`/boisko/${slugify(…)}`' },
  { wzorzec: /slug:\s*slugify\((?:field|f|v|venue|obiekt)\.name\)/, opis: '`slug: slugify(<obiekt>.name)`' },
  { wzorzec: /\bslug\s*=\s*slugify\((?:field|f|v|venue|obiekt)\.name\)/, opis: '`slug = slugify(<obiekt>.name)`' },
];

// Martwy kod (AGENTS.md, „Martwy kod"): nic go nie importuje, więc nie
// produkuje żadnego linku. Wyjątek zapisany jawnie, żeby jego ożywienie
// wymagało świadomej decyzji, a nie przeszło po cichu.
const POMIJANE = new Set(['src/components/map/LeafletMapImpl.tsx']);

describe('linki do strony obiektu', () => {
  it('nigdzie nie budują adresu obiektu z samej nazwy', () => {
    const naruszenia: string[] = [];
    for (const { sciezka, tresc } of plikiAplikacji()) {
      if (POMIJANE.has(sciezka.split(path.sep).join('/'))) continue;
      for (const { wzorzec, opis } of ZAKAZANE) {
        if (wzorzec.test(tresc)) naruszenia.push(`${sciezka}: ${opis}, użyj slugBoiska(name, id)`);
      }
    }
    expect(naruszenia).toEqual([]);
  });

  it('sitemapa boisk i huby katalogu używają slugBoiska', () => {
    const wymagane = [
      'src/app/sitemap-boiska/[plik]/route.ts',
      'src/app/boiska/[sport]/page.tsx',
      'src/app/boiska/[sport]/[miasto]/page.tsx',
      'src/app/boiska/woj/[wojewodztwo]/page.tsx',
    ];
    for (const plik of wymagane) {
      const tresc = readFileSync(path.join(process.cwd(), plik), 'utf8');
      expect(tresc, plik).toMatch(/slugBoiska\(/);
    }
  });
});
