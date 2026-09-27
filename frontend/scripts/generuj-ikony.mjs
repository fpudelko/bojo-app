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
 *    maskowalny ma pełne zielone tło, linię boiska i B z kołem pomniejszone
 *    do strefy bezpiecznej. Bez tego ikona na Androidzie wygląda na przyciętą.
 *
 * Po każdej zmianie obrazka podbij `WERSJA_IKON` w `app/manifest.ts`.
 * Zainstalowana apka nie pobierze nowego pliku spod tego samego adresu.
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
// Litera jest dziś geometryczna (obie komory to koła) — dziury dorysowują się
// osobnymi kółkami w kolorze tła, nie przez `fill-rule="evenodd"` w samej ścieżce.
const LITERA =
  'M40 33 L40 77 L62 77 Q74 77 74 65.5 Q74 56 64 54.5 Q72 52.5 72 43.5 Q72 33 60 33 Z';
const DZIURA_GORA = { cx: 57, cy: 46.5 };
const DZIURA_DOL = { cx: 58, cy: 63.5 };
const R_DZIURA = 4.5;
const ZIELEN = '#15663E';
const LINIA_BOISKA = '#1E7A4B';

/** Litera + jej dwie dziury — wspólne dla obu wariantów ikony. */
function svgLitera(fillDziur) {
  return `<path d="${LITERA}" fill="#ffffff"/>
    <circle cx="${DZIURA_GORA.cx}" cy="${DZIURA_GORA.cy}" r="${R_DZIURA}" fill="${fillDziur}"/>
    <circle cx="${DZIURA_DOL.cx}" cy="${DZIURA_DOL.cy}" r="${R_DZIURA}" fill="${fillDziur}"/>`;
}

/** Logo w oryginale: zaokrąglony kafelek wypełniający kadr, linia i koło boiska za literą. */
function svgZwykle() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
    <rect width="110" height="110" rx="26" fill="${ZIELEN}"/>
    <g stroke="${LINIA_BOISKA}" stroke-width="3" fill="none">
      <line x1="0" y1="55" x2="110" y2="55"/>
      <circle cx="57" cy="55" r="31"/>
    </g>
    ${svgLitera(ZIELEN)}
  </svg>`;
}

/**
 * Wariant maskowalny: pełne tło, a litera z kołem pomniejszone do strefy
 * bezpiecznej (~60% kadru). To TEN plik widać na ekranie głównym Androida,
 * więc linia boiska musi tu być — bez niej zainstalowana apka pokazywała
 * gołe B. Linia idzie od krawędzi do krawędzi poza skalowaniem: launcher
 * i tak przytnie ją do swojego kształtu, jak linię boiska wychodzącą z kadru.
 */
function svgMaskowalne() {
  // Najciaśniejsza maska Androida zostawia koło o promieniu ~36 ze 110
  // jednostek; koło boiska z obrysem przy tej skali ma ~26, więc nic nie ginie.
  const skala = 0.8;
  const przesun = (110 - 110 * skala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110">
    <rect width="110" height="110" fill="${ZIELEN}"/>
    <line x1="0" y1="55" x2="110" y2="55" stroke="${LINIA_BOISKA}" stroke-width="3"/>
    <g transform="translate(${przesun} ${przesun}) scale(${skala})">
      <circle cx="57" cy="55" r="31" stroke="${LINIA_BOISKA}" stroke-width="${(3 / skala).toFixed(2)}" fill="none"/>
      ${svgLitera(ZIELEN)}
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
