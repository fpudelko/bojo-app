// Number parsing for Search Console exports in any locale.
//
// The same metric arrives as "1.34%", "1,34%", "1,34 %", "8733", "8 733" (NBSP),
// "8,733" or "7,5" depending on UI language and on whether someone re-saved the
// file in Excel. Guessing wrong here silently multiplies CTR by 100 or turns
// 8 733 impressions into 8.7, so counts and ratios are parsed differently.

const SPACJE = /[\s  ]/g;

/** Integer counts: clicks, impressions, pages, items. Strips every non-digit. */
export function liczbaCalkowita(wartosc) {
  if (wartosc == null) return null;
  const s = String(wartosc).replace(SPACJE, '');
  if (s === '' || s === '-' || s === '—') return null;
  // "1,234" or "1.234" as thousands separators; a count has no fractions.
  const cyfry = s.replace(/[^\d-]/g, '');
  if (cyfry === '' || cyfry === '-') return null;
  return parseInt(cyfry, 10);
}

/** Decimal values: position, CTR. Accepts both decimal separators. */
export function liczbaDziesietna(wartosc) {
  if (wartosc == null) return null;
  let s = String(wartosc).replace(SPACJE, '').replace('%', '');
  if (s === '' || s === '-' || s === '—') return null;
  const ostKropka = s.lastIndexOf('.');
  const ostPrzecinek = s.lastIndexOf(',');
  if (ostKropka >= 0 && ostPrzecinek >= 0) {
    // Both present: the last one is the decimal separator.
    if (ostPrzecinek > ostKropka) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ostPrzecinek >= 0) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** CTR as a fraction (0.0134), whatever the input looked like ("1,34%"). */
export function ctrJakoUlamek(wartosc) {
  const n = liczbaDziesietna(wartosc);
  if (n == null) return null;
  const zProcentem = String(wartosc).includes('%');
  return zProcentem || n > 1 ? n / 100 : n;
}

/** Wilson score interval for a binomial proportion (clicks / impressions). */
export function przedzialWilsona(sukcesy, proby, z = 1.96) {
  if (!proby) return { dol: 0, gora: 1 };
  const p = sukcesy / proby;
  const z2 = z * z;
  const mianownik = 1 + z2 / proby;
  const srodek = (p + z2 / (2 * proby)) / mianownik;
  const polowa = (z * Math.sqrt((p * (1 - p)) / proby + z2 / (4 * proby * proby))) / mianownik;
  return { dol: Math.max(0, srodek - polowa), gora: Math.min(1, srodek + polowa) };
}

/** Two-proportion z-test; returns { z, p } (two-sided). */
export function testDwochProporcji(c1, n1, c2, n2) {
  if (!n1 || !n2) return { z: 0, p: 1 };
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const p = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, p: 1 };
  const z = (p1 - p2) / se;
  return { z, p: 2 * (1 - rozkladNormalny(Math.abs(z))) };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 7.5e-8). */
export function rozkladNormalny(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Impressions per arm needed to detect CTR p1 → p2 (alpha 0.05, power 0.8). */
export function wymaganaProba(p1, p2) {
  const zA = 1.959964;
  const zB = 0.841621;
  const roznica = Math.abs(p2 - p1);
  if (!roznica) return Infinity;
  return Math.ceil(((zA + zB) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (roznica * roznica));
}

export const formatLiczby = (n) =>
  n == null ? '–' : Math.round(n).toLocaleString('pl-PL').replace(/ /g, ' ');

export const formatProcent = (u, miejsca = 1) =>
  u == null ? '–' : `${(u * 100).toFixed(miejsca).replace('.', ',')}%`;

export const formatPozycji = (p) => (p == null ? '–' : p.toFixed(1).replace('.', ','));
