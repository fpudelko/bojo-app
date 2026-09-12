import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// `interactiveWidget` NIE MA WRACAĆ do `viewport` w `app/layout.tsx`.
//
// SKĄD TEN PLIK. `interactiveWidget: 'resizes-content'` wyglądało na poprawkę
// wysokości ekranu czatu na Androidzie, a zabierało możliwość pisania:
// klawiatura mrugała i zamykała się natychmiast po dotknięciu pola — i to na
// KAŻDYM polu w aplikacji, nie tylko w rozmowie (zgłoszone wprost: „nie
// wyświetla klawiatury ani przy pisaniu, ani przy wyszukiwaniu"). Powód:
// `resizes-content` kurczy layout, więc otwarcie klawiatury przelicza
// `svh`/`dvh` i przestawia stronę pod palcem; pole traci widoczność,
// przeglądarka chowa klawiaturę, layout wraca i cykl startuje od nowa.
//
// Dlaczego test, a nie komentarz: pusta przestrzeń pod composerem na
// Androidzie to objaw, który widać od razu, a zepsutej klawiatury nie widać
// na desktopie ani w Playwrighcie (nie ma tam klawiatury ekranowej). Kolejna
// próba „naprawienia wysokości" tym samym ustawieniem jest więc pewna jak
// deszcz — wysokość liczy `useOknoCzatu` z `visualViewport`, na obu systemach.
const LAYOUT = path.join(process.cwd(), 'src', 'app', 'layout.tsx');

describe('viewport aplikacji', () => {
  it('nie ustawia interactiveWidget — klawiatura Androida nie może mrugać', () => {
    const zrodlo = readFileSync(LAYOUT, 'utf8');
    const bezKomentarzy = zrodlo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bezKomentarzy).not.toMatch(/interactiveWidget/);
  });
});
