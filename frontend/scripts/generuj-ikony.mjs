/**
 * Generuje ikony PWA z logo Bojo.
 *
 * DLACZEGO SKRYPT, A NIE WRZUCONE PNG-I: logo jest dziś robocze
 * („TODO: podmienić na finalną wersję od grafika" w `components/Logo.tsx`).
 * Gdy przyjdzie wersja od grafika, ikony odtwarza się jedną komendą zamiast
 * ręcznego eksportu w sześciu rozmiarach.
 *
 *     cd frontend && node scripts/generuj-ikony.mjs
 *
 * Rasteryzuje Chromium z Playwrighta — ten sam, którego używają testy, więc
 * nie dokładamy `sharp` ani `resvg` tylko po to, żeby raz na kwartał zamienić
 * SVG na PNG.
 *
 * DWA WARIANTY, i to jest sedno:
 *
 *  - `ikona-*.png` — logo takie, jakie jest: zielony kafelek z białym B,
 *    wypełniający cały kadr. Tak wygląda na iOS i w przeglądarce.
 *
 *  - `maskowalna-*.png` — Android przycina ikonę do kształtu wybranego przez
 *    producenta (koło, kwadrat, kropla). Obcina do 20% z każdej strony, więc
 *    logo wypełniające kadr straciłoby rogi razem z zaokrągleniem. Wariant
 *    maskowalny ma pełne zielone tło i samo B pomniejszone do strefy
 *    bezpiecznej. Bez tego ikona na Androidzie wygląda na przyciętą.
 */

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KATALOG = path.join(process.cwd(), 'public', 'ikony');

// Ścieżka litery „B" — skopiowana z `src/components/Logo.tsx`. Świadome
// powtórzenie: skrypt buildowy nie zaimportuje modułu TSX bez całego łańcucha
// transpilacji, a test niżej pilnuje, żeby obie kopie nie rozjechały się cicho.
// Jedna linia mimo długości: test `ikonyPwa.test.ts` porównuje ją znak po
// znaku z `LOGO_SVG_STRING`, a złamanie na sklejane literały rozbiłoby to
// porównanie i pilnowanie przestałoby działać.
// eslint-disable-next-line max-len
const LITERA = 'M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z M51 42 L59 42 Q63 42 63 46.5 Q63 51 59 51 L51 51 Z M51 59 L60 59 Q65 59 65 64 Q65 68 60 68 L51 68 Z';
const ZIELEN = '#15663E';

/** Logo w oryginale: zaokrąglony kafelek wypełniający kadr. */
function svgZwykle() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
    <rect width="110" height="110" rx="26" fill="${ZIELEN}"/>
    <path d="${LITERA}" fill="#ffffff" fill-rule="evenodd"/>
  </svg>`;
}

/** Wariant maskowalny: pełne tło + litera w strefie bezpiecznej (~60% kadru). */
function svgMaskowalne() {
  const skala = 0.62;
  const przesun = (110 - 110 * skala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
    <rect width="110" height="110" fill="${ZIELEN}"/>
    <g transform="translate(${przesun} ${przesun}) scale(${skala})">
      <path d="${LITERA}" fill="#ffffff" fill-rule="evenodd"/>
    </g>
  </svg>`;
}

const DO_ZROBIENIA = [
  // Manifest — Android i przeglądarki.
  { plik: 'ikona-192.png', rozmiar: 192, svg: svgZwykle },
  { plik: 'ikona-512.png', rozmiar: 512, svg: svgZwykle },
  { plik: 'maskowalna-192.png', rozmiar: 192, svg: svgMaskowalne },
  { plik: 'maskowalna-512.png', rozmiar: 512, svg: svgMaskowalne },
  // iOS czyta WYŁĄCZNIE `apple-touch-icon` i ignoruje ikony z manifestu.
  // Bez tego pliku na ekranie głównym iPhone'a ląduje zrzut strony.
  { plik: 'apple-touch-icon.png', rozmiar: 180, svg: svgZwykle },
  // Favicon w karcie przeglądarki.
  { plik: 'favicon-32.png', rozmiar: 32, svg: svgZwykle },
];

const przegladarka = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);

await mkdir(KATALOG, { recursive: true });

for (const { plik, rozmiar, svg } of DO_ZROBIENIA) {
  const strona = await przegladarka.newPage({
    viewport: { width: rozmiar, height: rozmiar },
    deviceScaleFactor: 1,
  });
  // `margin: 0` i tło przezroczyste — inaczej wokół ikony zostaje biała ramka
  // z domyślnych stylów strony.
  await strona.setContent(
    `<!doctype html><html><body style="margin:0">
       <div style="width:${rozmiar}px;height:${rozmiar}px">${svg()}</div>
     </body></html>`,
  );
  const obrazek = await strona.locator('div').screenshot({ omitBackground: true });
  await writeFile(path.join(KATALOG, plik), obrazek);
  await strona.close();
  console.log(`✓ ${plik} (${rozmiar}×${rozmiar})`);
}

await przegladarka.close();
console.log(`\nGotowe — ${DO_ZROBIENIA.length} plików w public/ikony/`);
