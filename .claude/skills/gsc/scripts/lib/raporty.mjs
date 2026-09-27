// Search Console export → one normalized structure, whatever the report,
// UI language or delivery form (ZIP, loose CSV files, a directory).
//
// Tables are recognised by their COLUMNS first and file names second: file
// names differ per UI language ("Zapytania.csv" / "Queries.csv"), and Google
// has renamed reports before ("Coverage" → "Page indexing"). Columns are
// mapped to stable English keys (query, page, clicks, …) so the analysers
// never branch on language.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, extname } from 'node:path';
import { csvDoObiektow } from './csv.mjs';
import { czytajZip } from './zip.mjs';
import { liczbaCalkowita, liczbaDziesietna, ctrJakoUlamek } from './liczby.mjs';

export const bezOgonkow = (s) =>
  s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Dimension columns: exact (normalised) header → key.
const WYMIARY = new Map([
  ['najczestsze zapytania', 'query'], ['zapytania', 'query'], ['zapytanie', 'query'],
  ['top queries', 'query'], ['queries', 'query'], ['query', 'query'],
  ['najpopularniejsze strony', 'page'], ['top pages', 'page'], ['page', 'page'],
  ['strona', 'page'], ['adres url', 'page'], ['url', 'page'], ['adres', 'page'],
  ['kraj', 'country'], ['kraje', 'country'], ['country', 'country'], ['countries', 'country'],
  ['urzadzenie', 'device'], ['urzadzenia', 'device'], ['device', 'device'], ['devices', 'device'],
  ['wyglad w wynikach wyszukiwania', 'appearance'], ['wyglad w wyszukiwarce', 'appearance'],
  ['search appearance', 'appearance'],
  ['data', 'date'], ['date', 'date'], ['dzien', 'date'],
  ['przyczyna', 'reason'], ['reason', 'reason'],
  ['zrodlo', 'source'], ['source', 'source'],
  ['weryfikacja', 'validation'], ['validation', 'validation'],
  ['trend', 'trend'],
  ['problem', 'issue'], ['issue', 'issue'], ['typ problemu', 'issue'],
  ['nazwa elementu', 'itemName'], ['item name', 'itemName'], ['nazwa', 'itemName'],
  ['ostatnie zindeksowanie', 'lastCrawled'], ['ostatnie skanowanie', 'lastCrawled'],
  ['last crawled', 'lastCrawled'], ['last crawl', 'lastCrawled'],
  ['mapa witryny', 'sitemap'], ['sitemap', 'sitemap'], ['mapy witryn', 'sitemap'],
  ['typ', 'type'], ['type', 'type'],
  ['przeslano', 'submitted'], ['submitted', 'submitted'],
  ['ostatni odczyt', 'lastRead'], ['last read', 'lastRead'],
  ['stan', 'status'], ['status', 'status'],
  ['filtr', 'filter'], ['filter', 'filter'], ['wartosc', 'value'], ['value', 'value'],
]);

// Metric columns: matched by CONTAINS, because comparison exports carry the
// period in the header ("Kliknięcia (ostatnie 28 dni)", "Last 28 days Clicks").
const METRYKI = [
  [/klikniec|klikniecia|\bclicks?\b/, 'clicks'],
  [/wyswietlen|\bimpressions?\b/, 'impressions'],
  [/\bctr\b/, 'ctr'],
  [/pozycja|\bposition\b/, 'position'],
  [/^(nie zindeksowano|niezindeksowane|nie zindeksowane|not indexed)/, 'notIndexed'],
  [/^(zindeksowane|zindeksowano|indexed)/, 'indexed'],
  [/^(nieprawidlowe|invalid)/, 'invalid'],
  [/^(prawidlowe|valid)/, 'valid'],
  [/^(wymagajace poprawy|needs? improvement)/, 'needsImprovement'],
  [/^(slabe|poor)/, 'poor'],
  [/^(dobre|good)/, 'good'],
  [/^(elementy|items)$/, 'items'],
  [/^(strony|pages|liczba stron)$/, 'pages'],
  [/^(wykryte strony|discovered pages)/, 'discoveredPages'],
  [/^(wykryte filmy|discovered videos)/, 'discoveredVideos'],
];

const LICZNIKI = new Set(['clicks', 'impressions', 'indexed', 'notIndexed', 'valid', 'invalid',
  'good', 'needsImprovement', 'poor', 'items', 'pages', 'discoveredPages', 'discoveredVideos']);

const POPRZEDNI = /poprzedn|previous|prior|wczesniej|porownan/;

/** Map raw headers to keys. Returns { mapa: {naglowek: klucz}, okresy: {...} }. */
export function mapujKolumny(naglowki) {
  const mapa = {};
  const uzyte = new Set();
  const okresy = {};
  for (const n of naglowki) {
    const norm = bezOgonkow(n);
    if (WYMIARY.has(norm) && !uzyte.has(WYMIARY.get(norm))) {
      const k = WYMIARY.get(norm);
      // "Strony" is a COUNT in the indexing table, never a dimension.
      mapa[n] = k;
      uzyte.add(k);
      continue;
    }
    const m = METRYKI.find(([re]) => re.test(norm));
    if (!m) continue;
    let klucz = m[1];
    if (POPRZEDNI.test(norm) || uzyte.has(klucz)) {
      klucz = `${klucz}_prev`;
      okresy.poprzedni = n;
    } else if (/\d+ (dni|days|miesi|months)|ostatni|last/.test(norm)) {
      okresy.biezacy = n;
    }
    if (uzyte.has(klucz)) continue;
    mapa[n] = klucz;
    uzyte.add(klucz);
  }
  return { mapa, okresy };
}

function normalizujWartosc(klucz, v) {
  const baza = klucz.replace(/_prev$/, '');
  if (LICZNIKI.has(baza)) return liczbaCalkowita(v);
  if (baza === 'ctr') return ctrJakoUlamek(v);
  if (baza === 'position') return liczbaDziesietna(v);
  return v;
}

/** Decide what a table is from its keys (and file name as a tiebreaker). */
export function rolaTabeli(klucze, nazwaPliku = '') {
  const k = new Set(klucze);
  const plik = bezOgonkow(nazwaPliku);
  const ma = (...x) => x.every((y) => k.has(y));
  if (ma('page', 'query')) return 'strona-zapytanie';
  if (ma('query')) return 'zapytania';
  if (ma('filter', 'value')) return 'filtry';
  if (ma('sitemap')) return 'mapy-witryn';
  if (ma('reason')) return 'przyczyny';
  if (ma('issue')) return 'problemy';
  if (ma('date') && (k.has('indexed') || k.has('notIndexed'))) return 'wykres-indeksowania';
  if (ma('date') && (k.has('valid') || k.has('invalid'))) return 'wykres-ulepszen';
  if (ma('date') && (k.has('good') || k.has('poor') || k.has('needsImprovement'))) return 'wykres-cwv';
  if (ma('date') && (k.has('clicks') || k.has('impressions'))) return 'daty';
  if (ma('country')) return 'kraje';
  if (ma('device')) return 'urzadzenia';
  if (ma('appearance')) return 'wyglad';
  if (ma('page') && (k.has('clicks') || k.has('impressions'))) return 'strony';
  if (ma('page')) return 'przyklady';
  if (/wykres|chart/.test(plik)) return 'wykres';
  return 'inna';
}

/** "https___www.bojo.pl_-Events-2026-09-24.zip" → { wlasciwosc, nazwa, data }. */
export function metadaneZNazwyPliku(nazwa) {
  const b = basename(nazwa).replace(/\.(zip|csv)$/i, '');
  // Uploads and downloads often prepend something ("24540718-", "(1) "), so
  // look for the property marker anywhere, not only at the start.
  const m = b.match(/((?:https?___|sc-domain_).*?_)-(.+)-(\d{4}-\d{2}-\d{2})(?:\s*\(\d+\))?$/);
  if (!m) return {};
  const wlasciwosc = m[1]
    .replace(/^sc-domain_/, 'sc-domain:')
    .replace(/^(https?)___/, '$1://')
    .replace(/_$/, m[1].startsWith('sc-domain') ? '' : '/');
  return { wlasciwosc, nazwa: m[2].replace(/-/g, ' '), data: m[3] };
}

// Rich result reports by the English name Google puts in the ZIP file name.
export const ULEPSZENIA = {
  events: { schemat: 'Event', raportPl: 'Wydarzenia', budowniczy: 'eventJsonLd() w frontend/src/lib/structuredData.ts' },
  breadcrumbs: { schemat: 'BreadcrumbList', raportPl: 'Menu nawigacyjne', budowniczy: 'breadcrumbsJsonLd() w frontend/src/lib/structuredData.ts' },
  faq: { schemat: 'FAQPage', raportPl: 'Najczęstsze pytania', budowniczy: 'faqJsonLd() w frontend/src/lib/structuredData.ts', uwaga: 'Google wycofał wyniki rozszerzone FAQ w 2026; raport znika' },
  logos: { schemat: 'Organization', raportPl: 'Logo', budowniczy: 'siteJsonLd() w frontend/src/lib/structuredData.ts' },
  'review snippets': { schemat: 'Review/AggregateRating', raportPl: 'Fragmenty opinii', budowniczy: 'brak w Bojo' },
  'software apps': { schemat: 'SoftwareApplication', raportPl: 'Aplikacje', budowniczy: 'siteJsonLd() w frontend/src/lib/structuredData.ts' },
};

/**
 * Parse a rich-result issue title into a property path.
 * „Brakujące pole „availability” (w „offers”)” → { rodzaj: 'brak-pola', sciezka: 'offers.availability' }
 */
export function parsujProblem(tekst) {
  const t = tekst.trim();
  const cytaty = [...t.matchAll(/[„"“”']([^„"“”']+)[„"“”']/g)].map((m) => m[1]);
  const n = bezOgonkow(t);
  let rodzaj = 'inny';
  if (/brakujace pole|missing field/.test(n)) rodzaj = 'brak-pola';
  else if (/nieprawidlowy typ obiektu|invalid object type/.test(n)) rodzaj = 'nieprawidlowy-typ';
  else if (/nieprawidlowa wartosc|invalid value|nieprawidlowy format|invalid (date|datetime|url|enum)/.test(n)) rodzaj = 'nieprawidlowa-wartosc';
  else if (/blad analizy|parsing error|nieprawidlowy json|unparsable/.test(n)) rodzaj = 'blad-skladni';
  else if (/should be specified|nalezy podac|trzeba podac/.test(n)) rodzaj = 'brak-pola';
  const [pole, rodzic] = cytaty;
  const sciezka = pole ? (rodzic ? `${rodzic}.${pole}` : pole) : null;
  return { rodzaj, pole: pole ?? null, rodzic: rodzic ?? null, sciezka };
}

function wagaZNazwyPliku(nazwa) {
  const n = bezOgonkow(nazwa);
  if (/niekrytyczn|non-critical|non critical|ostrzezen|warning/.test(n)) return 'niekrytyczny';
  if (/krytyczn|critical|bled|error/.test(n)) return 'krytyczny';
  return null;
}

/** Normalize one CSV file into a table description. */
export function tabelaZCsv(nazwaPliku, tekst) {
  const { naglowki, wiersze } = csvDoObiektow(tekst);
  const { mapa, okresy } = mapujKolumny(naglowki);
  const klucze = Object.values(mapa);
  const rola = rolaTabeli(klucze, nazwaPliku);
  const waga = wagaZNazwyPliku(nazwaPliku);
  const znormalizowane = wiersze.map((w) => {
    const o = {};
    for (const [naglowek, klucz] of Object.entries(mapa)) o[klucz] = normalizujWartosc(klucz, w[naglowek]);
    if (rola === 'problemy' || rola === 'przyczyny') {
      if (waga) o.waga = waga;
    }
    if (rola === 'problemy' && o.issue) Object.assign(o, { problem: parsujProblem(o.issue) });
    return o;
  });
  const niezmapowane = naglowki.filter((h) => !(h in mapa));
  return { plik: nazwaPliku, rola, naglowki, mapa, okresy, niezmapowane, wiersze: znormalizowane };
}

function scalTabele(tabele) {
  // Critical + non-critical issue files describe one table split in two.
  const wynik = {};
  for (const t of tabele) {
    const klucz = t.rola;
    if (!wynik[klucz]) { wynik[klucz] = { ...t, pliki: [t.plik] }; continue; }
    wynik[klucz].wiersze.push(...t.wiersze);
    wynik[klucz].pliki.push(t.plik);
  }
  return wynik;
}

/** Decide the overall report type from the set of table roles. */
export function typRaportu(role, meta = {}) {
  const r = new Set(role);
  const nazwa = bezOgonkow(meta.nazwa ?? '');
  if (r.has('problemy') || r.has('wykres-ulepszen')) return 'ulepszenia';
  if (r.has('przyczyny') || r.has('wykres-indeksowania') || /coverage|indexing|indeksow/.test(nazwa)) return 'indeksowanie';
  if (r.has('wykres-cwv') || /web vitals|vitals/.test(nazwa)) return 'cwv';
  if (r.has('mapy-witryn')) return 'mapy-witryn';
  const wydajnosc = ['zapytania', 'strony', 'daty', 'kraje', 'urzadzenia', 'wyglad', 'strona-zapytanie'];
  if (wydajnosc.some((x) => r.has(x))) return 'skutecznosc';
  if (r.has('przyklady')) return 'przyklady';
  return 'nieznany';
}

/** Files from a path: ZIP, single CSV or a directory of CSVs. */
export function wczytajPliki(sciezka) {
  const st = statSync(sciezka);
  if (st.isDirectory()) {
    return readdirSync(sciezka)
      .filter((n) => extname(n).toLowerCase() === '.csv')
      .map((n) => ({ nazwa: n, tekst: readFileSync(join(sciezka, n), 'utf8') }));
  }
  const bufor = readFileSync(sciezka);
  if (bufor.readUInt32LE(0) === 0x04034b50) {
    return czytajZip(bufor)
      .filter((p) => extname(p.nazwa).toLowerCase() === '.csv')
      .map((p) => ({ nazwa: basename(p.nazwa), tekst: p.dane.toString('utf8') }));
  }
  return [{ nazwa: basename(sciezka), tekst: bufor.toString('utf8') }];
}

/** Whole export → normalized report. Accepts several paths (e.g. loose CSVs). */
export function wczytajEksport(sciezki) {
  const lista = Array.isArray(sciezki) ? sciezki : [sciezki];
  const pliki = lista.flatMap((s) => wczytajPliki(s));
  const meta = lista.map((s) => metadaneZNazwyPliku(s)).find((m) => m.nazwa) ?? {};
  const tabele = scalTabele(pliki.map((p) => tabelaZCsv(p.nazwa, p.tekst)));
  const typ = typRaportu(Object.keys(tabele), meta);

  const raport = { typ, ...meta };
  if (typ === 'ulepszenia' && meta.nazwa) {
    const u = ULEPSZENIA[bezOgonkow(meta.nazwa)];
    if (u) Object.assign(raport, u);
  }
  // Performance export without a single click column = the generative-AI
  // report (impressions only, no clicks, no queries: Google, June 2026).
  if (typ === 'skutecznosc' && !Object.values(tabele).some((t) => Object.values(t.mapa).includes('clicks'))) {
    raport.typ = 'ai';
  }
  const filtry = tabele.filtry?.wiersze ?? [];
  if (filtry.length) raport.filtry = Object.fromEntries(filtry.map((f) => [f.filter, f.value]));

  return { zrodlo: lista.map((s) => basename(s)), raport, tabele };
}

/**
 * Series analysis for chart tables: range, last value, extremes and step
 * changes (a day that moves the value by ≥ max(prog, 30% of the day before)).
 */
export function analizaSzeregu(wiersze, klucz, { prog = 10 } = {}) {
  const punkty = wiersze
    .filter((w) => w.date && w[klucz] != null)
    .map((w) => ({ data: w.date, v: w[klucz] }))
    .sort((a, b) => a.data.localeCompare(b.data));
  if (punkty.length === 0) return null;
  let min = punkty[0];
  let max = punkty[0];
  const skoki = [];
  for (let i = 1; i < punkty.length; i++) {
    const p = punkty[i];
    if (p.v < min.v) min = p;
    if (p.v > max.v) max = p;
    const d = p.v - punkty[i - 1].v;
    if (Math.abs(d) >= Math.max(prog, 0.3 * Math.abs(punkty[i - 1].v))) {
      skoki.push({ data: p.data, z: punkty[i - 1].v, na: p.v, zmiana: d });
    }
  }
  const ost = punkty[punkty.length - 1];
  const pierwszyNiezerowy = punkty.find((p) => p.v !== 0) ?? null;
  return { od: punkty[0].data, do: ost.data, dni: punkty.length, ostatnia: ost.v, min, max, skoki, pierwszyNiezerowy };
}
