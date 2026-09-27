// Synthetic Search Console exports for tests: same file names, Polish headers
// and number formats as real GSC downloads, with KNOWN planted findings so a
// test can assert the analysers find them. Deterministic (seeded PRNG).
//
// SYNTHETIC DATA: nothing here is a real bojo.pl measurement.

import { zbudujZip } from '../lib/zip.mjs';

function prng(ziarno) {
  let s = ziarno >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CSV = (naglowki, wiersze) => [naglowki.join(','), ...wiersze.map((w) => w.map((x) => (/[",]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(','))].join('\n');

// Plausible CTR by position for the synthetic "normal" pages.
const ctrDla = (poz) => (poz < 1.5 ? 0.2 : poz < 2.5 ? 0.12 : poz < 3.5 ? 0.08 : poz < 5.5 ? 0.05 : poz < 10.5 ? 0.02 : 0.005);

/**
 * Performance export. `przecinek: true` writes Polish decimals ("1,34%", "7,5").
 * Planted: two venue pages at position ~3 with far too few clicks (CTR gap),
 * one query at position ~6 with 900 impressions (striking distance), brand
 * queries with zero clicks, a step change in daily impressions.
 */
export function eksportSkutecznosci({ przecinek = false } = {}) {
  const los = prng(42);
  const dz = (n, m = 2) => {
    const s = n.toFixed(m);
    return przecinek ? s.replace('.', ',') : s;
  };
  const proc = (u) => `${dz(u * 100)}%`;
  const B = 'https://www.bojo.pl';

  const strony = [];
  for (let i = 0; i < 60; i++) {
    const poz = 2 + los() * 10;
    const wy = Math.round(80 + los() * 400);
    const kl = Math.round(wy * ctrDla(poz) * (0.8 + los() * 0.4));
    const id = (0x100000000000 + i * 7919).toString(16).slice(-12);
    strony.push([`${B}/boisko/boisko-pilkarskie-${id}`, kl, wy, poz]);
  }
  // Planted CTR gaps: excellent position, almost no clicks.
  strony.push([`${B}/boisko/orlik-luka-aaaaaaaaaaa1`, 1, 900, 2.8]);
  strony.push([`${B}/boisko/hala-luka-aaaaaaaaaaa2`, 2, 700, 3.1]);
  strony.push([`${B}/boiska/pilka-nozna/poznan`, 30, 600, 4.2]);
  strony.push([`${B}/`, 12, 400, 6.5]);
  strony.push([`${B}/dlaczego-bojo`, 3, 150, 8.1]);
  strony.push([`${B}/wydarzenia/4ca4de66-2458-429e-8c4b-90f571acef45`, 2, 90, 5.0]);

  const zapytania = [
    ['bojo', 0, 30, 6.97],
    ['co to bojo', 0, 60, 8.2],
    ['bojo co to', 0, 55, 9.0],
    ['boisko orlik poznań rataje', 9, 900, 6.1], // striking distance
    ['tor wyścigów konnych służewiec boisko', 4, 10, 4.3],
    ['hala sportowa kraków', 1, 120, 12.4],
    ['boisko do koszykówki wrocław', 6, 140, 3.2],
  ];

  const daty = [];
  const start = Date.parse('2026-08-18');
  for (let d = 0; d < 28; d++) {
    const data = new Date(start + d * 864e5).toISOString().slice(0, 10);
    const wy = d < 20 ? Math.round(20 + los() * 10) : Math.round(1500 + los() * 1200); // step on day 20
    const kl = Math.round(wy * 0.013);
    daty.push([data, kl, wy, proc(kl / wy), dz(7 + los(), 1)]);
  }

  const pliki = {
    'Zapytania.csv': CSV(['Najczęstsze zapytania', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'],
      zapytania.map(([q, kl, wy, poz]) => [q, kl, wy, proc(kl / wy), dz(poz)])),
    'Strony.csv': CSV(['Najpopularniejsze strony', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'],
      strony.map(([u, kl, wy, poz]) => [u, kl, wy, proc(kl / wy), dz(poz)])),
    'Kraje.csv': CSV(['Kraj', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], [['Polska', 114, 8600, proc(114 / 8600), dz(7.4)], ['Niemcy', 2, 133, proc(2 / 133), dz(9.9)]]),
    'Urządzenia.csv': CSV(['Urządzenie', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], [['Komórka', 101, 7513, proc(101 / 7513), dz(6.8)], ['Komputer', 15, 1195, proc(15 / 1195), dz(11.1)], ['Tablet', 0, 25, proc(0), dz(8)]]),
    'Wygląd w wynikach wyszukiwania.csv': CSV(['Wygląd w wynikach wyszukiwania', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], []),
    'Daty.csv': CSV(['Data', 'Kliknięcia', 'Wyświetlenia', 'CTR', 'Pozycja'], daty),
    'Filtry.csv': CSV(['Filtr', 'Wartość'], [['Typ wyszukiwania', 'Internet'], ['Data', 'Ostatnie 28 dni']]),
  };
  return zbudujZip(pliki);
}

/** Page-indexing export shaped like the 2026-09-14 reading in 7a.2 (numbers from the doc). */
export function eksportIndeksowania() {
  const wykres = [];
  const start = Date.parse('2026-09-01');
  for (let d = 0; d < 14; d++) {
    const data = new Date(start + d * 864e5).toISOString().slice(0, 10);
    const [zi, nz] = d < 4 ? [59, 5] : [17473, 530];
    wykres.push([data, nz, zi, d < 9 ? 20 : 2500]);
  }
  const pliki = {
    'Wykres.csv': CSV(['Data', 'Nie zindeksowano', 'Zindeksowano', 'Wyświetlenia'], wykres),
    'Problemy krytyczne.csv': CSV(['Przyczyna', 'Źródło', 'Weryfikacja', 'Strony'], [
      ['Alternatywna strona zawierająca prawidłowy tag strony kanonicznej', 'Strona internetowa', 'Nie rozpoczęto', 233],
      ['Strona wykluczona za pomocą tagu „noindex”', 'Strona internetowa', 'Nie rozpoczęto', 111],
      ['Duplikat, użytkownik nie oznaczył strony kanonicznej', 'Strona internetowa', 'Nie rozpoczęto', 54],
      ['Strona zawiera przekierowanie', 'Strona internetowa', 'Nie rozpoczęto', 45],
      ['Strona zablokowana przez plik robots.txt', 'Strona internetowa', 'Nie rozpoczęto', 2],
      ['Strona zeskanowana, ale jeszcze nie zindeksowana', 'Systemy Google', 'Nie rozpoczęto', 85],
    ]),
    'Problemy niekrytyczne.csv': CSV(['Przyczyna', 'Źródło', 'Weryfikacja', 'Strony'], []),
  };
  return zbudujZip(pliki);
}

/** Drill-down examples of one reason (URL list), as exported from GSC. */
export function eksportPrzykladow() {
  return CSV(['URL', 'Ostatnie skanowanie'], [
    ['https://www.bojo.pl/boisko/boisko-pilkarskie', '2026-09-20'],
    ['https://www.bojo.pl/boisko/4ca4de66-2458-429e-8c4b-90f571acef45', '2026-09-19'],
    ['https://www.bojo.pl/gracze', '2026-09-18'],
    ['https://www.bojo.pl/boisko/dubidzkie-lwy-741e4f384561', '2026-09-18'],
  ]);
}

/** Core Web Vitals chart export. */
export function eksportCwv() {
  return zbudujZip({
    'Wykres.csv': CSV(['Data', 'Słabe', 'Wymagające poprawy', 'Dobre'], [
      ['2026-09-01', 0, 12, 40], ['2026-09-02', 0, 30, 20], ['2026-09-03', 5, 30, 20],
    ]),
  });
}
