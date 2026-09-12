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

// Druga połowa tej samej decyzji: pasek ma zniknąć na czas pisania. Android
// zakrywa go klawiaturą sam, iOS NIE — Safari podnosi elementy `fixed` nad
// klawiaturę, więc pasek lądował na środku ekranu, na polu do pisania
// (zgłoszone ze zrzutem z iPhone'a). Regułę widać wyłącznie na telefonie
// z otwartą klawiaturą, czyli nigdzie w CI — stąd ten test.
const GLOBALS = path.join(process.cwd(), 'src', 'app', 'globals.css');

describe('otwarta klawiatura ekranowa', () => {
  it('chowa dolny pasek nawigacji', () => {
    expect(readFileSync(GLOBALS, 'utf8'))
      .toMatch(/html\[data-klawiatura='1'\]\s*\[data-pasek-dolny\]\s*\{\s*display:\s*none/);
  });

  it('zeruje miejsce rezerwowane pod pasek', () => {
    expect(readFileSync(GLOBALS, 'utf8'))
      .toMatch(/html\[data-klawiatura='1'\]\s*\{\s*--bottom-nav-h:\s*0px/);
  });

  it('selektor paska istnieje w komponencie nawigacji', () => {
    const nav = readFileSync(path.join(process.cwd(), 'src', 'components', 'layout', 'BottomNav.tsx'), 'utf8');
    expect(nav).toMatch(/data-pasek-dolny/);
  });
});

describe('viewport aplikacji', () => {
  it('ustawia interactiveWidget na resizes-visual', () => {
    expect(kodBezKomentarzy(LAYOUT)).toMatch(/interactiveWidget:\s*'resizes-visual'/);
  });

  it('nie wraca do resizes-content ani overlays-content', () => {
    expect(kodBezKomentarzy(LAYOUT)).not.toMatch(/resizes-content|overlays-content/);
  });
});
