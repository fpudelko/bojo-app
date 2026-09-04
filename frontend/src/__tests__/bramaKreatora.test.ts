import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Brama kreatora (`/wydarzenia/nowe` dla wylogowanego) to strona sprzedażowa:
// trzy korzyści, karta logowania i ROZMYTA MAKIETA kreatora z podpisem
// „↑ tak wygląda kreator po zalogowaniu". Makieta jest ręcznym rysunkiem, nie
// renderem prawdziwego formularza — więc rozjeżdża się po cichu.
//
// I rozjechała się: do 2026-09-03 rysowała Sport → Lokalizacja → Data, czyli
// układ sprzed przebudowy kroków, podczas gdy krok pierwszy to dziś Sport →
// Termin → Liczba miejsc → przełączniki, a lokalizacja jest krokiem DRUGIM.
// Pierwszy ekran organizatora obiecywał inny formularz niż ten, który dostanie
// — dokładnie w miejscu, w którym prosimy go o założenie konta.
//
// Plik czytamy jako TEKST: makieta to `aria-hidden` JSX bez własnego eksportu,
// a chodzi tu o zgodność ŹRÓDEŁ, nie o zachowanie komponentu (ten sam wzorzec
// co `ikonyPwa.test.ts`).
const ZRODLO = readFileSync(
  path.join(process.cwd(), 'src', 'app', 'wydarzenia', 'nowe', 'page.tsx'),
  'utf8',
);

/** Fragment pliku od makiety do jej podpisu, BEZ komentarzy JSX — komentarz
 *  opisujący, co z makiety zniknęło, nie może wywracać asercji o tym, czego
 *  na makiecie nie ma. */
function makieta(): string {
  const start = ZRODLO.indexOf('aria-hidden="true"');
  const koniec = ZRODLO.indexOf('tak wygląda kreator po zalogowaniu');
  expect(start, 'nie znaleziono makiety kreatora').toBeGreaterThan(-1);
  expect(koniec, 'nie znaleziono podpisu pod makietą').toBeGreaterThan(start);
  return ZRODLO.slice(start, koniec).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

describe('brama kreatora — makieta zgadza się z kreatorem', () => {
  it('nazwy kroków bierze z STEP_TITLES, a nie z osobnego literału', () => {
    // Gdyby ktoś wpisał kroki ręcznie, ta asercja spadnie przy pierwszej
    // zmianie nazw w kreatorze — i o to chodzi.
    expect(ZRODLO).toContain('Trzy kroki: {STEP_TITLES.map(');
  });

  it('STEP_TITLES to nadal Kiedy / Gdzie / Dla kogo', () => {
    const linia = ZRODLO.match(/const STEP_TITLES = \[([^\]]+)\]/)?.[1];
    expect(linia).toBeTruthy();
    expect(linia).toContain("'Kiedy'");
    expect(linia).toContain("'Gdzie'");
    expect(linia).toContain("'Dla kogo'");
  });

  it('makieta pokazuje KROK PIERWSZY: sport, termin, liczbę miejsc i rezerwę', () => {
    const m = makieta();
    expect(m, 'brak sekcji sportu').toContain('Sport');
    expect(m, 'brak terminu').toContain('Termin');
    expect(m, 'brak liczby miejsc').toContain('Ilu nas gra');
    expect(m, 'brak przełącznika rezerwy').toContain('Lista rezerwowa');
  });

  it('makieta NIE pokazuje lokalizacji — to jest krok drugi', () => {
    const m = makieta();
    expect(m, 'lokalizacja wróciła na makietę kroku pierwszego').not.toContain('Lokalizacja');
    // Mapka-atrapa rysowała się gradientem w kropki — jej brak jest drugim,
    // niezależnym sygnałem, że krok drugi nie wrócił na makietę kroku pierwszego.
    expect(m).not.toContain('radial-gradient');
  });
});
