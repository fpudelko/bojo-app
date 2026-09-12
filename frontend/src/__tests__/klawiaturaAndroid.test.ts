import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// `interactiveWidget` w `app/layout.tsx` MA BYĆ `resizes-visual`.
//
// SKĄD TEN PLIK. Stało tam `resizes-content` — wyglądało na poprawkę wysokości
// ekranu czatu, a kosztowało dwie rzeczy naraz:
//
//  1. Klawiatura na Androidzie mrugała i zamykała się natychmiast po dotknięciu
//     pola, w CAŁEJ aplikacji („nie wyświetla klawiatury ani przy pisaniu, ani
//     przy wyszukiwaniu"). `resizes-content` kurczy layout, więc otwarcie
//     klawiatury przelicza `svh`/`dvh` i przestawia stronę pod palcem: pole ze
//     skupieniem wyjeżdża z widoku, przeglądarka chowa klawiaturę, layout wraca
//     i cykl startuje od nowa.
//  2. Dolna nawigacja jechała nad klawiaturę zamiast schować się za nią
//     (zgłoszone ze zrzutem) — bo `fixed bottom-0` trzyma się dołu LAYOUTU,
//     a ten właśnie się skurczył.
//
// Wartość musi być podana JAWNIE: samo usunięcie klucza nie wystarczyło, bo
// Chrome na Androidzie nadal domyślnie kurczy layout.
//
// Dlaczego test, a nie komentarz: objaw, który `resizes-content` „naprawiało"
// (pusty pas pod composerem), widać na telefonie od razu, a zepsutej klawiatury
// nie widać nigdzie poza telefonem — ani `tsc`, ani Vitest, ani Playwright nie
// mają klawiatury ekranowej. Wysokość liczy `useOknoCzatu` z `visualViewport`.
const LAYOUT = path.join(process.cwd(), 'src', 'app', 'layout.tsx');

function kodBezKomentarzy(sciezka: string): string {
  return readFileSync(sciezka, 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('viewport aplikacji', () => {
  it('ustawia interactiveWidget na resizes-visual', () => {
    expect(kodBezKomentarzy(LAYOUT)).toMatch(/interactiveWidget:\s*'resizes-visual'/);
  });

  it('nie wraca do resizes-content ani overlays-content', () => {
    expect(kodBezKomentarzy(LAYOUT)).not.toMatch(/resizes-content|overlays-content/);
  });
});
