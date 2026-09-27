// Minimal RFC 4180 CSV reader for Search Console exports.
//
// GSC exports are plain UTF-8 with commas, LF and no trailing newline, but the
// same files often come back re-saved by Excel or Google Sheets: BOM, CRLF,
// semicolons (Polish Excel uses `;` because `,` is the decimal separator) and
// quoted fields. All of those are handled here so nobody has to "fix the file
// first" before analysis.

const BOM = '﻿';

/** Pick the delimiter that splits the header line into the most columns. */
export function wykryjSeparator(tekst) {
  const pierwszaLinia = tekst.split(/\r?\n/, 1)[0] ?? '';
  const kandydaci = [',', ';', '\t'];
  let najlepszy = ',';
  let max = 0;
  for (const sep of kandydaci) {
    // Count separators outside quotes only.
    let wCudzyslowie = false;
    let ile = 0;
    for (const znak of pierwszaLinia) {
      if (znak === '"') wCudzyslowie = !wCudzyslowie;
      else if (znak === sep && !wCudzyslowie) ile++;
    }
    if (ile > max) { max = ile; najlepszy = sep; }
  }
  return najlepszy;
}

/**
 * Parse CSV text into an array of rows (arrays of strings).
 * Empty trailing lines are dropped; empty cells are kept as ''.
 */
export function parsujCsv(tekst, separator) {
  let t = tekst.startsWith(BOM) ? tekst.slice(1) : tekst;
  const sep = separator ?? wykryjSeparator(t);
  const wiersze = [];
  let wiersz = [];
  let pole = '';
  let wCudzyslowie = false;

  for (let i = 0; i < t.length; i++) {
    const znak = t[i];
    if (wCudzyslowie) {
      if (znak === '"') {
        if (t[i + 1] === '"') { pole += '"'; i++; } // escaped quote
        else wCudzyslowie = false;
      } else {
        pole += znak;
      }
      continue;
    }
    if (znak === '"' && pole === '') { wCudzyslowie = true; continue; }
    if (znak === sep) { wiersz.push(pole); pole = ''; continue; }
    if (znak === '\r') continue;
    if (znak === '\n') {
      wiersz.push(pole);
      wiersze.push(wiersz);
      wiersz = [];
      pole = '';
      continue;
    }
    pole += znak;
  }
  if (pole !== '' || wiersz.length > 0) {
    wiersz.push(pole);
    wiersze.push(wiersz);
  }
  return wiersze.filter((w) => !(w.length === 1 && w[0].trim() === ''));
}

/** Parse CSV into { naglowki, wiersze: [{naglowek: wartosc}] }. */
export function csvDoObiektow(tekst) {
  const wiersze = parsujCsv(tekst);
  if (wiersze.length === 0) return { naglowki: [], wiersze: [] };
  const naglowki = wiersze[0].map((h) => h.trim());
  const dane = wiersze.slice(1).map((w) => {
    const obiekt = {};
    naglowki.forEach((h, i) => { obiekt[h] = (w[i] ?? '').trim(); });
    return obiekt;
  });
  return { naglowki, wiersze: dane };
}
